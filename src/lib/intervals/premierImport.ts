/**
 * LE PREMIER IMPORT, SANS BOUTON (09/11/2026).
 *
 * Constaté le soir du 09/11 avec le frère de Cyprien (COROS, compte intervals.icu créé le
 * soir même) : la montre reliée, il arrive sur une liste de séances VIDE et doit appuyer sur
 * « Synchroniser » pour voir son historique. Deux causes :
 *
 *  · la synchronisation automatique (`components/AutoSync`) ne tire que les 3 derniers
 *    jours : c'est un rafraîchissement, pas un import. Rien ne ramenait jamais l'historique ;
 *  · la liste de la page Sync Montre se charge une fois, à l'ouverture : ce qu'AutoSync
 *    importait ensuite n'y apparaissait pas (`router.refresh()` ne relit pas une liste
 *    chargée par le navigateur).
 *
 * Et une troisième, invisible : le plan est construit à la fin du questionnaire, AVANT la
 * montre. La replanification qui suit une séance importée est retenue 10 minutes
 * (`replanIfFresh`) : le premier plan ignorait donc tout l'historique jusqu'à la nuit.
 *
 * Ce module ne contient que les décisions, sans navigateur ni réseau, pour être passé au
 * crible (tests/premier-import.test.ts). `AutoSync` les exécute.
 */

/** Émis sur `window` quand une synchronisation automatique a ramené du neuf : les listes
 *  chargées par le navigateur (page Sync Montre) se relisent. */
export const EVENEMENT_SYNCHRO = "pacevo:synchro";
/** Émis sur `window` quand une montre vient d'être reliée sans rechargement de page (clé
 *  API) : AutoSync avait retenu « pas de montre » pour toute la visite. */
export const EVENEMENT_MONTRE_RELIEE = "pacevo:montre-reliee";
/** Où le navigateur retient l'état du premier import. */
export const CLE_PREMIER_IMPORT = "pacevo_premier_import";

const JOUR_MS = 86_400_000;
/** Les 30 derniers jours d'abord : l'écran se remplit vite, par ce que l'athlète reconnaît.
 *  Puis l'année, par tranches de 90 jours : une année d'un coup dépasse la durée d'une
 *  fonction serveur chez un coureur assidu. */
const BORNES_JOURS = [0, 30, 120, 210, 300, 365] as const;

/**
 * CE QUE RÉPOND LE SERVEUR (`/api/intervals/status` → `premierImport`).
 *
 *  · `true`  : la montre est reliée et AUCUNE séance de montre n'est en base ;
 *  · `false` : pas de montre, ou des séances sont déjà là ;
 *  · `null`  : le compte n'a pas pu être lu. ⚠️ Une panne n'est ni « rien en base » (on
 *    réimporterait une année à chaque panne) ni « tout est là » : on ne sait pas.
 */
export function premierImportDu(configured: boolean, lecture: { count: number | null; error: unknown } | null): boolean | null {
  if (!configured) return false;
  if (!lecture || lecture.error || typeof lecture.count !== "number") return null;
  return lecture.count === 0;
}

export type Tranche = { oldest: string; newest: string };

const jour = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Les périodes à importer, de la plus récente à la plus ancienne.
 *
 * ⚠️ La première va jusqu'à DEMAIN : les dates sont en UTC, et un coureur à l'est de
 * Greenwich est déjà « demain » en fin de soirée. Les bornes sont incluses des deux côtés,
 * donc deux tranches voisines partagent un jour : sans gravité, une séance déjà en base est
 * mise à jour, jamais doublée.
 */
export function tranchesPremierImport(maintenant: number): Tranche[] {
  const t: Tranche[] = [];
  for (let i = 0; i + 1 < BORNES_JOURS.length; i++) {
    t.push({
      oldest: jour(maintenant - BORNES_JOURS[i + 1] * JOUR_MS),
      newest: jour(i === 0 ? maintenant + JOUR_MS : maintenant - BORNES_JOURS[i] * JOUR_MS),
    });
  }
  return t;
}

/**
 * Ce que le navigateur retient. `enCours` : un import a été demandé ou a commencé, et n'est
 * pas allé au bout (onglet fermé, coupure). `essais` : combien de fois de suite on a essayé.
 */
export type Marque = { dernier: number; essais: number; enCours: boolean };

