/**
 * UNE FICHE D'INDICATEUR — ce que la page /dashboard/indicateurs/[cle] affiche (04/10/2026).
 *
 * Cyprien : « quand on clique sur ces modules, j'aimerais une page qui donne les valeurs
 * précises et qui explique pourquoi ». Chaque fiche est produite par une fonction PURE
 * (`lib/indicateurs/fiches`) à partir des MÊMES calculs que la carte du tableau de bord :
 * la page ne peut pas contredire la carte. Aucun texte n'est généré par un modèle : tout
 * ce qui est écrit découle des chiffres, et le calcul est montré avec ces chiffres.
 */

export const INDICATEURS = ["forme", "vfc", "vitesse", "discipline", "objectif", "charge", "acwr", "volume", "zones"] as const;
export type CleIndicateur = (typeof INDICATEURS)[number];

export const estIndicateur = (x: unknown): x is CleIndicateur => typeof x === "string" && (INDICATEURS as readonly string[]).includes(x);

/** La tonalité d'un état : elle choisit la couleur, jamais le texte. */
export type Ton = "excellent" | "bon" | "moyen" | "alerte" | "neutre";

export type Composante = {
  libelle: string;
  valeur: string;
  unite?: string;
  /** 0–100 : longueur de la barre, quand la composante est un pourcentage. */
  part?: number;
  ton: Ton;
  /** D'où vient ce chiffre, avec les vraies valeurs. */
  detail: string;
};

export type Point = { date: string; valeur: number };

export type Graphe = {
  titre: string;
  unite: string;
  lignes: { libelle: string; couleur: string; points: Point[]; aire?: boolean }[];
  /** Une bande de référence (zone normale, zone optimale…). */
  bande?: { bas: number; haut: number; libelle: string };
  /** Une ligne de repère horizontale (base, cible). */
  repere?: { valeur: number; libelle: string };
  /** Des barres plutôt qu'une courbe (volume, charge quotidienne). */
  barres?: boolean;
};

export type Repere = { libelle: string; plage: string; ton: Ton; actif: boolean };

export type Tableau = { titre: string; colonnes: string[]; lignes: { cellules: string[]; actif?: boolean }[]; note?: string };

export type Fiche = {
  cle: CleIndicateur;
  titre: string;
  /** Ce que l'indicateur mesure, en une phrase. */
  mesure: string;
  valeur: string;
  unite?: string;
  statut?: { libelle: string; ton: Ton };
  /** Le verdict du jour, en une ou deux phrases — avec les chiffres. */
  verdict: string;
  /** Sur quoi le calcul s'appuie (« 38 séances, 14 mesures de VFC… »). */
  base?: string;
  composantes?: Composante[];
  graphe?: Graphe;
  tableaux?: Tableau[];
  calcul: string[];
  reperes?: { titre: string; lignes: Repere[] };
  conseils: string[];
  /** Pourquoi c'est important — l'explication de fond, courte. */
  pourquoi: string;
  sources?: string[];
  liens?: { libelle: string; href: string }[];
  /** Pas assez de données : la fiche le dit au lieu d'afficher des zéros. */
  vide?: string;
};
