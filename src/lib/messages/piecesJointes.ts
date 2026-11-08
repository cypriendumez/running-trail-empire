/**
 * LES PIÈCES JOINTES DE LA MESSAGERIE — PRIVÉES (01/10/2026).
 *
 * ⚠️ ELLES VIVAIENT DANS UN SEAU PUBLIC (`message-attachments`, `getPublicUrl`) : une photo
 * envoyée à un ami ou au coach restait lisible À VIE par quiconque obtenait l'adresse —
 * sans compte, sans mot de passe. Un audit de reprise (Cyprien va vendre l'application) le
 * relèverait au titre de l'article 32 du RGPD (sécurité du traitement). Aucun message n'en
 * contenait encore le jour du changement : rien à reprendre.
 *
 * Désormais :
 *   - le fichier va dans un seau PRIVÉ (`SEAU_PJ`), vérifié privé à chaque dépôt ;
 *   - son chemin ne dit rien : `<compte>/<uuid>.<ext>` — ni nom de fichier ni date ;
 *   - le message ne garde qu'une adresse de l'APPLICATION (`/api/messages/piece?c=…`),
 *     servie après contrôle : l'expéditeur, un destinataire du message, ou le coach ;
 *   - une « pièce jointe » qui n'est pas l'une des nôtres est refusée : un message ne peut
 *     plus porter un lien quelconque déguisé en fichier.
 */

export const SEAU_PJ = "pieces-jointes";
export const ROUTE_PJ = "/api/messages/piece";
export const MAX_PIECES = 5;

export type PieceJointe = { url: string; name: string; type: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const CHEMIN = new RegExp(`^${UUID}/${UUID}\\.(jpeg|png|gif|webp|pdf)$`);

/** Le chemin d'un fichier déposé par ce compte : rien d'autre que deux identifiants. */
export function cheminPiece(userId: string, uuid: string, contentType: string): string {
  const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1];
  return `${userId}/${uuid}.${ext}`;
}

/** Un chemin a-t-il la seule forme que nous fabriquons ? (`..`, `/`, autres seaux : non) */
export function cheminValide(chemin: unknown): chemin is string {
  return typeof chemin === "string" && CHEMIN.test(chemin);
}

/** L'adresse, DANS L'APPLICATION, qui sert ce fichier après contrôle. */
export function urlPiece(chemin: string): string {
  return `${ROUTE_PJ}?c=${encodeURIComponent(chemin)}`;
}

/** Le chemin désigné par une adresse de pièce jointe — ou null si ce n'est pas l'une des nôtres. */
export function cheminDeUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith(`${ROUTE_PJ}?`)) return null;
  let c: string | null;
  try { c = new URLSearchParams(url.slice(ROUTE_PJ.length + 1)).get("c"); } catch { return null; }
  return cheminValide(c) && urlPiece(c) === url ? c : null;
}

/** Les pièces jointes d'un message, telles qu'on accepte de les enregistrer. */
export function nettoyerPieces(brut: unknown): PieceJointe[] {
  if (!Array.isArray(brut)) return [];
  return brut.slice(0, MAX_PIECES).flatMap((x) => {
    const p = (x ?? {}) as Partial<PieceJointe>;
    const chemin = cheminDeUrl(p.url);
    if (!chemin) return [];
    return [{ url: urlPiece(chemin), name: String(p.name ?? "fichier").slice(0, 120) || "fichier", type: String(p.type ?? "").slice(0, 80) }];
  });
}

/**
 * Qui peut ouvrir ce fichier ? Celui qui l'a déposé (son identifiant ouvre le chemin), le
 * coach, ou quelqu'un qui l'a REÇU — `recu` dit si un message de sa boîte le porte.
 */
export function peutOuvrir(p: { chemin: string; userId: string; estCoach: boolean; recu: boolean }): boolean {
  if (!cheminValide(p.chemin) || !p.userId) return false;
  return p.chemin.startsWith(`${p.userId}/`) || p.estCoach || p.recu;
}
