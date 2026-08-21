import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * JETON DE DÉSINSCRIPTION — signé, sans stockage.
 *
 * Le pied de page promettait « désinscription en un clic » alors qu'AUCUNE route de
 * désinscription n'existait : la colonne `unsubscribed` était lue partout et n'était
 * jamais mise à true par personne. Ce n'était pas seulement une promesse non tenue —
 * envoyer un e-mail de prospection sans moyen de s'y soustraire est contraire au RGPD.
 *
 * ── POURQUOI UN HMAC PLUTÔT QU'UNE COLONNE ───────────────────────────────────
 * Un jeton aléatoire stocké par abonné imposerait une migration, et ce projet vise
 * ZÉRO migration. Un HMAC de l'adresse se recalcule à la volée : il ne se stocke pas,
 * ne s'épuise pas, et ne peut pas se désynchroniser d'une base.
 *
 * ⚠️ Il n'est PAS réversible : on ne déduit pas l'adresse du jeton. Le lien porte donc
 * l'adresse en clair ET sa signature, et la route refuse tout ce qui ne concorde pas.
 * Sans cela, n'importe qui pourrait désinscrire n'importe quelle adresse en la devinant.
 *
 * ⚠️ La comparaison se fait en TEMPS CONSTANT (`timingSafeEqual`). Comparer deux
 * signatures avec `===` laisse fuir, par le temps de réponse, le nombre d'octets
 * corrects — de quoi reconstruire une signature octet par octet.
 *
 * ⚠️ Le secret est `CRON_SECRET`, déjà présent en production. Le faire tourner
 * invalide les liens des e-mails DÉJÀ envoyés : c'est acceptable (l'abonné peut
 * toujours écrire), mais il faut le savoir avant de le changer.
 */

const secret = () => process.env.CRON_SECRET ?? "";

export function jetonDesinscription(email: string): string {
  return createHmac("sha256", secret())
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

/** Vraie si le jeton correspond à l'adresse. Faux si le secret manque. */
export function jetonValide(email: string, jeton: string): boolean {
  if (!secret() || !jeton) return false;
  const attendu = Buffer.from(jetonDesinscription(email));
  const fourni = Buffer.from(String(jeton));
  if (attendu.length !== fourni.length) return false;
  return timingSafeEqual(attendu, fourni);
}

/** L'URL complète à mettre dans chaque e-mail. Jamais un e-mail sans elle. */
export function lienDesinscription(email: string, base: string): string {
  const u = new URL("/api/newsletter/unsubscribe", base);
  u.searchParams.set("e", email.trim().toLowerCase());
  u.searchParams.set("t", jetonDesinscription(email));
  return u.toString();
}
