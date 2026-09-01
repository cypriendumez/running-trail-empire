/**
 * ZONES D'ENTRAÎNEMENT — répartition du temps réellement mesuré par la montre.
 *
 * Sorti du composant pour une raison précise : ce calcul produisait un chiffre FAUX
 * (44 % de facile au lieu de 71 %) et un verdict faux avec lui, sans qu'aucun test ne
 * puisse l'attaquer — une fonction enfermée dans un fichier `.tsx` client n'est pas
 * importable depuis la suite de tests. Ce qui décide d'un verdict affiché à l'athlète
 * doit pouvoir être crash-testé.
 */
import { isRun } from "@/lib/intervals/sport";
import { dansFenetre } from "./fenetre";

export type SeanceZones = {
  date: string;
  sport?: string | null;
  hr_zone_seconds?: number[] | null;
};

// ⚠️ CETTE FONCTION MENTAIT SUR DEUX PLANS, ET LE VERDICT « Trop d'intensité »
//    AVEC ELLE. Constaté sur des données réelles, fenêtre du 20/07 au 31/08/2026 :
//
//    1. Elle rangeait TOUTE une séance dans UNE SEULE zone, d'après sa FC MOYENNE.
//       Un footing de 73 min dont la montre a mesuré 68 min en Z1 était compté
//       73 min en « Tempo », parce que sa FC moyenne tombait dans cette tranche.
//       D'où l'aberration affichée : 10 % du temps de course en endurance facile
//       pour quelqu'un qui court 47 à 89 km par semaine.
//    2. Elle ne filtrait AUCUN sport. Les 1014 min de RANDONNÉE de la fenêtre
//       atterrissaient en « Récupération » — c'est très exactement le « 1014 min »
//       qu'affichait la carte, une donnée de marche présentée comme de la course.
//
//    Résultat : la carte annonçait 44 % de facile et « Trop d'intensité », alors que
//    le temps en zone mesuré par la montre dit 71 % facile / 29 % dur. Le coach, lui,
//    lisait DÉJÀ la bonne donnée (coachContext : Z1-Z2 = facile, Z3+ = intensité) :
//    le tableau de bord contredisait donc le coach sur le même écran.
//
//    On lit désormais `hr_zone_seconds`, c'est-à-dire les seconds réellement passées
//    dans chaque zone par la montre (intervals.icu → `icu_hr_zone_times`). Aucune
//    estimation : quand la donnée manque, la séance est écartée du calcul et le
//    nombre de séances retenues est annoncé sous le graphe.
export function computeHrZones(workouts: SeanceZones[]): { secs: number[]; total: number; seances: number; ecartees: number } {
  const secs = [0, 0, 0, 0, 0];
  let seances = 0, ecartees = 0;
  for (const w of workouts) {
    // Six semaines de CALENDRIER, pas 1008 heures glissantes : voir `fenetre.ts`.
    if (!dansFenetre(w.date, 42)) continue;
    // Les zones de course ne décrivent que la COURSE. Une randonnée de 3 h à faible
    // FC n'est pas du « footing de récupération » : la compter gonfle la part facile
    // et fausse la règle des 80/20, qui ne porte que sur l'entraînement de course.
    if (!isRun(w.sport)) continue;
    const z = Array.isArray(w.hr_zone_seconds) ? w.hr_zone_seconds : null;
    if (!z || !z.some((v) => Number(v) > 0)) { ecartees++; continue; }
    seances++;
    // La montre renvoie plus de tranches (jusqu'à 7) que les 5 bandes affichées :
    // tout ce qui dépasse la VO₂max est agrégé dans la dernière, jamais perdu.
    for (let i = 0; i < z.length; i++) {
      // ⚠️ `Number(x) || 0` NE SUFFIT PAS : il laisse passer Infinity, qui contamine
      //    ensuite le total et fait afficher « Infinity min » à l'athlète. Trouvé par
      //    crash-test. On n'accepte qu'un nombre fini et positif — une durée en secondes
      //    ne peut être ni négative ni infinie.
      const v = Number(z[i]);
      secs[Math.min(i, secs.length - 1)] += Number.isFinite(v) && v > 0 ? v : 0;
    }
  }
  return { secs, total: secs.reduce((a, b) => a + b, 0), seances, ecartees };
}
