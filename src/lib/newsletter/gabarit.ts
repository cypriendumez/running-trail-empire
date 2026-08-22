/**
 * LA COQUILLE DES E-MAILS — une seule, pour tous les envois.
 *
 * ⚠️ Il y en avait DEUX, écrites séparément : l'accusé d'inscription et la lettre du
 * lundi. Elles avaient déjà divergé — la lettre affichait un lien « Se désinscrire »
 * propre, l'accusé collait l'URL brute en toutes lettres, soixante-dix caractères de
 * jeton compris, ce qui donnait trois lignes vertes illisibles au bas du message. Deux
 * copies d'un habillage divergent toujours ; celle-ci est la seule.
 *
 * ── CE QUI EST VOULU, ET POURQUOI ────────────────────────────────────────────
 * · Fond gris, carte blanche, coins arrondis : c'est ce qui distingue un message soigné
 *   d'un bloc de texte collé sur du blanc.
 * · Largeur bornée à 600 px — au-delà, les lignes deviennent trop longues à lire, et
 *   c'est la largeur que tous les clients de messagerie savent rendre.
 * · Le logo est une IMAGE HÉBERGÉE, avec un `alt`. La plupart des clients bloquent les
 *   images par défaut : sans `alt`, l'en-tête d'un message sur deux serait vide. Le mot
 *   « PACEVO » est écrit à côté, en texte, et reste donc toujours lisible.
 * · Aucune police externe. Une police web ne se charge pas dans un e-mail ; on s'appuie
 *   sur la pile système, qui rend correctement partout.
 */

/** Échappe ce qui part dans du HTML d'e-mail. Un titre d'article contient des `&`. */
export const ech = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function coquilleEmail(opts: {
  /** L'adresse du site, pour le logo et les liens. */
  base: string;
  /** Petite ligne au-dessus du titre (« Semaine du 21 août »), déjà échappée. */
  surtitre?: string;
  /** Le contenu, déjà en HTML et déjà échappé. */
  corps: string;
  /** Le pied de page, déjà en HTML : mentions, raison de l'envoi, désinscription. */
  pied: string;
}): string {
  const { base, surtitre, corps, pied } = opts;
  const logo = `${base.replace(/\/$/, "")}/icon.png`;
  return `<div style="margin:0;padding:24px 12px;background:#f4f4f5;font-family:${POLICE}">
  <div style="max-width:600px;margin:0 auto">

    <div style="padding:0 4px 18px;text-align:left">
      <img src="${ech(logo)}" width="40" height="40" alt="Pacevo"
        style="display:inline-block;vertical-align:middle;border-radius:9px;border:0" />
      <span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:15px;font-weight:800;letter-spacing:.16em;color:#18181b">PACEVO</span>
    </div>

    <div style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e4e4e7">
      ${surtitre ? `<div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669">${surtitre}</div>` : ""}
      ${corps}
    </div>

    <div style="padding:18px 8px 4px;font-size:12px;line-height:1.65;color:#a1a1aa">
      ${pied}
    </div>

  </div>
</div>`;
}

/**
 * La ligne de désinscription, en LIEN et jamais en URL brute.
 *
 * ⚠️ L'accusé d'inscription affichait l'adresse complète — `…/api/newsletter/unsubscribe
 * ?e=…%40outlook.fr&t=2780275…` — soit trois lignes de vert au bas d'un message par
 * ailleurs sobre. Le lien porte l'adresse ET son jeton : il est fait pour être cliqué,
 * pas pour être lu.
 */
export function ligneDesinscription(texte: string, lien: string): string {
  return `<a href="${ech(lien)}" style="color:#71717a;text-decoration:underline">${ech(texte)}</a>`;
}
