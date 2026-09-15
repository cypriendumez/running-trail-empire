export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { vmaFrom6min } from "@/lib/running/fitness";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

// ─────────────────────────────────────────────────────────────────────────────
//  ENREGISTRER SA VMA — le résultat du test 6 min.
//
//  Tant qu'aucune VMA n'est MESURÉE, le coach ne prescrit qu'une chose : le test VMA
//  (voir lib/ai/autoCoach → prescrireTestVma). Cette route ferme la boucle : l'athlète
//  fait le test (montre ou téléphone), saisit la distance parcourue en 6 min, et sa VMA
//  est calculée puis enregistrée. Le plan complet est régénéré dans la foulée.
//
//  ⚠️ L'identifiant de l'athlète vient de la SESSION, jamais du corps de la requête — la
//  même règle que /api/coach/generate. Et la VMA est RECALCULÉE côté serveur depuis la
//  distance brute : on ne fait pas confiance à un nombre calculé par le navigateur.
//
//  ⚠️ ÉCRITURE JAMAIS MUETTE : Supabase renvoie ses erreurs, on les lit. Une insertion de
//  baseline qui échoue en silence laisserait l'athlète bloqué sur le test pour toujours,
//  la pastille verte et rien dans le calendrier — le pire des défauts silencieux.
// ─────────────────────────────────────────────────────────────────────────────

// Bornes physiologiques : en dessous de 8 km/h ce n'est pas un test à FOND, au-dessus de
// 30 km/h c'est une saisie erronée (record du monde du 2000 m ≈ 29 km/h de moyenne).
const VMA_MIN = 8, VMA_MAX = 30;

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const admin = createAdminClient();
  // Même lecture que le verrou du coach (autoCoach) et que effectiveVma : la ligne la plus
  // récente de performance_baselines. `vma_kmh` est NOT NULL → une ligne = une VMA mesurée.
  const { data: base } = await admin.from("performance_baselines")
    .select("vma_kmh").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).maybeSingle();
  const vma = Number((base as { vma_kmh?: number } | null)?.vma_kmh) || null;
  return NextResponse.json({ measured: vma != null && vma > 0, vma });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const meters = Number((body as { meters?: unknown }).meters);
  const vmaSaisie = Number((body as { vma_kmh?: unknown }).vma_kmh);
  const maxHr = Number((body as { max_hr?: unknown }).max_hr);
  const restHr = Number((body as { resting_hr?: unknown }).resting_hr);

  // La distance a la priorité (c'est le vrai test) ; la VMA saisie à la main est le repli
  // pour qui connaît déjà sa valeur. On RECALCULE toujours depuis la distance côté serveur.
  const vma = Number.isFinite(meters) && meters > 0
    ? vmaFrom6min(meters)
    : (Number.isFinite(vmaSaisie) && vmaSaisie > 0 ? Math.round(vmaSaisie * 10) / 10 : null);

  if (vma == null || vma < VMA_MIN || vma > VMA_MAX) {
    return NextResponse.json({ error: `VMA hors bornes (${VMA_MIN}–${VMA_MAX} km/h). Vérifie la distance saisie.` }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("performance_baselines").insert({
    user_id: user.id,
    vma_kmh: vma,
    // FC : facultatif à la saisie, mais NOT NULL en base → repli sur des valeurs neutres
    // que le coach affine ensuite depuis les séances observées (coachContext).
    max_hr: Number.isFinite(maxHr) && maxHr >= 140 && maxHr <= 220 ? Math.round(maxHr) : 190,
    resting_hr: Number.isFinite(restHr) && restHr >= 30 && restHr <= 100 ? Math.round(restHr) : 50,
    tested_at: aujourdhui(FUSEAU_DEFAUT),
  });
  if (error) {
    console.error("[api/vma] baseline non enregistrée :", error.message);
    return NextResponse.json({ error: "Enregistrement impossible. Réessaie." }, { status: 500 });
  }

  // Plan complet régénéré tout de suite : le verrou est levé (une VMA existe désormais),
  // autoCoachForUser produit maintenant la vraie semaine au lieu du seul test. Best effort :
  // la VMA est déjà enregistrée, et le cron de nuit rattraperait un échec ici.
  const { data: creds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
    notify: true,
  }).catch(() => { /* le cron rattrapera */ });

  return NextResponse.json({ ok: true, vma });
}
