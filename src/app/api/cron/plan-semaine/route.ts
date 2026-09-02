export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
/**
 * GET /api/cron/plan-semaine — le récapitulatif du lundi matin.
 *
 * Appelé par `.github/workflows/*` le lundi à 06 h 30 UTC, en même temps que le résumé
 * d'actualité. Il remplace le « Plan de la semaine » qu'intervals.icu envoyait de son
 * côté (notification `PLAN_FOR_WEEK`, retirée du compte le 24/08/2026).
 *
 * ⚠️ IL REFUSE DE S'EXÉCUTER UN AUTRE JOUR. Le déclencheur est déjà hebdomadaire, mais
 * la route est publique-par-secret : un appel manuel un jeudi enverrait à TOUS les
 * athlètes un « voici ta semaine » au milieu de leur semaine. `?force=1` lève la garde
 * pour pouvoir tester, et l'exception est explicite dans la réponse.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPlanSemaineEmail } from "@/lib/notify/planSemaine";

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  // Essai à blanc : tout le chemin, aucun courriel. Voir `sendPlanSemaineEmail`.
  const blanc = url.searchParams.get("blanc") === "1";
  const now = new Date();
  // 1 = lundi. `getUTCDay` et non `getDay` : le serveur tourne aux États-Unis (région
  // iad1), où il est encore dimanche soir quand l'Europe est lundi matin.
  if (now.getUTCDay() !== 1 && !force) {
    return NextResponse.json({ ok: true, skipped: "ce n'est pas lundi", jour: now.getUTCDay() });
  }

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles").select("id").eq("onboarding_completed", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Le lundi de la semaine qui commence. Un appel forcé un autre jour part du lundi
  // PRÉCÉDENT, pour que le tableau corresponde à la semaine en cours.
  const lundi = new Date(now);
  lundi.setUTCDate(lundi.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const dateLundi = lundi.toISOString().slice(0, 10);

  const resultats: { userId: string; sent: boolean; skipped?: string }[] = [];
  for (const p of profiles ?? []) {
    const r = await sendPlanSemaineEmail(admin, { userId: p.id as string, lundi: dateLundi, blanc })
      .catch((e) => ({ sent: false, skipped: String((e as Error).message) }));
    resultats.push({ userId: p.id as string, ...r });
  }

  const envoyes = resultats.filter((r) => r.sent).length;
  return NextResponse.json({ ok: true, blanc, lundi: dateLundi, athletes: resultats.length, envoyes, resultats });
}
