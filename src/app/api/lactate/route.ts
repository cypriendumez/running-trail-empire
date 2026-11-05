export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { validerTestLactate, fmtAllure, TYPE_TEST_LACTATE, type TestLactate } from "@/lib/coach/lactate";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

// ─────────────────────────────────────────────────────────────────────────────
//  ENREGISTRER UN TEST DE LACTATE — les deux seuils mesurés (lib/coach/lactate).
//
//  ⚠️ L'identifiant de l'athlète vient de la SESSION, jamais du corps de la requête, et
//  le test est CONTRÔLÉ côté serveur (bornes, ordre des seuils, date) : on ne fait pas
//  confiance à ce que le navigateur a vérifié. Rangé dans `notifications` (type
//  `test_lactate`, un par saisie, le plus récent fait foi) : aucune colonne à créer.
//
//  ⚠️ ÉCRITURE JAMAIS MUETTE : Supabase renvoie ses erreurs, on les lit.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ Une route Next n'exporte que ses méthodes et sa configuration : la constante du type
// vit dans lib/coach/lactate (un export de plus ici casse la construction).

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { data, error } = await createAdminClient().from("notifications").select("data")
    .eq("user_id", user.id).eq("type", TYPE_TEST_LACTATE).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
  return NextResponse.json({ test: ((data as { data?: TestLactate } | null)?.data ?? null) });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const verdict = validerTestLactate(body, aujourdhui(FUSEAU_DEFAUT));
  if ("erreur" in verdict) return NextResponse.json({ error: verdict.erreur }, { status: 400 });
  const { test } = verdict;

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: user.id, type: TYPE_TEST_LACTATE, title: "Test de lactate",
    body: `Seuil 1 ${fmtAllure(test.lt1.allureSec)}/km · seuil 2 ${fmtAllure(test.lt2.allureSec)}/km`,
    data: test,
  });
  if (error) {
    console.error("[api/lactate] test non enregistré :", error.message);
    return NextResponse.json({ error: "enregistrement" }, { status: 500 });
  }

  // Les allures changent : plan régénéré tout de suite. Best effort — le test est déjà
  // enregistré, et le cron de nuit rattraperait un échec ici.
  const { data: creds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
    notify: true,
  }).catch(() => { /* le cron rattrapera */ });

  return NextResponse.json({ ok: true, test });
}
