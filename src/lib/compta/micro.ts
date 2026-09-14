/**
 * MICRO-ENTREPRISE — le chiffre d'affaires prêt à recopier dans la déclaration URSSAF.
 *
 * ⚠️ AUCUN TAUX, AUCUN SEUIL, AUCUNE DATE LÉGALE N'EST ÉCRIT ICI. Le taux de cotisations,
 * la fin de l'ACRE et le plafond de franchise sont SAISIS par l'éditeur (cf. `Reglages`
 * dans `model.ts`) : ils changent chaque année et dépendent d'un statut que l'application
 * ne connaît pas. On ne fait qu'appliquer ce qui est saisi, et on le dit à l'écran.
 *
 * ⚠️ LE CA MICRO = LES RECETTES ENCAISSÉES, par DATE D'OPÉRATION, hors apports personnels
 * (`horsResultat`) et hors lignes annulées. C'est EXACTEMENT la base de `cotisations()` :
 * une seule définition du CA dans toute l'app, jamais deux chiffres qui divergent.
 * (Les remboursements reçus et aides restent inclus comme une entrée ordinaire — à
 * l'éditeur de vérifier leur traitement selon sa situation ; l'écran le rappelle.)
 */
import { type Ecriture, type Reglages, horsResultat, cotisations } from "./model";

export type Periodicite = "mensuel" | "trimestriel";

export type PeriodeDeclaration = {
  /** Clé triable : « 2026-T3 » ou « 2026-09 ». */
  cle: string;
  /** Libellé lisible : « 3ᵉ trimestre 2026 » / « septembre 2026 ». */
  libelle: string;
  debut: string; // AAAA-MM-JJ inclus
  fin: string;   // AAAA-MM-JJ inclus
  caCents: number;
  /** Estimation des cotisations, `null` si un taux nécessaire n'est pas saisi. */
  cotisationsCents: number | null;
  /** Ce qui manque pour totaliser les cotisations de cette période. */
  manquant: string[];
  /** Échéance de déclaration INDICATIVE (dernier jour du mois suivant la fin). */
  echeanceIndicative: string;
  /** La période est-elle close (sa fin est passée) ? Sinon, elle est « en cours ». */
  close: boolean;
  nbEcritures: number;
};

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const TRIM_FR = ["1ᵉʳ trimestre", "2ᵉ trimestre", "3ᵉ trimestre", "4ᵉ trimestre"];

const jour = (iso: string) => String(iso ?? "").slice(0, 10);
const dernierJourDuMois = (annee: number, moisIndex0: number) => new Date(Date.UTC(annee, moisIndex0 + 1, 0)).toISOString().slice(0, 10);

/** Le CA encaissé (recettes non annulées, hors apports) entre deux dates incluses. */
export function caEncaisse(ecritures: Ecriture[], debut: string, fin: string): { caCents: number; nb: number } {
  let caCents = 0, nb = 0;
  for (const e of ecritures) {
    if (e.annulee || e.sens !== "entree" || horsResultat(e)) continue;
    if (e.date >= debut && e.date <= fin) { caCents += e.montantCents; nb++; }
  }
  return { caCents, nb };
}

/**
 * Les périodes de déclaration d'une année, de la plus récente à la plus ancienne.
 *
 * On produit toutes les périodes DÉJÀ COMMENCÉES jusqu'à aujourd'hui (une période close se
 * déclare, la période en cours se prépare) — jamais les périodes futures, qui n'ont pas
 * de CA et n'induiraient qu'un tableau vide.
 */
export function declarationsMicro(
  ecritures: Ecriture[],
  reglages: Reglages,
  annee: number,
  aujourdhui: string,
): PeriodeDeclaration[] {
  const periodicite: Periodicite = reglages.periodiciteUrssaf === "mensuel" ? "mensuel" : "trimestriel";
  const ajd = jour(aujourdhui);
  const out: PeriodeDeclaration[] = [];

  const bornes: { debut: string; fin: string; libelle: string; cle: string }[] = [];
  if (periodicite === "trimestriel") {
    for (let q = 0; q < 4; q++) {
      const debut = `${annee}-${String(q * 3 + 1).padStart(2, "0")}-01`;
      const fin = dernierJourDuMois(annee, q * 3 + 2);
      bornes.push({ debut, fin, libelle: `${TRIM_FR[q]} ${annee}`, cle: `${annee}-T${q + 1}` });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const debut = `${annee}-${String(m + 1).padStart(2, "0")}-01`;
      const fin = dernierJourDuMois(annee, m);
      bornes.push({ debut, fin, libelle: `${MOIS_FR[m]} ${annee}`, cle: `${annee}-${String(m + 1).padStart(2, "0")}` });
    }
  }

  for (const b of bornes) {
    // Période pas encore commencée → on ne l'affiche pas.
    if (b.debut > ajd) continue;
    const { caCents, nb } = caEncaisse(ecritures, b.debut, b.fin);
    const dansPeriode = ecritures.filter((e) => e.date >= b.debut && e.date <= b.fin);
    const cot = cotisations(dansPeriode, reglages);
    const finMois = new Date(`${b.fin}T12:00:00Z`);
    const echeanceIndicative = dernierJourDuMois(finMois.getUTCFullYear(), finMois.getUTCMonth() + 1);
    out.push({
      cle: b.cle, libelle: b.libelle, debut: b.debut, fin: b.fin,
      caCents, cotisationsCents: cot.totalCents, manquant: cot.manquant,
      echeanceIndicative, close: b.fin < ajd, nbEcritures: nb,
    });
  }
  return out.reverse();
}

export type BilanAnnuel = {
  annee: number;
  caCents: number;
  /** Part du plafond de franchise SAISI par l'éditeur (`seuilCA`), en %, ou `null`. */
  partPlafondPct: number | null;
  seuilCents: number | null;
  cotisationsCents: number | null;
};

export function bilanAnnuel(ecritures: Ecriture[], reglages: Reglages, annee: number): BilanAnnuel {
  const { caCents } = caEncaisse(ecritures, `${annee}-01-01`, `${annee}-12-31`);
  const seuilCents = typeof reglages.seuilCA === "number" && reglages.seuilCA > 0 ? Math.round(reglages.seuilCA * 100) : null;
  const dansAnnee = ecritures.filter((e) => e.date >= `${annee}-01-01` && e.date <= `${annee}-12-31`);
  return {
    annee, caCents,
    seuilCents,
    partPlafondPct: seuilCents ? Math.round((caCents / seuilCents) * 100) : null,
    cotisationsCents: cotisations(dansAnnee, reglages).totalCents,
  };
}
