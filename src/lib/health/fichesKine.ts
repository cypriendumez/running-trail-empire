// ─────────────────────────────────────────────────────────────────────────────
//  LES FICHES DE PRÉVENTION — de l'INFORMATION générale, signée par un kinésithérapeute.
//
//  Le Kiné IA a été retiré le 09/11/2026 (lib/health/kineIa) : proposer des exercices
//  pour LA douleur d'un coureur, c'est un traitement — donc un dispositif médical
//  (règlement 2017/745, MDCG 2019-11), interdit aussi par les conditions de Gemini.
//  Cyprien, 10/11/2026 : « ça peut pas proposer des idées d'exercices ? ».
//
//  Ce qui reste possible, et que fait ce module : une BIBLIOTHÈQUE de fiches GÉNÉRALES,
//  identiques pour tous, écrites ou relues et SIGNÉES par un masseur-kinésithérapeute
//  diplômé. Toutes sont ouvertes à tous ; celles de la région signalée passent en tête,
//  comme une bibliothèque range un livre au bon rayon. Rien n'est adapté à la douleur de
//  la personne : ni niveau, ni durée, ni protocole individuel.
//
//  ⚠️ RELECTURE JURIDIQUE (10/11/2026) — à tenir pour chaque fiche publiée :
//   · TITRE PAR RÉGION OU PAR THÈME, JAMAIS PAR PATHOLOGIE (« Tibia : prévention chez le
//     coureur », pas « Prévenir la périostite ») : un nom de maladie servi en réponse à un
//     symptôme ressemble à un diagnostic ;
//   · aucun texte, ni ici ni dans le marketing, ne dit « pour ta douleur » ;
//   · la signature est donnée LANGUE PAR LANGUE (`langues`) : « relue par X » n'apparaît
//     jamais sous une traduction que X n'a pas relue ;
//   · nom et RPPS du signataire entrent dans un dépôt PUBLIC et dans son historique : ils
//     n'y entrent qu'avec son accord écrit (contrat de relecture et de cession de droits) ;
//   · une relecture payée le dit (`remuneree`) ; aucun lien vers son cabinet, aucune
//     affiliation (publicité par un tiers, compérage).
//
//  ⚠️ AUCUNE FICHE N'EST AFFICHÉE SANS SIGNATURE. Une fiche sans `validation` complète
//  (nom, numéro RPPS à 11 chiffres, date) reste invisible, quoi qu'elle contienne. Les
//  brouillons ne vivent PAS ici (le dépôt est public) : ils sont dans ~/Desktop/Pacevo/,
//  en attente de relecture. Une fiche n'entre dans `FICHES` qu'une fois signée.
//
//  ⚠️ AUCUNE IA ne choisit ni ne modifie le texte PUBLIÉ : il est celui que le
//  professionnel a signé, mot pour mot, dans chaque langue qu'il a relue ; le texte final
//  engage le seul signataire. (Les brouillons qui lui sont soumis peuvent, eux, avoir été
//  rédigés avec une IA : c'est dit dans leur en-tête.)
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/base";

/** L'annuaire officiel de l'Ordre des masseurs-kinésithérapeutes (vérifié le 10/11/2026). */
export const ANNUAIRE_KINE = "https://www.ordremk.fr/je-suis-patient/trouver-un-kinesitherapeute/";

/** Les régions du corps auxquelles une fiche se range. */
export type Region = "tibia" | "mollet-achille" | "cheville-pied" | "genou" | "hanche" | "cuisse" | "dos";

/**
 * D'où viennent les douleurs : le schéma corporel de Santé (`face:shinL`…) et le ressenti
 * d'après séance (« Tibia (périoste) »…). Les deux se ramènent à une région.
 */
const PAR_EMPLACEMENT: Record<string, Region> = {
  shinL: "tibia", shinR: "tibia",
  ankleL: "cheville-pied", ankleR: "cheville-pied", footL: "cheville-pied", footR: "cheville-pied",
  kneeL: "genou", kneeR: "genou",
  hipL: "hanche", hipR: "hanche",
  thighL: "cuisse", thighR: "cuisse",
};
const PAR_RESSENTI: Record<string, Region> = {
  "Tibia (périoste)": "tibia",
  "Mollet": "mollet-achille",
  "Tendon d'Achille": "mollet-achille",
  "Pied / cheville": "cheville-pied",
  "Genou": "genou",
  "Hanche": "hanche",
  "Cuisse": "cuisse",
  "Ischio-jambier": "cuisse",
  "Dos / bas du dos": "dos",
};

