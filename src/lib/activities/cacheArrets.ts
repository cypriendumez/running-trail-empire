// ─────────────────────────────────────────────────────────────────────────────
//  LES ARRÊTS D'UNE SÉANCE, MÉMORISÉS — une trace ne change plus une fois importée.
//
//  Relecture du 10/11/2026 : le coach relisait la trace GPS ENTIÈRE (`activity_tracks.points`,
//  plusieurs milliers de points) de la dernière séance de qualité, jusqu'à 12 jours après,
//  à chaque reconstruction de son contexte — c'est-à-dire à chaque synchro, toutes les
//  deux minutes. Le résultat (quelques arrêts) ne change pas : on le garde en mémoire.
//
//  ⚠️ ON NE MÉMORISE QUE CE QUI EST DÉFINITIF :
//   · des arrêts calculés sur une trace ;
//   · « pas de GPS » (séance sur tapis : `has_gps = false`).
//  Jamais une absence de trace (elle peut être importée à la synchro suivante), jamais une
//  erreur de lecture (passagère), jamais une trace inexploitable (la séance peut recevoir sa
//  distance plus tard). La clé porte la distance et la durée en mouvement : si la séance est
//  corrigée, la vitesse change et le calcul est refait.
//
//  La mémoire vit dans l'instance serveur : un démarrage à froid relit la trace, c'est tout.
// ─────────────────────────────────────────────────────────────────────────────
import type { PausesSeance } from "@/lib/activities/pauses";

/** Au-delà, les plus anciennes entrées partent : la mémoire ne grossit pas sans fin. */
export const CAPACITE_CACHE_ARRETS = 500;

type Entree = { cle: string; valeur: PausesSeance | null };
const memoire = new Map<string, Entree>();

const cleDe = (distanceKm: unknown, dureeSec: unknown) => `${Number(distanceKm) || 0}|${Number(dureeSec) || 0}`;

/** `undefined` : rien de mémorisé pour cette séance (ou mémorisé pour d'autres distance/durée). */
export function arretsMemorises(workoutId: string, distanceKm: unknown, dureeSec: unknown): PausesSeance | null | undefined {
  const e = memoire.get(workoutId);
  return e && e.cle === cleDe(distanceKm, dureeSec) ? e.valeur : undefined;
}

/** À n'appeler qu'avec un résultat DÉFINITIF : des arrêts calculés, ou `null` pour une séance sans GPS. */
export function memoriserArrets(workoutId: string, distanceKm: unknown, dureeSec: unknown, valeur: PausesSeance | null): void {
  memoire.delete(workoutId);
  memoire.set(workoutId, { cle: cleDe(distanceKm, dureeSec), valeur });
  while (memoire.size > CAPACITE_CACHE_ARRETS) memoire.delete(memoire.keys().next().value as string);
}

/** Pour les tests : repartir d'une mémoire vide. */
export function viderCacheArrets(): void { memoire.clear(); }
