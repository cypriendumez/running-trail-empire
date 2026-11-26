/**
 * CE QUE PÈSE UNE SÉANCE, EN KILOMÈTRES, À L'ALLURE DU COUREUR.
 *
 * Deux grandeurs que le plan (`lib/ai/autoPlan`) et le contexte du coach (`lib/ai/coachContext`)
 * doivent lire AU MÊME ENDROIT : le coût d'une séance de qualité et le plus petit footing. Le plan
 * s'en sert pour compter ses séances ; le contexte, pour décider qu'une semaine de reprise est trop
 * petite pour porter une séance dure ET un footing (`semaineTropPetitePourQualite`). Deux copies du
 * calcul, et le motif annonçait une semaine que le plan ne posait pas.
 *
 * Module pur : aucune donnée, aucun secret, importable partout.
 */

/** Coût d'une séance de qualité quand l'allure facile est inconnue (échauffement et retour au calme compris). */
export const COUT_QUALITE_KM_DEFAUT = 11;
/** Le plus petit footing, en kilomètres, quelle que soit l'allure. */
export const FOOTING_MIN_KM = 4;
/** Le plus petit footing, en minutes : en dessous, ce n'est plus une séance. */
export const FOOTING_MIN_MINUTES = 25;
/** Minutes de corps comptées pour une séance de qualité. */
const CORPS_QUALITE_MINUTES = 25;

/**
 * Coût kilométrique d'une séance de qualité : échauffement + retour au calme + 25 minutes de corps,
 * à l'allure facile du coureur (« 5'15 »). 5 km au moins ; 11 km quand l'allure est inconnue.
 */
export function coutQualiteKm(easyPace: string | null | undefined, warmMin: number, coolMin: number): number {
  const p = easyPace?.match(/(\d+)['’](\d{2})/);
  if (!p) return COUT_QUALITE_KM_DEFAUT;
  const secPerKm = Number(p[1]) * 60 + Number(p[2]);
  const minutes = warmMin + coolMin + CORPS_QUALITE_MINUTES;
  return Math.max(5, Math.round((minutes * 60 / secPerKm) * 10) / 10);
}

/** Le plus petit footing du coureur : 25 minutes à son allure facile, 4 km au moins ; 4 km quand elle est inconnue. */
export function footingMinKm(easyPace: string | null | undefined): number {
  const m = easyPace?.match(/(\d+)['’:](\d{1,2})/);
  return m ? Math.max(FOOTING_MIN_KM, Math.ceil((FOOTING_MIN_MINUTES * 60) / (Number(m[1]) * 60 + Number(m[2])))) : FOOTING_MIN_KM;
}

/**
 * LA SEMAINE EST-ELLE TROP PETITE POUR PORTER UNE SÉANCE DURE ET UN FOOTING ?
 *
 * Le volume qui reste une fois la sortie longue posée (et ce que le plafond d'un long arrêt lui a
 * retiré, qui ne fait pas de place à une séance dure : `longRunReserveKm`) doit tenir le coût d'une
 * séance de qualité PLUS le plus petit footing. Sinon la séance dure serait l'unique sortie facile
 * de la semaine, ou n'aurait qu'une « sortie longue » à côté : deux sorties exigeantes pour deux
 * sorties (avis du directeur scientifique, 23/11/2026). La sortie longue ne compte pas comme un footing.
 */
export function semaineTropPetitePourQualite(o: SemaineChiffree): boolean {
  return qualitesTenablesAvecFooting(o) < 1;
}

/** Ce que le critère lit d'une semaine : son volume, sa sortie longue, la réserve du long arrêt, l'allure et les minutes du coureur. */
export type SemaineChiffree = {
  targetKm: number; longRunKm: number; reserveKm?: number;
  easyPace: string | null | undefined; warmMin: number; coolMin: number;
};

/**
 * COMBIEN DE SÉANCES DE QUALITÉ LA SEMAINE PEUT PORTER EN GARDANT UN FOOTING À CÔTÉ (0, 1, 2…).
 * Pendant la marche de sortie d'un long arrêt, deux séances sont permises : une semaine de 30 km dont 9 de sortie
 * longue portait un seuil, une séance spécifique et la sortie longue, sans aucun footing (22 semaines sur 5 500
 * tirées au hasard, 23/11/2026). Le plan compte ses séances sans réserver ce footing (`maxByVolume`, autoPlan) :
 * c'est ce nombre-ci qui borne le budget pendant une reprise.
 */
export function qualitesTenablesAvecFooting(o: SemaineChiffree): number {
  const reste = o.targetKm - o.longRunKm - (o.reserveKm ?? 0);
  return Math.max(0, Math.floor((reste - footingMinKm(o.easyPace)) / coutQualiteKm(o.easyPace, o.warmMin, o.coolMin)));
}
