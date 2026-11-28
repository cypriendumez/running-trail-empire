/**
 * LE LIEN D'AGENDA OUVERT DANS UN NAVIGATEUR (28/11/2026).
 *
 * Défaut réel : le lien https du flux, collé dans Safari, a TÉLÉCHARGÉ le fichier .ics ; le Mac a
 * proposé « ajouter les événements » et une COPIE FIGÉE des séances s'est rangée dans le
 * calendrier « Travail » de Cyprien : chaque séance en double, jamais mise à jour, impossible à
 * retirer depuis Pacevo.
 *
 * Parade : une ouverture PAR UN NAVIGATEUR (navigation de page : `Sec-Fetch-Dest: document` ou
 * `Sec-Fetch-Mode: navigate`, que seuls les navigateurs envoient) ne reçoit jamais le fichier :
 *   - Apple (iPhone, iPad, Mac) → l'adresse `webcal://`, qui ouvre l'ABONNEMENT dans Calendrier,
 *     seulement si le lien est encore valable (un lien révoqué abonnerait à un flux mort : 404) ;
 *   - ailleurs → Paramètres › Connexions, où sont les boutons, avec un mot d'explication ; par la
 *     connexion d'abord si ce navigateur n'est pas connecté (puis retour à cette page).
 * Les agendas eux-mêmes (Apple CalendarAgent, Google, Outlook) lisent le lien sans ces en-têtes :
 * ils reçoivent le calendrier comme avant. Limite : Safari antérieur à 16.4 n'envoie pas ces
 * en-têtes et reçoit encore le fichier.
 */
import { adresseFlux, jetonDuChemin } from "./jeton";
import { ORIGINE_FLUX } from "./abonnement";

/** La page des boutons ; `agenda=lien` fait afficher à l'encart pourquoi on est là. */
export const PAGE_CONNEXIONS = "/dashboard/settings?onglet=connexions&agenda=lien";

const ENTETES = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

/** Une navigation de navigateur vers un jeton bien formé : à qui on a affaire. `null` = servir comme d'habitude. */
export function ouvertureNavigateur(entetes: Headers, segment: string): { apple: boolean; jeton: string } | null {
  const page = entetes.get("sec-fetch-dest") === "document" || entetes.get("sec-fetch-mode") === "navigate";
  if (!page) return null;
  const jeton = jetonDuChemin(segment);
  if (!jeton) return null;
  return { apple: /iPhone|iPad|Macintosh/.test(entetes.get("user-agent") ?? ""), jeton };
}

/**
 * La réponse à une ouverture dans un navigateur, ou `null` (un agenda, ou un jeton mal formé :
 * la route fait comme avant). `existe` : le lien est-il encore valable (`null` = base illisible) ;
 * `connecte` : ce navigateur a-t-il une session Pacevo.
 */
export async function reponseNavigateur(
  entetes: Headers, segment: string,
  deps: { existe: (jeton: string) => Promise<boolean | null>; connecte: () => Promise<boolean> },
): Promise<Response | null> {
  const o = ouvertureNavigateur(entetes, segment);
  if (!o) return null;
  if (o.apple) {
    const existe = await deps.existe(o.jeton);
    if (existe === null) return new Response("Indisponible, réessaie plus tard", { status: 503, headers: { ...ENTETES, "Content-Type": "text/plain; charset=utf-8", "Retry-After": "900" } });
    if (!existe) return new Response("Calendrier introuvable", { status: 404, headers: { ...ENTETES, "Content-Type": "text/plain; charset=utf-8" } });
    return new Response(null, { status: 302, headers: { ...ENTETES, Location: adresseFlux(ORIGINE_FLUX, o.jeton).webcal } });
  }
  const cible = (await deps.connecte().catch(() => false))
    ? `${ORIGINE_FLUX}${PAGE_CONNEXIONS}`
    : `${ORIGINE_FLUX}/login?next=${encodeURIComponent(PAGE_CONNEXIONS)}`;
  return new Response(null, { status: 302, headers: { ...ENTETES, Location: cible } });
}
