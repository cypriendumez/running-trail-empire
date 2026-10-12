/**
 * UNE SÉRIE DE VFC = UNE SEULE MESURE (12/10/2026).
 *
 * `hrv_data` porte deux mesures qui n'ont pas la même échelle :
 *  · la rMSSD (`rmssd`), référence pour suivre la récupération — mesurée la nuit par
 *    Garmin, COROS, Polar, Oura… et par Intervals.icu Companion quand l'option
 *    « Sleeping HRV (rMSSD) » est activée ;
 *  · la SDNN (`sdnn`), ce qu'Intervals.icu Companion envoie PAR DÉFAUT pour une Apple
 *    Watch : la moyenne des relevés ponctuels de la journée, envoyée le lendemain.
 * Les mélanger dans une même série fabrique de faux signaux : si la SDNN de journée d'un
 * athlète tourne autour de 45 ms et sa rMSSD de nuit autour de 70, il « bondit » de 55 %
 * le soir où il active l'option, et le passage inverse ressemble à un effondrement.
 *
 * RÈGLE : chaque athlète est lu dans UNE mesure, choisie sur la fenêtre lue (la rMSSD dès
 * qu'elle suffit à une base, la SDNN sinon, et jamais une mesure qui n'arrive plus), et
 * TOUT — dernière valeur, base, tendance, chute aiguë, état — se calcule dans celle-là.
 *
 * Deux colonnes ne se lisent donc plus en base :
 *  · `hrv_ms` vaut `rmssd ?? sdnn` (elle est NOT NULL) : mélangée par construction ;
 *  · `physiological_state` était tranché sur des seuils ABSOLUS (< 50 ms → récupération,
 *    > 80 → compétition). Sur les 77 mesures de Cyprien (médiane 90 ms), 49 sortaient
 *    « compétition » et 14 des 16 « récupération » dépassaient 50 ms — jusqu'à 106.
 * La série renvoyée RÉÉCRIT ces deux champs : `hrv_ms` = la valeur dans LA mesure de
 * l'athlète, `physiological_state` = sa position face à SA base. Tout ce qui est en aval
 * (`statsVfc`, `computeDiscipline`, `chuteVfc`, les graphiques) lit `hrv_ms` comme avant.
 */
import { BASE_VFC_MIN, FRAICHEUR_JOURS, ecartJours } from "@/lib/coach/recuperation";

export type MetriqueVfc = "rmssd" | "sdnn";
export type EtatVfc = "recovery" | "optimal" | "competition";

/** Les colonnes à lire. JAMAIS `hrv_ms` ni `physiological_state` (voir l'en-tête). */
export const COLONNES_VFC = "date, rmssd, sdnn";

/**
 * La zone normale : ± 6 % autour de la base. C'est la bande que trace la fiche VFC
 * (« Ta zone normale ») et le seuil de l'état du jour du tableau de bord : une seule
 * définition, sinon la carte dirait « dans ta normale » et l'état « récupération ».
 */
export const ZONE_NORMALE_VFC = 0.06;
/** La base : les 14 dernières mesures, comme la carte du tableau de bord (`statsVfc`). */
export const MESURES_BASE_VFC = 14;
/** Sous ce nombre de mesures, pas de base, donc pas d'état : on reste neutre. */
export const BASE_ETAT_MIN = 3;

/** Une ligne telle que lue en base (d'autres colonnes peuvent l'accompagner). */
export type LigneVfcBrute = { date: string; rmssd?: unknown; sdnn?: unknown };
/** Une ligne de la série : `hrv_ms` et `physiological_state` sont ceux de LA mesure. */
export type LigneVfc<T extends LigneVfcBrute = LigneVfcBrute> = T & { hrv_ms: number; physiological_state: EtatVfc };
export type SerieVfc<T extends LigneVfcBrute = LigneVfcBrute> = { metrique: MetriqueVfc | null; lignes: LigneVfc<T>[] };

/** PostgREST rend un `numeric` en nombre, mais une chaîne numérique ne doit pas se perdre. */
const valeur = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
};
const jour = (d: unknown): string => {
  const s = typeof d === "string" ? d.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
};

/**
 * LA mesure de l'athlète sur ces lignes, ou `null` s'il n'en a aucune.
 *
 *  1. Une seule mesure présente : c'est elle.
 *  2. Une mesure qui N'ARRIVE PLUS n'est plus la sienne : si la dernière valeur de l'une
 *     a plus de {@link FRAICHEUR_JOURS} jours de retard sur l'autre, on prend l'autre
 *     (montre plus portée la nuit, option désactivée). La SDNN arrive naturellement un
 *     jour après la rMSSD — un jour d'écart n'est pas un arrêt.
 *  3. La rMSSD dès qu'elle a assez de points pour une base ({@link BASE_VFC_MIN}) : c'est
 *     la meilleure mesure de la récupération. Avant, celle qui a le plus de points.
 */
