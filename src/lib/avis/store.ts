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
 *
 * ── LES GROSSIÈRETÉS SONT REFUSÉES À LA SOUMISSION ───────────────────────────
 * Décision de Cyprien le 23/08/2026. Jusque-là, le filtre de `lib/social/moderation`
 * n'était branché QUE sur le fil communautaire : un avis pouvait contenir n'importe
 * quelle insulte, seule la relecture manuelle l'arrêtait avant publication.
 *
 * ⚠️ CE QUE CE REFUS NE DOIT JAMAIS DEVENIR. Il porte sur les MOTS, jamais sur la note
 * ni sur le fond. Un avis d'une étoile, dur, argumenté et poli passe exactement comme
 * un avis de cinq. Le jour où ce filtre servirait à écarter une critique, il tomberait
 * sous la même interdiction que les faux avis — directive (UE) 2019/2161. Le risque a
 * été exposé à Cyprien avant qu'il tranche : un avis sincère mais énervé
 * (« putain, c'est trop dur ») est refusé et son auteur doit le reformuler.
 */

import { contientGrosMot, premierGrosMot } from "@/lib/social/moderation";
import { TEXTE_MIN, TEXTE_MAX, REPONSE_MAX } from "./bornes";
export { REPONSE_MAX };

export type Avis = {
  note: number;      // 1 à 5
  texte: string;
  auteur: string;    // « Prénom N. », figé à la soumission
  at: string;        // ISO
  publie: boolean;
  /**
   * LA RÉPONSE DE L'ÉDITEUR, publiée sous l'avis.
   *
   * ⚠️ UN CHAMP SÉPARÉ, ET C'EST TOUT L'INTÉRÊT. La page publique promet des avis
   * « publiés tels qu'ils sont écrits, sans les retoucher ». Répondre en modifiant
   * `texte` détruirait cette promesse en silence — on ne saurait plus ce que l'athlète
   * avait écrit. La réponse vit à côté, elle est attribuée, et le texte d'origine reste
   * intact et vérifiable.
   *
   * C'est aussi ce que font App Store, Google Play et Google : la réponse du
   * professionnel s'affiche SOUS l'avis, jamais à sa place.
   */
  reponse?: string;
  /** Horodatage de la réponse — une réponse sans date ne se distingue pas d'une
   *  réponse d'il y a deux ans, et c'est justement ce qu'un lecteur regarde. */
  reponseAt?: string;
};



export const TYPE_AVIS = "avis";
// Réexportées depuis `bornes.ts`, qui n'importe RIEN : c'est ce fichier-là que le
// formulaire client importe, pour que la liste de grossièretés reste côté serveur.
export { TEXTE_MIN, TEXTE_MAX } from "./bornes";

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
  // ⚠️ LES DEUX FONCTIONS, PAS UNE SEULE. `premierGrosMot` sait NOMMER le mot fautif —
  // un refus sans motif passe pour un bug — mais il ne rattrape PAS les lettres espacées
  // (« m e r d e »), que seul `contientGrosMot` recolle. Ne garder que la première
  // laisserait donc passer le contournement le plus évident, sans que rien ne le signale.
  if (contientGrosMot(t)) {
    const fautif = premierGrosMot(t);
    return fautif
      ? `Ton avis contient « ${fautif} » : reformule-le sans ce mot et il partira en relecture.`
      : "Ton avis contient une grossièreté : reformule-le et il partira en relecture.";
  }
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
    // ⚠️ Une réponse vide n'est PAS une réponse : `""` afficherait un bloc « L'équipe
    // Pacevo a répondu » suivi de rien, ce qui est pire que pas de réponse du tout.
    ...(typeof d.reponse === "string" && d.reponse.trim()
      ? { reponse: d.reponse.trim().slice(0, REPONSE_MAX), reponseAt: typeof d.reponseAt === "string" ? d.reponseAt : "" }
      : {}),
  };
}

/**
 * Valide une réponse avant de l'enregistrer. Rend le motif du refus, ou `null`.
 *
 * ⚠️ LA CHAÎNE VIDE EST UNE VALEUR LÉGITIME : elle SUPPRIME la réponse. C'est le seul
 * moyen de revenir en arrière sur une réponse écrite trop vite, et une modération sans
 * marche arrière pousse à ne jamais répondre.
 */
export function refusReponse(texte: unknown): string | null {
  if (typeof texte !== "string") return "Réponse invalide.";
  const t = texte.trim();
  if (!t) return null;
  if (t.length > REPONSE_MAX) return `Ta réponse ne doit pas dépasser ${REPONSE_MAX} caractères.`;
  return null;
}
