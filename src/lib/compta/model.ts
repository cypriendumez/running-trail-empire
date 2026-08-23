/**
 * COMPTABILITÉ — le cœur calculable, sans React et sans base de données.
 *
 * Tout ce qui compte ici tient en une règle : **l'argent se compte en CENTIMES ENTIERS**.
 * Un euro stocké en nombre à virgule finit par produire des totaux qui ne tombent pas
 * juste — 0,1 + 0,2 ne vaut pas 0,3 en binaire — et une comptabilité qui ne tombe pas
 * juste ne sert à rien : c'est précisément ce qu'on lui demande.
 *
 * ⚠️ CE FICHIER NE CONTIENT AUCUN TAUX. Ni cotisations, ni TVA, ni seuil de franchise.
 * Ces valeurs changent chaque année et dépendent d'un statut juridique que l'application
 * ne connaît pas. Les inventer donnerait des chiffres faux qui ont l'air justes — le pire
 * résultat possible pour un outil de comptabilité. L'éditeur saisit SES taux, relevés sur
 * urssaf.fr ou impots.gouv.fr ; l'application ne fait que les appliquer et le rappelle à
 * l'écran.
 */

export type Sens = "entree" | "sortie";

export type Categorie = {
  id: string;
  label: string;
  sens: Sens;
  /** Charge qui revient chaque mois : sert à projeter les frais fixes annuels. */
  recurrenteParDefaut?: boolean;
};

/** Les postes d'un éditeur d'application. Ordre = ordre d'affichage. */
export const CATEGORIES: Categorie[] = [
  // — Entrées —
  { id: "abonnements", label: "Abonnements", sens: "entree" },
  { id: "coaching", label: "Coaching / prestations", sens: "entree" },
  { id: "affiliation", label: "Affiliation", sens: "entree" },
  { id: "partenariats", label: "Partenariats & publicité", sens: "entree" },
  { id: "aides", label: "Aides & subventions", sens: "entree" },
  { id: "remboursements", label: "Remboursements reçus", sens: "entree" },
  { id: "autre_entree", label: "Autre recette", sens: "entree" },
  // — Sorties —
  { id: "hebergement", label: "Hébergement & infrastructure", sens: "sortie", recurrenteParDefaut: true },
  { id: "ia", label: "IA & API", sens: "sortie", recurrenteParDefaut: true },
  { id: "services", label: "Services tiers", sens: "sortie", recurrenteParDefaut: true },
  { id: "domaine", label: "Nom de domaine", sens: "sortie" },
  { id: "logiciels", label: "Logiciels & abonnements", sens: "sortie", recurrenteParDefaut: true },
  { id: "materiel", label: "Matériel", sens: "sortie" },
  { id: "marketing", label: "Marketing & publicité", sens: "sortie" },
  { id: "honoraires", label: "Honoraires (avocat, expert-comptable)", sens: "sortie" },
  { id: "frais_bancaires", label: "Banque & frais de paiement", sens: "sortie" },
  { id: "cotisations", label: "Cotisations sociales", sens: "sortie" },
  { id: "impots", label: "Impôts & taxes", sens: "sortie" },
  { id: "deplacements", label: "Déplacements", sens: "sortie" },
  { id: "autre_sortie", label: "Autre dépense", sens: "sortie" },
];

export const categorieDe = (id: string): Categorie | undefined => CATEGORIES.find((c) => c.id === id);

export const MOYENS = ["Carte", "Virement", "Prélèvement", "Stripe", "Espèces", "Autre"] as const;
export type Moyen = (typeof MOYENS)[number];

export type Ecriture = {
  id: string;
  /** Date de l'OPÉRATION (pas celle de la saisie : elles diffèrent, et c'est la première qui compte). */
  date: string; // AAAA-MM-JJ
  libelle: string;
  sens: Sens;
  categorie: string;
  /** Toujours POSITIF, en centimes. Le sens porte le signe — un montant négatif n'existe pas. */
  montantCents: number;
  moyen: Moyen;
  tiers?: string;
  /** Numéro de facture, de reçu, ou lien : la pièce justificative. */
  piece?: string;
  /** TVA en points de pourcentage (20 = 20 %). Absente si non assujetti. */
  tvaTaux?: number;
  note?: string;
  recurrente?: boolean;
  /** Horodatage d'enregistrement, distinct de `date`. */
  saisieLe?: string;
  /**
   * ⚠️ UNE ÉCRITURE NE S'EFFACE PAS, ELLE S'ANNULE. Un livre de recettes dont on peut
   * retirer une ligne ne prouve plus rien : c'est le principe même d'un journal
   * comptable. L'écriture reste, barrée, avec son motif et sa date d'annulation.
   */
  annulee?: boolean;
  motifAnnulation?: string;
  annuleeLe?: string;
};

