// ─────────────────────────────────────────────────────────────────────────────
//  TROIS FOOTINGS DE SUITE NE PEUVENT PAS ÊTRE LE MÊME FOOTING.
//
//  Constaté le 06/09/2026 sur un plan réel : lundi, mardi et mercredi portaient le même
//  titre, la même distance (~7,65 km) et le même texte. Seule l'allure variait, et
//  seulement parce que la météo changeait. Vu de l'athlète, c'est trois fois la même
//  séance — et il l'a dit.
//
//  Deux corrections, toutes deux SANS toucher au volume de la semaine :
//
//  1. LA DISTANCE VARIE autour de la moyenne. Un entraîneur alterne un footing court et
//     un footing plus soutenu ; la somme est identique, la sollicitation ne l'est pas.
//     La répartition est DÉTERMINISTE (pas de tirage au sort) : un plan qui change à
//     chaque rafraîchissement de page n'est plus un plan.
//
//  2. UN footing par semaine porte des LIGNES DROITES — 5 × 100 m en accélération, avec
//     récupération complète. Coût en fatigue quasi nul, mais c'est ce qui entretient la
//     vitesse et l'économie de foulée quand la semaine n'a aucune séance de qualité,
//     exactement le cas qui a produit trois footings identiques.
// ─────────────────────────────────────────────────────────────────────────────

/** Amplitude de la variation, en fraction de la distance moyenne. */
export const AMPLITUDE = 0.18;

/**
 * Répartit `n` footings autour de `kmMoyen` en gardant la SOMME inchangée.
 *
 * Le motif suit la logique d'un entraîneur : on commence court (les jambes sortent d'une
 * séance ou d'une sortie longue), on allonge, on raccourcit à nouveau avant la suite.
 * Chaque valeur reste dans les bornes de réalisme de l'appelant.
 */
export function repartirFootings(n: number, kmMoyen: number, plancher: number, plafond: number): number[] {
  if (!Number.isFinite(n) || n <= 0) return [];
  if (!Number.isFinite(kmMoyen) || kmMoyen <= 0) return Array.from({ length: n }, () => 0);
  if (n === 1) return [arrondi(borne(kmMoyen, plancher, plafond))];

  // Coefficients centrés sur 1 : leur moyenne vaut exactement 1, donc la somme est
  // conservée avant bornage. -A, +A, 0, -A/2, +A/2, … pour rester varié au-delà de 3.
  const coefs = Array.from({ length: n }, (_, i) => {
    const rang = i % 4;
    const f = rang === 0 ? -1 : rang === 1 ? 1 : rang === 2 ? -0.4 : 0.4;
    return 1 + f * AMPLITUDE;
  });
  const moyenneCoefs = coefs.reduce((a, b) => a + b, 0) / n;
  const brut = coefs.map((c) => (kmMoyen * c) / moyenneCoefs);

  // Bornage, puis redistribution de ce que le bornage a retiré ou ajouté : sans cela,
  // un plafond bas ferait silencieusement fondre le volume de la semaine.
  const borne0 = brut.map((v) => borne(v, plancher, plafond));
  const ecart = brut.reduce((a, b) => a + b, 0) - borne0.reduce((a, b) => a + b, 0);
  if (Math.abs(ecart) > 0.05) {
    const ajustables = borne0.map((v, i) => ({ i, v, marge: ecart > 0 ? plafond - v : v - plancher }))
      .filter((x) => x.marge > 0.05);
    const margeTotale = ajustables.reduce((a, b) => a + b.marge, 0);
    if (margeTotale > 0) {
      for (const a of ajustables) borne0[a.i] += (ecart * a.marge) / margeTotale;
    }
  }
  return borne0.map((v) => arrondi(borne(v, plancher, plafond)));
}

const borne = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Au demi-kilomètre : un footing ne se prescrit pas au mètre près. */
const arrondi = (v: number) => Math.round(v * 2) / 2;

export type Variante = "base" | "lignes" | "progressif";

/**
 * Quelle INTENTION donner à chaque footing de la semaine.
 *
 * ⚠️ Pourquoi ce n'est pas qu'une affaire de distance : les footings sont plafonnés à
 * 85 % de la sortie longue. Avec une sortie longue de 9 km et trois footings visant
 * 7,65 km, le plafond mord sur les trois — aucune variation de distance n'est possible.
 * Constaté sur un plan réel, et c'est justement celui que l'athlète a trouvé répétitif.
 * On fait donc varier ce qu'on lui demande de FAIRE, à distance égale :
 *
 *   • base       — footing tranquille, l'allure conversationnelle du début à la fin ;
 *   • lignes     — 5 × 100 m en accélération à la fin : entretient la vitesse pour un
 *                  coût en fatigue quasi nul, décisif une semaine sans qualité ;
 *   • progressif — dernier tiers un peu plus rapide : apprend à finir fort, sans
 *                  jamais toucher au seuil.
 *
 * Rien de tout cela en affûtage, en semaine de course, ou sans historique : on
 * n'ajoute pas d'intensité, même minime, quand l'objectif est de garder du jus ou
 * qu'on ne connaît pas l'athlète.
 */
export function varianteFooting(rang: number, total: number, o: { taper?: boolean; semaineCourse?: boolean; sansHistorique?: boolean }): Variante {
  if (o.taper || o.semaineCourse || o.sansHistorique) return "base";
  if (!Number.isFinite(rang) || !Number.isFinite(total) || total < 2 || rang < 0) return "base";
  // Le PREMIER footing reste neutre : il suit souvent une séance dure ou une sortie
  // longue, et des accélérations sur des jambes chargées n'apportent rien de bon.
  if (rang === 1) return "lignes";
  if (rang === 2 && total >= 3) return "progressif";
  return "base";
}