/** La région d'une douleur : clé du schéma (`face:shinL`) ou libellé du ressenti ; `null` si aucune. */
export function regionDe(cleOuLibelle: string): Region | null {
  const s = String(cleOuLibelle ?? "").trim();
  const emplacement = s.includes(":") ? s.split(":").pop()! : s;
  return PAR_EMPLACEMENT[emplacement] ?? PAR_RESSENTI[s.replace(/\s*\(\s*\d+\s*\/\s*\d+\s*\)\s*$/, "")] ?? null;
}

/** La signature du professionnel qui a écrit ou relu la fiche. */
export type Validation = {
  /** Prénom et nom, tels qu'inscrits à l'Ordre. */
  nom: string;
  /** Numéro RPPS (11 chiffres) : vérifiable par chacun dans l'annuaire santé. */
  rpps: string;
  /** Date de la relecture (AAAA-MM-JJ) : une fiche se relit, elle ne se fige pas. */
  date: string;
  /** Les langues que CE signataire a relues : une traduction non relue n'est pas affichée. */
  langues: Lang[];
  /** Relecture payée par Pacevo : la fiche le dit (transparence). */
  remuneree: boolean;
};

export type ContenuFiche = { titre: string; resume: string; sections: { titre: string; points: string[] }[] };

export type Fiche = {
  id: string;
  regions: Region[];
  /** Le texte signé, langue par langue : une langue non relue n'est pas affichée. */
  contenu: Partial<Record<Lang, ContenuFiche>>;
  validation: Validation | null;
};

/** Une signature complète : nom, RPPS à 11 chiffres, date réelle. */
export function ficheSignee(f: Pick<Fiche, "validation">): boolean {
  const v = f.validation;
  if (!v || v.nom.trim().length < 3 || !/^\d{11}$/.test(v.rpps) || !Array.isArray(v.langues) || typeof v.remuneree !== "boolean") return false;
  // Une date calendaire réelle (« 2026-02-30 » est refusée) et passée.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.date);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && d.getTime() <= Date.now();
}

/**
 * LES FICHES PUBLIÉES. Vide tant qu'aucun kinésithérapeute n'a signé : c'est voulu.
 * Pour en ajouter une : son texte exact, par langue relue, et sa `validation`.
 */
export const FICHES: Fiche[] = [];

/**
 * Un TITRE ne nomme jamais une pathologie (relecture juridique du 10/11/2026) : servi après
 * un symptôme, il ressemblerait à un diagnostic. Le corps du texte peut en parler. Liste en
 * 5 langues ; une fiche dont le titre en contient un n'est pas affichée.
 */
export const PATHOLOGIE_DANS_TITRE = /p[ée]riost|tendin|fasci|syndrome|fractur|entorse|l[ée]sion|shin\s*splint|sprain|strain|stress|bursit|zerrung|verstauchung|esguince|rotura|entors|les[ãa]o/i;

/** Tous les titres de la fiche (dans toutes ses langues) sont neutres : région ou thème. */
export function titresNeutres(f: Pick<Fiche, "contenu">): boolean {
  return Object.values(f.contenu).every((c) => !c || !PATHOLOGIE_DANS_TITRE.test(c.titre));
}

export type FicheAffichee = ContenuFiche & {
  id: string; signataire: string; rpps: string; relueLe: string; remuneree: boolean;
  /** La fiche porte sur une région que l'athlète a signalée : elle passe en tête. */
  regionSignalee: boolean;
};

/**
 * La bibliothèque dans cette langue : toutes les fiches signées et relues dans cette langue,
 * celles des régions signalées EN TÊTE. Ouverte à tous, douleur ou non : c'est de
 * l'information générale, pas une réponse à une douleur.
 */
export function fichesPour(douleurs: readonly string[], lang: Lang, fiches: readonly Fiche[] = FICHES): FicheAffichee[] {
  const regions = new Set(douleurs.map(regionDe).filter((r): r is Region => r != null));
  return fiches
    .filter((f) => ficheSignee(f) && titresNeutres(f) && f.validation!.langues.includes(lang) && f.contenu[lang])
    .map((f) => ({
      ...f.contenu[lang]!, id: f.id, signataire: f.validation!.nom, rpps: f.validation!.rpps,
      relueLe: f.validation!.date, remuneree: f.validation!.remuneree,
      regionSignalee: f.regions.some((r) => regions.has(r)),
    }))
    .sort((a, b) => Number(b.regionSignalee) - Number(a.regionSignalee));
}
