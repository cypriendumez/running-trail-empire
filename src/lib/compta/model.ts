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
  /**
   * Mouvement de TRÉSORERIE qui n'est ni une recette ni une charge.
   *
   * ⚠️ METTRE SON PROPRE ARGENT DANS L'ENTREPRISE N'EST PAS UN CHIFFRE D'AFFAIRES. Traité
   * comme une recette, un apport de 500 € gonflerait le CA déclaré, ferait payer des
   * cotisations sur de l'argent déjà gagné ailleurs, et rapprocherait d'un plafond sans
   * qu'un seul euro ait été facturé. Symétriquement, se verser de l'argent n'est pas une
   * charge déductible. Ces lignes bougent la trésorerie, et RIEN d'autre.
   */
  horsResultat?: boolean;
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
  { id: "apport", label: "Apport personnel (argent que tu mets)", sens: "entree", horsResultat: true },
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
  { id: "remboursements_verses", label: "Remboursements versés", sens: "sortie" },
  { id: "cotisations", label: "Cotisations sociales", sens: "sortie" },
  { id: "impots", label: "Impôts & taxes", sens: "sortie" },
  { id: "deplacements", label: "Déplacements", sens: "sortie" },
  { id: "retrait", label: "Retrait personnel (argent que tu sors)", sens: "sortie", horsResultat: true },
  { id: "autre_sortie", label: "Autre dépense", sens: "sortie" },
];

export const categorieDe = (id: string): Categorie | undefined => CATEGORIES.find((c) => c.id === id);

/** Une écriture qui déplace de la trésorerie sans être ni recette ni charge. */
export const horsResultat = (e: Pick<Ecriture, "categorie">): boolean =>
  Boolean(categorieDe(e.categorie)?.horsResultat);

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
  /** Numéro de facture, de reçu, ou lien : la référence de la pièce justificative. */
  piece?: string;
  /**
   * Chemin du FICHIER justificatif dans l'espace privé.
   *
   * ⚠️ Une référence texte ne remplace pas la pièce : l'obligation est de CONSERVER la
   * facture, pas d'en noter le numéro. Un numéro sans document ne justifie rien.
   */
  pieceFichier?: string;
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
  /** « stripe » = écriture créée par un encaissement réel, pas saisie à la main. */
  origine?: "manuel" | "stripe";
  /**
   * Clé d'unicité de l'encaissement d'origine.
   *
   * ⚠️ STRIPE RÉÉMET SES NOTIFICATIONS quand il n'obtient pas de réponse — parfois
   * plusieurs fois. Sans cette clé, un seul abonnement serait compté deux ou trois fois,
   * et rien dans le journal n'aurait l'air anormal : trois lignes identiques ressemblent
   * à trois vrais paiements.
   */
  stripeId?: string;
};

