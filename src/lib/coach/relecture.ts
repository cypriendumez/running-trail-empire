// ─────────────────────────────────────────────────────────────────────────────
//  LE COACH SE RELIT — a-t-il prescrit des allures tenables ?
//
//  Trou le plus grave relevé le 06/09/2026 : le coach vérifiait SI l'athlète avait couru
//  le jour prévu, jamais CE QU'IL AVAIT FAIT. Il pouvait demander 5×1000 m à 3'20 pendant
//  des mois, les voir courus à 3'28, et ne rien en tirer. Un entraîneur ajuste ses
//  allures à partir de l'exécution ; celui-ci prescrivait dans le vide.
//
//  Ce module compare l'allure PRESCRITE à l'allure RÉELLEMENT tenue, et n'agit que
//  lorsque l'écart est à la fois net et régulier.
//
//  ⚠️ CE QU'IL NE PEUT PAS SAVOIR, ET QUI COMMANDE TOUTE LA PRUDENCE : sans ressenti
//  post-séance (aucun enregistré sur le compte de référence), un écart ne dit pas SI la
//  cible était trop rapide ou si la séance a été mal exécutée — vent, fatigue, terrain,
//  arrêt à un feu. On corrige donc de la MOITIÉ de l'écart constaté, jamais de sa
//  totalité, et on plafonne. Une correction trop zélée créerait une spirale : cible plus
//  lente → allure plus lente → cible encore plus lente.
//
//  L'allure retenue est l'allure AJUSTÉE AU DÉNIVELÉ (GAP) quand la montre la fournit :
//  sans elle, une semaine en côtes passerait pour une baisse de forme.
// ─────────────────────────────────────────────────────────────────────────────

export type SeanceRealisee = {
  /** Allure réellement tenue, en secondes par kilomètre (GAP de préférence). */
  allureSecKm: number;
  /** Allure prescrite ce jour-là, en secondes par kilomètre. */
  cibleSecKm: number;
};

/** Sous ce nombre de séances comparables, un écart n'est qu'une anecdote. */
export const SEANCES_MIN = 8;
/** En deçà, l'écart se confond avec le bruit d'une montre et d'un parcours. */
export const ECART_MIN_SEC = 10;
/** Part de l'écart effectivement corrigée. Voir l'avertissement en tête de module. */
export const PART_CORRIGEE = 0.5;
/** Une correction ne déplace jamais une allure de plus de ça. */
export const CORRECTION_MAX_PCT = 0.08;

export type Relecture = {
  seances: number;
  /** Écart médian, en s/km. Positif = l'athlète court PLUS LENTEMENT que prescrit. */
  ecartMedianSec: number;
  /** Le même, en part de la cible. */
  ecartPct: number;
  /** Dispersion (écart interquartile) : large = exécution irrégulière, pas cible fausse. */
  dispersionSec: number;
  /** Correction à appliquer aux prochaines allures, en s/km. 0 = ne rien changer. */
  correctionSec: number;
  /** Pourquoi on n'agit pas, quand on n'agit pas. */
  motifInaction: "aucun" | "trop_peu_de_seances" | "ecart_negligeable" | "execution_irreguliere";
};

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const quantile = (tri: number[], q: number) => tri[Math.min(tri.length - 1, Math.floor(tri.length * q))];

/**
 * Relit l'exécution. Rend `null` quand il n'y a rien de comparable — l'absence de
 * verdict est un verdict, et il vaut mieux que d'en inventer un.
 */
export function relireExecution(seances: readonly SeanceRealisee[]): Relecture | null {
  const paires = (seances ?? []).filter(
    (s) => s && fini(s.allureSecKm) && fini(s.cibleSecKm)
      && s.allureSecKm > 120 && s.allureSecKm < 900 && s.cibleSecKm > 120 && s.cibleSecKm < 900,
  );
  if (!paires.length) return null;

  const ecarts = paires.map((s) => s.allureSecKm - s.cibleSecKm).sort((a, b) => a - b);
  const n = ecarts.length;
  const median = n % 2 ? ecarts[(n - 1) / 2] : (ecarts[n / 2 - 1] + ecarts[n / 2]) / 2;
  const dispersion = quantile(ecarts, 0.75) - quantile(ecarts, 0.25);
  const cibleMoyenne = paires.reduce((a, s) => a + s.cibleSecKm, 0) / n;

  const base: Omit<Relecture, "correctionSec" | "motifInaction"> = {
    seances: n,
    ecartMedianSec: Math.round(median),
    ecartPct: Math.round((median / cibleMoyenne) * 1000) / 10,
    dispersionSec: Math.round(dispersion),
  };
  const rien = (motif: Relecture["motifInaction"]): Relecture => ({ ...base, correctionSec: 0, motifInaction: motif });

  if (n < SEANCES_MIN) return rien("trop_peu_de_seances");
  if (Math.abs(median) < ECART_MIN_SEC) return rien("ecart_negligeable");
  // ⚠️ Une dispersion plus large que l'écart lui-même signifie que l'athlète est
  // IRRÉGULIER, pas que la cible est fausse. Corriger dans ce cas reviendrait à
  // poursuivre du bruit.
  if (dispersion > Math.abs(median) * 3) return rien("execution_irreguliere");

  const brute = median * PART_CORRIGEE;
  const plafond = cibleMoyenne * CORRECTION_MAX_PCT;
  return {
    ...base,
    correctionSec: Math.round(Math.max(-plafond, Math.min(plafond, brute))),
    motifInaction: "aucun",
  };
}

/** Applique la correction à une allure, en gardant le format « m'ss ». */
export function corrigerAllure(allure: string | null | undefined, correctionSec: number): string | null {
  const m = String(allure ?? "").match(/(\d+)['’:](\d{2})/);
  if (!m || !fini(correctionSec)) return allure ?? null;
  const sec = Number(m[1]) * 60 + Number(m[2]) + Math.round(correctionSec);
  if (!(sec > 120) || !(sec < 900)) return allure ?? null;
  return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, "0")}`;
}
