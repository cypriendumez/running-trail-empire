/**
 * LECTURE D'UNE FICHE DE COURSE À LA SOURCE.
 *
 * ⚠️ POURQUOI CE MODULE EXISTE. La synchronisation historique explorait jogging-plus,
 * qui est passé derrière une protection anti-robot JavaScript : il répond 403 avec une
 * page « Checking your browser » à TOUTES les requêtes, y compris `robots.txt`. Un
 * serveur ne peut pas résoudre ce défi. Résultat constaté le 01/09/2026 : la synchro
 * renvoyait `{"calendar":0,"wordpress":0,"ffa":0}` en 5 secondes, et la dernière course
 * entrée en base datait du 10 juin.
 *
 * finishers.com, lui, autorise explicitement l'exploration : son `robots.txt` n'interdit
 * que `/account*`, `/book*`, `/docs*` et les pages de filtres, et le site publie son
 * propre sitemap. Ses fiches portent des données structurées schema.org — donc une date
 * lisible sans deviner quoi que ce soit dans du HTML.
 *
 * Et on possède DÉJÀ l'URL finishers de chaque course, dans `registration_url` : le
 * contrôle des liens visite ces pages de toute façon. On lit la date au passage plutôt
 * que de lancer une seconde exploration — une visite, deux bénéfices, et pas un octet
 * de charge supplémentaire pour un site qui ne nous doit rien.
 */

/**
 * Date de départ annoncée par la fiche, au format `AAAA-MM-JJ`.
 *
 * ⚠️ ON NE LIT QUE LES DONNÉES STRUCTURÉES, jamais le texte de la page. Une date
 * attrapée dans une phrase publicitaire (« édition 2025 ») écraserait la bonne. Si le
 * balisage est absent ou illisible, on renvoie `null` et on ne touche à rien.
 */
export function dateDeLaFiche(html: string): string | null {
  const s = String(html ?? "");
  if (!s) return null;
  for (const m of s.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let bloc: unknown;
    try { bloc = JSON.parse(m[1]); } catch { continue; }
    const d = chercherStartDate(bloc);
    if (d) return d;
  }
  return null;
}

function chercherStartDate(o: unknown, prof = 0): string | null {
  if (prof > 6 || o == null) return null;
  if (Array.isArray(o)) {
    for (const v of o) { const d = chercherStartDate(v, prof + 1); if (d) return d; }
    return null;
  }
  if (typeof o !== "object") return null;
  const obj = o as Record<string, unknown>;
  const type = String(obj["@type"] ?? "");
  if (/Event/i.test(type)) {
    const j = jourDe(obj.startDate);
    if (j) return j;
  }
  for (const v of Object.values(obj)) { const d = chercherStartDate(v, prof + 1); if (d) return d; }
  return null;
}

/** `startDate` peut arriver en date seule ou en date-heure ISO. On ne garde que le jour. */
function jourDe(v: unknown): string | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const jour = `${m[1]}-${m[2]}-${m[3]}`;
  // Garde-fou : une date hors de tout bon sens vient d'un balisage cassé, pas d'une
  // course. Le marqueur 2099 de l'app ne doit jamais être écrasé par une vraie date
  // qui serait en fait une erreur de la source.
  const an = Number(m[1]);
  if (an < 2000 || an > 2098) return null;
  return jour;
}

/**
 * La date lue doit-elle remplacer celle qu'on a en base ?
 *
 * ⚠️ ON NE RECULE JAMAIS DANS LE PASSÉ. Une fiche peut garder l'ancienne édition en
 * ligne des semaines après la course ; réécrire la date avec elle ferait redisparaître
 * la course du catalogue, exactement le défaut qu'on vient de réparer. On n'accepte
 * qu'une date à venir, et différente de celle déjà enregistrée.
 */
export function doitMettreAJour(actuelle: unknown, lue: string | null, aujourdhui: string): boolean {
  if (!lue) return false;
  if (lue < aujourdhui) return false;
  const a = String(actuelle ?? "").slice(0, 10);
  return a !== lue;
}
