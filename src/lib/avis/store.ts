/**
 * LES AVIS — écrits par de vraies personnes, ou pas du tout.
 *
 * Cette page publiait 26 témoignages fabriqués jusqu'au 21/08/2026. Ce module est ce qui
 * permet de tenir la promesse affichée à leur place : « n'afficher que des avis de
 * personnes ayant réellement un compte ».
 *
 * ── AUCUNE MIGRATION ─────────────────────────────────────────────────────────
 * Les avis vivent dans `notifications`, le fourre-tout typé du projet, sous le type
 * `avis` — comme `auto_coach_state`, `race_objective` ou `user_settings` avant eux. La
 * ligne appartient à l'utilisateur (`user_id`), ce qui donne gratuitement la règle
 * « un compte = un avis » et le droit de le modifier.
 *
 * ── CE QUI EST PUBLIÉ, ET CE QUI NE L'EST PAS ────────────────────────────────
 * ⚠️ Le nom complet n'est JAMAIS publié. On fige à la soumission un « Prénom N. », et
 * c'est cette chaîne-là qui s'affiche : recalculer plus tard depuis le profil ferait
 * changer un avis déjà publié si la personne renomme son compte.
 *
 * ⚠️ `publie` est faux au départ. La modération sert à écarter l'insulte et le spam,
 * JAMAIS à trier par note — filtrer les avis négatifs est précisément ce que la
 * directive (UE) 2019/2161 interdit, au même titre que les inventer.
 */

export type Avis = {
  note: number;      // 1 à 5
  texte: string;
  auteur: string;    // « Prénom N. », figé à la soumission
  at: string;        // ISO
  publie: boolean;
};

export const TYPE_AVIS = "avis";
export const TEXTE_MIN = 40;
export const TEXTE_MAX = 600;

/**
 * « Cyprien Dumez » → « Cyprien D. ». Un nom seul reste tel quel, un nom vide devient
 * anonyme — on n'affiche jamais une chaîne vide devant des étoiles.
 */
export function nomAffiche(fullName: string | null | undefined): string {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Un coureur";
  const prenom = parts[0];
  if (parts.length === 1) return prenom;
  return `${prenom} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * Valide ce qu'on s'apprête à stocker. Rend le motif du refus, ou `null` si tout va bien.
 *
 * ⚠️ Le texte est borné DANS LES DEUX SENS. Trop court, ce n'est pas un avis mais un
 * clic ; trop long, la carte devient illisible et le champ un vecteur d'abus.
 */
export function refusDe(note: unknown, texte: unknown): string | null {
  if (typeof note !== "number" || !Number.isInteger(note) || note < 1 || note > 5) {
    return "La note doit être un entier de 1 à 5.";
  }
  const t = typeof texte === "string" ? texte.trim() : "";
  if (t.length < TEXTE_MIN) return `Ton avis doit faire au moins ${TEXTE_MIN} caractères.`;
  if (t.length > TEXTE_MAX) return `Ton avis ne doit pas dépasser ${TEXTE_MAX} caractères.`;
  return null;
}

/** Ce que le SERVEUR construit à partir d'une soumission valide. Jamais le client. */
export function avisDe(note: number, texte: string, fullName: string | null | undefined): Avis {
  return {
    note,
    texte: String(texte).trim().slice(0, TEXTE_MAX),
    auteur: nomAffiche(fullName),
    at: new Date().toISOString(),
    // ⚠️ TOUJOURS faux ici. Un client qui enverrait `publie: true` ne doit rien pouvoir
    // publier : la valeur ne vient jamais de la requête.
    publie: false,
  };
}

/** Lit une ligne `notifications` comme un avis, ou rend `null` si elle n'en est pas un. */
export function litAvis(data: unknown): Avis | null {
  const d = data as Partial<Avis> | null;
  if (!d || typeof d.note !== "number" || typeof d.texte !== "string" || !d.texte.trim()) return null;
  return {
    note: Math.min(5, Math.max(1, Math.round(d.note))),
    texte: d.texte,
    auteur: typeof d.auteur === "string" && d.auteur.trim() ? d.auteur : "Un coureur",
    at: typeof d.at === "string" ? d.at : "",
    publie: d.publie === true,
  };
}
