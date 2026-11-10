// ─────────────────────────────────────────────────────────────────────────────
//  L'ÉCRAN DES DOULEURS — une seule liste, ce qu'elle a changé, et quand consulter.
//
//  Constaté le 10/11/2026 sur l'écran Santé : « Suivi de tes douleurs : aucune douleur
//  déclarée », et juste en dessous une douleur dans « Signalées après tes séances ». Deux
//  listes qui se contredisent : un client ne comprend pas. Ce module réunit les douleurs
//  DÉCLARÉES (schéma corporel) et celles COCHÉES après une séance en une seule liste, dit
//  quand consulter, et met en regard la charge d'entraînement des semaines d'avant.
//
//  Rien ici n'interprète une douleur : on rapporte des dates, des chiffres de charge et ce
//  que l'athlète a déclaré. Pas de diagnostic, pas de cause affirmée.
// ─────────────────────────────────────────────────────────────────────────────
import { isRun } from "@/lib/intervals/sport";

export type DouleurUnifiee = {
  /** Clé stable : clé du schéma corporel (`face:shinL`), ou valeur du ressenti (« Tibia (périoste) »). */
  cle: string;
  source: "declaree" | "seance";
  /** Jours depuis la première fois qu'elle a été signalée (encore comptée). */
  depuisJours: number;
  /** Jours depuis la dernière fois. */
  derniereIlYaJours: number;
  /** Déclarée : l'identifiant de la déclaration la plus récente et son état (actif, mieux, pire). */
  id?: string;
  etat?: string;
  /** Déclarée : intensités (première, dernière) et nombre de déclarations. */
  premier?: number;
  dernier?: number;
  signalements?: number;
  tendance?: string;
};

/** Au-delà, une douleur qui dure appelle un avis professionnel. */
export const JOURS_AVANT_CONSULTER = 10;

/**
 * Faut-il dire « consulte » ? Une douleur qui dure depuis 10 jours ou plus, ou qu'il dit
 * empirer. Ce n'est pas un diagnostic : c'est un délai, et ce que l'athlète déclare.
 */
export function doitConsulter(douleurs: readonly DouleurUnifiee[]): { motif: "duree" | "pire"; cle: string } | null {
  const pire = douleurs.find((d) => d.etat === "pire" || d.tendance === "aggravation");
  if (pire) return { motif: "pire", cle: pire.cle };
  const longue = douleurs.find((d) => d.depuisJours >= JOURS_AVANT_CONSULTER);
  return longue ? { motif: "duree", cle: longue.cle } : null;
}

export type ChargeAvant = {
  /** Kilomètres courus les 14 jours avant le début de la douleur. */
  kmAvant: number;
  /** Les 14 jours d'avant (pour comparer). */
  kmPrecedent: number;
  /** Variation en %, `null` si la période de comparaison est vide (rien à comparer). */
  variationPct: number | null;
};

const jourMoins = (jour: string, n: number) => {
  const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10);
};

/**
 * La charge de course des deux semaines avant le début d'une douleur, face aux deux semaines
 * d'avant. Un FAIT d'entraînement, que le coureur et son kinésithérapeute lisent eux-mêmes.
 * `null` sans aucune séance sur les quatre semaines : on ne dit rien plutôt que « 0 km ».
 */
export function chargeAvantDouleur(seances: readonly { date?: string | null; distance_km?: number | null; sport?: string | null }[], debut: string): ChargeAvant | null {
  const d14 = jourMoins(debut, 14), d28 = jourMoins(debut, 28);
  let kmAvant = 0, kmPrecedent = 0, vues = 0;
  for (const s of seances) {
    const jour = String(s.date ?? "").slice(0, 10);
    const km = Number(s.distance_km);
    if (!jour || !Number.isFinite(km) || km <= 0 || !isRun(s.sport ?? "run")) continue;
    if (jour >= d14 && jour < debut) { kmAvant += km; vues++; }
    else if (jour >= d28 && jour < d14) { kmPrecedent += km; vues++; }
  }
  if (!vues) return null;
  return {
    kmAvant: Math.round(kmAvant),
    kmPrecedent: Math.round(kmPrecedent),
    variationPct: kmPrecedent > 0 ? Math.round((kmAvant / kmPrecedent - 1) * 100) : null,
  };
}
