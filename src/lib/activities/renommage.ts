// ─────────────────────────────────────────────────────────────────────────────
//  RENOMMER UNE SORTIE — ET CE QU'ON REFUSE.
//
//  La montre appelle tout « Rouen Course à pied » : pouvoir renommer, c'est ce que fait
//  Strava et c'est légitime. Mais un champ libre affiché à côté d'une carte est aussi
//  une surface d'abus, et le projet a DÉJÀ une liste de grossièretés
//  (`lib/social/moderation`, celle qui filtre les commentaires) — on la RÉUTILISE plutôt
//  que d'en écrire une seconde qui divergerait au premier ajout.
//
//  Une seule règle pour tous les refus : on dit POURQUOI. Un champ qui refuse sans
//  expliquer pousse l'athlète à réessayer au hasard.
// ─────────────────────────────────────────────────────────────────────────────
import { verdictGrossierete } from "@/lib/social/moderation";

export const TITRE_MAX = 80;
export const DESCRIPTION_MAX = 1000;
/** Au-delà, ce n'est plus de l'emphase, c'est du bruit (« aaaaaaaaaa »). */
export const REPETITIONS_MAX = 4;

export type Refus =
  | { ok: false; motif: "vide" }
  | { ok: false; motif: "trop_long"; max: number }
  | { ok: false; motif: "grossierete"; mot: string }
  | { ok: false; motif: "sans_lettre" }
  | { ok: false; motif: "repetition" }
  | { ok: false; motif: "lien" };
export type Verdict = { ok: true; valeur: string } | Refus;

/** Caractères de contrôle. Invisibles à l'écran, ils servent à masquer du contenu. */
const CONTROLE = /[\u0000-\u001F\u007F]/g;
/** Idem, mais en gardant le saut de ligne, légitime dans une description. */
const CONTROLE_SAUF_SAUT = /[\u0000-\u0009\u000B-\u001F\u007F]/g;

/** Espaces normalisés, caractères de contrôle retirés. Un titre n'a pas de retour ligne. */
export function nettoyerTitre(brut: unknown): string {
  return String(brut ?? "").replace(CONTROLE, " ").replace(/\s+/g, " ").trim();
}

/** Idem, mais les retours à la ligne sont LÉGITIMES dans une description. */
export function nettoyerDescription(brut: unknown): string {
  return String(brut ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROLE_SAUF_SAUT, " ")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const A_DEUX_LETTRES = /\p{L}\s*\p{L}/u;
// Un lien dans un titre de sortie n'est à peu près jamais autre chose que de la publicité.
const LIEN = /(https?:\/\/|www\.|[\w.-]+@[\w.-]+\.\p{L}{2,}|\p{L}[\w-]*\.(?:com|net|org|fr|io|shop|xyz|ru)\b)/iu;

function repetitionExcessive(t: string): boolean {
  let n = 1;
  for (let i = 1; i < t.length; i++) {
    n = t[i] === t[i - 1] ? n + 1 : 1;
    if (n > REPETITIONS_MAX) return true;
  }
  return false;
}

/**
 * Titre proposé par l'athlète. Un titre VIDE n'est pas une faute de frappe : c'est la
 * demande de revenir au nom d'origine — l'appelant le traite comme tel, et ce refus ne
 * sert qu'aux appels qui exigent une valeur.
 */
export function verifierTitre(brut: unknown): Verdict {
  const t = nettoyerTitre(brut);
  if (!t) return { ok: false, motif: "vide" };
  if (t.length > TITRE_MAX) return { ok: false, motif: "trop_long", max: TITRE_MAX };
  if (!A_DEUX_LETTRES.test(t)) return { ok: false, motif: "sans_lettre" };
  if (LIEN.test(t)) return { ok: false, motif: "lien" };
  if (repetitionExcessive(t)) return { ok: false, motif: "repetition" };
  const v = verdictGrossierete(t);
  if (!v.propre) return { ok: false, motif: "grossierete", mot: v.mot ?? "" };
  return { ok: true, valeur: t };
}

/** Description libre. Vide = suppression, donc acceptée telle quelle. */
export function verifierDescription(brut: unknown): Verdict {
  const t = nettoyerDescription(brut);
  if (!t) return { ok: true, valeur: "" };
  if (t.length > DESCRIPTION_MAX) return { ok: false, motif: "trop_long", max: DESCRIPTION_MAX };
  if (LIEN.test(t)) return { ok: false, motif: "lien" };
  const v = verdictGrossierete(t);
  if (!v.propre) return { ok: false, motif: "grossierete", mot: v.mot ?? "" };
  return { ok: true, valeur: t };
}

/**
 * Nom affiché : le choix de l'athlète l'emporte sur celui de la montre, et une chaîne
 * vide en base ne doit jamais effacer le nom d'origine.
 */
export function nomAffiche(perso: string | null | undefined, origine: string | null | undefined, repli: string): string {
  return nettoyerTitre(perso) || nettoyerTitre(origine) || repli;
}
