/**
 * LES CLASSEMENTS DES ÉDITIONS PASSÉES — 2025, 2024, 2023 (30/09/2026).
 *
 * Demandé par Cyprien : « mets les anciens résultats des courses, 2025, 2024… ». La base ne
 * gardait qu'UN lien de classement par course — et depuis qu'on ne propose plus celui d'une
 * édition pas encore courue, une course de 2026 n'en montrait plus aucun.
 *
 * Beaucoup de chronométreurs rangent chaque édition sous une adresse qui porte l'année :
 * « …wiclax-results.com/La Ronda des Coudous 2026/ ». L'édition 2025 est souvent la même
 * adresse avec 2025 — mesuré : 2025 et 2024 répondent, 2023 et 1999 sont introuvables (404).
 *
 * ⚠️ UNE ADRESSE DEVINÉE N'EST PAS UNE ADRESSE VÉRIFIÉE. Chaque candidate est OUVERTE avant
 * d'être proposée, et un site qui répond « trouvé » à n'importe quelle année (témoin : 1999)
 * est écarté en bloc — il renverrait sa page d'accueil sous l'étiquette « Classement 2024 ».
 */

import { jourFrance } from "./jourFrance";
import { lienClassementPropre } from "./lienPropre";

export type EditionResultats = { annee: number; url: string };

/** L'année comme MOT : pas « 12025 », pas « 20251 » — mais « %202025 » (espace encodé) oui. */
const motAnnee = (annee: number) => new RegExp(`(?:(?<!\\d)|(?<=%[0-9A-Fa-f]{2}))${annee}(?!\\d)`, "g");

/**
 * Remplace l'année d'un lien par une autre, PARTOUT où elle figure dans le chemin, la
 * requête et l'ancre (« …/2025/…?annee=2025#resultats2025 » : ensemble, sinon l'adresse
 * serait incohérente), jamais dans le nom d'hôte. Travaille sur l'adresse ENCODÉE telle quelle : décoder puis
 * réencoder abîmait les « & » et « = » échappés d'une requête.
 * `null` si l'année n'y figure pas.
 */
function remplaceurAnnee(url: string, annee: number): ((autre: number) => string) | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const re = motAnnee(annee);
  const n = (u.pathname.match(re) ?? []).length + (u.search.match(re) ?? []).length;
  if (n === 0) return null;   // une année SEULEMENT dans l'ancre ne désigne pas une édition
  return (autre) => {
    const v = new URL(url);
    v.pathname = u.pathname.replace(motAnnee(annee), String(autre));
    v.search = u.search.replace(motAnnee(annee), String(autre));
    v.hash = u.hash.replace(motAnnee(annee), String(autre));
    return v.toString();
  };
}

/** Pas d'édition avant 2005 : au-delà, les pages de résultats en ligne sont rares et datées. */
export const ANNEE_PLANCHER = 2005;

/**
 * Les adresses candidates des éditions précédant `annee` — jusqu'à `profondeur` ans en
 * arrière, la plus récente d'abord — plus le TÉMOIN d'une année absurde (1999) qui sert à
 * démasquer un site « attrape-tout ». Le script s'arrête de lui-même après trois années
 * de suite introuvables (2020 et 2021 annulées ne doivent pas couper la série).
 */
export function adressesEditions(url: string, annee: number, profondeur = 10): { candidates: EditionResultats[]; temoin: string } | null {
  if (!Number.isInteger(annee) || annee < ANNEE_PLANCHER + 1 || annee > 2100) return null;
  const propre = lienClassementPropre(url);
  const vers = propre ? remplaceurAnnee(propre, annee) : null;
  if (!vers) return null;
  const candidates: EditionResultats[] = [];
  for (let a = annee - 1; a >= Math.max(ANNEE_PLANCHER, annee - profondeur); a--) candidates.push({ annee: a, url: vers(a) });
  return { candidates, temoin: vers(1999) };
}

/** Une réponse prouve-t-elle qu'une page d'édition EXISTE ? 2xx, et pas renvoyée ailleurs. */
export function pageTrouvee(code: number, urlFinale: string, annee: number): boolean {
  if (!(code >= 200 && code < 300)) return false;
  let decodee = urlFinale;
  try { decodee = decodeURIComponent(urlFinale); } catch { /* adresse mal encodée : lue telle quelle */ }
  return motAnnee(annee).test(urlFinale) || motAnnee(annee).test(decodee);
}

