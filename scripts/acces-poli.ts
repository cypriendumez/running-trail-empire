/**
 * L'ACCÈS POLI — la seule porte par laquelle un script de collecte lit une page (01/10/2026).
 *
 * Identité déclarée (`UA_PACEVOBOT`, qui renvoie à pacevo.fr/robot), robots.txt relu par
 * origine et RESPECTÉ, liste d'opposition (`SITES_EXCLUS`). Rend `null` — comme une erreur
 * réseau — quand la page ne doit pas être lue : les appelants savent déjà s'en passer.
 * robots.txt illisible (5xx, délai) : on ne lit pas, dans le doute.
 */
import { UA_PACEVOBOT, siteExclu } from "../src/lib/races/robot";
import { robotsAutorise } from "../src/lib/races/resultatsSite";

const robots = new Map<string, Promise<string | null | "inconnu">>();

function robotsDe(origine: string): Promise<string | null | "inconnu"> {
  if (!robots.has(origine)) {
    robots.set(origine, fetch(`${origine}/robots.txt`, { headers: { "User-Agent": UA_PACEVOBOT }, signal: AbortSignal.timeout(10_000) })
      .then(async (r) => (r.status === 200 ? await r.text() : r.status === 404 || r.status === 410 ? null : "inconnu"))
      .catch(() => "inconnu" as const));
  }
  return robots.get(origine)!;
}

/** Cette page peut-elle être lue par PacevoBot ? (opposition, puis robots.txt) */
export async function lectureAutorisee(url: string): Promise<boolean> {
  if (siteExclu(url)) return false;
  let u: URL; try { u = new URL(url); } catch { return false; }
  const rb = await robotsDe(u.origin);
  return rb !== "inconnu" && robotsAutorise(rb, u.pathname + u.search);
}

/** `fetch`, en s'identifiant, seulement si la page peut être lue ; sinon `null`. */
export async function lirePoliment(url: string, init: RequestInit = {}): Promise<Response | null> {
  if (!(await lectureAutorisee(url))) return null;
  const entetes = new Headers(init.headers);
  entetes.set("User-Agent", UA_PACEVOBOT);
  return fetch(url, { ...init, headers: entetes });
}
