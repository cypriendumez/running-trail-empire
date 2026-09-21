import { createHash } from "node:crypto";

/**
 * MESURE D'AUDIENCE SANS COOKIE — ce qu'on retient d'une visite, et ce qu'on refuse d'en retenir.
 *
 * ⚠️ RIEN N'ÉTAIT MESURÉ jusqu'au 14/09/2026 : ni le site, ni l'application. À la question
 * « combien de personnes viennent ? », la seule réponse était le nombre de comptes créés.
 *
 * ⚠️ L'ADRESSE IP N'EST JAMAIS ÉCRITE. Elle entre dans une empreinte avec le navigateur, un
 * sel secret et LE JOUR : `sha256(sel + jour + ip + ua)`. Deux conséquences voulues :
 *  · impossible de retrouver l'adresse à partir de l'empreinte (sel secret, hachage tronqué) ;
 *  · impossible de suivre une personne d'un jour à l'autre — l'empreinte change à minuit.
 * C'est exactement le périmètre de l'exemption de consentement de la CNIL pour la mesure
 * d'audience : compter, pas pister. Un cookie ou un identifiant stable nous en ferait sortir.
 *
 * ⚠️ CONSÉQUENCE HONNÊTE : on ne sait PAS compter des « visiteurs uniques sur 30 jours ».
 * Une même personne venue dix jours de suite compte dix fois. Les écrans doivent dire
 * « visiteurs par jour », jamais « visiteurs uniques du mois ».
 *
 * Pour un compte CONNECTÉ, en revanche, on retient un pseudonyme stable `sha256(sel + id)` :
 * l'athlète a un compte, le service consiste à le suivre, et c'est la seule façon de dire
 * combien de clients utilisent réellement l'application sur une semaine ou un mois.
 */

export const LONGUEUR_EMPREINTE = 24;

/** Une visite sans sel serait une empreinte devinable : on refuse de la compter. */
export function empreinteVisiteur(p: { sel: string; jour: string; ip: string; ua: string }): string | null {
  if (!p.sel) return null;
  return createHash("sha256").update(`${p.sel}|${p.jour}|${p.ip}|${p.ua}`).digest("hex").slice(0, LONGUEUR_EMPREINTE);
}

/** Pseudonyme STABLE d'un compte connecté — pas de jour dans le calcul, c'est voulu. */
export function pseudonymeCompte(p: { sel: string; userId: string }): string | null {
  if (!p.sel || !p.userId) return null;
  return createHash("sha256").update(`${p.sel}|compte|${p.userId}`).digest("hex").slice(0, LONGUEUR_EMPREINTE);
}

/**
 * Les robots ne sont pas des visiteurs. La liste vise les agents qui se DÉCLARENT ; un
 * robot qui se fait passer pour Chrome passera, et c'est une limite assumée : le filtre
 * sert à ne pas compter Google, pas à gagner une course contre les faussaires.
 */
const ROBOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp|telegram|discord|skype|curl\/|wget\/|python-requests|go-http-client|java\/|okhttp|axios|node-fetch|vercel-screenshot|uptime|monitor/i;
export function estRobot(ua: string | null | undefined): boolean {
  const u = String(ua ?? "").trim();
  if (!u) return true;
  return ROBOT.test(u);
}

export type Appareil = "mobile" | "tablette" | "ordinateur";
export function appareilDe(ua: string | null | undefined): Appareil {
  const u = String(ua ?? "");
  if (/ipad|tablet|(android(?!.*mobile))/i.test(u)) return "tablette";
  if (/mobi|iphone|ipod|android|windows phone/i.test(u)) return "mobile";
  return "ordinateur";
}

/**
 * Les segments variables d'une adresse sont REPLIÉS sur leur gabarit : compter
 * « /courses/marathon-de-paris » et « /courses/trail-des-templiers » séparément ferait
 * 17 000 lignes distinctes pour une seule page. Le gabarit suit `src/app` — une
 * nouvelle route dynamique doit être ajoutée ici (un test le rappelle).
 */
const GABARITS: [RegExp, string][] = [
  [/^\/courses\/region\/[^/]+$/, "/courses/region/[slug]"],
  [/^\/courses\/[^/]+$/, "/courses/[slug]"],
  [/^\/chaussures\/[^/]+$/, "/chaussures/[slug]"],
  [/^\/blog\/[^/]+$/, "/blog/[slug]"],
  [/^\/dashboard\/shop\/[^/]+$/, "/dashboard/shop/[slug]"],
  [/^\/suivre\/[^/]+$/, "/suivre/[id]"],
  [/^\/amis\/[^/]+$/, "/amis/[id]"],
];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export function normaliserChemin(brut: string | null | undefined): string | null {
  let c = String(brut ?? "").trim();
  if (!c.startsWith("/")) return null;
  c = c.split(/[?#]/)[0];
  if (c.length > 1) c = c.replace(/\/+$/, "");
  if (c.length > 200) return null;
  // Les préfixes techniques ne sont pas des pages.
  if (/^\/(api|_next|_vercel)(\/|$)/.test(c)) return null;
  for (const [motif, gabarit] of GABARITS) if (motif.test(c)) return gabarit;
  return c.replace(UUID, "[id]");
}

export type Espace = "site" | "app";
/** Le SITE est ce que voit un inconnu ; l'APP commence à l'inscription. */
export function espaceDe(chemin: string): Espace {
  return /^\/(dashboard|admin|onboarding)(\/|$)/.test(chemin) ? "app" : "site";
}

/** Seulement l'HÔTE de la page d'origine — jamais l'adresse complète, qui peut porter un jeton. */
export function referentDe(brut: string | null | undefined, hoteLocal: string): string | null {
  try {
    const u = new URL(String(brut ?? ""));
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!h || h === hoteLocal.replace(/^www\./, "").toLowerCase()) return null;
    return h.slice(0, 80);
  } catch { return null; }
}

export function langueDe(brut: string | null | undefined): string | null {
  const m = /^([a-z]{2})/i.exec(String(brut ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

/** Le code pays de l'hébergeur : deux lettres, ou rien. */
export function paysDe(brut: string | null | undefined): string | null {
  const p = String(brut ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(p) ? p : null;
}
