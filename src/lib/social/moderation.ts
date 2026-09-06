// ─────────────────────────────────────────────────────────────────────────────
//  MODÉRATION DES TEXTES PUBLIÉS — insultes et grossièretés.
//
//  CE QUE CE MODULE NE PROMET PAS. Il ne connaît pas « tous les gros mots de toutes
//  les langues » : personne ne le peut, et prétendre le contraire serait exactement le
//  genre d'affirmation fausse que ce projet refuse. Il couvre les six langues de
//  l'application plus les tournures les plus courantes, et il est fait pour qu'on y
//  ajoute un mot en une ligne.
//
//  DEUX PIÈGES QUI FONT ÉCHOUER LA PLUPART DES FILTRES :
//
//  1. LE PROBLÈME DE SCUNTHORPE. Chercher un gros mot comme simple sous-chaîne bloque
//     des mots parfaitement innocents : « connexion » contient « con », « Bitterfeld »
//     contient « bitte », « assez » contient « ass », « pute » est dans « députe ».
//     Un athlète qui écrit « super connexion GPS » et se fait refuser son commentaire
//     ne recommence pas : il s'en va. On travaille donc sur des MOTS ENTIERS.
//
//  2. LE CONTOURNEMENT TRIVIAL. « c0nnard », « m e r d e », « puuuute », « ÇÔN » :
//     sans normalisation, le filtre ne sert qu'à embêter les honnêtes gens. On
//     normalise donc accents, chiffres-lettres, ponctuation intercalée et lettres
//     répétées AVANT de comparer.
//
//  Aucune correspondance approximative au-delà de ça : un filtre trop zélé qui refuse
//  un message légitime coûte plus cher qu'un juron qui passe.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Racines interdites, en MOTS ENTIERS après normalisation.
 * Les variantes de terminaison sont gérées par le suffixe optionnel (pluriels,
 * féminins), pas en dupliquant chaque forme.
 */
const GROS_MOTS: Record<string, string[]> = {
  fr: [
    "connard", "connasse", "conne", "encule", "enculer", "enculee", "salope", "salaud",
    "pute", "putain", "putes", "merde", "merdeux", "chier", "chiotte", "bite", "couille",
    "couilles", "batard", "batarde", "nique", "niquer", "ntm", "tafiole", "pd", "pede",
    "fdp", "trouduc", "foutre", "bordel", "cretin", "debile", "abruti", "cretine",
  ],
  en: [
    "fuck", "fucking", "fucker", "fuckers", "motherfucker", "shit", "shitty", "bullshit",
    "bitch", "bitches", "asshole", "assholes", "dickhead", "cunt", "bastard", "whore",
    "slut", "wanker", "twat", "prick", "retard", "faggot", "nigger", "nigga",
  ],
  es: [
    "puta", "putas", "puto", "cabron", "cabrona", "gilipollas", "joder", "mierda",
    "coño", "cono", "pendejo", "pendeja", "chinga", "chingar", "maricon", "polla",
  ],
  de: [
    "scheisse", "scheiss", "arschloch", "wichser", "hurensohn", "fotze", "schlampe",
    "fick", "ficken", "verpiss", "missgeburt",
  ],
  pt: [
    "caralho", "foda", "fodase", "merda", "puta", "putas", "cabrao", "filhodaputa",
    "buceta", "porra", "otario", "corno",
  ],
  it: [
    "cazzo", "stronzo", "stronza", "vaffanculo", "puttana", "merda", "figadiputtana",
    "coglione", "troia",
  ],
};

/** Ensemble plat, dédoublonné. Une racine vaut pour toutes les langues : un juron
 *  anglais dans un commentaire français reste un juron. */
const RACINES = new Set(Object.values(GROS_MOTS).flat());

/** Terminaisons tolérées après une racine (pluriels, féminins, conjugaisons simples).
 *  Volontairement courtes : au-delà, on attrape des mots qui n'ont rien à voir. */
const SUFFIXES = ["", "s", "e", "es", "er", "ee", "ees", "ent", "ing", "ed", "n", "ne", "nes"];

/** Formes complètes acceptées, racine + terminaison. Calculé une fois. */
const INTERDITS = (() => {
  const set = new Set<string>();
  for (const r of RACINES) for (const s of SUFFIXES) set.add(r + s);
  return set;
})();

/** Chiffres et symboles utilisés pour maquiller une lettre. */
const SUBSTITUTIONS: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "|": "i", "+": "t",
};

/** L'astérisque n'est PAS une lettre déguisée : c'est une lettre CACHÉE (« f*ck »).
 *  La supprimer donnait « fck », qui ne correspond à rien — le contournement le plus
 *  répandu passait donc tranquillement. On la traite comme un joker d'exactement une
 *  lettre, et UNIQUEMENT quand elle est présente : jamais de comparaison approximative
 *  sur un mot ordinaire, sous peine de refuser « pâte » au motif qu'il ressemble à
 *  « pute ». */
const JOKER = "*";

/**
 * Normalise un mot pour la comparaison : minuscules, accents retirés, chiffres-lettres
 * rétablis, lettres répétées réduites.
 *
 * « ÇÔNNARD », « c0nnard », « connnnard » et « ÇonnArd » donnent tous « connard ».
 */
