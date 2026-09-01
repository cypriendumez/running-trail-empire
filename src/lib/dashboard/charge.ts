/**
 * CHARGE D'ENTRAÎNEMENT — modèle de Banister (CTL / ATL / TSB).
 *
 * Sorti du composant pour être crash-testable. Ce calcul annonçait « Forme 54,
 * Fraîcheur −4, charge équilibrée » alors que sur les mêmes séances la réponse est
 * « Forme 46, Fraîcheur −11, surcharge » : un tiers du chiffre venait d'une amorce
 * écrite en dur. Un modèle qui décide d'un verdict d'entraînement doit être attaquable
 * par des tests, pas enfermé dans un composant client.
 */
import { jourLocal, decaleJour, ecartJours } from "@/lib/streak/compute";

export type SeanceCharge = {
  date: string;
  tss?: number | null;
  type?: string | null;
  duration_seconds?: number | null;
};

export type LoadMetrics = { ctl: number; atl: number; tsb: number };

// ⚠️ CE CALCUL AFFICHAIT UN TIERS DE CHIFFRE INVENTÉ.
//    C'est une moyenne mobile exponentielle de constante 42 jours. Elle partait de
//    `ctl = 40`, écrit en dur et commenté « typical starting fitness », puis ne
//    tournait que 42 jours. Or après 42 jours une telle moyenne conserve
//    (1 − 1/42)^42 ≈ 36 % de son amorce : sur ce compte, 14,5 des 53,7 points de
//    « Forme » affichés étaient LE 40 DE DÉPART, pas de l'entraînement.
//
//    Conséquence mesurée le 31/08/2026 : la carte annonçait Forme 54 / Fraîcheur −4
//    et le verdict « Charge équilibrée ». Recalculé sur un an d'historique réel :
//    Forme 46,4 et Fraîcheur −10,8, ce qui sort de la bande « équilibrée ». Le
//    verdict lui-même était donc faux, pas seulement le nombre.
//
//    Corrigé sur les deux plans : amorce à ZÉRO (on ne suppose aucune forme de
//    départ) et mise en route sur tout l'historique fourni — un an, ce qui réduit
//    le poids de l'amorce à (1 − 1/42)^365 ≈ 0,015 %.
//
//    Le TSS d'entrée, lui, vient bien de la montre : présent sur 330 séances sur
//    330 de ce compte. `estimateTSS` ne sert que de repli et son usage est compté,
//    pour pouvoir le DIRE au lieu de le taire.
export function computeLoad(
  workouts: { date: string; tss?: number | null; type?: string | null; duration_seconds?: number | null }[],
): { ctl: number; atl: number; tsb: number; history: LoadMetrics[]; estimees: number } {
  const K_CTL = 42; // jours
  const K_ATL = 7;  // jours

  const tssMap: Record<string, number> = {};
  let estimees = 0;
  let plusAncien = 0;
  // ⚠️ LES JOURS SONT LOCAUX, PAS UTC. En bucketant sur `toISOString()`, la journée
  //    d'entraînement d'un athlète parisien basculait à 02 h du matin : entre minuit
  //    et 2 h, la Fatigue (constante 7 jours) passait de 57 à 49 et le verdict de
  //    charge changeait sous les yeux du lecteur. Voir `fenetre.ts`.
  const aujourdhui = jourLocal();
  for (const w of workouts) {
    const jour = String(w.date).slice(0, 10);
    // ⚠️ `w.tss ?? estimateTSS(w)` NE PROTÉGEAIT PAS DE NaN : l'opérateur `??` ne
    //    rattrape que null et undefined. Un seul TSS corrompu rendait le CTL, l'ATL et
    //    les 42 points de la courbe entièrement NaN — la carte affichait « NaN ».
    //    Trouvé par crash-test. On exige un nombre fini et positif, sinon on estime ;
    //    et une estimation reste comptée pour pouvoir être annoncée.
    // ⚠️ TESTER L'ABSENCE AVANT DE CONVERTIR : `Number(null)` vaut 0, donc une séance
    //    sans charge mesurée passait pour une séance de charge NULLE — pire que de
    //    l'estimer, et sans jamais être comptée comme estimation. Trouvé en mutant
    //    le compteur d'estimations, pas à la lecture.
    const brut = w.tss == null ? Number.NaN : Number(w.tss);
    const mesure = Number.isFinite(brut) && brut >= 0 ? brut : null;
    if (mesure == null) estimees++;
    tssMap[jour] = (tssMap[jour] ?? 0) + (mesure ?? estimateTSS(w));
    const age = ecartJours(jour, aujourdhui);
    if (Number.isFinite(age) && age >= 0) plusAncien = Math.max(plusAncien, age);
  }

  // Aucune forme supposée au départ : ce que la courbe montre doit venir des séances.
  let ctl = 0;
  let atl = 0;
  const history: LoadMetrics[] = [];

  // On remonte aussi loin que l'historique le permet (borné à un an), mais on ne
  // GARDE que les 42 derniers jours dans l'historique tracé : les jours de mise en
  // route ne sont pas des données à montrer, seulement de quoi faire converger.
  const debut = Math.min(365, Math.max(41, plusAncien));
  for (let i = debut; i >= 0; i--) {
    const d = decaleJour(aujourdhui, -i);
    const tss = tssMap[d] ?? 0;
    ctl = ctl + (tss - ctl) / K_CTL;
    atl = atl + (tss - atl) / K_ATL;
    if (i <= 41) history.push({ ctl, atl, tsb: ctl - atl });
  }

  return { ctl, atl, tsb: ctl - atl, history, estimees };
}

/** Repli quand la montre n'a pas fourni de charge. Son usage est COMPTÉ par
 *  `computeLoad` : une estimation qui ne se déclare pas est une donnée inventée. */
export function estimateTSS(w: { duration_seconds?: number | null; type?: string | null }): number {
  const durationHours = (w.duration_seconds ?? 0) / 3600;
  const typeMultiplier: Record<string, number> = {
    easy: 50, tempo: 75, interval: 90, vma: 100,
    long_run: 65, trail: 70, hill_repeat: 85,
    race: 110, recovery: 30, strength: 40,
  };
  // Une durée absente, négative ou corrompue ne produit pas une charge négative :
  // elle ne produit aucune charge.
  const v = Math.round(durationHours * (typeMultiplier[String(w.type ?? "")] ?? 60));
  return Number.isFinite(v) && v > 0 ? v : 0;
}