export type Reglages = {
  /** Taux de cotisations sociales en %, SAISI PAR L'ÉDITEUR (l'app n'en connaît aucun). */
  tauxCotisations?: number;
  /** Assujetti à la TVA ? Change tout l'affichage. */
  tva?: boolean;
  /** Seuil de chiffre d'affaires à surveiller, en euros, SAISI PAR L'ÉDITEUR. */
  seuilCA?: number;
  /** Solde du compte au démarrage du suivi, en centimes (peut être négatif). */
  soldeInitialCents?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Montants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * « 12,50 » « 12.50 » « 1 234,5 » « 12 » → centimes entiers.
 *
 * ⚠️ Renvoie `null` si la saisie n'est pas un montant, au lieu de 0. Transformer une
 * faute de frappe en zéro fait entrer une ligne à 0 € dans le livre sans que personne
 * ne s'en aperçoive — l'erreur doit se voir à la saisie, pas se découvrir au bilan.
 */
export function enCentimes(saisie: string | number): number | null {
  if (typeof saisie === "number") {
    return Number.isFinite(saisie) ? Math.round(saisie * 100) : null;
  }
  const net = String(saisie).replace(/\s| |€/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(net)) return null;
  return Math.round(parseFloat(net) * 100);
}

/** Centimes → « 1 234,50 € ». Pas de `toLocaleString` : le rendu doit être identique serveur et client. */
export function euros(cents: number, avecSigne = false): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const e = String(Math.floor(abs / 100));
  const c = String(abs % 100).padStart(2, "0");
  const groupe = e.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const signe = neg ? "−" : avecSigne ? "+" : "";
  // Espace fine insécable pour les milliers, insécable avant le symbole : un montant ne
  // doit jamais se couper en fin de ligne.
  return `${signe}${groupe},${c}\u00a0€`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une date qui existe VRAIMENT dans le calendrier.
 *
 * ⚠️ `new Date("2026-02-31")` ne renvoie pas d'erreur : JavaScript reporte au 2 mars. Un
 * 31 février saisi par erreur était donc accepté, stocké tel quel, compté en février par
 * le regroupement mensuel — et daté de mars par tout calcul qui relit la date. Deux
 * vérités pour une même écriture, sans le moindre message. Trouvé par un test.
 */
function dateReelle(iso: string): boolean {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() + 1 === m && d.getUTCDate() === j;
}

/** Liste des motifs de refus. Vide = l'écriture est recevable. */
export function valider(e: Partial<Ecriture>): string[] {
  const err: string[] = [];
  if (!e.libelle || !e.libelle.trim()) err.push("Le libellé est obligatoire.");
  if (!e.date || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) err.push("La date est obligatoire (AAAA-MM-JJ).");
  else if (!dateReelle(e.date)) err.push("Cette date n'existe pas.");
  if (e.sens !== "entree" && e.sens !== "sortie") err.push("Le sens doit être une entrée ou une sortie.");
  const cat = categorieDe(String(e.categorie ?? ""));
  if (!cat) err.push("Catégorie inconnue.");
  else if (e.sens && cat.sens !== e.sens) err.push(`« ${cat.label} » n'est pas une catégorie de ${e.sens === "entree" ? "recette" : "dépense"}.`);
  if (typeof e.montantCents !== "number" || !Number.isFinite(e.montantCents)) err.push("Montant illisible.");
  else if (!Number.isInteger(e.montantCents)) err.push("Le montant doit être un nombre entier de centimes.");
  else if (e.montantCents <= 0) err.push("Le montant doit être strictement positif : c'est le sens qui porte le signe.");
  if (e.tvaTaux !== undefined && (e.tvaTaux < 0 || e.tvaTaux > 100)) err.push("Taux de TVA hors bornes.");
  return err;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Totaux
// ─────────────────────────────────────────────────────────────────────────────

export type Totaux = {
  entreesCents: number;
  sortiesCents: number;
  resultatCents: number;
  parCategorie: { id: string; label: string; sens: Sens; cents: number }[];
  parMois: { mois: string; entreesCents: number; sortiesCents: number; resultatCents: number }[];
  /** TVA collectée sur les recettes / déductible sur les dépenses, en centimes. */
  tvaCollecteeCents: number;
  tvaDeductibleCents: number;
  chargesFixesMensuellesCents: number;
  nbEcritures: number;
  nbAnnulees: number;
};

/** Part de TVA contenue dans un montant TTC, en centimes. */
export function tvaDe(montantCents: number, taux?: number): number {
  if (!taux || taux <= 0) return 0;
  return Math.round(montantCents - montantCents / (1 + taux / 100));
}

/**
 * ⚠️ LES ÉCRITURES ANNULÉES SONT EXCLUES DE TOUS LES TOTAUX, mais restent comptées à
 * part. Les inclure fausserait le résultat ; les faire disparaître ferait perdre la
 * trace. Les deux sont nécessaires.
 */
export function totaux(ecritures: Ecriture[]): Totaux {
  const vives = ecritures.filter((e) => !e.annulee);
  const parCat = new Map<string, number>();
  const parMois = new Map<string, { e: number; s: number }>();
  let entrees = 0, sorties = 0, tvaC = 0, tvaD = 0, fixes = 0;

  for (const e of vives) {
    const m = e.date.slice(0, 7);
    const acc = parMois.get(m) ?? { e: 0, s: 0 };
    if (e.sens === "entree") {
      entrees += e.montantCents; acc.e += e.montantCents; tvaC += tvaDe(e.montantCents, e.tvaTaux);
    } else {
      sorties += e.montantCents; acc.s += e.montantCents; tvaD += tvaDe(e.montantCents, e.tvaTaux);
      if (e.recurrente) fixes += e.montantCents;
    }
    parMois.set(m, acc);
    parCat.set(e.categorie, (parCat.get(e.categorie) ?? 0) + e.montantCents);
  }

  return {
    entreesCents: entrees,
    sortiesCents: sorties,
    resultatCents: entrees - sorties,
    parCategorie: [...parCat.entries()]
      .map(([id, cents]) => ({ id, label: categorieDe(id)?.label ?? id, sens: categorieDe(id)?.sens ?? "sortie", cents }))
      .sort((a, b) => b.cents - a.cents),
    parMois: [...parMois.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, v]) => ({ mois, entreesCents: v.e, sortiesCents: v.s, resultatCents: v.e - v.s })),
    tvaCollecteeCents: tvaC,
    tvaDeductibleCents: tvaD,
    /**
     * ⚠️ Une charge récurrente est mensuelle PAR CONVENTION, mais elle peut être saisie
     * plusieurs fois (un mois par ligne). On prend donc la DERNIÈRE occurrence de chaque
     * couple catégorie+libellé, pas la somme : sinon douze lignes d'hébergement
     * annonceraient douze fois le loyer mensuel.
     */
    chargesFixesMensuellesCents: derniereOccurrence(vives),
    nbEcritures: vives.length,
    nbAnnulees: ecritures.length - vives.length,
  };
  function derniereOccurrence(list: Ecriture[]): number {
    const vue = new Map<string, { date: string; cents: number }>();
    for (const e of list) {
      if (e.sens !== "sortie" || !e.recurrente) continue;
      const cle = `${e.categorie}::${e.libelle.trim().toLowerCase()}`;
      const prec = vue.get(cle);
      if (!prec || e.date > prec.date) vue.set(cle, { date: e.date, cents: e.montantCents });
    }
    return [...vue.values()].reduce((s, v) => s + v.cents, 0);
  }
}