export function normaliserMot(mot: string): string {
  const sansAccent = mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const substitue = [...sansAccent].map((c) => (c in SUBSTITUTIONS ? SUBSTITUTIONS[c] : c)).join("");
  // Lettres répétées : « puuuute » → « pute ». On réduit à UNE lettre et non deux,
  // sinon « puuute » passe. Les doubles légitimes (« connard » a deux n) sont couverts
  // parce que la racine est elle aussi normalisée de la même façon.
  return substitue.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

/** Racines normalisées — comparées à la même aune que le texte entrant. */
const INTERDITS_NORMALISES = new Set([...INTERDITS].map(normaliserMot));

/**
 * Le mot est-il un gros mot MASQUÉ par des astérisques (« f*ck », « c*nnard ») ?
 *
 * Chaque astérisque vaut exactement une lettre. On ne construit le motif que si le mot
 * en contient au moins un : sans cette condition, on comparerait des mots ordinaires
 * de façon approximative et on refuserait des textes parfaitement légitimes.
 */
function estMasque(mot: string): boolean {
  const brut = mot.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const substitue = [...brut].map((c) => (c in SUBSTITUTIONS ? SUBSTITUTIONS[c] : c)).join("");
  const garde = substitue.replace(/[^a-z*]/g, "");
  if (!garde.includes(JOKER)) return false;
  // Lettres répétées réduites comme ailleurs, pour comparer à la même aune.
  const reduit = garde.replace(/([a-z])\1+/g, "$1");
  const motif = new RegExp(`^${reduit.split("").map((c) => (c === JOKER ? "[a-z]" : c)).join("")}$`);
  for (const interdit of INTERDITS_NORMALISES) if (motif.test(interdit)) return true;
  return false;
}

/**
 * Le texte contient-il un gros mot ?
 *
 * Découpe sur tout ce qui n'est pas une lettre ou un chiffre, donc « va te faire,
 * connard ! » est bien découpé. Traite aussi le cas des lettres espacées
 * (« m e r d e ») en recollant les suites de lettres isolées.
 */
export function contientGrosMot(texte: string): boolean {
  if (typeof texte !== "string" || !texte) return false;
  const mots = texte.split(/[^\p{L}\p{N}@$!|*+]+/u).filter(Boolean);
  for (const m of mots) {
    const n = normaliserMot(m);
    if (n && INTERDITS_NORMALISES.has(n)) return true;
    if (m.includes(JOKER) && estMasque(m)) return true;
  }
  // « m e r d e » : des lettres seules à la suite forment un mot déguisé.
  //
  // ⚠️ On teste chaque SUITE CONTIGUË de lettres isolées, pas leur concaténation
  // globale. Mesuré le 06/09/2026 : « m.e.r.d.e » était bien attrapé, mais
  // « c'etait m.e.r.d.e » ne l'était plus — le « c » de l'apostrophe se collait devant
  // et donnait « cmerde ». Autrement dit, il suffisait d'écrire un mot avec une
  // apostrophe avant pour désarmer le filtre. Découper en suites corrige les deux
  // sens : ça rattrape ce cas, et ça évite d'assembler des lettres isolées éparpillées
  // dans un long texte en un mot que personne n'a écrit.
  let suite = "";
  for (const m of [...mots, ""]) {
    if (m.length === 1) { suite += m; continue; }
    if (suite.length >= 3) {
      const n = normaliserMot(suite);
      if (n && INTERDITS_NORMALISES.has(n)) return true;
    }
    suite = "";
  }
  return false;
}

/** Le premier mot fautif, pour pouvoir le dire à l'auteur — un refus sans motif
 *  donne l'impression d'un bug. */
export function premierGrosMot(texte: string): string | null {
  if (typeof texte !== "string" || !texte) return null;
  for (const m of texte.split(/[^\p{L}\p{N}@$!|*+]+/u).filter(Boolean)) {
    if (INTERDITS_NORMALISES.has(normaliserMot(m))) return m;
    if (m.includes(JOKER) && estMasque(m)) return m;
  }
  return null;
}

/** Nombre de formes surveillées — sert au test qui vérifie que la liste n'a pas été
 *  vidée par accident lors d'une édition. */
export const NB_FORMES_SURVEILLEES = INTERDITS_NORMALISES.size;

/**
 * LA porte de modération. À utiliser partout, plutôt que d'appeler les deux fonctions
 * à la main — c'est en les appelant à la main qu'on en oublie une.
 *
 * ⚠️ `premierGrosMot` sait NOMMER le mot fautif (un refus sans motif passe pour un bug),
 * mais il ne rattrape PAS les lettres espacées ou pointées (« m e r d e », « m.e.r.d.e »),
 * que seul `contientGrosMot` recolle. Mesuré le 06/09/2026 : les routes des publications
 * ET des commentaires ne se servaient que de la première, et laissaient donc passer le
 * contournement le plus évident, sans que rien ne le signale.
 */
export function verdictGrossierete(texte: string): { propre: true } | { propre: false; mot: string | null } {
  if (!contientGrosMot(texte)) return { propre: true };
  return { propre: false, mot: premierGrosMot(texte) };
}
