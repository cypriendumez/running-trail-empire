/**
 * ON DEMANDE LA PERMISSION AVANT DE LIRE UNE PAGE.
 *
 * La lettre du lundi résume des articles de presse. Deux usages, deux régimes :
 *
 *  • Le texte que l'éditeur met LUI-MÊME dans son flux (`content:encoded`) : il le
 *    publie pour être repris par des agrégateurs. Rien à demander.
 *  • La page de l'article, quand le flux ne porte pas de texte : là on va chercher
 *    quelque chose qui ne nous a pas été tendu.
 *
 * `robots.txt` est la façon reconnue, lisible par une machine, dont un éditeur dit ce
 * qu'il accepte — et depuis la directive européenne 2019/790 (article 4), c'est aussi
 * la façon dont il RÉSERVE ses droits contre la fouille de textes et de données, ce que
 * fait exactement un résumé automatique. L'ignorer, c'est passer outre un refus écrit.
 *
 * ⚠️ Ce fichier ne rend pas l'usage licite à lui seul — il respecte un refus explicite.
 * Le reste tient à ce qu'on publie : titre, nom de l'éditeur, lien vers lui, et un
 * résumé de deux ou trois phrases écrit par nous. Jamais l'article, jamais ses photos.
 *
 * En cas de doute (fichier absent, réseau en panne) on AUTORISE : un `robots.txt`
 * inaccessible n'est pas un refus, et le traiter comme tel couperait la lettre au
 * premier incident réseau.
 */

type Regles = { interdits: string[]; at: number };
const cache = new Map<string, Regles>();
const TTL = 6 * 3600 * 1000; // 6 h : un robots.txt bouge rarement.

/** Les `Disallow` qui s'appliquent à nous : le groupe `*` et le nôtre. */
export function lireRobots(txt: string): string[] {
  const interdits: string[] = [];
  let concerne = false;
  for (const brute of txt.split(/\r?\n/)) {
    const ligne = brute.split("#")[0].trim();
    if (!ligne) continue;
    const [cle, ...reste] = ligne.split(":");
    const valeur = reste.join(":").trim();
    const nom = cle.trim().toLowerCase();
    if (nom === "user-agent") {
      const ua = valeur.toLowerCase();
      concerne = ua === "*" || ua.includes("pacevo");
    } else if (nom === "disallow" && concerne && valeur) {
      interdits.push(valeur);
    }
  }
  return interdits;
}

export async function pageAutorisee(url: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(url); } catch { return false; }

  const cle = u.origin;
  const vu = cache.get(cle);
  let regles = vu && Date.now() - vu.at < TTL ? vu : null;

  if (!regles) {
    try {
      const r = await fetch(`${u.origin}/robots.txt`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PacevoNewsletter/1.0)" },
        signal: AbortSignal.timeout(5000),
      });
      // 404 = pas de règles = tout est permis. Une erreur serveur, pareil : on n'invente
      // pas un refus qui n'a pas été écrit.
      regles = { interdits: r.ok ? lireRobots(await r.text()) : [], at: Date.now() };
    } catch {
      regles = { interdits: [], at: Date.now() };
    }
    cache.set(cle, regles);
  }

  const chemin = u.pathname + u.search;
  // « Disallow: / » interdit tout ; un préfixe n'interdit que ce qui commence par lui.
  return !regles.interdits.some((p) => chemin.startsWith(p));
}