/**
 * Cotisations estimées à partir du taux SAISI PAR L'ÉDITEUR.
 *
 * ⚠️ Renvoie `null` tant qu'aucun taux n'est renseigné, et l'écran affiche alors
 * « taux non renseigné » plutôt qu'un montant. Une estimation calculée sur un taux
 * inventé serait indiscernable d'une estimation juste.
 */
export function cotisationsEstimees(recettesCents: number, taux?: number): number | null {
  if (taux === undefined || !Number.isFinite(taux) || taux <= 0) return null;
  return Math.round((recettesCents * taux) / 100);
}

/** Solde de trésorerie cumulé, écriture par écriture, du plus ancien au plus récent. */
export function soldeCumule(ecritures: Ecriture[], soldeInitialCents = 0): { id: string; date: string; soldeCents: number }[] {
  const tri = ecritures.filter((e) => !e.annulee).slice()
    .sort((a, b) => a.date.localeCompare(b.date) || (a.saisieLe ?? "").localeCompare(b.saisieLe ?? ""));
  let solde = soldeInitialCents;
  return tri.map((e) => {
    solde += e.sens === "entree" ? e.montantCents : -e.montantCents;
    return { id: e.id, date: e.date, soldeCents: solde };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Export
// ─────────────────────────────────────────────────────────────────────────────

const echapper = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Export CSV — point-virgule et virgule décimale, parce que le tableur d'un utilisateur
 * français ouvre le fichier dans SA locale. Un CSV à virgules colle tout dans une seule
 * colonne, et l'export a l'air cassé alors que la donnée est bonne.
 *
 * Les écritures annulées SONT exportées, marquées comme telles : un export qui les
 * masque ne peut pas servir de justificatif.
 */
export function versCSV(ecritures: Ecriture[]): string {
  const entete = ["Date", "Libellé", "Sens", "Catégorie", "Montant (€)", "Moyen", "Tiers", "Pièce", "TVA (%)", "Note", "Annulée", "Motif d'annulation"];
  const lignes = ecritures.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => [
    e.date,
    e.libelle,
    e.sens === "entree" ? "Recette" : "Dépense",
    categorieDe(e.categorie)?.label ?? e.categorie,
    (e.montantCents / 100).toFixed(2).replace(".", ","),
    e.moyen,
    e.tiers ?? "",
    e.piece ?? "",
    e.tvaTaux === undefined ? "" : String(e.tvaTaux),
    e.note ?? "",
    e.annulee ? "oui" : "",
    e.motifAnnulation ?? "",
  ].map((v) => echapper(String(v))).join(";"));
  return "﻿" + [entete.join(";"), ...lignes].join("\r\n");
}
