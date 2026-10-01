/**
 * LA VEILLE DES PAGES OFFICIELLES — résultats, dates, inscription, parcours (01/10/2026).
 *
 * Cyprien : « crée des sortes de bots qui mettent instantanément les liens des parcours, les
 * dates, les résultats sur mon application quand ça sort ». Trois veilleurs partagent CETTE
 * logique (pure, testée) :
 *   - chaque jour, les courses de J-12 à J+60 (`scripts/veille-courses.ts --fenetre`) : les
 *     résultats tombent dans les jours qui suivent, les tracés et inscriptions avant ;
 *   - chaque semaine, tout le catalogue (même script, dans le rafraîchissement du mardi) ;
 *   - à la CONSULTATION : quand un coureur ouvre la fiche, la page officielle est relue en
 *     arrière-plan (au plus toutes les 6 h) — le résultat est là à sa visite suivante.
 *
 * Ce qui décide :
 *   - la page officielle (`pageOfficielle`) : le site de l'organisateur, sinon sa page
 *     d'inscription — jamais un calendrier, une plateforme ni un chronométreur ;
 *   - la page doit NOMMER la course ; si elle ne lui est pas DÉDIÉE (son adresse ou son
 *     titre ne la nomme pas), chaque lien doit la nommer lui-même ;
 *   - chaque distance reçoit SON classement et SON parcours (« Résultats 10km ») ;
 *   - un classement plus RÉCENT remplace l'ancien (le 2026 qui sort remplace le 2025) ;
 *   - un lien d'inscription ou de parcours ne remplace jamais celui qu'on a déjà ;
 *   - les dates suivent `lib/races/prochaineEdition` (annoncée = confirmée, édition récente
 *     racontée = suivante estimée).
 */
import { estCalendrierTiers, domaineDe } from "./destination";
import { estPlateformeInscription, lienInscriptionSite } from "./inscriptionSite";
import { estChronometreur, motsDistinctifs, liensResultatsCandidats, choisirParDistance } from "./resultatsSite";
import { liensParcours, parcoursPour } from "./parcoursSite";
import { datesAnnoncees, dateDepuisPage, type DateLue } from "./prochaineEdition";
import { lienClassementPropre, lienSortantPropre } from "./lienPropre";

const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const decode = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };

/**
 * La page officielle d'une course : le site de l'organisateur, sinon sa page d'inscription.
 * ⚠️ JAMAIS UN CALENDRIER, UNE PLATEFORME D'INSCRIPTION NI UN CHRONOMÉTREUR (30/09/2026) :
 * relu à la main, la fiche protiming du « Semi de la Juine » (édition 2022) affichait dans
 * sa colonne « autres événements » le Cross du Val d'Essonne du 8 novembre 2026 — que la
 * course aurait reçu comme date « confirmée ». Ces pages parlent de TOUTES leurs courses.
 */
export function pageOfficielle(c: { site_officiel?: string | null; registration_url?: string | null }): string | null {
  const http = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);
  const propre = (u: string | null) => (u && !estCalendrierTiers(u) && !estPlateformeInscription(u) && !estChronometreur(u) ? u : null);
  return propre(http(c.site_officiel)) ?? propre(http(c.registration_url));
}

/** La page NOMME-t-elle la course ? Un mot distinctif de son nom, dans le texte ou l'adresse. */
export function pageNommeLaCourse(texte: string, url: string, nom: string): boolean {
  const mots = motsDistinctifs(nom);
  if (!mots.length) return false;
  const t = norm(`${texte} ${decode(url)}`);
  return mots.some((m) => t.includes(m));
}

/**
 * La page est-elle DÉDIÉE à la course, et à quel point ?
 *   - "site" : le DOMAINE la nomme (« letraildubuis.fr ») — tout le site parle d'elle, menus compris ;
 *   - "page" : seul le chemin ou le titre la nomme (« lambersart.fr/foulees-lambersartoises ») —
 *     la PAGE parle d'elle, mais les menus sont ceux d'une mairie ou d'un club : lus le
 *     01/10/2026, le menu « Billetterie » de la ville passait pour l'inscription à la course ;
 *   - null : une page qui parle de plusieurs épreuves — chaque lien doit nommer la sienne.
 */
export function pageDediee(url: string, titre: string, nom: string, ville?: string | null): "site" | "page" | null {
  const mots = motsCourse(nom, ville);
  if (!mots.length) return null;
  let u: URL; try { u = new URL(url); } catch { return null; }
  // ⚠️ UNE MAIRIE, UN CLUB, UN OFFICE DE TOURISME n'est jamais « dédié » à une course, même
  // si son domaine porte le nom de la ville (01/10/2026 : « Rochegude en Rose » sur
  // mairie-rochegude.fr recevait le lien « inscription scolaire » du menu).
  if (!HOTE_INSTITUTION.test(u.hostname) && mots.some((m) => norm(u.hostname).replace(/[^a-z0-9]/g, "").includes(m))) return "site";
  return mots.some((m) => norm(`${decode(u.pathname)} ${titre}`).includes(m)) ? "page" : null;
}

