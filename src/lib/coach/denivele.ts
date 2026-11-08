/**
 * LE DÉNIVELÉ DÉCLARÉ À L'INSCRIPTION, BRANCHÉ SUR LE PLAN.
 *
 * ⚠️ JUSQU'AU 11/10/2026, LA QUESTION ÉTAIT UNE PROMESSE NON TENUE. « Et le dénivelé ? »
 * annonçait « Détermine la place des côtes et du D+ dans tes semaines », mais le moteur du
 * plan (`autoPlan`) ne la lisait pas : seule la relecture IA du Premium la voyait, et elle
 * ne peut pas changer une séance. Un coureur qui évite les côtes en recevait selon son
 * objectif ; un spécialiste du D+ n'en recevait pas s'il visait un 10 km.
 *
 * La préférence agit sur le MENU des séances de qualité, avant que le facteur limitant et
 * la phase (approche de la course) ne le réordonnent : l'objectif de course garde le
 * dernier mot. La séance de côtes a le type « VMA » (même zone d'effort, moins d'impact) :
 * elle remplace la VMA, elle ne s'ajoute pas — le budget de séances dures ne bouge pas.
 */
export type PreferenceDenivele = "evite" | "modere" | "aime" | "specialiste";

const VALEURS: readonly PreferenceDenivele[] = ["evite", "modere", "aime", "specialiste"];

/** Lit la colonne `profiles.elevation_pref` ; toute autre valeur = pas de préférence. */
export function preferenceDenivele(v: unknown): PreferenceDenivele | null {
  return typeof v === "string" && (VALEURS as readonly string[]).includes(v) ? (v as PreferenceDenivele) : null;
}

/**
 * Le menu des séances de qualité, réordonné selon la préférence de dénivelé.
 *
 * - `evite` : pas de côtes — sauf si l'objectif en exige (trail, ultra), et alors APRÈS
 *   les autres séances : on l'introduit, on ne commence pas par là.
 * - `modere` : une semaine sur deux, les côtes prennent la place de la VMA (hors trail,
 *   où elles sont déjà en tête de menu).
 * - `aime` : les côtes remplacent la VMA chaque semaine.
 * - `specialiste` : les côtes en tête chaque semaine, quel que soit l'objectif.
 *
 * Fonction pure : ne modifie pas le tableau reçu.
 */
export function menuSelonDenivele<T>(
  menu: readonly T[],
  seances: { vma: T; cote: T },
  pref: PreferenceDenivele | null,
  o: { objectifDenivele: boolean; semainePaire: boolean },
): T[] {
  const { vma, cote } = seances;
  const sans = (x: T) => menu.filter((m) => m !== x);
  const remplacerVma = (): T[] => {
    if (menu.includes(cote)) return [...menu];
    const i = menu.indexOf(vma);
    return i < 0 ? [...menu] : menu.map((m, k) => (k === i ? cote : m));
  };
  switch (pref) {
    case "evite":
      // Objectif sans D+ : aucune séance de côtes. Objectif trail : les côtes passent en dernier.
      return o.objectifDenivele ? (menu.includes(cote) ? [...sans(cote), cote] : [...menu]) : sans(cote);
    case "modere":
      return !o.objectifDenivele && o.semainePaire ? remplacerVma() : [...menu];
    case "aime":
      return o.objectifDenivele ? [...menu] : remplacerVma();
    case "specialiste": {
      const avec = remplacerVma();
      return avec.includes(cote) ? [cote, ...avec.filter((m) => m !== cote)] : avec;
    }
    default:
      return [...menu];
  }
}
