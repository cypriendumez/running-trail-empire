/**
 * L'HABILLAGE DES E-MAILS DE LA NEWSLETTER (accusé, lettre du lundi, alertes).
 *
 * ⚠️ IL ÉTAIT ÉCRIT À CÔTÉ DE CELUI DES E-MAILS DU COACH (`lib/notify/gabarit`), et les
 * deux avaient divergé : celui-ci n'avait ni ligne d'aperçu (la liste des messages
 * montrait « PACEVO Tu es bien inscrit… »), ni tableaux (Outlook ignorait la largeur
 * bornée), ni mention de l'éditeur ; le mot-marque était noir ici et vert là. Un abonné
 * qui recevait l'accusé d'inscription puis « ton plan est à jour » recevait deux marques.
 *
 * Il ne reste donc ici qu'un ADAPTATEUR : même signature qu'avant pour les sept appelants,
 * mais la coquille est celle de `lib/notify/gabarit`, la seule. Le pied de la newsletter
 * (désinscription signée, revue de presse) passe par son champ `pied` sur mesure.
 */
import { coquille, esc, FOND_EMAIL } from "@/lib/notify/gabarit";
import type { Lang } from "@/lib/i18n/translations";

/** Échappe ce qui part dans du HTML d'e-mail. Un titre d'article contient des `&`. */
export const ech = (s: string) => esc(String(s ?? ""));

export { FOND_EMAIL };

export function coquilleEmail(opts: {
  /** L'adresse du site, pour le logo et les liens. */
  base: string;
  /** Petite ligne au-dessus du titre (« Semaine du 21 août »), déjà échappée. */
  surtitre?: string;
  /** Le contenu, déjà en HTML et déjà échappé. */
  corps: string;
  /** Le pied de page, déjà en HTML : mentions, raison de l'envoi, désinscription. */
  pied: string;
  /** Langue du message (attribut `lang` du document). Français à défaut. */
  lang?: Lang;
  /** Objet, repris dans le `<title>` du document. */
  sujet?: string;
  /** Ligne lue dans la LISTE des messages, invisible une fois ouvert. */
  apercu?: string;
}): string {
  const { base, surtitre, corps, pied } = opts;
  const contenu = `${surtitre ? `<div style="font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669">${surtitre}</div>` : ""}
      ${corps}`;
  return coquille({
    lang: opts.lang ?? "fr",
    sujet: opts.sujet ?? "Pacevo",
    apercu: opts.apercu ?? "",
    contenu,
    appUrl: base.replace(/\/+$/, ""),
    pied,
  });
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