/** Hôtes d'institutions qui parlent de tout : une mairie, un club, un office de tourisme. */
const HOTE_INSTITUTION = /mairie|ville-|commune|tourisme|office|athle|club|comite|ligue|federation|asso\b|agglo|metropole|departement|region/i;

/**
 * Les mots qui désignent LA COURSE, pas sa ville : « Rochegude en Rose » → « rose ». Le nom
 * de la ville est partout sur le site de sa mairie ; il ne prouve pas qu'une page parle de
 * la course. (Une course qui ne porte QUE le nom de sa ville garde ce nom.)
 */
export function motsCourse(nom: string, ville?: string | null): string[] {
  const mots = motsDistinctifs(nom);
  const deVille = new Set(ville ? motsDistinctifs(ville) : []);
  const propres = mots.filter((m) => !deVille.has(m));
  return propres.length ? propres : mots;
}

/** Une inscription qui n'est pas celle d'une course : école, cantine, crèche, adhésion au club… */
const INSCRIPTION_HORS_COURSE = /scolaire|cantine|p[ée]riscolaire|cr[èe]che|loisirs|garderie|[ée]cole|stage|b[ée]n[ée]vole|newsletter|listes? [ée]lectorales?|enfance|jeunesse|adh[ée]sion|licence|cotisation|plaquette/i;

/**
 * Les CONSTRUCTEURS DE SITES (01/10/2026) : sur leur domaine nu, « Créer un site »,
 * « Inscription » vendent le service — lu en pied de page, `wordpress.com/start` passait pour
 * l'inscription à une course, `sportsregions.fr/inscription` aussi. Les sites des clubs, eux,
 * vivent sur des SOUS-domaines (club.sportsregions.fr) et restent lus.
 */
export const HOTE_CONSTRUCTEUR = /^(?:www\.)?(?:wordpress\.com|wix\.com|jimdo\.com|weebly\.com|squarespace\.com|godaddy\.com|e-monsite\.com|site123\.com|webnode\.(?:fr|com)|strikingly\.com|sportsregions\.fr|clubeo\.com)$/i;
const SEGMENT_GENERIQUE = /^(?:resultats?|r%c3%a9sultats?|results?|classements?|live|calendrier|calendar|evenements?|events?|inscriptions?|competitions?|accueil|home)$/i;

/**
 * Une page GÉNÉRIQUE d'un autre site — la liste « tous nos résultats » d'un chronométreur
 * (`yaka-chrono.com/resultats`), une page « étiquette » de blog — n'est le classement ni
 * l'inscription d'aucune course. Sur le site de la course, « /resultats » est bien le sien.
 */
export function pageGenerique(url: string, pageUrl: string): boolean {
  let u: URL; try { u = new URL(url); } catch { return true; }
  if (HOTE_CONSTRUCTEUR.test(u.hostname)) return true;
  if (/\/(?:etiquette|tag|tags|categorie|category)\//i.test(u.pathname)) return true;
  const segs = u.pathname.split("/").filter(Boolean);
  const externe = domaineDe(url) !== domaineDe(pageUrl);
  return externe && !u.search && (segs.length === 0 || (segs.length === 1 && SEGMENT_GENERIQUE.test(segs[0])));
}
/** Une page de plateforme qui liste TOUTES ses courses n'est l'inscription d'aucune. */
const PAGE_LISTE = /\/(?:inscriptions?(?:-listing)?|listing|events?|evenements?|calendrier|agenda|courses|competitions?|accueil)\/?$/i;

/** La page sans ses menus, son en-tête ni son pied : ce qui reste est le CONTENU. */
export const sansMenus = (html: string) => html.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");

/**
 * Les dates qui parlent DE CETTE COURSE : toutes, si le site porte son nom (« letraildubuis.fr ») ;
 * sinon seulement celles écrites à côté de son nom (±150 caractères). Une page de club qui
 * annonce trois épreuves ne date que celle qu'elle nomme près de la date.
 */
export function datesDeLaCourse(dates: readonly DateLue[], url: string, nom: string): DateLue[] {
  const mots = motsDistinctifs(nom);
  if (!mots.length) return [];
  let hote = ""; try { hote = norm(new URL(url).hostname).replace(/[^a-z0-9]/g, ""); } catch { return []; }
  if (mots.some((m) => hote.includes(m))) return [...dates];
  return dates.filter((x) => (x.contextes ?? []).some((c) => mots.some((m) => norm(c).includes(m))));
}

/** Ce qu'une page officielle donne, lu UNE fois pour toutes les courses qui y renvoient. */
export type PageLue = {
  url: string;
  titre: string;
  texte: string;
  resultats: (ReturnType<typeof liensResultatsCandidats>[number] & { contenu: boolean })[];
  parcours: (ReturnType<typeof liensParcours>[number] & { contenu: boolean })[];
  inscription: { url: string; texte: string; contenu: boolean } | null;
  dates: DateLue[];
};

export function lirePage(html: string, url: string, aujourdhui: string): PageLue {
  const annee = Number(aujourdhui.slice(0, 4));
  const titre = `${html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""} ${html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""}`.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const texte = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200_000);
  // Chaque lien sait s'il vient du CONTENU ou d'un menu (voir `pageDediee`).
  const contenu = sansMenus(html);
  const dansContenu = new Set([
    ...liensResultatsCandidats(contenu, url, annee, undefined).map((x) => x.url),
    ...liensParcours(contenu, url).map((x) => x.url),
    lienInscriptionSite(contenu, url, annee, undefined)?.url,
  ]);
  const insc = lienInscriptionSite(html, url, annee, undefined);
  return {
    url, titre, texte,
    resultats: liensResultatsCandidats(html, url, annee, undefined).slice(0, 20).map((x) => ({ ...x, contenu: dansContenu.has(x.url) })),
    parcours: liensParcours(html, url).slice(0, 20).map((x) => ({ ...x, contenu: dansContenu.has(x.url) })),
    inscription: insc ? { url: insc.url, texte: insc.texte, contenu: dansContenu.has(insc.url) } : null,
    dates: datesAnnoncees(html, aujourdhui),
  };
}

