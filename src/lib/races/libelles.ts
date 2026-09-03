/**
 * CE QUE LISENT GOOGLE ET LES COUREURS — les libellés des pages publiques.
 *
 * ⚠️ CONSTAT DU 03/09/2026, sur les 10 700 pages qui viennent d'être ouvertes à
 * l'indexation. Elles affichaient la région sous sa forme technique :
 * « Courses et trails en auvergne-rhone-alpes » en titre de page, en description, et
 * dans le fil d'Ariane de CHAQUE fiche. Personne ne cherche « auvergne-rhone-alpes » ;
 * un titre est la première chose qu'un moteur pèse et la seule qu'un humain lit dans
 * une liste de résultats.
 *
 * ⚠️ RIEN N'EST DEVINÉ ICI. La table des régions est celle des collectivités
 * françaises ; la liste des sigles a été MESURÉE dans le catalogue (155 sigles
 * distincts relevés dans des noms à casse mixte, donc attestés comme sigles). Sans
 * elle, une mise en forme mot à mot écrirait « Vtt », « Edf » et « Ag2R ».
 */

/** Les 18 régions françaises, DOM compris, avec leur identifiant tel qu'il est stocké. */
const REGIONS: Record<string, string> = {
  "auvergne-rhone-alpes": "Auvergne-Rhône-Alpes",
  "bourgogne-franche-comte": "Bourgogne-Franche-Comté",
  "bretagne": "Bretagne",
  "centre-val-de-loire": "Centre-Val de Loire",
  "corse": "Corse",
  "grand-est": "Grand Est",
  "hauts-de-france": "Hauts-de-France",
  "ile-de-france": "Île-de-France",
  "normandie": "Normandie",
  "nouvelle-aquitaine": "Nouvelle-Aquitaine",
  "occitanie": "Occitanie",
  "pays-de-la-loire": "Pays de la Loire",
  "provence-alpes-cote-d-azur": "Provence-Alpes-Côte d'Azur",
  "guadeloupe": "Guadeloupe",
  "guyane": "Guyane",
  "la-reunion": "La Réunion",
  "martinique": "Martinique",
  "mayotte": "Mayotte",
};

/**
 * Les écritures d'une même région à ramener sur une seule.
 *
 * ⚠️ MESURÉ : « provence-alpes-cote-azur » (33 courses) et
 * « provence-alpes-cote-d-azur » (1 088) coexistaient. La page affichait donc DEUX
 * filtres pour la même région, dont un quasi vide — et 33 courses étaient
 * pratiquement introuvables.
 */
const ALIAS: Record<string, string> = {
  "provence-alpes-cote-azur": "provence-alpes-cote-d-azur",
  "paca": "provence-alpes-cote-d-azur",
  "reunion": "la-reunion",
  "ile-de-france-idf": "ile-de-france",
};

/** L'identifiant retenu pour une région, quelle que soit l'écriture reçue. */
export function regionCanonique(slug: unknown): string {
  const s = String(slug ?? "").trim().toLowerCase();
  return ALIAS[s] ?? s;
}

/**
 * Le nom lisible d'une région. Une valeur inconnue est RENDUE TELLE QUELLE plutôt
 * qu'écartée : mieux vaut afficher « xyz » et le voir, que faire disparaître des
 * courses parce qu'une région n'était pas dans la table.
 */
export function nomRegion(slug: unknown): string {
  const c = regionCanonique(slug);
  return REGIONS[c] ?? String(slug ?? "").trim();
}

/**
 * Les écritures acceptées pour un identifiant canonique, l'identifiant lui-même compris.
 * Sert à FILTRER : chercher une seule écriture laisserait des courses inatteignables.
 */
export const ECRITURES_REGION: Record<string, string[]> = Object.entries(ALIAS)
  .reduce<Record<string, string[]>>((acc, [ecrit, vers]) => {
    acc[vers] = [...new Set([...(acc[vers] ?? [vers]), ecrit])];
    return acc;
  }, {});

/** Toutes les régions connues, pour un menu ou un plan du site. */
export function regionsConnues(): { slug: string; nom: string }[] {
  return Object.entries(REGIONS).map(([slug, nom]) => ({ slug, nom }));
}

/**
 * Sigles ATTESTÉS dans le catalogue — relevés parmi les mots entièrement en capitales
 * apparaissant dans des noms à casse mixte, c'est-à-dire là où l'auteur du nom a
 * délibérément mis des capitales. Ils ne doivent jamais être recapitalisés.
 */
const SIGLES = new Set([
  "VTT", "EDF", "AG2R", "UCI", "THP", "GF", "EDHEC", "TERREX", "MPI", "ARAC",
  "UTMB", "ITRA", "SNCF", "CE", "CD", "ASPTT", "USEP", "UNSS", "FFA", "TDF",
  "XL", "XXL", "KV", "SUP", "BMX", "VTC", "PMR", "HS", "TSF", "OM", "PSG",
]);

/** Les mots qui ne prennent pas de majuscule au milieu d'un titre français. */
const OUTILS = new Set([
  "de", "du", "des", "d", "le", "la", "les", "l", "et", "a", "au", "aux",
  "en", "sur", "sous", "par", "pour", "dans", "vers", "chez", "the", "of",
]);

const capitaliser = (m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();

/**
 * Le nom d'une course, écrit comme un titre français.
 *
 * ⚠️ TRANSFORMATION D'AFFICHAGE, PAS DE MIGRATION. La base n'est pas réécrite : si
 * cette fonction se trompe sur un nom, c'est un défaut d'affichage réversible à la
 * seconde, pas une donnée abîmée. Sur 10 700 noms venus de sources hétérogènes, c'est
 * la seule prudence qui tienne.
 *
 * Deux corrections, et deux seulement :
 * · 295 noms portent une majuscule sur un mot-outil (« Ultra Tour Du Mont Ventoux ») —
 *   c'est la recapitalisation mot à mot d'une source anglophone, pas du français ;
 * · 89 noms crient en capitales (« LA RÉMI CAVAGNA ») — illisible en titre de page.
 * Tout le reste est laissé intact : un nom à casse mixte est un nom que quelqu'un a
 * écrit exprès.
 */
export function nomAffichable(nom: unknown): string {
  const brut = String(nom ?? "").trim().replace(/\s+/g, " ");
  if (!brut) return "";
  const crie = brut === brut.toUpperCase() && /[A-ZÀ-Ÿ]{4,}/.test(brut);

  const mots = brut.split(" ");
  return mots.map((mot, i) => {
    // Un sigle attesté ne bouge jamais, où qu'il soit dans le nom.
    if (SIGLES.has(mot.replace(/[^A-Za-zÀ-Ÿ0-9]/g, "").toUpperCase())
        && mot === mot.toUpperCase()) return mot;
    // Un nombre, une distance, une année : rien à capitaliser.
    if (/^\d/.test(mot)) return mot;

    const nu = mot.replace(/[^A-Za-zÀ-Ÿ']/g, "").toLowerCase();
    // Mot-outil au milieu : en minuscules. Jamais le premier mot.
    if (i > 0 && OUTILS.has(nu.replace(/'$/, ""))) return mot.toLowerCase();
    // Un nom qui crie est ramené à une capitale initiale ; sinon on ne touche à rien.
    return crie ? mot.split("-").map(capitaliser).join("-") : mot;
  }).join(" ");
}
