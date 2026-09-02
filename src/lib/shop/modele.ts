/**
 * CATALOGUE DE MODÈLES — la fiche technique d'une chaussure, et rien d'autre.
 *
 * ⚠️ POURQUOI UN FICHIER ET PAS UNE TABLE. Ce catalogue est un contenu éditorial : il se
 * relit, se corrige et se versionne. En base, une valeur fausse se répare en silence et
 * personne ne sait quand elle a changé ; ici, chaque correction est un commit. Les tests
 * peuvent en outre exiger qu'AUCUNE spécification n'existe sans sa source.
 *
 * ⚠️ CE QUE CE FICHIER NE CONTIENT PAS. Aucun prix marchand, aucune disponibilité,
 * aucune image. Les prix vivent dans `product_offers`, alimentée par un flux officiel ;
 * une image de produit appartient à la marque et n'est pas libre de droits. Le seul
 * montant admis ici est le PRIX PUBLIC CONSEILLÉ, publié par le fabricant lui-même.
 *
 * ⚠️ CHAQUE NOMBRE PORTE SA SOURCE ET SA DATE. Un poids sans source est un poids inventé.
 * Une valeur absente s'affiche « non communiqué » — jamais une estimation.
 */

export type Terrain = "route" | "trail" | "piste";

/** À quoi sert la chaussure. Le vocabulaire du coureur, pas celui du marketing. */
export type Usage =
  | "quotidien"      // footing, endurance fondamentale, la paire qui encaisse le volume
  | "polyvalent"     // une seule paire pour tout faire
  | "tempo"          // séances au seuil, allures soutenues
  | "competition"    // le jour J, sur route
  | "trail_court"    // moins de 25 km
  | "trail_long"     // ultra, terrain technique
  | "amorti_max";    // récupération, gros gabarits, longues sorties lentes

export type Genre = "homme" | "femme" | "unisexe";

/**
 * Une valeur relevée, indissociable de la date du relevé.
 *
 * ⚠️ LA SOURCE EST PORTÉE PAR LE MODÈLE, PAS PAR LE CHAMP. Ma première version collait à
 * chaque valeur la PREMIÈRE source consultée, alors que le poids et le prix viennent
 * rarement du même site : la fiche aurait affirmé « poids : 278 g — source hoka.com »
 * pour un chiffre lu ailleurs. Une attribution fausse est pire qu'une attribution large.
 * On énonce donc ce qui est vrai : ces valeurs ont été relevées ce jour-là, sur ces
 * sites-là.
 */
export type Mesure<T> = { valeur: T; vu: string };

export type Modele = {
  slug: string;
  marque: string;
  nom: string;
  annee: number;
  terrain: Terrain;
  usage: Usage;
  /** Poids en grammes, pour la déclinaison homme (US 9 / EU 42) sauf mention. */
  poidsG?: Mesure<number>;
  /** Différence talon-orteils, en mm. */
  dropMm?: Mesure<number>;
  /** Hauteur de semelle au talon, en mm. */
  stackTalonMm?: Mesure<number>;
  /** Plaque carbone : ce n'est pas un détail, elle change à qui la chaussure convient. */
  plaqueCarbone?: Mesure<boolean>;
  /** Prix public conseillé par le fabricant, en euros. Jamais un prix marchand. */
  prixConseilleEur?: Mesure<number>;
  /** Durée de vie annoncée, en km. */
  dureeVieKm?: Mesure<number>;
  /**
   * Code-barres du produit. C'est la SEULE clé fiable pour reconnaître la même paire chez
   * deux marchands : les noms commerciaux diffèrent (« Clifton 10 M », « Clifton 10
   * Homme », « Clifton 10 »), le code-barres non. `product_offers.ean` l'attend.
   */
  ean?: string;
  /** Nom commercial exact tel que publié, quand il diffère de notre libellé. */
  nomExact?: string;
  /** Type de foulée visé (neutre, universelle, pronateur) — classement du fabricant. */
  foulee?: string;
  /** Sites consultés pour établir la fiche. Vide = fiche refusée, jamais publiée. */
  sources: string[];
  /** Vrai si le site du fabricant figure parmi les sources : le relevé est de première main. */
  sourceFabricant?: boolean;
};

