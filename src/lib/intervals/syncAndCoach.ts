// ─────────────────────────────────────────────────────────────────────────────
//  CHAÎNE UNIQUE : synchronisation → analyses → traces → replanification → montre.
//
//  Elle existait en DEUX exemplaires qui ne faisaient pas la même chose :
//
//    • /api/intervals/sync (navigateur) : importait les traces GPS, et protégeait la
//      replanification par un garde-fou de 10 min.
//    • /api/cron/sync-all (serveur)     : n'importait AUCUNE trace, et republiait sans
//      aucun garde-fou.
//
//  Conséquence, invisible tant que le cron ne passait qu'une fois par nuit : un athlète
//  qui n'ouvre jamais l'application n'avait jamais de trace GPS — donc ni survol, ni
//  carte de chaleur, ni appariement de segments — et rien ne le signalait. En passant
//  le balayage à toutes les 10 minutes, ce même écart aurait produit des dizaines de
//  republications par heure sur le chemin sans garde-fou, chacune poussant cinq séances
//  sur la montre.
//
//  Tout ce qui suit l'écriture des séances vit donc ICI, une fois.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncIntervalsForUser } from "./syncUser";

/** Jamais deux republications à moins de 10 min : chacune réécrit le calendrier ET
 *  pousse cinq séances sur la montre. */
export const REPLAN_MIN_INTERVAL_MS = 10 * 60_000;

/** Traces importées par passage. Borné : une trace manquante ne doit jamais faire
 *  échouer une synchronisation, et le reliquat est repris au passage suivant. */
const TRACKS_PER_PASS = 8;

export type SyncReport = {
  /** Séances RÉELLEMENT nouvelles (les mises à jour ne comptent pas : la synchro
   *  rafraîchit les derniers jours à chaque passage, ce qui produirait un « du neuf »
   *  permanent et ferait republier le plan en boucle). */
  fresh: number;
  replanned: boolean;
  /** Pourquoi on n'a PAS republié — jamais un silence : c'est ce silence qui a masqué
   *  pendant des mois le fait que ce chemin n'enregistrait rien. */
  skipped: "rien de neuf" | "republié il y a moins de 10 min" | "erreur" | null;
  tracks: { imported: number; withoutGps: number; failed: number; remaining: number };
  error?: string;
};

/** Importe les traces GPS manquantes. Best-effort : jamais bloquant. */
export async function importTracksBestEffort(
  admin: SupabaseClient,
  opts: { userId: string; apiKey: string; max?: number },
): Promise<SyncReport["tracks"]> {
  try {
    const { importMissingTracks } = await import("./tracks");
    return await importMissingTracks(admin, { userId: opts.userId, apiKey: opts.apiKey, max: opts.max ?? TRACKS_PER_PASS });
  } catch {
    return { imported: 0, withoutGps: 0, failed: 0, remaining: 0 };
  }
}

/**
 * Republie le plan SI et SEULEMENT SI une séance inédite vient d'arriver, et pas plus
 * d'une fois par tranche de 10 minutes.
 *
 * Le garde-fou lit l'horodatage du dernier passage du coach (`auto_coach_state.at`) :
 * c'est la même source que celle affichée à l'athlète, donc les deux ne peuvent pas
 * diverger.
 */
export async function replanIfFresh(
  admin: SupabaseClient,
  opts: { userId: string; athleteId?: string | null; apiKey?: string | null; fresh: number },
): Promise<{ replanned: boolean; skipped: SyncReport["skipped"] }> {
  if (opts.fresh <= 0) return { replanned: false, skipped: "rien de neuf" };
  try {
    const { data: st } = await admin.from("notifications").select("data")
      .eq("user_id", opts.userId).eq("type", "auto_coach_state").maybeSingle();
    const lastAt = (st?.data as { at?: string } | null)?.at;
    if (lastAt && Date.now() - new Date(lastAt).getTime() <= REPLAN_MIN_INTERVAL_MS) {
      return { replanned: false, skipped: "republié il y a moins de 10 min" };
    }
    const { autoCoachForUser } = await import("@/lib/ai/autoCoach");
    const r = await autoCoachForUser(admin, { userId: opts.userId, athleteId: opts.athleteId, apiKey: opts.apiKey });
    return { replanned: !!r.processed, skipped: r.processed ? null : "erreur" };
  } catch {
    // Le plan sera de toute façon recalculé au passage suivant : on ne fait pas échouer
    // la synchronisation pour une replanification.
    return { replanned: false, skipped: "erreur" };
  }
}

/**
 * Chaîne complète, côté SERVEUR (client admin) : c'est celle du balayage périodique,
 * le seul chemin qui fonctionne quand l'athlète n'ouvre pas l'application.
 */
export async function syncAndCoachForUser(
  admin: SupabaseClient,
  opts: { userId: string; athleteId: string; apiKey: string; days?: number },
): Promise<SyncReport> {
  const { synced, error } = await syncIntervalsForUser(admin, opts);
  if (error) {
    return { fresh: 0, replanned: false, skipped: "erreur", tracks: { imported: 0, withoutGps: 0, failed: 0, remaining: 0 }, error };
  }
  const tracks = await importTracksBestEffort(admin, { userId: opts.userId, apiKey: opts.apiKey });
  const { replanned, skipped } = await replanIfFresh(admin, {
    userId: opts.userId, athleteId: opts.athleteId, apiKey: opts.apiKey, fresh: synced,
  });
  return { fresh: synced, replanned, skipped, tracks };
}

/**
 * Quels athlètes traiter à ce passage.
 *
 * intervals.icu limite le débit à ~200 requêtes : un balayage toutes les 10 minutes ne
 * peut pas réveiller tout le monde à chaque fois dès que la base grossit. On découpe la
 * liste en tranches et on en traite une par passage — SANS curseur en base, donc sans
 * état à corrompre : la tranche se déduit de l'horloge. Tout le monde est vu au moins
 * une fois par heure tant qu'il y a moins de `perPass × 6` athlètes.
 *
 * Trier par identifiant garantit un ordre stable : sans cela, deux passages pourraient
 * traiter deux fois le même athlète et jamais un autre.
 */
export function shardForPass<T extends { id: string }>(
  athletes: T[],
  opts: { perPass: number; everyMinutes: number; now?: number },
): { batch: T[]; shard: number; shards: number } {
  const sorted = [...athletes].sort((a, b) => a.id.localeCompare(b.id));
  const perPass = Math.max(1, opts.perPass);
  const shards = Math.max(1, Math.ceil(sorted.length / perPass));
  const minutes = Math.floor((opts.now ?? Date.now()) / 60_000);
  const shard = Math.floor(minutes / Math.max(1, opts.everyMinutes)) % shards;
  return { batch: sorted.slice(shard * perPass, shard * perPass + perPass), shard, shards };
}
