export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAndCoachForUser, shardForPass } from "@/lib/intervals/syncAndCoach";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s timeout (Vercel hobby = 10s, pro = 60s)

/**
 * GET /api/cron/sync-all — BALAYAGE PÉRIODIQUE, authentifié par CRON_SECRET.
 *
 * C'est le SEUL chemin qui fonctionne quand l'athlète n'ouvre pas l'application.
 * Le sondage côté navigateur (`AutoSync`) ne tourne que tant qu'un onglet est ouvert :
 * un athlète qui termine sa séance à 18 h et ne rouvre pas l'app attendait jusqu'au
 * passage de nuit pour voir son plan et recevoir ses séances sur sa montre.
 *
 * ⚠️ FRÉQUENCE RÉELLE : le commentaire d'origine annonçait « every 30 minutes ». C'était
 * FAUX — `vercel.json` déclarait `0 3 * * *`, soit UNE FOIS PAR JOUR, parce que le plan
 * Vercel Hobby plafonne les tâches planifiées à une exécution quotidienne (vérifié :
 * l'équipe `cyprien-dumez-s-projects` est en `hobby`). La cadence réelle vient donc d'un
 * déclencheur externe (voir .github/workflows/sync-coach.yml) ; le cron Vercel reste en
 * filet de nuit. Ne remets pas une planification infra-journalière dans vercel.json :
 * en Hobby, Vercel la ramène silencieusement à une exécution par jour.
 */
const EVERY_MINUTES = 10;  // cadence du déclencheur externe — sert au découpage en tranches
const PER_PASS = 25;       // athlètes traités par passage (intervals.icu : ~200 requêtes)

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Une activité peut arriver à N'IMPORTE QUELLE heure (séance de nuit, décalage
  // horaire, import différé). On ne filtre donc PAS sur une plage horaire : le seul
  // critère est « cet athlète a des identifiants intervals.icu ».
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, intervals_athlete_id, intervals_api_key")
    .not("intervals_athlete_id", "is", null)
    .not("intervals_api_key", "is", null);

  if (error) {
    console.error("[cron/sync-all] DB error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const eligible = (profiles ?? []).filter((p) => p.intervals_athlete_id && p.intervals_api_key);
  // Tranche déduite de l'horloge : aucun curseur en base, donc aucun état à corrompre.
  const { batch, shard, shards } = shardForPass(eligible, { perPass: PER_PASS, everyMinutes: EVERY_MINUTES });

  const days = 1; // 24 h suffisent pour un balayage fréquent ; le filet de nuit ratisse plus large
  const results: { userId: string; ok: boolean; workouts?: number; coached?: boolean; skipped?: string | null; error?: string }[] = [];

  for (const profile of batch) {
    try {
      // Chaîne PARTAGÉE (lib/intervals/syncAndCoach) : import, analyses, traces GPS,
      // republication sous garde-fou, poussée montre. Ce cron en avait sa propre
      // version, sans les traces et sans garde-fou anti-rafale.
      const r = await syncAndCoachForUser(admin, {
        userId: profile.id,
        athleteId: profile.intervals_athlete_id as string,
        apiKey: profile.intervals_api_key as string,
        days,
      });
      results.push({ userId: profile.id, ok: !r.error, workouts: r.fresh, coached: r.replanned, skipped: r.skipped, error: r.error });
    } catch (err) {
      results.push({ userId: profile.id, ok: false, error: String(err) });
    }
  }

  const total = results.reduce((a, r) => a + (r.workouts ?? 0), 0);
  const coached = results.filter((r) => r.coached).length;
  console.log(`[cron/sync-all] tranche ${shard + 1}/${shards} · ${results.length} athlète(s) · ${total} séance(s) inédite(s) · ${coached} replanification(s)`);
  return NextResponse.json({
    ok: true, shard: shard + 1, shards, eligible: eligible.length,
    users: results.length, total_activities: total, replanned: coached, results,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Le rôle de la séance vient de `lib/intervals/sport` — table UNIQUE. Trois copies
// vivaient ici, dans /api/intervals/sync et dans syncUser, et divergeaient déjà.

// Classe la séance par intensité RÉELLE (FC) + distance + dénivelé → type canonique juste,
// au lieu de tout marquer « easy ». Préserve le trail. enum workouts.type valide.
