/**
 * LES COMPTES SOCIAUX DE PACEVO — UNE SEULE COPIE.
 *
 * Même règle que `lib/brand/editeur` (identité légale), `lib/billing/prix` (tarifs) et
 * `lib/brand/stats` (chiffres affichés) : une adresse recopiée à deux endroits finit
 * toujours par diverger, et c'est le jour d'un changement de compte qu'on s'en aperçoit —
 * en laissant un lien mort derrière soi.
 *
 * ⚠️ L'ADRESSE INSTAGRAM EST VOLONTAIREMENT NETTOYÉE. Celle donnée à l'origine portait
 * `?stkn=…&utm_source=qr` : c'est le jeton d'un partage par QR code, propre à l'appareil
 * qui l'a généré. Publier un jeton de partage dans le pied de page de tout un site, c'est
 * au mieux un lien qui expire, au pire une trace de session exposée. Le profil public se
 * suffit à lui-même.
 */
export type Reseau = { cle: "tiktok" | "instagram" | "linkedin"; nom: string; url: string };

export const RESEAUX: Reseau[] = [
  { cle: "tiktok", nom: "TikTok", url: "https://www.tiktok.com/@pacevo.fr" },
  { cle: "instagram", nom: "Instagram", url: "https://www.instagram.com/pacevo.fr" },
  { cle: "linkedin", nom: "LinkedIn", url: "https://www.linkedin.com/company/pacevo/" },
];
