export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { compteDeLaCle } from "@/lib/intervals/compteDeLaCle";

const INTERVALS_BASE = "https://intervals.icu/api/v1";

function intervalsAuth(apiKey: string) {
  return "Basic " + Buffer.from(`API_KEY:${apiKey}`).toString("base64");
}

// GET — fetch user's saved credentials (masked)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    athleteId: profile?.intervals_athlete_id ?? null,
    apiKeyMasked: profile?.intervals_api_key
      ? profile.intervals_api_key.slice(0, 4) + "●●●●●●●●●●●●"
      : null,
    hasCredentials: !!(profile?.intervals_athlete_id && profile?.intervals_api_key),
  });
}

// POST — save credentials + auto-register Intervals.icu webhook
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const idSaisi = String(body.athleteId ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();

  if (!apiKey) {
    return NextResponse.json({ error: "La clé API est requise", code: "cle_requise" }, { status: 400 });
  }

  // 1. La clé est vérifiée ET désigne le compte : l'Athlete ID n'est plus à recopier
  //    (questionnaire du 12/10/2026). Celui de la page Sync Montre reste accepté.
  const compte = await compteDeLaCle(apiKey, idSaisi || null);
  if (!compte.ok) {
    return NextResponse.json({ error: compte.message, code: compte.code }, { status: compte.status });
  }
  const athleteId = compte.athleteId;

  // 2. Save to profile
  const { error } = await supabase
    .from("profiles")
    .update({ intervals_athlete_id: athleteId, intervals_api_key: apiKey })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3. Auto-register webhook with Intervals.icu (best effort — don't fail if it doesn't work)
  const webhookResult = await registerWebhook(athleteId, apiKey);

  return NextResponse.json({ ok: true, athleteId, nom: compte.nom, webhook: webhookResult });
}

// DELETE — remove credentials + unregister webhook
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get credentials before deleting to unregister webhook
  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();

  if (profile?.intervals_athlete_id && profile?.intervals_api_key) {
    await unregisterWebhook(profile.intervals_athlete_id, profile.intervals_api_key).catch(() => {});
  }

  /**
   * ⚠️ ENREGISTRER VÉRIFIAIT SON ERREUR (plus haut, 500 si elle échoue) ; EFFACER NON.
   *
   * Ce n'est pas une symétrie de style. L'athlète clique « déconnecter ma montre »,
   * lit une confirmation — et sa CLÉ D'API intervals.icu reste en base. Il a demandé
   * le retrait d'un identifiant et on lui a répondu que c'était fait. Une suppression
   * de données personnelles ne peut pas se déclarer réussie sans l'être.
   */
  const { error } = await supabase
    .from("profiles")
    .update({ intervals_athlete_id: null, intervals_api_key: null })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: "Déconnexion impossible, tes identifiants sont toujours enregistrés" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ── Webhook helpers ──────────────────────────────────────────────────────────

// ⚠️ intervals.icu N'EXPOSE PAS d'API d'enregistrement de webhook pour l'authentification
// par clé API : `GET/POST /athlete/{id}/webhooks` répond 404 (vérifié le 6 août 2026, alors
// que /activities répond 200 avec les mêmes identifiants). Cette fonction a donc TOUJOURS
// échoué silencieusement. La fraîcheur des données est assurée autrement : le composant
// AutoSync appelle /api/intervals/sync au chargement, au retour sur l'onglet et toutes les
// 2 min, et cette route republie le plan dès qu'une séance INÉDITE est importée.
// On conserve la tentative (sans coût) au cas où l'API évoluerait, mais sans rien promettre.
async function registerWebhook(athleteId: string, apiKey: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.WEBHOOK_SECRET;

  if (!appUrl || !secret || appUrl.includes("localhost")) {
    return "skipped (dev environment)";
  }

  const webhookUrl = `${appUrl}/api/webhooks/intervals?secret=${secret}`;

  try {
    // List existing webhooks first
    const listRes = await fetch(`${INTERVALS_BASE}/athlete/${athleteId}/webhooks`, {
      headers: { Authorization: intervalsAuth(apiKey) },
    });

    if (listRes.ok) {
      const existing: { id: number; url: string }[] = await listRes.json();
      // Delete old webhook for our domain if any
      for (const wh of existing) {
        if (wh.url?.includes(new URL(appUrl).hostname)) {
          await fetch(`${INTERVALS_BASE}/athlete/${athleteId}/webhooks/${wh.id}`, {
            method: "DELETE",
            headers: { Authorization: intervalsAuth(apiKey) },
          });
        }
      }
    }

    // Register new webhook
    const createRes = await fetch(`${INTERVALS_BASE}/athlete/${athleteId}/webhooks`, {
      method: "POST",
      headers: {
        Authorization: intervalsAuth(apiKey),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: webhookUrl }),
    });

    if (createRes.ok) return "registered";
    const err = await createRes.text();
    console.warn("[credentials] Webhook registration failed:", createRes.status, err);
    return `failed (${createRes.status})`;
  } catch (err) {
    console.warn("[credentials] Webhook registration error:", err);
    return "error";
  }
}

async function unregisterWebhook(athleteId: string, apiKey: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || appUrl.includes("localhost")) return;

  const listRes = await fetch(`${INTERVALS_BASE}/athlete/${athleteId}/webhooks`, {
    headers: { Authorization: intervalsAuth(apiKey) },
  });
  if (!listRes.ok) return;

  const existing: { id: number; url: string }[] = await listRes.json();
  for (const wh of existing) {
    if (wh.url?.includes(new URL(appUrl).hostname)) {
      await fetch(`${INTERVALS_BASE}/athlete/${athleteId}/webhooks/${wh.id}`, {
        method: "DELETE",
        headers: { Authorization: intervalsAuth(apiKey) },
      });
    }
  }
}