/**
 * Une réponse qui ne prouve RIEN sur la page : réseau coupé (0), accès refusé au robot
 * (403), limite de débit (429), panne du serveur (5xx). Vécu le 30/09/2026 : une coupure
 * réseau d'une heure a classé les 1 984 liens d'organisateurs « refusés » — et le cache
 * l'aurait retenu comme un verdict. Une telle réponse ne se MÉMORISE jamais.
 */
export const reponseIncertaine = (code: number) => code === 0 || code === 403 || code === 429 || code >= 500;

/** Au plus autant d'années à l'écran — au-delà, la ligne de pastilles devient illisible. */
export const EDITIONS_MAX = 8;

/**
 * Les éditions à PROPOSER pour une course : vérifiées, http(s), sans le lien principal (déjà
 * affiché — ni son adresse, ni son année : « Classement 2025 » puis une pastille « 2025 »
 * menant ailleurs serait un doublon trompeur), une fois par année, la plus récente d'abord,
 * `EDITIONS_MAX` au plus.
 *
 * ⚠️ JAMAIS L'ÉDITION À VENIR (30/09/2026) : pour une course de 2026 pas encore courue, une
 * page « 2026 » existe souvent déjà — vide, en chargement sans fin (La Ronda des Coudous).
 * On ne propose que des années STRICTEMENT antérieures à celle de la course à venir, et
 * jamais une année postérieure à l'année en cours.
 */
export function editionsAAfficher(
  editions: unknown, principal: string | { url: string; annee?: number | null } | null | undefined,
  course?: { date?: string | null } | null, aujourdhui: string = jourFrance(),
): EditionResultats[] {
  if (!Array.isArray(editions)) return [];
  const lienPrincipal = typeof principal === "string" ? principal : principal?.url ?? null;
  const anneePrincipale = typeof principal === "object" && principal && Number.isInteger(principal.annee) ? principal.annee : null;
  const anneeCourante = Number(aujourdhui.slice(0, 4));
  const jour = String(course?.date ?? "").slice(0, 10);
  const aVenir = /^\d{4}-\d{2}-\d{2}$/.test(jour) && jour >= aujourdhui ? Number(jour.slice(0, 4)) : null;
  const vues = new Set<number>();
  return editions
    .filter((e): e is EditionResultats => !!e && typeof (e as EditionResultats).url === "string" && Number.isInteger((e as EditionResultats).annee))
    .map((e) => ({ annee: e.annee, url: lienClassementPropre(e.url) }))
    .filter((e): e is EditionResultats => e.url != null)
    .filter((e) => e.annee >= ANNEE_PLANCHER && e.annee <= anneeCourante && (aVenir == null || e.annee < aVenir))
    .sort((a, b) => b.annee - a.annee)
    .filter((e) => e.url !== lienPrincipal && e.annee !== anneePrincipale && !vues.has(e.annee) && (vues.add(e.annee), true))
    .slice(0, EDITIONS_MAX);
}

/**
 * Deux listes d'éditions disent-elles la même chose ? Indépendant de l'ordre des CLÉS :
 * Postgres (jsonb) rend « {"url","annee"} » ce qu'on lui a donné en « {"annee","url"} ».
 */
export function memesEditions(a: unknown, b: unknown): boolean {
  const sig = (x: unknown) => (Array.isArray(x) ? x.map((e) => `${e?.annee}|${e?.url}`).join("\n") : "∅");
  return sig(a) === sig(b);
}

/** Réunit des listes « une adresse par année » ; à année égale, la PREMIÈRE liste l'emporte. */
export function fusionEditions(...listes: EditionResultats[][]): EditionResultats[] {
  const par = new Map<number, string>();
  for (const l of listes) for (const e of l) if (!par.has(e.annee)) par.set(e.annee, e.url);
  return [...par].map(([annee, url]) => ({ annee, url })).sort((a, b) => b.annee - a.annee);
}

/**
 * Le dossier de PUBLICATION n'est pas l'année de la course (30/09/2026) : lu sur un site,
 * « /wp-content/uploads/2026/02/resultats-editions-precedentes.xls » passait pour le
 * classement 2026. « /AAAA/MM/ » (WordPress, blogs) dit quand le fichier a été déposé.
 */
