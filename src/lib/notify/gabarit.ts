/**
 * LE GABARIT COMMUN À TOUS LES E-MAILS PACEVO.
 *
 * ⚠️ EXTRAIT LE 24/08/2026, EN ÉCRIVANT LE DEUXIÈME E-MAIL DE PLAN. Le premier
 * (« ton plan est à jour ») portait sa mise en page en dur. Recopier cette mise en page
 * dans le second aurait produit exactement le défaut qu'on venait de corriger sur les
 * logos : deux habillages écrits séparément DIVERGENT, et le client finit par recevoir
 * deux marques différentes selon le message. Le projet a déjà vécu ça avec l'accusé
 * d'inscription et la lettre du lundi.
 *
 * Tout ce qui est ici a été payé par un vrai défaut, constaté dans une vraie boîte :
 *  · LA LIGNE D'APERÇU. Sans elle, la messagerie affiche le début du corps — la liste
 *    montrait « PACEVO Salut Cyprien, T… », et il fallait ouvrir pour savoir de quoi il
 *    s'agissait.
 *  · LES TABLEAUX. Outlook (Windows) ignore `max-width` sur un bloc : le message
 *    s'étalait sur toute la largeur de la fenêtre.
 *  · LE LOGO DISTANT AVEC SON TEXTE DE REMPLACEMENT. Les messageries bloquent les
 *    images par défaut ; sans `alt`, l'en-tête devient un carré vide.
 *  · LE PIED DE PAGE CLIQUABLE. « Profil → Notifications » obligeait à chercher.
 */
import type { Lang } from "@/lib/i18n/translations";
import { EDITEUR } from "@/lib/brand/editeur";

/** Émeraude de la marque, la même que sur le site. */
export const VERT = "#059669";

/**
 * Échappement HTML. Les titres de séance viennent d'intervals.icu — donc du nom que
 * Garmin a donné à la sortie — et le prénom vient de la base : un chevron casserait la
 * mise en page, et pire, pourrait injecter du balisage.
 */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Une carte grise, pour isoler un bloc d'information. */
export const carte = (inner: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0">
     <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px">${inner}</td></tr>
   </table>`;

/** Le sur-titre d'une carte : petit, capitales, espacé. */
export const titreBloc = (txt: string) =>
  `<div style="font:600 11px/1.4 ${POLICE};text-transform:uppercase;letter-spacing:.09em;color:#64748b">${esc(txt)}</div>`;

/** Une pastille verte, pour l'objectif de course. */
export const pastille = (txt: string) =>
  `<div style="margin-top:14px"><span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:#047857">${esc(txt)}</span></div>`;

/** Le bouton d'action. Une cellule de tableau, pas un `<a>` stylé : Outlook n'applique
 *  pas de fond à un lien en ligne. */
export const bouton = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px">
     <tr><td style="background:${VERT};border-radius:11px">
       <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(label)}</a>
     </td></tr>
   </table>`;

/**
 * L'habillage complet : en-tête, corps, pied de page.
 *
 * ⚠️ `contenu` est du HTML DÉJÀ ÉCHAPPÉ par l'appelant. Le gabarit ne peut pas le faire
 * à sa place : il recevrait des balises légitimes (tableaux, cartes) qu'il transformerait
 * en texte visible.
 */
export function coquille(o: {
  lang: Lang;
  sujet: string;
  /** Ligne lue dans la LISTE des messages, invisible une fois ouvert. */
  apercu: string;
  contenu: string;
  appUrl: string;
  piedTexte: string;
  piedLien: string;
}): string {
  return `<!doctype html>
<html lang="${o.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.sujet)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;font-family:${POLICE};color:#0f172a">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(o.apercu)}${"&#8199;&#65279;&nbsp;".repeat(60)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f6">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px">

    <tr><td style="padding:0 4px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;vertical-align:middle">
          <img src="${esc(o.appUrl)}/icon.png" width="34" height="34" alt="Pacevo"
               style="display:block;width:34px;height:34px;border:0;border-radius:9px">
        </td>
        <td style="vertical-align:middle;font:800 19px/1 ${POLICE};letter-spacing:-.02em;color:${VERT}">PACEVO</td>
      </tr></table>
    </td></tr>

    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:28px 26px">
      ${o.contenu}
    </td></tr>

    <tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#94a3b8">
      ${esc(o.piedTexte)}
      <a href="${esc(o.appUrl)}/dashboard/profile" style="color:#64748b;text-decoration:underline">${esc(o.piedLien)}</a>
      <div style="margin-top:8px">Pacevo &middot; ${esc(EDITEUR.nom)} &middot; <a href="${esc(o.appUrl)}/mentions-legales" style="color:#94a3b8;text-decoration:underline">${esc(o.appUrl.replace(/^https?:\/\//, ""))}</a></div>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}
