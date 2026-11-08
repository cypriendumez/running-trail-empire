/**
 * LES RÈGLES D'UN NOUVEAU MOT DE PASSE — une seule copie, lue par le navigateur (la liste
 * cochée sous le champ) ET par le serveur (qui refuse). Module pur : ni réseau, ni secret,
 * il peut entrer dans le bundle client.
 *
 * Pourquoi ces seuils (08/11/2026) :
 * - **12 caractères, au moins 3 familles** (minuscules, majuscules, chiffres, symboles) : la
 *   CNIL (délibération 2022-100) demande l'équivalent de 80 bits d'entropie pour un mot de
 *   passe seul, 50 bits quand le nombre de tentatives est limité (Supabase limite par adresse
 *   IP). 12 caractères sur 3 familles ≈ 70 bits : entre les deux, au-dessus du second.
 * - **ou 16 caractères et plus, sans exigence de familles** : une phrase de passe (« quatre
 *   mots au hasard ») est plus longue à deviner qu'un `Pacevo2026!` et plus facile à retenir.
 * - **72 octets au plus** : GoTrue (v2.197, `MaxPasswordLength`) refuse au-delà, parce que
 *   bcrypt ignore tout ce qui dépasse. On le dit avant, plutôt qu'une erreur anglaise après.
 * - **ni l'adresse e-mail, ni le nom de l'app** dedans : c'est le premier essai d'un attaquant.
 *
 * Le refus des mots de passe DÉJÀ FUITÉS (Have I Been Pwned) se fait au serveur seulement,
 * voir `motDePasseFuite.ts` : il demande un appel réseau.
 *
 * ⚠️ Ces règles s'appliquent à un mot de passe qu'on CHOISIT (inscription, réinitialisation,
 * réglages). Un compte existant avec un ancien mot de passe de 8 caractères se connecte
 * toujours : personne n'est enfermé dehors par un changement de règle.
 */

export const MDP_MIN = 12;
export const MDP_PHRASE = 16;
export const MDP_MAX_OCTETS = 72;
export const MDP_FAMILLES_MIN = 3;
/** Caractères DIFFÉRENTS exigés : sans eux, 16 « a » ou 16 espaces passaient pour une phrase de passe. */
export const MDP_DISTINCTS_MIN = 6;

export type RaisonMotDePasse = "longueur" | "familles" | "variete" | "trop_long" | "contient_email" | "contient_marque";

/** Nombre de familles de caractères présentes : minuscules, majuscules, chiffres, symboles. */
export function famillesDe(mdp: string): number {
  return [/\p{Ll}/u, /\p{Lu}/u, /\p{Nd}/u, /[^\p{L}\p{Nd}]/u].filter((re) => re.test(mdp)).length;
}

/** Longueur en caractères (un « é » ou un emoji compte pour un, pas pour deux). */
export function longueurDe(mdp: string): number {
  return [...mdp].length;
}

/** La partie de l'adresse avant « @ », si elle est assez longue pour être un vrai indice. */
function identifiantDe(email: string | null | undefined): string | null {
  const local = String(email ?? "").split("@")[0]?.trim().toLowerCase() ?? "";
  return local.length >= 4 ? local : null;
}

/**
 * Les règles que `mdp` ne respecte pas (liste vide = accepté). L'ordre est celui de l'affichage.
 * `email` : l'adresse du compte, pour refuser un mot de passe qui la contient.
 */
export function verifierRegles(mdp: string, email?: string | null): RaisonMotDePasse[] {
  const raisons: RaisonMotDePasse[] = [];
  const n = longueurDe(mdp);
  if (n < MDP_MIN) raisons.push("longueur");
  if (n < MDP_PHRASE && famillesDe(mdp) < MDP_FAMILLES_MIN) raisons.push("familles");
  if (mdp && new Set([...mdp.toLowerCase()]).size < MDP_DISTINCTS_MIN) raisons.push("variete");
  if (new TextEncoder().encode(mdp).length > MDP_MAX_OCTETS) raisons.push("trop_long");
  const bas = mdp.toLowerCase();
  const id = identifiantDe(email);
  if (id && bas.includes(id)) raisons.push("contient_email");
  if (bas.includes("pacevo")) raisons.push("contient_marque");
  return raisons;
}