export const sansDossierDePublication = (chemin: string) => chemin.replace(/\/(?:19|20)\d{2}\/(?:0[1-9]|1[0-2])\//g, "/");

/** Une page « introuvable » servie en 200 : son titre ou son premier intertitre le dit. */
const PAGE_ERREUR = /\b404\b|introuvable|not found|n'existe pas|n’existe pas|page d'erreur|page non trouv/i;

/**
 * Une édition relevée sur le SITE DE L'ORGANISATEUR (« Résultats 2024 ») est-elle vérifiée ?
 *   - 2xx ;
 *   - pas renvoyée à la page d'accueil (un lien mort « redirigé vers / » répond 200) ;
 *   - une page HTML — ou XML mise en page par le navigateur (feuille XSL : les anciennes
 *     éditions livetrail) : pas une page d'erreur servie en 200 (titre « Page introuvable »),
 *     et l'année dans l'adresse finale (hors dossier de publication) ou dans son texte ;
 *   - un PDF : servi à la même adresse (http → https près), sans redirection ailleurs (on ne
 *     lit pas son contenu — l'année vient alors du libellé que l'organisateur lui a donné).
 */
export function editionSiteVerifiee(
  r: { code: number; demandee: string; finale: string; type: string; html: string | null }, annee: number,
): boolean {
  if (!(r.code >= 200 && r.code < 300)) return false;
  let d: URL, f: URL;
  try { d = new URL(r.demandee); f = new URL(r.finale); } catch { return false; }
  const racine = (p: string) => p.replace(/\/(index\.(?:html?|php))?$/i, "") === "";
  if (racine(f.pathname) && !f.search && !(racine(d.pathname) && !d.search)) return false;
  const meme = (x: URL) => `${x.hostname.replace(/^www\./i, "").toLowerCase()}${x.pathname}${x.search}`;
  if (/pdf/i.test(r.type)) return meme(d) === meme(f);
  const xmlMisEnPage = /xml/i.test(r.type) && /<\?xml-stylesheet[^>]*xsl/i.test(r.html ?? "");
  if (!(/html/i.test(r.type) || xmlMisEnPage) || r.html == null) return false;
  const titre = `${r.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""} ${r.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""}`;
  if (PAGE_ERREUR.test(titre.replace(/<[^>]+>/g, " "))) return false;
  if (pageTrouvee(r.code, f.origin + sansDossierDePublication(f.pathname) + f.search, annee)) return true;
  const texte = r.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return motAnnee(annee).test(texte);
}

/** Un tableur ou une archive se TÉLÉCHARGE au lieu de s'afficher : pas une « page de classement ». */
const FICHIER_A_TELECHARGER = /\.(?:xlsx?|xlsm|ods|csv|docx?|odt|zip|rar|7z|gz)$/i;

/**
 * Les éditions relevées sur un site, RETENUES ou non (30/09/2026). Lu sur plauzatsportnature.fr :
 * « Résultat 2023…2026 » du Trail des Lions Nocturne ET « Résultats 2015…2019 » des 5 et 10 km
 * — deux courses, un seul site, et la liste « une adresse par année » les mélangeait.
 *
 * On regroupe les adresses par MODÈLE (l'adresse où l'année devient « {A} ») :
 *   - une seule famille de plusieurs éditions : on ne garde qu'elle ;
 *   - plusieurs familles de plusieurs éditions : plusieurs courses — on ne garde RIEN ;
 *   - que des adresses isolées (des PDF nommés à la main) : on les garde.
 */
export function editionsDuSite(editions: unknown): EditionResultats[] {
  if (!Array.isArray(editions)) return [];
  const propres = editions.filter((e): e is EditionResultats => !!e && typeof e.url === "string" && Number.isInteger(e.annee)
    && /^https?:\/\//i.test(e.url) && !FICHIER_A_TELECHARGER.test(e.url.replace(/[?#].*$/, "")));
  const modele = (e: EditionResultats) => {
    try {
      const u = new URL(e.url);
      return `${u.host}${u.pathname.replace(motAnnee(e.annee), "{A}")}${u.search.replace(motAnnee(e.annee), "{A}")}`;
    } catch { return e.url; }
  };
  const familles = new Map<string, EditionResultats[]>();
  for (const e of propres) familles.set(modele(e), [...(familles.get(modele(e)) ?? []), e]);
  const nombreuses = [...familles.values()].filter((f) => f.length >= 2);
  if (nombreuses.length >= 2) return [];
  return nombreuses.length === 1 ? nombreuses[0] : propres;
}

/**
 * Deux années qui aboutissent à la MÊME page (« Résultats 2023 » et « Résultats 2024 » →
 * la page générale) : aucune des deux n'est « le classement de cette année-là ».
 */
export function sansPagePartagee<T extends { finale: string }>(liste: T[]): T[] {
  const cle = (u: string) => u.replace(/#.*$/, "").replace(/\/$/, "").toLowerCase();
  const compte = new Map<string, number>();
  for (const x of liste) compte.set(cle(x.finale), (compte.get(cle(x.finale)) ?? 0) + 1);
  return liste.filter((x) => compte.get(cle(x.finale)) === 1);
}
