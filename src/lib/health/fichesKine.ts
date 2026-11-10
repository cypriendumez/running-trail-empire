// ─────────────────────────────────────────────────────────────────────────────
//  LES FICHES DE PRÉVENTION — de l'INFORMATION générale, signée par un kinésithérapeute.
//
//  Le Kiné IA a été retiré le 09/11/2026 (lib/health/kineIa) : proposer des exercices
//  pour LA douleur d'un coureur, c'est un traitement — donc un dispositif médical
//  (règlement 2017/745, MDCG 2019-11), interdit aussi par les conditions de Gemini.
//  Cyprien, 10/11/2026 : « ça peut pas proposer des idées d'exercices ? ».
//
//  Ce qui reste possible, et que fait ce module : des fiches GÉNÉRALES, identiques pour
//  tous, écrites ou relues et SIGNÉES par un masseur-kinésithérapeute diplômé. L'appli
//  propose la fiche de la RÉGION signalée (« tu as signalé le tibia : voici la fiche de
//  prévention »), comme une bibliothèque range un livre au bon rayon. Rien n'est adapté
//  à la douleur de la personne : ni niveau, ni durée, ni protocole individuel.
//
//  ⚠️ AUCUNE FICHE N'EST AFFICHÉE SANS SIGNATURE. Une fiche sans `validation` complète
//  (nom, numéro RPPS à 11 chiffres, date) reste invisible, quoi qu'elle contienne. Les
//  brouillons ne vivent PAS ici (le dépôt est public) : ils sont dans ~/Desktop/Pacevo/,
//  en attente de relecture. Une fiche n'entre dans `FICHES` qu'une fois signée.
//
//  ⚠️ AUCUNE IA ne produit ni ne choisit le contenu : le texte est celui que le
//  professionnel a signé, mot pour mot, dans chaque langue qu'il a validée.
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
  return !!v && v.nom.trim().length >= 3 && /^\d{11}$/.test(v.rpps) && /^\d{4}-\d{2}-\d{2}$/.test(v.date) && !Number.isNaN(Date.parse(v.date));
}

/**
 * LES FICHES PUBLIÉES. Vide tant qu'aucun kinésithérapeute n'a signé : c'est voulu.
 * Pour en ajouter une : son texte exact, par langue relue, et sa `validation`.
 */
export const FICHES: Fiche[] = [];

export type FicheAffichee = ContenuFiche & { id: string; signataire: string; relueLe: string };

/** Les fiches à proposer pour ces douleurs, dans cette langue : signées, de la bonne région, traduites et relues. */
export function fichesPour(douleurs: readonly string[], lang: Lang, fiches: readonly Fiche[] = FICHES): FicheAffichee[] {
  const regions = new Set(douleurs.map(regionDe).filter((r): r is Region => r != null));
  if (!regions.size) return [];
  return fiches
    .filter((f) => ficheSignee(f) && f.regions.some((r) => regions.has(r)) && f.contenu[lang])
    .map((f) => ({ ...f.contenu[lang]!, id: f.id, signataire: f.validation!.nom, relueLe: f.validation!.date }));
}
