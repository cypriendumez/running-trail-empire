// ─────────────────────────────────────────────────────────────────────────────
//  LES REFUS D'ÉCRITURE DE LA SYNCHRO, LÀ OÙ ON LES LIT : `error_logs` (/admin › Bugs).
//
//  `syncIntervalsForUser` rend `failures` : chaque séance, VFC ou nuit que la base a
//  refusée, avec son code et son message. Ses deux appelants serveur — le webhook
//  intervals.icu et le balayage du cron — ne lisaient que `synced` et `error` : le refus,
//  consigné avec soin dans la synchro, n'arrivait nulle part. C'est le motif des
//  « écritures muettes » (tests/ecritures.test.ts), un étage plus haut.
//
//  ⚠️ UNE LIGNE PAR CAUSE, PAS PAR JOUR. Onze jours de VFC refusés pour la même raison sont
//  UN défaut : le panneau regroupe sur le message, qui ne porte donc que la cause (ce
//  qu'a répondu la base) ; les jours et les séances touchés vont dans `meta`.
//
//  ⚠️ UN JOUR SANS MONTRE NE DOIT RIEN PRODUIRE ICI. Mesuré le 12/10/2026 sur le seul compte
//  réel, 28 jours rejoués contre la vraie base sans rien y écrire : tant que la synchro
//  écrivait les jours à `hrv: null`, 17 passages du cron sur 27 auraient journalisé un
//  refus (23502 sur `hrv_ms`, 23514 sur `total_sleep_min`) ; avec le correctif VFC du même
//  jour (`wellnessRow`, qui n'écrit plus ces jours-là), aucun sur 27. Un journal qui crie
//  à chaque passage cesse d'être lu — y compris le jour où il a raison.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { estErreurTransitoire } from "@/lib/cron/transitoire";

/** Qui synchronisait. La route est écrite dans `url` : c'est elle que le panneau affiche. */
export const ROUTES_SYNCHRO = {
  webhook: "/api/webhooks/intervals",
  cron: "/api/cron/sync-all",
} as const;
export type CanalSynchro = keyof typeof ROUTES_SYNCHRO;

/** Au-delà, `meta` grossit sans rien apprendre de plus ; le total, lui, reste exact. */
const EXEMPLES_MAX = 20;

/** Un code rendu PAR LA BASE : SQLSTATE (23502, 22P02, P0001, XX000…) ou PostgREST (PGRST204…).
 *  Pas « cinq majuscules » : `EPIPE`, une coupure réseau, en a cinq aussi. */
const CODE_BASE = /^(?:\d[0-9A-Z]{4}|P0\d{3}|XX\d{3}|PGRST\d{3})$/;

/**
 * Ce qui a été refusé, et pourquoi, depuis une ligne de `failures` :
 *   « 2026-10-11 « Footing » : 22P02 invalid input… » → séance
 *   « VFC du 2026-10-11 : 23502 null value… »          → VFC
 *   « sommeil du 2026-10-11 : 23514 new row… »         → sommeil
 * La cause commence par le code (« ? » quand l'erreur n'en avait pas). Une ligne d'un
 * format inconnu n'est jamais perdue : elle devient sa propre cause.
 */
export function causeDuRefus(ligne: string): { quoi: string; code: string; cause: string } {
  const bienEtre = /^(VFC|sommeil) du \S+ : ([\s\S]+)$/.exec(ligne);
  // Le titre d'une séance est GOURMAND : il peut contenir « » : », le message de la base non.
  const seance = bienEtre ? null : /^\d{4}-\d{2}-\d{2} « [\s\S]*» : ([\s\S]+)$/.exec(ligne);
  const quoi = bienEtre ? bienEtre[1] : seance ? "séance" : "écriture";
  const cause = (bienEtre ? bienEtre[2] : seance ? seance[1] : ligne).trim();
  return { quoi, code: cause.split(" ")[0] ?? "", cause };
}

/**
 * Un incident d'infrastructure, que le passage suivant réparera seul en réécrivant la même
 * fenêtre ; tout le reste est un refus de la base.
 *
 * ⚠️ JAMAIS SUR LE CODE NI SUR UNE ERREUR QUI EN PORTE UN. `estErreurTransitoire` cherche
 * « 502 », « 503 », « 504 » sans bornes de mot : « 23502 » — la violation de NOT NULL,
 * celle des jours sans montre — y passe pour un « 502 Bad Gateway », et une valeur refusée
 * (« 1502.5 » dans une colonne entière) aussi. Une erreur qui porte un code de la base a
 * été rendue PAR la base : c'est un refus. Seule une erreur sans code (réseau, passerelle)
 * peut être passagère.
 */
export function estPassager(r: { code: string; cause: string }): boolean {
  if (CODE_BASE.test(r.code)) return false;
  return estErreurTransitoire(r.cause);
}

export type BilanRefus = { refus: number; passagers: number };

/**
 * Journalise les refus d'une synchronisation et rend leur compte.
 *
 * Ne lève JAMAIS : le journal d'un refus ne doit pas faire tomber la synchro qui l'a
 * constaté. S'il ne peut pas être écrit, la console est le seul endroit qui reste.
 */
export async function journaliserRefus(
  admin: SupabaseClient,
  o: { userId: string; canal: CanalSynchro; failures?: string[] | null },
): Promise<BilanRefus> {
  const lignes = o.failures ?? [];
  const parCause = new Map<string, { quoi: string; cause: string; lignes: string[] }>();
  let passagers = 0;
  for (const ligne of lignes) {
    const r = causeDuRefus(ligne);
    // Un incident passager est compté, pas journalisé (même règle que lib/cron/transitoire).
    if (estPassager(r)) { passagers++; continue; }
    const cle = `${r.quoi}|${r.cause}`;
    const g = parCause.get(cle) ?? { quoi: r.quoi, cause: r.cause, lignes: [] };
    g.lignes.push(ligne);
    parCause.set(cle, g);
  }
  const bilan = { refus: lignes.length - passagers, passagers };
  if (passagers) console.warn(`[synchro/${o.canal}] ${passagers} écriture(s) en échec passager — reprises au passage suivant`);
  if (!parCause.size) return bilan;

  try {
    const { error } = await admin.from("error_logs").insert([...parCause.values()].map((g) => ({
      user_id: o.userId,
      source: "synchro",
      message: `Écriture refusée à la synchro (${g.quoi}) : ${g.cause}`.slice(0, 2000),
      url: ROUTES_SYNCHRO[o.canal],
      meta: { canal: o.canal, total: g.lignes.length, refus: g.lignes.slice(0, EXEMPLES_MAX) },
    })));
    if (error) console.error(`[synchro/${o.canal}] journal non écrit :`, error.message, "—", lignes.slice(0, 3).join(" | "));
  } catch (e) {
    console.error(`[synchro/${o.canal}] journal non écrit :`, e instanceof Error ? e.message : String(e));
  }
  return bilan;
}