export function choisirMetrique(lignes: readonly LigneVfcBrute[]): MetriqueVfc | null {
  let nR = 0, nS = 0, dR = "", dS = "";
  for (const l of lignes ?? []) {
    const d = jour(l?.date);
    if (!d) continue;
    if (valeur(l.rmssd) != null) { nR++; if (d > dR) dR = d; }
    if (valeur(l.sdnn) != null) { nS++; if (d > dS) dS = d; }
  }
  if (!nR && !nS) return null;
  if (!nS) return "rmssd";
  if (!nR) return "sdnn";
  const avanceSdnn = ecartJours(dS, dR) ?? 0;
  if (avanceSdnn > FRAICHEUR_JOURS) return "sdnn";
  if (-avanceSdnn > FRAICHEUR_JOURS) return "rmssd";
  if (nR >= BASE_VFC_MIN) return "rmssd";
  return nS > nR ? "sdnn" : "rmssd";
}

/** Position d'une mesure face à SA base : sous la zone normale, dedans, au-dessus. */
export function etatRelatif(mesure: number, base: number): EtatVfc {
  if (!(mesure > 0) || !(base > 0)) return "optimal";
  // En POURCENTAGE, comme la fiche : `94 / 100 − 1` vaut −0,06000000000000005 en flottant
  // et classerait « récupération » une mesure que la fiche dit « dans ta normale ».
  const pct = ((mesure - base) / base) * 100, zone = ZONE_NORMALE_VFC * 100;
  return pct < -zone ? "recovery" : pct > zone ? "competition" : "optimal";
}

/**
 * La série de l'athlète dans SA mesure : seules les lignes qui la portent, de la plus
 * récente à la plus ancienne, `hrv_ms` = sa valeur, `physiological_state` = son état face
 * à la base des {@link MESURES_BASE_VFC} mesures qui s'achèvent sur elle (comme la carte).
 * Les lignes de l'autre mesure sont ÉCARTÉES, jamais converties : il n'existe pas de
 * formule qui passe de l'une à l'autre.
 */
export function serieVfc<T extends LigneVfcBrute>(lignes: readonly T[] | null | undefined): SerieVfc<T> {
  const src = (lignes ?? []).filter((l) => l && jour(l.date));
  const metrique = choisirMetrique(src);
  if (!metrique) return { metrique: null, lignes: [] };
  const pts = src
    .map((l) => ({ l, v: valeur(l[metrique]) }))
    .filter((p): p is { l: T; v: number } => p.v != null)
    .sort((a, b) => jour(b.l.date).localeCompare(jour(a.l.date)));
  const sortie = pts.map((p, i) => {
    const fenetre = pts.slice(i, i + MESURES_BASE_VFC).map((q) => q.v);
    const base = fenetre.length >= BASE_ETAT_MIN ? fenetre.reduce((a, b) => a + b, 0) / fenetre.length : null;
    return { ...p.l, hrv_ms: p.v, physiological_state: base != null ? etatRelatif(p.v, base) : "optimal" } as LigneVfc<T>;
  });
  return { metrique, lignes: sortie };
}

/**
 * Une série PAR athlète, pour les lectures qui couvrent plusieurs comptes (espace coach).
 * Chaque athlète garde sa propre mesure : l'un peut être en rMSSD, l'autre en SDNN.
 */
export function seriesParAthlete<T extends LigneVfcBrute & { user_id: string }>(lignes: readonly T[] | null | undefined) {
  const parAthlete = new Map<string, T[]>();
  for (const l of lignes ?? []) {
    if (!l?.user_id) continue;
    const liste = parAthlete.get(l.user_id) ?? [];
    liste.push(l);
    parAthlete.set(l.user_id, liste);
  }
  const out = new Map<string, SerieVfc<T>>();
  for (const [id, liste] of parAthlete) out.set(id, serieVfc(liste));
  return out;
}

/** Libellé court de la mesure, identique dans toutes les langues. */
export const NOM_METRIQUE: Record<MetriqueVfc, string> = { rmssd: "rMSSD", sdnn: "SDNN" };

/**
 * Ce que le coach (et les assistants) doivent savoir de la mesure qu'ils lisent. La SDNN
 * d'une Apple Watch n'est pas une rMSSD : elle se compare à elle-même, jamais à une norme.
 */
export function precisionMetrique(m: MetriqueVfc | null): string {
  if (m === "sdnn") return "SDNN — moyenne des relevés ponctuels de la journée (cas de l'Apple Watch), arrivée le lendemain : plus bruitée et décalée d'un jour par rapport à une rMSSD nocturne. Elle ne se compare qu'à SA propre base SDNN, à aucune norme ; ne réagis qu'à un écart net ou répété";
  if (m === "rmssd") return "rMSSD";
  return "aucune mesure";
}
