/**
 * LE MÉDIATEUR DE LA CONSOMMATION — désigné par l'éditeur, lu sur l'hébergement.
 *
 * ⚠️ OBLIGATOIRE DÈS QU'ON VEND À UN PARTICULIER. Tout professionnel doit garantir au
 * consommateur un recours GRATUIT à un médiateur, et lui en donner le NOM et le SITE
 * (code de la consommation, art. L612-1 et L616-1). Les CGV disaient seulement « un
 * médiateur de la consommation » : une mention qui ne nomme personne ne dit pas au
 * client qui saisir, elle ne vaut rien.
 *
 * ⚠️ IL SE RENSEIGNE SANS TOUCHER AU CODE, comme `EDITEUR_STATUT` : deux variables sur
 * l'hébergement (`MEDIATEUR_NOM`, `MEDIATEUR_SITE`), posées le jour où la convention avec
 * le médiateur est signée. Un repreneur doit pouvoir y mettre le sien sans dépôt ni
 * développeur.
 *
 * ⚠️ MODULE SERVEUR, POUR LA MÊME RAISON QUE `statutEditeur.ts` : le navigateur ne reçoit
 * pas les variables non publiques. Lu dans un composant client, le médiateur disparaîtrait
 * à l'hydratation. `tests/bundle.test.ts` refuse qu'un composant client l'atteigne.
 *
 * ⚠️ ET IL CONDITIONNE LA VENTE : sans médiateur, `/api/stripe/checkout` refuse d'ouvrir
 * le paiement. Vendre sans médiateur expose à une amende administrative ; un paiement qui
 * n'ouvre pas coûte une journée, un abonné sans recours coûte bien plus.
 */

export type Mediateur = { nom: string; site: string };

/**
 * Le médiateur désigné, ou `null` tant qu'il ne l'est pas.
 *
 * On ne retient qu'une valeur PLAUSIBLE : un nom d'au moins trois caractères et une
 * adresse https complète. Une variable posée à « oui » ou à « www.truc » remplirait les
 * CGV d'un recours introuvable, pire que la phrase d'attente qu'elle remplace.
 */
export function mediateurConso(env: Record<string, string | undefined> = process.env): Mediateur | null {
  const nom = (env.MEDIATEUR_NOM ?? "").trim();
  const site = (env.MEDIATEUR_SITE ?? "").trim();
  if (nom.length < 3) return null;
  try {
    const u = new URL(site);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
  } catch {
    return null;
  }
  return { nom, site };
}