export type Reglages = {
  /**
   * Taux de cotisations sociales en % applicable AUJOURD'HUI, SAISI PAR L'ÉDITEUR.
   * Pendant l'ACRE, c'est le taux réduit.
   */
  tauxCotisations?: number;
  /**
   * Dernier jour du taux réduit (ACRE), au format AAAA-MM-JJ.
   *
   * ⚠️ L'ACRE dure une durée déterminée, puis le taux REMONTE. Un outil qui applique le
   * taux réduit indéfiniment annonce des cotisations sous-évaluées pendant des mois —
   * et l'écart ne se découvre qu'à l'appel de cotisations, quand l'argent est dépensé.
   * Aucune durée n'est écrite dans le code : c'est une date que l'éditeur saisit.
   */
  acreJusquau?: string;
  /** Taux plein applicable APRÈS cette date, SAISI PAR L'ÉDITEUR lui aussi. */
  tauxApresAcre?: number;
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
export function dateReelle(iso: string): boolean {
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
  /** Argent personnel mis dans l'entreprise — hors résultat, hors CA, hors cotisations. */
  apportsCents: number;
  /** Argent sorti pour soi — hors résultat, non déductible. */
  retraitsCents: number;
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

  let apports = 0, retraits = 0;
  for (const e of vives) {
    // ⚠️ Écarté de TOUT ce qui touche au résultat : totaux, ventilation par mois, par
    // poste, TVA. Un apport n'est pas un chiffre d'affaires, et il ne doit apparaître
    // nulle part comme tel.
    if (horsResultat(e)) {
      if (e.sens === "entree") apports += e.montantCents; else retraits += e.montantCents;
      continue;
    }
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
    apportsCents: apports,
    retraitsCents: retraits,
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

export type Cotisations = {
  /** `null` tant qu'un taux nécessaire manque : on ne complète pas au taux voisin. */
  totalCents: number | null;
  tranches: { libelle: string; recettesCents: number; taux?: number; cotisationsCents: number | null }[];
  /** Ce qu'il manque pour pouvoir totaliser, en clair. */
  manquant: string[];
  /** Jours restants avant la fin du taux réduit — `null` si aucune date n'est posée. */
  joursAvantFinAcre: number | null;
};

/**
 * Cotisations estimées EN TENANT COMPTE DU CHANGEMENT DE TAUX.
 *
 * ⚠️ Les recettes sont ventilées PAR DATE, pas globalement. Appliquer le taux du jour à
 * l'ensemble de l'année fausse les deux périodes à la fois : trop peu sur celles d'avant
 * la bascule, trop sur celles d'après.
 *
 * ⚠️ ET SI LE TAUX D'UNE PÉRIODE MANQUE, LE TOTAL VAUT `null`. Additionner ce qu'on sait
 * calculer et taire le reste donnerait un montant plus petit que la réalité, qui a l'air
 * d'un vrai total.
 */
export function cotisations(ecritures: Ecriture[], r: Reglages, aujourdhui = new Date()): Cotisations {
  const fin = r.acreJusquau && /^\d{4}-\d{2}-\d{2}$/.test(r.acreJusquau) ? r.acreJusquau : null;
  let avant = 0, apres = 0;
  for (const e of ecritures) {
    // Un apport n'est pas une recette : cotiser dessus serait payer sur son propre argent.
    if (e.annulee || e.sens !== "entree" || horsResultat(e)) continue;
    if (fin && e.date > fin) apres += e.montantCents; else avant += e.montantCents;
  }

  const utilisable = (t?: number) => (typeof t === "number" && Number.isFinite(t) && t > 0 ? t : undefined);
  const tAvant = utilisable(r.tauxCotisations);
  const tApres = utilisable(r.tauxApresAcre);

  const tranches: Cotisations["tranches"] = [];
  const manquant: string[] = [];
  const calc = (cents: number, taux?: number) => (taux === undefined ? null : Math.round((cents * taux) / 100));

  if (!fin) {
    tranches.push({ libelle: "Recettes", recettesCents: avant, taux: tAvant, cotisationsCents: calc(avant, tAvant) });
    if (tAvant === undefined) manquant.push("le taux de cotisations");
  } else {
    tranches.push({ libelle: `Jusqu'au ${fin}`, recettesCents: avant, taux: tAvant, cotisationsCents: calc(avant, tAvant) });
    tranches.push({ libelle: `À partir du ${fin}`, recettesCents: apres, taux: tApres, cotisationsCents: calc(apres, tApres) });
    if (tAvant === undefined && avant > 0) manquant.push("le taux réduit (ACRE)");
    // ⚠️ Réclamé SEULEMENT s'il y a des recettes après la bascule : exiger un taux
    // qu'aucune recette n'utilise encore afficherait un manque permanent et inutile.
    if (tApres === undefined && apres > 0) manquant.push("le taux après l'ACRE");
  }

  const totalCents = tranches.some((t) => t.recettesCents > 0 && t.cotisationsCents === null)
    ? null
    : tranches.reduce((s2, t) => s2 + (t.cotisationsCents ?? 0), 0);

  const joursAvantFinAcre = fin
    ? Math.ceil((new Date(fin + "T23:59:59Z").getTime() - aujourdhui.getTime()) / 86400000)
    : null;

  return { totalCents, tranches, manquant, joursAvantFinAcre };
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

// ─────────────────────────────────────────────────────────────────────────────
//  Ce qu'un livre de recettes doit savoir faire
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Numérote les écritures dans l'ordre chronologique.
 *
 * ⚠️ UN LIVRE DE RECETTES SE TIENT PAR NUMÉROS D'ORDRE CONTINUS. Sans eux, rien ne
 * montre qu'il ne manque pas une ligne au milieu — et c'est précisément ce qu'un
 * contrôle vérifie. Les écritures ANNULÉES gardent leur numéro : un numéro qui
 * disparaît est un trou, et un trou se justifie.
 *
 * L'ordre est total et déterministe (date, puis heure de saisie, puis identifiant) :
 * deux affichages successifs ne doivent jamais renuméroter les mêmes lignes.
 */
export function numeroter(ecritures: Ecriture[]): Map<string, number> {
  const tri = ecritures.slice().sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.saisieLe ?? "").localeCompare(b.saisieLe ?? "") ||
    a.id.localeCompare(b.id));
  return new Map(tri.map((e, i) => [e.id, i + 1]));
}

/**
 * Écritures qui ressemblent assez à la nouvelle pour être la même, saisie deux fois.
 *
 * ⚠️ AVERTIR, JAMAIS BLOQUER. Deux abonnements identiques le même jour arrivent
 * vraiment ; refuser la seconde ligne forcerait à la contourner. Mais saisir deux fois
 * la même facture est l'erreur la plus banale d'une comptabilité tenue à la main, et
 * elle est invisible une fois enregistrée.
 */
export function doublonsProbables(nouvelle: Partial<Ecriture>, existantes: Ecriture[]): Ecriture[] {
  const lib = String(nouvelle.libelle ?? "").trim().toLowerCase();
  return existantes.filter((e) =>
    !e.annulee &&
    e.date === nouvelle.date &&
    e.montantCents === nouvelle.montantCents &&
    e.sens === nouvelle.sens &&
    e.libelle.trim().toLowerCase() === lib);
}

/**
 * Totaux par trimestre civil — la maille des déclarations.
 *
 * ⚠️ On ne déclare pas « depuis le début » : on déclare une PÉRIODE. Recopier un cumul
 * dans un formulaire trimestriel est une erreur qu'on ne découvre qu'au redressement.
 */
export function parTrimestre(ecritures: Ecriture[]): { periode: string; recettesCents: number; depensesCents: number }[] {
  const m = new Map<string, { r: number; d: number }>();
  for (const e of ecritures) {
    if (e.annulee || horsResultat(e)) continue;
    const t = `${e.date.slice(0, 4)}-T${Math.floor((Number(e.date.slice(5, 7)) - 1) / 3) + 1}`;
    const acc = m.get(t) ?? { r: 0, d: 0 };
    if (e.sens === "entree") acc.r += e.montantCents; else acc.d += e.montantCents;
    m.set(t, acc);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([periode, v]) => ({ periode, recettesCents: v.r, depensesCents: v.d }));
}

/**
 * Les charges mensuelles connues, et si elles ont déjà été saisies pour un mois donné.
 *
 * Permet de reporter en un clic les frais qui reviennent — la partie la plus fastidieuse
 * d'une comptabilité tenue à la main, et donc celle qu'on oublie.
 */
export function modelesRecurrents(ecritures: Ecriture[], mois: string): {
  libelle: string; categorie: string; montantCents: number; moyen: Moyen; tiers?: string; dejaSaisi: boolean;
}[] {
  const vue = new Map<string, { e: Ecriture; date: string }>();
  for (const e of ecritures) {
    if (e.annulee || e.sens !== "sortie" || !e.recurrente) continue;
    const cle = `${e.categorie}::${e.libelle.trim().toLowerCase()}`;
    const prec = vue.get(cle);
    if (!prec || e.date > prec.date) vue.set(cle, { e, date: e.date });
  }
  return [...vue.values()].map(({ e }) => ({
    libelle: e.libelle, categorie: e.categorie, montantCents: e.montantCents, moyen: e.moyen, tiers: e.tiers,
    // ⚠️ Un report déjà fait ne doit pas être reproposé à l'identique : c'est la façon
    // la plus simple de créer un doublon en croyant bien faire.
    dejaSaisi: ecritures.some((x) => !x.annulee && x.date.startsWith(mois) &&
      x.categorie === e.categorie && x.libelle.trim().toLowerCase() === e.libelle.trim().toLowerCase()),
  }));
}

/** Évolution en % entre deux montants. `null` quand la base est nulle : « +∞ % » ne veut rien dire. */
export function evolution(actuelCents: number, precedentCents: number): number | null {
  if (precedentCents === 0) return null;
  return Math.round(((actuelCents - precedentCents) / Math.abs(precedentCents)) * 100);
}

/**
 * LE LIVRE DES RECETTES — le document qu'un micro-entrepreneur doit tenir.
 *
 * Il n'a pas la même forme qu'un export général : uniquement les RECETTES, dans l'ordre
 * chronologique, numérotées, avec pour chacune la date, la référence de la pièce,
 * l'identité du client, la nature de la prestation et le mode de règlement.
 *
 * ⚠️ Les écritures ANNULÉES y figurent, barrées d'une mention. Un livre où les lignes
 * annulées disparaissent présente des numéros à trous sans expliquer pourquoi — et c'est
 * exactement ce qu'un contrôle demande de justifier.
 */
export function versLivreRecettes(ecritures: Ecriture[]): string {
  const num = numeroter(ecritures);
  const entete = ["N°", "Date", "Référence de la pièce", "Client", "Nature", "Montant (€)", "Mode de règlement", "Annulée"];
  const lignes = ecritures
    // ⚠️ Un apport personnel n'a rien à faire dans un livre des RECETTES.
    .filter((e) => e.sens === "entree" && !horsResultat(e))
    .sort((a, b) => (num.get(a.id) ?? 0) - (num.get(b.id) ?? 0))
    .map((e) => [
      String(num.get(e.id) ?? ""),
      e.date,
      e.piece ?? (e.pieceFichier ? "pièce jointe" : ""),
      e.tiers ?? "",
      categorieDe(e.categorie)?.label ?? e.categorie,
      (e.montantCents / 100).toFixed(2).replace(".", ","),
      e.moyen,
      e.annulee ? `oui — ${e.motifAnnulation ?? ""}` : "",
    ].map((v) => echapper(String(v))).join(";"));
  return "\ufeff" + [entete.join(";"), ...lignes].join("\r\n");
}