// ── BORNES DE PLAUSIBILITÉ ────────────────────────────────────────────────────────────
//  ⚠️ UNE VALEUR HORS BORNES EST REJETÉE, PAS CORRIGÉE. Un modèle de langage rend parfois
//  un poids en onces converti de travers, ou le prix d'un lot. Ramener la valeur dans les
//  bornes fabriquerait un chiffre que personne n'a mesuré : on préfère la case vide, qui
//  s'affiche « non communiqué » et ne trompe personne.
export const BORNES = {
  poidsG: [140, 420] as const,
  dropMm: [0, 14] as const,
  stackTalonMm: [10, 60] as const,
  prixConseilleEur: [40, 400] as const,
  dureeVieKm: [300, 1200] as const,
};

export function dansLesBornes(champ: keyof typeof BORNES, v: unknown): boolean {
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  const [min, max] = BORNES[champ];
  return n >= min && n <= max;
}

/**
 * Le stack ne peut pas être inférieur au drop : la semelle avant aurait une épaisseur
 * négative. C'est le contrôle qui attrape une valeur juste en apparence mais impossible.
 */
export function coherenceStackDrop(stackTalonMm?: number, dropMm?: number): boolean {
  if (stackTalonMm == null || dropMm == null) return true;
  return stackTalonMm > dropMm;
}

/**
 * Une source utilisable : une adresse complète, OU le simple domaine du site consulté.
 *
 * ⚠️ LA RECHERCHE NE REND PAS TOUJOURS L'URL. Gemini remonte ses sources sous forme de
 * domaine (« hoka.com ») aussi souvent que d'adresse complète. Exiger `https://` faisait
 * rejeter CHAQUE fiche collectée — le script tournait, ne se plaignait de rien et
 * n'écrivait rien. Un domaine reste vérifiable par un humain ; ce qu'on refuse, c'est
 * l'absence totale de source, qui signerait une réponse donnée de mémoire.
 */
export function sourceValide(u: unknown): boolean {
  const s = String(u ?? "").trim();
  if (/^https?:\/\/[^\s"']+\.[a-z]{2,}/i.test(s)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s) && /\.[a-z]{2,}$/i.test(s) && !s.includes(" ");
}

/**
 * Domaines qu'on refuse comme source d'une CARACTÉRISTIQUE TECHNIQUE.
 *
 * ⚠️ CONSTATÉ SUR LA FICHE DE LA CLIFTON 10 : « Relevé sur youtube.com, rei.com,
 * dickssportinggoods.com… ». Une vidéo n'est pas une fiche technique, et un fil de forum
 * encore moins. Ces sources ne sont pas fausses en soi — elles ne sont simplement pas
 * vérifiables par un lecteur qui voudrait contrôler un poids au gramme près. Les afficher
 * abîme la seule chose qui donne du prix au reste : le fait qu'on puisse aller voir.
 *
 * On ne bloque PAS les revendeurs étrangers : leur fiche produit publie bien la donnée.
 */
const SOURCES_REFUSEES = [
  "youtube.com", "youtu.be", "reddit.com", "facebook.com", "instagram.com", "tiktok.com",
  "pinterest.com", "quora.com", "x.com", "twitter.com", "vimeo.com", "dailymotion.com",
];

export function sourceCitable(u: unknown): boolean {
  const d = domaineDe(u);
  if (!d) return false;
  return !SOURCES_REFUSEES.some((x) => d === x || d.endsWith(`.${x}`));
}

/** Les sources d'une fiche, réduites à celles qu'un lecteur peut réellement consulter. */
export function sourcesCitables(sources: string[] | undefined): string[] {
  return (sources ?? []).filter(sourceCitable);
}

export function domaineDe(u: unknown): string {
  const s = String(u ?? "").trim();
  try { return new URL(s).hostname.replace(/^www\./, ""); } catch { /* pas une URL */ }
  return sourceValide(s) ? s.replace(/^www\./, "") : "";
}
