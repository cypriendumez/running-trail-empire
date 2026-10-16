export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { compteDeLaCle } from "@/lib/intervals/compteDeLaCle";
import { estJetonOAuth, jetonDe } from "@/lib/intervals/auth";
import { revoquer } from "@/lib/intervals/oauth";

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

  // ⚠️ Un jeton OAuth (« oauth:… ») ne se montre pas, même tronqué : ses quatre premiers
  // caractères seraient toujours « oaut ». L'écran affiche « autorisation intervals.icu ».
  const oauth = estJetonOAuth(profile?.intervals_api_key);
  return NextResponse.json({
    athleteId: profile?.intervals_athlete_id ?? null,
    mode: oauth ? "oauth" : profile?.intervals_api_key ? "cle" : null,
    apiKeyMasked: profile?.intervals_api_key && !oauth
      ? profile.intervals_api_key.slice(0, 4) + "●●●●●●●●●●●●"
      : null,
    hasCredentials: !!(profile?.intervals_athlete_id && profile?.intervals_api_key),
  });
}

// POST — enregistre la clé API ; l'identifiant d'athlète est celui que la clé désigne.
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

  // Une clé remplace une autorisation OAuth : on rend l'autorisation à intervals.icu
  // (au mieux), plutôt que de la laisser ouverte sans plus jamais s'en servir.
  const { data: avant } = await supabase.from("profiles").select("intervals_api_key").eq("id", user.id).single();

  // 2. Save to profile
  const { error } = await supabase
    .from("profiles")
    .update({ intervals_athlete_id: athleteId, intervals_api_key: apiKey })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (estJetonOAuth(avant?.intervals_api_key)) await revoquer(jetonDe(String(avant!.intervals_api_key)));

  // Pas d'alerte à enregistrer ici : intervals.icu n'en offre AUCUNE à une clé API (son
  // `/athlete/{id}/webhooks` répondait 404, vérifié le 06/08/2026). Les alertes sont celles de
  // l'application OAuth, réglées une fois pour toutes sur sa page Manage App
  // (`/api/webhooks/intervals`). Un athlète relié par clé reste servi par le sondage.
  return NextResponse.json({ ok: true, athleteId, nom: compte.nom });
}

// DELETE — remove credentials
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lus avant l'effacement : il faut le jeton pour le rendre à intervals.icu.
  const { data: profile } = await supabase
    .from("profiles")
    .select("intervals_athlete_id, intervals_api_key")
    .eq("id", user.id)
    .single();

  // OAuth : on révoque l'autorisation, ce qui coupe aussi les alertes de l'application.
  if (estJetonOAuth(profile?.intervals_api_key)) {
    await revoquer(jetonDe(String(profile!.intervals_api_key)));
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