export type CourseVeillee = {
  id: string; name: string; city?: string | null; date: string | null; date_confirmee?: boolean | null; distance_km?: number | null;
  resultats_url?: string | null; resultats_annee?: number | null; inscription_url?: string | null; parcours_url?: string | null;
};

/**
 * Ce qu'il faut écrire pour une course d'après sa page officielle — `{}` si rien.
 * `colonnes` : ce que la base sait stocker (migrations 032 et 034 passées ou non).
 */
export function deciderVeille(
  c: CourseVeillee, p: PageLue, aujourdhui: string,
  colonnes: { confirmee: boolean; parcours: boolean },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  // Sortie rapide : une page qui ne nomme pas la course n'a rien à lui donner (les filtres
  // suivants l'écarteraient aussi, lien par lien).
  if (!pageNommeLaCourse(`${p.titre} ${p.texte}`, p.url, c.name)) return patch;
  const dediee = pageDediee(p.url, p.titre, c.name, c.city);
  const mots = motsCourse(c.name, c.city);
  // Un lien vaut pour la course s'il la NOMME, ou si le site entier lui est dédié, ou si la
  // page lui est dédiée ET que le lien est dans son contenu (pas dans le menu de la mairie).
  const nommeLien = (x: { texte: string; url: string; contenu: boolean }) =>
    dediee === "site" || (dediee === "page" && x.contenu) || mots.some((m) => norm(`${x.texte} ${decode(x.url)}`).includes(m));
  const km = typeof c.distance_km === "number" ? c.distance_km : null;
  const jour = String(c.date ?? "").slice(0, 10);
  const aVenir = /^\d{4}-\d{2}-\d{2}$/.test(jour) && !jour.startsWith("2099") && jour >= aujourdhui;

  // ── Classement ──
  const res = choisirParDistance(p.resultats.filter((x) => nommeLien(x) && !pageGenerique(x.url, p.url)), km);
  const resUrl = res ? lienClassementPropre(res.url) : null;
  // Le classement d'une édition qui n'a pas encore eu lieu n'existe pas (page vide).
  const futur = res?.annee != null && aVenir && res.annee >= Number(jour.slice(0, 4));
  if (res && resUrl && !futur && resUrl !== c.resultats_url) {
    const plusRecent = res.annee != null && (c.resultats_annee == null || res.annee > c.resultats_annee);
    if (!c.resultats_url || plusRecent) { patch.resultats_url = resUrl; patch.resultats_annee = res.annee ?? null; }
  }
  // ── Inscription : seulement si on n'en a aucune ──
  if (!c.inscription_url && p.inscription && nommeLien(p.inscription)
    && !INSCRIPTION_HORS_COURSE.test(`${p.inscription.texte} ${decode(p.inscription.url)}`)) {
    const u = lienSortantPropre(p.inscription.url);
    let chemin = ""; try { chemin = new URL(u ?? "").pathname; } catch { /* */ }
    // La liste « toutes nos courses » d'une PLATEFORME n'est l'inscription d'aucune ; sur le
    // site de la course, « /inscriptions » est bien la sienne.
    if (u && !(estPlateformeInscription(u) && PAGE_LISTE.test(chemin)) && !pageGenerique(u, p.url)) patch.inscription_url = u;
  }
  // ── Parcours : seulement si on n'en a aucun ──
  if (colonnes.parcours && !c.parcours_url) {
    const tr = parcoursPour(p.parcours.filter((x) => nommeLien(x) && !pageGenerique(x.url, p.url)), km);
    if (tr) patch.parcours_url = tr.url;
  }
  // ── Date : « à venir » ou estimée seulement ──
  if (colonnes.confirmee) {
    const d = dateDepuisPage(datesDeLaCourse(p.dates, p.url, c.name), { date: c.date, date_confirmee: c.date_confirmee }, aujourdhui);
    if (d && d.date !== c.date) { patch.date = d.date; patch.date_confirmee = d.confirmee; }
  }
  return patch;
}
