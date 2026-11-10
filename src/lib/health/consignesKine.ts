// ─────────────────────────────────────────────────────────────────────────────
//  LES CONSIGNES DE TON KINÉSITHÉRAPEUTE — saisies par le coureur, appliquées par le coach.
//
//  Cyprien, 10/11/2026 (Santé, lot 1) : « cette appli travaille avec mon kiné, pas contre
//  lui ». Pacevo ne décide rien de médical : c'est le PROFESSIONNEL qui fixe le cadre
//  (durée maximale d'une sortie, pas d'intensité, nombre de séances, jusqu'à quelle date),
//  le coureur le recopie, et le plan déterministe s'y tient. Aucune interprétation, aucune
//  valeur inventée : une consigne absente ne contraint rien.
//
//  Stockage : une ligne `notifications` de type `consignes_kine` par coureur (aucun schéma
//  nouveau). `data` = `ConsignesKine`.
// ─────────────────────────────────────────────────────────────────────────────

export const TYPE_CONSIGNES = "consignes_kine";

/** Bornes de saisie : au-delà, ce n'est pas une consigne de reprise, c'est une faute de frappe. */
/** Au moins 15 min : la plus courte séance (échauffement 5 + corps 5 + retour au calme 5) y tient. */
export const DUREE_MIN = 15, DUREE_MAX = 240, SEANCES_MAX = 7;
/** Au moins une sortie : le plan en pose toujours une. Un arrêt complet ne se saisit pas ici. */
export const SEANCES_MIN = 1;
/** Une consigne se pose pour une période : au plus 6 mois, puis on la redemande au professionnel. */
export const PERIODE_MAX_JOURS = 183;

export type ConsignesKine = {
  /** Durée maximale d'une sortie de course, en minutes ; `null` = pas de limite donnée. */
  dureeMaxMin: number | null;
  /** Aucune séance de qualité (seuil, VMA, côtes, allure spécifique). */
  sansIntensite: boolean;
  /** Nombre maximal de sorties de course par semaine ; `null` = pas de limite donnée. */
  seancesMaxSemaine: number | null;
  /** Dernier jour d'application (AAAA-MM-JJ), inclus. */
  jusquAu: string;
  /** Jour de la saisie. */
  majA: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ecartJours = (de: string, a: string) =>
  Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000);
const entierDans = (v: unknown, min: number, max: number): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
};

/**
 * Valide une saisie. Rend les consignes propres, ou le motif du refus (clé i18n de l'écran).
 * Une consigne qui ne contraint RIEN est refusée : elle n'aurait aucun effet sur le plan.
 */
export function validerConsignes(brut: unknown, aujourdhui: string): { ok: true; consignes: ConsignesKine } | { ok: false; motif: string } {
  const b = (brut ?? {}) as Record<string, unknown>;
  const dureeMaxMin = entierDans(b.dureeMaxMin, DUREE_MIN, DUREE_MAX);
  const seancesMaxSemaine = entierDans(b.seancesMaxSemaine, SEANCES_MIN, SEANCES_MAX);
  if (Number.isNaN(dureeMaxMin)) return { ok: false, motif: "duree" };
  if (Number.isNaN(seancesMaxSemaine)) return { ok: false, motif: "seances" };
  const jusquAu = String(b.jusquAu ?? "");
  if (!DATE.test(jusquAu) || Number.isNaN(Date.parse(jusquAu))) return { ok: false, motif: "date" };
  const duree = ecartJours(aujourdhui, jusquAu);
  if (duree < 0 || duree > PERIODE_MAX_JOURS) return { ok: false, motif: "date" };
  const sansIntensite = b.sansIntensite === true;
  if (dureeMaxMin == null && seancesMaxSemaine == null && !sansIntensite) return { ok: false, motif: "vide" };
  return { ok: true, consignes: { dureeMaxMin, sansIntensite, seancesMaxSemaine, jusquAu, majA: aujourdhui } };
}

/** Les consignes encore en vigueur aujourd'hui ; `null` si aucune, expirée ou illisible. */
export function consignesEnVigueur(brut: unknown, aujourdhui: string): ConsignesKine | null {
  const c = brut as Partial<ConsignesKine> | null;
  if (!c || typeof c.jusquAu !== "string" || !DATE.test(c.jusquAu)) return null;
  if (ecartJours(aujourdhui, c.jusquAu) < 0) return null;
  const dureeMaxMin = typeof c.dureeMaxMin === "number" && c.dureeMaxMin >= DUREE_MIN ? c.dureeMaxMin : null;
  const seancesMaxSemaine = typeof c.seancesMaxSemaine === "number" && c.seancesMaxSemaine >= SEANCES_MIN ? c.seancesMaxSemaine : null;
  const sansIntensite = c.sansIntensite === true;
  if (dureeMaxMin == null && seancesMaxSemaine == null && !sansIntensite) return null;
  return { dureeMaxMin, sansIntensite, seancesMaxSemaine, jusquAu: c.jusquAu, majA: String(c.majA ?? "") };
}

/**
 * La distance que tient une durée maximale à l'allure facile (« 4'53 » ou « 4:53 » par km).
 * `null` si l'allure est inconnue : on ne devine pas une distance.
 */
export function kmPourDuree(dureeMin: number, allureFacile: string | null | undefined): number | null {
  const m = String(allureFacile ?? "").match(/(\d+)['’:](\d{1,2})/);
  if (!m) return null;
  const secKm = Number(m[1]) * 60 + Number(m[2]);
  if (!(secKm > 0)) return null;
  return Math.floor(((dureeMin * 60) / secKm) * 10) / 10;
}
