/**
 * INVITER SES AMIS — les adresses de partage, une par application.
 *
 * Cyprien, 29/09/2026 : « fais fonctionner le bouton inviter, je veux que l'individu puisse
 * inviter ses potes sur Messages, Instagram, etc., comme sur la plupart des applications ».
 * Le bouton ne connaissait QUE la feuille de partage du navigateur : sur Mac, choisir une
 * application y levait une erreur, affichée « Partage impossible » ; et Instagram n'y
 * figure jamais. D'où une feuille à nous, une rangée d'applications, puis « Plus… » pour
 * la feuille du système.
 *
 * ⚠️ INSTAGRAM (et Messenger hors téléphone) N'ACCEPTENT AUCUN TEXTE PAR ADRESSE : pas
 * d'équivalent de `wa.me/?text=`. On COPIE le lien, on ouvre la messagerie, et on le dit
 * (« colle-le dans ta conversation ») — ne rien dire laisserait croire à un envoi raté.
 *
 * Tout est pur : `FeuilleInvitation` affiche, ce module décide.
 */

export type Cible = "messages" | "whatsapp" | "instagram" | "messenger" | "telegram" | "x" | "facebook" | "email";

/** L'ordre d'affichage : ce qu'on utilise le plus pour écrire à un ami, d'abord. */
export const CIBLES: readonly Cible[] = ["messages", "whatsapp", "instagram", "messenger", "telegram", "email", "x", "facebook"];

export type Invitation = { texte: string; url: string; sujet: string };

/**
 * Ce que fait chaque cible : ouvrir une adresse (`href`), et/ou copier le lien d'abord
 * (`copier`) quand l'application ne sait pas recevoir de texte.
 */
export function actionPartage(cible: Cible, inv: Invitation, o: { mobile: boolean }): { href: string; copier: boolean } {
  const e = encodeURIComponent;
  const message = `${inv.texte} ${inv.url}`;
  switch (cible) {
    // `sms:?&body=` : la forme que comprennent à la fois iOS (qui lit `&body`) et Android.
    case "messages": return { href: `sms:?&body=${e(message)}`, copier: false };
    case "whatsapp": return { href: `https://wa.me/?text=${e(message)}`, copier: false };
    case "instagram": return { href: "https://www.instagram.com/direct/inbox/", copier: true };
    case "messenger": return o.mobile
      ? { href: `fb-messenger://share/?link=${e(inv.url)}`, copier: false }
      : { href: "https://www.messenger.com/", copier: true };
    case "telegram": return { href: `https://t.me/share/url?url=${e(inv.url)}&text=${e(inv.texte)}`, copier: false };
    case "x": return { href: `https://x.com/intent/post?text=${e(inv.texte)}&url=${e(inv.url)}`, copier: false };
    case "facebook": return { href: `https://www.facebook.com/sharer/sharer.php?u=${e(inv.url)}`, copier: false };
    case "email": return { href: `mailto:?subject=${e(inv.sujet)}&body=${e(`${inv.texte}\n\n${inv.url}`)}`, copier: false };
  }
}

/**
 * Une erreur de la feuille de partage du système est-elle un vrai échec ? Non si
 * l'athlète a simplement fermé la feuille (`AbortError`). Tout le reste (Mac, navigateur
 * qui refuse) retombe sur la copie du lien — jamais sur « Partage impossible » sec.
 */
export const estAnnulation = (e: unknown) => (e as { name?: string } | null)?.name === "AbortError";

/** Un appareil tactile à petit écran : là, les liens profonds (`fb-messenger://`) ouvrent l'application. */
export const estMobile = (ua: string) => /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
