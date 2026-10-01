/**
 * L'IDENTITÉ DE PACEVOBOT, ET LES SITES QUI ONT REFUSÉ D'ÊTRE LUS (01/10/2026).
 *
 * Cyprien : « je vais vendre mon application, reste dans la légalité ». Tous les robots de
 * Pacevo — veille des pages officielles, éditions passées, contrôle des liens, collecte du
 * comparateur — partagent :
 *   - UNE identité déclarée, qui renvoie à une page publique (`/robot`) disant ce qu'ils
 *     lisent et comment s'y opposer. Quatre anciens scripts du comparateur se présentaient
 *     comme un navigateur Chrome : une pratique qu'un audit de reprise relèverait ;
 *   - le respect de robots.txt, par l'agent `PacevoBot` ou `*` (`robotsAutorise`) ;
 *   - une liste d'OPPOSITION : un site qui demande à ne plus être lu y est ajouté, et plus
 *     aucun robot ne s'en approche.
 */
import { domaineDe } from "./destination";

export const PAGE_ROBOT = "https://pacevo.fr/robot";
export const UA_PACEVOBOT = `Mozilla/5.0 (compatible; PacevoBot/1.0; +${PAGE_ROBOT})`;

/**
 * Sites qui ont demandé à ne plus être lus — par DOMAINE (« exemple.fr » couvre
 * « www.exemple.fr » et « inscriptions.exemple.fr »). Ajouter une ligne, avec la date de la
 * demande en commentaire, suffit : la prochaine exécution les ignore.
 */
export const SITES_EXCLUS: readonly string[] = [
];

/** Ce site a-t-il refusé d'être lu ? Une adresse illisible est traitée comme exclue (prudence). */
export function siteExclu(url: unknown, liste: readonly string[] = SITES_EXCLUS): boolean {
  const d = domaineDe(url);
  if (!d) return true;
  return liste.some((x) => domaineDe(`https://${x.replace(/^https?:\/\//, "")}`) === d);
}