/** La marque lue dans le stockage, ou `null` si elle est absente ou abîmée. */
export function lireMarque(brut: string | null | undefined): Marque | null {
  if (!brut) return null;
  try {
    const m = JSON.parse(brut) as Partial<Marque> | null;
    if (!m || typeof m !== "object") return null;
    const { dernier, essais, enCours } = m;
    if (typeof dernier !== "number" || !Number.isFinite(dernier) || dernier < 0) return null;
    if (typeof essais !== "number" || !Number.isInteger(essais) || essais < 0) return null;
    return { dernier, essais, enCours: enCours === true };
  } catch {
    return null;
  }
}

/** Une montre vient d'être reliée : l'import complet est dû, quoi que la base contienne déjà
 *  (un athlète qui avait importé un GPX a des séances, mais pas son historique). */
export const MARQUE_DEMANDEE: Marque = { dernier: 0, essais: 0, enCours: true };

/** Note dans le navigateur qu'un import complet est dû. Sans stockage (navigation privée
 *  stricte), rien n'est noté : le signal du serveur reste, et le bouton « Synchroniser ». */
export function demanderPremierImport(stockage: Pick<Storage, "setItem"> | null | undefined): void {
  try { stockage?.setItem(CLE_PREMIER_IMPORT, JSON.stringify(MARQUE_DEMANDEE)); } catch { /* stockage refusé */ }
}

/** Tant qu'on n'a rien trouvé, on regarde de nouveau à chaque passage d'AutoSync (2 min)… */
export const ESSAIS_RAPPROCHES = 5;
const PAUSE_COURTE_MS = 100_000;
/** …puis on laisse tranquille un compte sans séance : un vrai débutant n'a rien à importer,
 *  et cinq requêtes à chaque affichage ne lui apporteraient rien. */
export const PAUSE_LONGUE_MS = 6 * 3_600_000;

export type Decision = {
  /** Lancer l'import maintenant. */
  lancer: boolean;
  /** Le dire à l'écran : vrai au premier essai d'une série, faux pour les relances. */
  annoncer: boolean;
};

/**
 * Faut-il importer l'historique maintenant ?
 *
 * @param premierImport ce que dit le serveur (`/api/intervals/status`) : `true` = montre
 *   reliée et AUCUNE séance de montre en base ; `null` = il n'a pas pu le lire. On ne lance
 *   rien sur un « je ne sais pas » — sauf si le navigateur sait qu'un import est dû.
 */
export function decisionPremierImport(premierImport: boolean | null, marque: Marque | null, maintenant: number): Decision {
  const du = premierImport === true || marque?.enCours === true;
  if (!du) return { lancer: false, annoncer: false };
  if (!marque || marque.essais === 0) return { lancer: true, annoncer: true };
  const age = maintenant - marque.dernier;
  // Horloge reculée : la marque date « du futur ». On ne reste pas bloqué dessus.
  if (age < 0) return { lancer: true, annoncer: true };
  if (marque.essais < ESSAIS_RAPPROCHES) return { lancer: age >= PAUSE_COURTE_MS, annoncer: false };
  return { lancer: age >= PAUSE_LONGUE_MS, annoncer: true };
}

/** La marque à écrire AVANT le premier appel : si l'onglet se ferme, l'import reprendra. */
export function marqueAuLancement(marque: Marque | null, maintenant: number): Marque {
  const age = marque ? maintenant - marque.dernier : 0;
  const nouvelleSerie = !marque || age < 0 || (marque.essais >= ESSAIS_RAPPROCHES && age >= PAUSE_LONGUE_MS);
  return { dernier: maintenant, essais: (nouvelleSerie ? 0 : marque.essais) + 1, enCours: true };
}

export type Bilan = {
  /** Toutes les tranches ont répondu. */
  complet: boolean;
  /** Séances écrites en base (insertions et mises à jour). */
  ecrites: number;
};

/**
 * La marque à écrire APRÈS l'import, ou `null` pour l'effacer (tout est là, c'est fini).
 *
 *  · incomplet (coupure, onglet quitté) : `enCours` reste vrai, on reprendra ;
 *  · complet mais rien d'écrit (compte intervals.icu encore vide, ou écritures refusées) :
 *    ce n'est PAS « fini » — on regardera de nouveau, au rythme de `decisionPremierImport`.
 */
export function marqueApres(marque: Marque, bilan: Bilan): Marque | null {
  if (!bilan.complet) return { ...marque, enCours: true };
  if (bilan.ecrites > 0) return null;
  return { ...marque, enCours: false };
}
