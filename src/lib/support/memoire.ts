import { HELP_PAGES, HELP_FACTS, HELP_PROBLEMS } from "@/data/helpKb";

/**
 * MÉMOIRE DES QUESTIONS DU SUPPORT.
 *
 * L'assistant repartait de zéro à chaque question : la même demande, posée par cent
 * personnes, coûtait cent appels au modèle et pouvait recevoir cent formulations
 * différentes. Les questions et leurs réponses sont désormais conservées, et une
 * question déjà traitée est resservie sans appel.
 *
 * ⚠️ CE QUI NE DOIT SURTOUT PAS ÊTRE RESSERVI.
 * L'assistant lit l'ÉTAT RÉEL du compte : « ta montre n'est pas connectée », « tu n'as
 * pas encore déclaré ton état de santé ». Rejouer une telle réponse à quelqu'un d'autre
 * — ou au même une semaine plus tard — serait un mensonge, et une fuite : cela
 * raconterait le compte d'un tiers. Une réponse n'est donc mise en mémoire QUE si elle
 * a été produite sans aucun constat de compte, et elle n'est resservie QUE si le compte
 * qui la redemande n'en a aucun non plus. C'est la garantie structurelle : le doute est
 * tranché à l'écriture ET à la lecture.
 *
 * La base de connaissances évolue à chaque déploiement. Une empreinte de `helpKb` est
 * stockée avec chaque réponse : si elle change, tout ce qui a été mémorisé avant est
 * ignoré. Sans cela, l'assistant continuerait d'indiquer un chemin de clics supprimé,
 * avec l'assurance d'une réponse « déjà validée ».
 */

/** Empreinte de la base de connaissances. Change dès qu'une page, un fait ou une fiche
 *  de dépannage bouge — ce qui périme automatiquement tout ce qui a été mémorisé. */
export function empreinteKb(): string {
  const base = [
    HELP_PAGES.map((p) => `${p.path}|${p.what}|${p.how ?? ""}`).join(";"),
    HELP_FACTS.join(";"),
    HELP_PROBLEMS.map((p) => `${p.q}|${p.a}`).join(";"),
  ].join("~");
  // Hachage FNV-1a : court, stable d'une exécution à l'autre, sans dépendance.
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Forme canonique d'une question : c'est elle qui décide si deux formulations sont
 * « la même question ».
 *
 * ⚠️ Volontairement PRUDENTE. On enlève la ponctuation, les accents, la casse et une
 * courte liste de mots vides — pas plus. Une normalisation trop agressive (racinisation,
 * suppression des négations) ferait passer « comment activer les notifications » et
 * « comment DÉSACTIVER les notifications » pour la même question, et l'assistant
 * répondrait le contraire de ce qu'on lui demande. Les négations sont donc conservées.
 */
const MOTS_VIDES = new Set([
  "je", "j", "tu", "il", "elle", "on", "nous", "vous", "ils", "me", "moi", "te", "toi", "se",
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "au", "aux", "a", "l",
  "et", "ou", "que", "qu", "est", "ce", "cet", "cette", "ces", "mon", "ma", "mes",
  "s", "il", "y", "en", "svp", "stp", "merci", "bonjour", "salut", "coucou", "hello",
  "the", "a", "an", "is", "do", "does", "i", "my", "me", "to", "for", "please", "hi",
]);

export function normaliserQuestion(q: string): string {
  const sansAccents = String(q ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const mots = sansAccents
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((m) => m && !MOTS_VIDES.has(m));
  return mots.join(" ").trim();
}

export type EntreeMemoire = {
  /** Question telle qu'elle a été posée — c'est elle qui a de la valeur pour toi. */
  q: string;
  /** Forme canonique, la clé de rapprochement. */
  cle: string;
  /** Réponse servie. */
  a: string;
  lang: string;
  /** Empreinte de `helpKb` au moment de la réponse. */
  kb: string;
  /** `true` seulement si AUCUN constat de compte n'est entré dans la réponse. */
  generique: boolean;
  /** D'où venait la réponse : base de connaissances, modèle, ou mémoire. */
  source: "base" | "modele" | "memoire";
  at: string;
};

/** Une entrée mémorisée est-elle utilisable ICI ET MAINTENANT ? */
export function utilisable(
  e: Pick<EntreeMemoire, "generique" | "kb" | "lang" | "a">,
  ctx: { lang: string; kb: string; compteAvecConstats: boolean },
): boolean {
  if (!e.generique) return false;             // la réponse parlait d'un compte précis
  if (ctx.compteAvecConstats) return false;   // ce compte-ci a un problème à signaler
  if (e.kb !== ctx.kb) return false;          // l'app a changé depuis
  if (e.lang !== ctx.lang) return false;      // une réponse ne se traduit pas toute seule
  return typeof e.a === "string" && e.a.trim().length > 0;
}
