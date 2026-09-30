/**
 * MISE À JOUR DU CATALOGUE DEPUIS LES FICHES finishers.com — la DÉCISION, sans écriture.
 *
 * Mesuré le 28/09/2026 : 7 002 événements du plan du site finishers absents de la base,
 * 7 994 formats en « Date à venir », 6 897 trails sans dénivelé, 510 trails à « 0 m », des
 * formats d'anciennes éditions mêlés aux vrais (« Odyssée du Tue Vaques » : 8, 10, 15, 27,
 * 30, 50 km en base pour 8,9 / 16 / 30,4 km réels).
 *
 * Tout ce qui DÉCIDE est ici, pur et testé ; `scripts/finishers-appliquer.ts` exécute.
 *
 * ⚠️ CE QU'ON NE TOUCHE PAS sur une ligne existante : le nom, le type, la ville, la
 * région. Le type a pu être corrigé par une troisième source (le-sportif : Bondues est
 * une course sur route, finishers dit trail) ou par `correctedRaceType` ; la ville a été
 * nettoyée à la main. On met à jour ce que la fiche sait MIEUX : date, distance exacte,
 * dénivelé, liens, heure.
 */

import { anneeDe } from "./resultatsSite";
import { nomCanonique } from "./groupes";
import { formatPasCourseAPied } from "./nonCourse";
import { DEPARTEMENTS } from "./departements";

export type FormatFiche = { id: string; titre: string | null; discipline: string | null; distanceM: number | null; dplus: number | null; date: string | null; heure: string | null; inscription: string | null; statut: string | null };
export type Edition = { annee: number; debut: string | null; statut: string | null };
export type Fiche = {
  slug: string; ok: boolean; /** Code HTTP d'une fiche illisible (0 = réseau). */ http?: number; pays?: string | null; nom?: string; ville?: string | null; departement?: string | null; region?: string | null;
  lat?: number | null; lon?: number | null; derniere?: Edition | null; prochaine?: Edition | null; formats?: FormatFiche[];
  siteOfficiel?: string | null; inscription?: string | null;
  /** `annee` fixée quand on l'a LUE (lien trouvé sur le site officiel) ; sinon déduite du lien. */
  resultats?: { page: string | null; classement: string | null; annee?: number | null } | null;
};
export type LigneCourse = {
  id: string; name: string; city: string | null; date: string; distance_km: number | null; elevation_gain_m: number | null;
  type: string; organization: string | null; registration_url: string | null; latitude: number | null; longitude: number | null;
  region: string | null; department: string | null; difficulty: string | null; source_id?: string | null;
};

/** France métropolitaine et outre-mer (codes ISO que la source emploie pour les DROM-COM). */
export const PAYS_FRANCE = new Set(["FR", "RE", "GP", "MQ", "GF", "YT", "PM", "BL", "MF", "NC", "PF", "WF"]);
export const DATE_A_VENIR = "2099-01-01";

/**
 * Disciplines de COURSE À PIED — la source recense aussi triathlons, vélo, nage, marche.
 *
 * ⚠️ LISTE EXACTE, PAS UN PRÉFIXE (29/09/2026). « commence par mountain » laissait passer
 * `mountain_biking` (443 formats : « Roc d'Azur VTT », « Le bélier VTT » au catalogue des
 * courses), et « commence par cross » `cross_country_skiing` ; l'exclusion cherchait
 * « bike », que « biking » ne contient pas. Vocabulaire mesuré sur 34 000 formats : seuls
 * `trail`, `road` et `cross` sont de la course. Une discipline inconnue est écartée.
 */
const DISCIPLINES_COURSE = new Set(["road", "trail", "cross", "running", "ultra", "stairs", "mountain_running", "vertical", "vertical_km", "skyrunning", "kv"]);
export const estCourseAPied = (discipline: string | null | undefined) =>
  DISCIPLINES_COURSE.has(String(discipline ?? "").trim().toLowerCase());

/** Le département d'outre-mer d'un code pays (RE → « La Réunion »), ou `null` (métropole, collectivités). */
export function departementOutreMer(pays: string | null | undefined): string | null {
  const region = REGION_OUTRE_MER[String(pays ?? "")];
  return (region && DEPARTEMENTS.find((d) => d.region === region)?.nom) || null;
}

/**
 * Outre-mer : la région vient du CODE PAYS. Le fil d'Ariane de la source y donne
 * l'arrondissement (« Saint-Benoît », « Saint-Paul » pour La Réunion), voire rien : une
 * course rangée en « saint-benoit » serait invisible du filtre par région.
 */
export const REGION_OUTRE_MER: Record<string, string> = {
  RE: "la-reunion", GP: "guadeloupe", MQ: "martinique", GF: "guyane", YT: "mayotte",
  NC: "nouvelle-caledonie", PF: "polynesie-francaise", PM: "saint-pierre-et-miquelon",
  BL: "saint-barthelemy", MF: "saint-martin", WF: "wallis-et-futuna",
};

/** « Provence-Alpes-Côte d'Azur » → « provence-alpes-cote-d-azur » (la forme déjà en base). */
export function slugRegion(label: string | null | undefined): string | null {
  const s = String(label ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || null;
}

/** Le type d'une NOUVELLE ligne — route par distance, trail par `correctedRaceType`. */
export function typeDe(discipline: string | null | undefined, km: number): string {
  const trail = /trail|ultra|mountain|sky|vertical|kv|cross/i.test(String(discipline ?? ""));
  if (!trail) return km < 7.5 ? "road_5k" : km < 16 ? "road_10k" : km < 30 ? "semi" : "marathon";
  return km < 30 ? "trail_s" : km < 50 ? "trail_m" : km < 80 ? "trail_l" : km < 100 ? "trail_xl" : "ultra";
}

export const estTrail = (type: string) => /trail|ultra/.test(type);

/**
 * Distance en km, au 1/10 ; `null` si inexploitable ou trop courte. Sous 4 km, ce sont des
 * courses ENFANTS (« 10 000 Pattes » : 1,8 km) — que le catalogue rangerait en « 5 km ».
 *
 * Exception : le kilomètre vertical, court par nature (≈ 3 km pour 1 000 m de D+).
 * ⚠️ La source ne le range PAS en « vertical » : c'est un « trail » de 3,8 km pour 1 000 m
 * (Marathon du Mont-Blanc). On le reconnaît donc à sa PENTE, pas à son étiquette — sans
 * quoi le seuil de 4 km retirait les KV du catalogue.
 */
export const kmDe = (m: number | null | undefined, discipline?: string | null, dplus?: number | null) => {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  // 300 m de D+ : aucune course enfants n'en a ; « Défi de l'Olympe, 3,5 km, 520 m » en a.
  const vertical = /vertical|kv/i.test(String(discipline ?? "")) || (typeof dplus === "number" && dplus >= 300);
  const min = vertical ? 1500 : 4000;
  return m >= min ? Math.round(m / 100) / 10 : null;
};

/**
 * Un dénivelé PLAUSIBLE pour cette distance ? Le plus raide des KV (Fully : 1 000 m sur
 * 1,9 km) fait ~530 m/km ; au-delà de 5 km, aucune course ne tient 250 m/km. En base le
 * 28/09/2026 : « Montée du Ventoux, 18 km, 16 660 m » — un zéro de trop, affiché tel quel.
 */
export function dplusPlausible(dplus: number, km: number | null | undefined): boolean {
  const k = Number(km);
  if (!Number.isFinite(k) || k <= 0) return true;   // sans distance, rien à comparer
  return dplus <= k * (k <= 5 ? 600 : 250);
}

/** Jours fériés en France (Pâques par l'algorithme de Meeus) : on y court, même en semaine. */
export function estFerie(iso: string): boolean {
  const [a, m, j] = iso.split("-").map(Number);
  if (["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25"].includes(iso.slice(5, 10))) return true;
  const g = a % 19, c = Math.floor(a / 100), h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
  const i = h - Math.floor(h / 28) * (1 - Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11));
  const jr = (a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4)) % 7;
  const l = i - jr, moisP = 3 + Math.floor((l + 40) / 44), jourP = l + 28 - 31 * Math.floor(moisP / 4);
  const paques = Date.UTC(a, moisP - 1, jourP), ce = Date.UTC(a, m - 1, j);
  return [1, 39, 50].some((k) => ce === paques + k * 864e5);   // lundi de Pâques, Ascension, lundi de Pentecôte
}

/**
 * La date d'un format : la sienne, sinon celle de la prochaine édition. Passée ou absente
 * → « Date à venir ». `confirmee` dit si l'organisateur l'a confirmée.
 *
 * ⚠️ « tba » N'EST PAS UNE DATE ANNONCÉE, C'EST UNE ESTIMATION de la source, reportée
 * d'édition en édition, et qui DÉRIVE : « Foulées Halluinoises » le mardi 06/10/2026, courues
 * le dimanche 11. Mesuré le 29/09/2026 contre le calendrier kikourou (3 semaines, 12
 * départements) : 0 estimation juste sur 28 un lundi ou un mardi ; 22 sur 34 un dimanche.
 * Et sur 387 dates CONFIRMÉES, aucune un mardi. Une date estimée en semaine (lundi → jeudi,
 * hors férié) est donc tenue pour inconnue ; le vendredi soir et le week-end restent,
 * signalés « estimée ».
 */
export function dateDe(f: FormatFiche, fiche: Fiche, aujourdhui: string): { date: string; confirmee: boolean | null } {
  const d = (f.date ?? fiche.prochaine?.debut ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < aujourdhui) return { date: DATE_A_VENIR, confirmee: null };
  const statut = f.statut ?? fiche.prochaine?.statut ?? null;
  const confirmee = statut === "confirmed" ? true : statut ? false : null;
  const jour = new Date(`${d}T12:00:00Z`).getUTCDay();   // 0 = dimanche
  if (confirmee !== true && jour >= 1 && jour <= 4 && !estFerie(d)) return { date: DATE_A_VENIR, confirmee: null };
  return { date: d, confirmee };
}

/**
 * ⚠️ UNE ESTIMATION ÉCARTÉE N'EFFACE PAS UNE DATE DÉCLARÉE AILLEURS. Vu le 29/09/2026 en
 * rejouant le rafraîchissement : « Boucles des Cordeliers » (Morlaàs), datée du samedi
 * 17/10 par l'office de tourisme (DATAtourisme), repassait chaque semaine en « Date à
 * venir » parce que finishers l'estime au mardi 27/10 — une estimation que `dateDe`
 * écarte, à raison. Écarter une estimation ne prouve rien contre une date d'une autre
 * source : si la ligne porte une date FUTURE de la même saison que l'estimation (± 120 j),
 * elle la garde. Une estimation passée ou absente, ou une date d'une autre édition
 * (~365 j) : rien. ± 45 j ne suffisait pas : « Trail des Ducs » (Bar-le-Duc), déclaré le
 * dimanche 25/04/2027, estimé au lundi 08/03 — l'épreuve a changé de mois, pas d'année.
 *
 * ⚠️ UNE ESTIMATION DÉPASSÉE NE PROUVE RIEN (30/09/2026). Six courses estimées au mardi
 * 29/09 (« Course des Remparts de Provins », « La Yussoise »…), déclarées le dimanche 4/10,
 * repassaient en « Date à venir » le lendemain : l'estimation était devenue passée. Seule
 * une date CONFIRMÉE et passée dit que l'édition a eu lieu (« Transvésubienne », 27/09).
 */
export function dateConservee(existante: string | null | undefined, f: FormatFiche, fiche: Fiche, aujourdhui: string): boolean {
  const e = String(existante ?? "").slice(0, 10), estimee = (f.date ?? fiche.prochaine?.debut ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e) || e.startsWith("2099") || e < aujourdhui) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(estimee)) return false;
  const confirmee = (f.statut ?? fiche.prochaine?.statut ?? null) === "confirmed";
  if (estimee < aujourdhui && confirmee) return false;
  return Math.abs(Date.parse(e) - Date.parse(estimee)) <= 120 * 864e5;
}

/**
 * Le dénivelé : celui de la fiche ; mais « 0 m » sur un TRAIL est une absence de donnée,
 * pas un fait — on écrit `null` (affiché « — »), jamais un zéro qui passerait pour du plat.
 */
export function dplusDe(dplus: number | null | undefined, trail: boolean, km?: number | null): number | null {
  if (typeof dplus !== "number" || !Number.isFinite(dplus) || dplus < 0) return null;
  if (dplus === 0 && trail) return null;
  if (!dplusPlausible(dplus, km)) return null;
  return Math.round(dplus);
}

/**
 * Format À DURÉE (6 h, 24 h, backyard) : la « distance » que donne la source est celle de
 * la BOUCLE (« Atipik Trail – 6h Solo : 3,3 km »). Ce n'est pas une course de 3,3 km —
 * ni à importer comme telle, ni à retirer comme périmée.
 * « 9h30 » (une heure de départ) ne compte pas : le `h` y est suivi de chiffres.
 */
export const estChrono = (titre: string | null | undefined) =>
  /(^|[^\d])\d{1,3}\s*h\b|\bheures?\b|backyard/i.test(String(titre ?? ""));

const estRelais = (titre: string | null | undefined) => /relais|relay|[ée]quipe|\bduo\b|\btrio\b/i.test(String(titre ?? ""));

/** Boucles des formats à durée — les lignes à cette distance ne sont pas des formats périmés. */
export function bouclesChrono(fiche: Fiche): number[] {
  return (fiche.formats ?? []).filter((f) => estChrono(f.titre) && estCourseAPied(f.discipline) && typeof f.distanceM === "number")
    .map((f) => Math.round((f.distanceM as number) / 100) / 10);
}

/**
 * Les formats de course à pied retenus d'une fiche, dédoublonnés par distance. À distance
 * égale, la course INDIVIDUELLE passe avant le relais (« Semi-marathon relais à 3 ») : c'est
 * elle dont on veut le lien d'inscription.
 */
export function formatsRetenus(fiche: Fiche): (FormatFiche & { km: number })[] {
  const vus = new Set<number>();
  const out: (FormatFiche & { km: number })[] = [];
  const ordre = [...(fiche.formats ?? [])].sort((a, b) => Number(estRelais(a.titre)) - Number(estRelais(b.titre)));
  for (const f of ordre) {
    if (estChrono(f.titre) || formatPasCourseAPied(f.titre)) continue;
    const km = kmDe(f.distanceM, f.discipline, f.dplus);
    if (km == null || !estCourseAPied(f.discipline) || km > 400) continue;
    if (vus.has(km)) continue;
    vus.add(km); out.push({ ...f, km });
  }
  return out;
}

const tolere = (km: number) => Math.max(0.25, km * 0.025);

/**
 * Apparie les lignes existantes d'un événement aux formats de la fiche : d'abord par
 * identifiant de source, puis par distance la plus proche dans la tolérance. UN POUR UN :
 * deux formats de 10 km (élite et populaire) ne se disputent pas la même ligne.
 */
export function apparier<L extends { id: string; distance_km: number | null; source_id?: string | null }>(
  lignes: readonly L[], formats: readonly { id: string; km: number }[],
): { paires: [L, { id: string; km: number }][]; lignesSeules: L[]; formatsSeuls: { id: string; km: number }[] } {
  const libres = [...lignes];
  const paires: [L, { id: string; km: number }][] = [];
  const formatsSeuls: { id: string; km: number }[] = [];
  const restants: { id: string; km: number }[] = [];
  for (const f of formats) {
    const i = libres.findIndex((l) => l.source_id && l.source_id === f.id);
    if (i >= 0) paires.push([libres.splice(i, 1)[0], f]); else restants.push(f);
  }
  for (const f of restants) {
    let k = -1, meilleur = Infinity;
    libres.forEach((l, j) => {
      const e = Math.abs(Number(l.distance_km) - f.km);
      if (Number.isFinite(e) && e <= tolere(f.km) && e < meilleur) { meilleur = e; k = j; }
    });
    if (k >= 0) paires.push([libres.splice(k, 1)[0], f]); else formatsSeuls.push(f);
  }
  return { paires, lignesSeules: libres, formatsSeuls };
}

export type Plan = {
  majs: { id: string; patch: Record<string, unknown> }[];
  ajouts: Record<string, unknown>[];
  retraits: string[];
  /** Pourquoi chaque ligne part : format d'une ancienne édition, doublon, épreuve qui n'est pas de la course à pied. */
  motifs: Record<string, "perime" | "doublon" | "pasCourseAPied">;
  /** Dates annoncées mais NON confirmées, laissées de côté tant que la colonne qui le dit n'existe pas. */
  datesEnAttente: number;
};

/** La ligne vient-elle de CETTE fiche (import finishers, lien vers ce slug) ? */
export const deCetteFiche = (l: Pick<LigneCourse, "organization" | "registration_url">, slug: string) =>
  l.organization === "finishers.com"
  && String(l.registration_url ?? "").replace(/[?#].*$/, "").replace(/\/+$/, "").endsWith(`finishers.com/course/${slug}`);

/**
 * Tous les formats de la fiche sont LISIBLES et aucun n'est de la course à pied adulte :
 * triathlon, marche, vélo, course enfants. Distinct d'une fiche muette (formats absents ou
 * distance inconnue), qui ne prouve rien.
 */
export function pasUneCourseAPied(fiche: Fiche): boolean {
  const f = fiche.formats ?? [];
  if (!f.length || formatsRetenus(fiche).length || bouclesChrono(fiche).length) return false;
  return f.every((x) => typeof x.distanceM === "number" && x.distanceM > 0 && !!x.discipline);
}

/**
 * Le plan d'un événement : mises à jour, ajouts, retraits.
 *
 * `lignes` = les lignes de CET événement : celles qui pointent vers sa fiche, et celles
 * d'une autre source au même nom dans la même ville (jogging-plus : 3 193 lignes figées en
 * « Date à venir » que rien d'autre ne rafraîchit).
 *
 * ⚠️ RETIRER n'est permis que pour une ligne qu'AUCUN athlète n'a mise en favori, et :
 *   - venue de CETTE fiche et absente de l'édition annoncée (format périmé) ;
 *   - venue d'ailleurs mais DOUBLON exact d'un format présent (même nom, même ville, même
 *     distance) — elle n'apporte rien et la course s'affichait deux fois ;
 *   - venue de cette fiche quand l'épreuve n'est pas de la course à pied (triathlon…).
 * Une ligne d'une autre source SANS équivalent dans la fiche n'est jamais retirée.
 *
 * ⚠️ UNE DATE ANNONCÉE N'EST PAS UNE DATE CONFIRMÉE. Tant que la colonne `date_confirmee`
 * n'existe pas (migration 032), une date estimée n'est pas écrite : elle s'afficherait
 * comme certaine. La ligne garde la sienne.
 */
export function planEvenement(
  fiche: Fiche, lignes: readonly LigneCourse[],
  o: { aujourdhui: string; favoris: ReadonlySet<string>; colonnesNouvelles: boolean },
): Plan {
  const plan: Plan = { majs: [], ajouts: [], retraits: [], motifs: {}, datesEnAttente: 0 };
  if (!fiche.ok || !PAYS_FRANCE.has(String(fiche.pays ?? ""))) return plan;
  const retirer = (id: string, motif: Plan["motifs"][string]) => { plan.retraits.push(id); plan.motifs[id] = motif; };
  const formats = formatsRetenus(fiche);
  if (!formats.length) {
    // Une fiche muette ne dit rien : on ne touche à rien. Une épreuve qui n'est pas de la
    // course à pied retire ce qu'on en avait importé (« Triathlon des Gorges, 103 km »).
    if (pasUneCourseAPied(fiche)) for (const l of lignes) if (deCetteFiche(l, fiche.slug) && !o.favoris.has(l.id)) retirer(l.id, "pasCourseAPied");
    return plan;
  }

  const resultats = fiche.resultats?.classement ?? fiche.resultats?.page ?? null;
  // L'année du classement : lue dans le lien (« …-marathon-de-paris-2026 »), JAMAIS supposée
  // être celle de la dernière édition — une page qui s'arrête en 2024 n'est pas « 2026 ».
  const anneeRes = resultats == null ? null
    : fiche.resultats?.annee !== undefined ? fiche.resultats.annee ?? null : anneeDe(resultats, Number(o.aujourdhui.slice(0, 4)));
  const extras = (f: FormatFiche) => (o.colonnesNouvelles ? {
    site_officiel: fiche.siteOfficiel ?? null,
    inscription_url: f.inscription ?? fiche.inscription ?? null,
    resultats_url: resultats,
    resultats_annee: anneeRes,
    heure_depart: f.heure && /^\d{2}:\d{2}$/.test(f.heure) ? f.heure : null,
    source_id: f.id || null,
    source_maj_at: new Date().toISOString(),
  } : {});
  // La date à écrire ; `confirmee: undefined` = ne pas toucher à `date_confirmee`.
  const dateAEcrire = (f: FormatFiche, existante: string | null): { date: string; confirmee: boolean | null | undefined } => {
    const { date, confirmee } = dateDe(f, fiche, o.aujourdhui);
    if (date === DATE_A_VENIR && existante && dateConservee(existante, f, fiche, o.aujourdhui)) return { date: existante.slice(0, 10), confirmee: undefined };
    if (o.colonnesNouvelles || confirmee === true || date === DATE_A_VENIR) return { date, confirmee };
    plan.datesEnAttente++;
    return { date: existante ?? DATE_A_VENIR, confirmee: null };
  };

  // ⚠️ DATATOURISME CÈDE LA PLACE. Ses distances sont LUES DANS LE TEXTE de l'office de
  // tourisme (« Luga'Trail » : 8 et 15 km) ; la fiche finishers les donne format par
  // format (11 et 16 km). Quand la fiche couvre l'événement, les lignes DATAtourisme
  // partent — sinon la carte affichait « 8 · 11 · 15 · 16 km » (vu le 29/09/2026).
  for (const l of lignes) if (l.organization === "DATAtourisme" && !o.favoris.has(l.id)) retirer(l.id, "doublon");
  const retenues = lignes.filter((l) => l.organization !== "DATAtourisme" || o.favoris.has(l.id));
  // Les lignes de la fiche d'abord : à distance égale, c'est elle qui garde le format et la
  // copie venue d'ailleurs qui devient le doublon.
  const ordonnees = [...retenues].sort((a, b) => Number(deCetteFiche(b, fiche.slug)) - Number(deCetteFiche(a, fiche.slug)));
  const { paires, lignesSeules, formatsSeuls } = apparier(ordonnees, formats);
  for (const [l, fa] of paires) {
    const f = formats.find((x) => x.id === fa.id && x.km === fa.km)!;
    const { date, confirmee } = dateAEcrire(f, l.date);
    const trail = estTrail(l.type);
    const garde = l.elevation_gain_m != null && !(trail && l.elevation_gain_m === 0) && dplusPlausible(l.elevation_gain_m, f.km) ? l.elevation_gain_m : null;
    const patch: Record<string, unknown> = {
      date, distance_km: f.km,
      elevation_gain_m: dplusDe(f.dplus, trail, f.km) ?? garde,
      ...extras(f),
      ...(o.colonnesNouvelles && confirmee !== undefined ? { date_confirmee: confirmee } : {}),
    };
    if (l.latitude == null && fiche.lat != null) Object.assign(patch, { latitude: fiche.lat, longitude: fiche.lon });
    plan.majs.push({ id: l.id, patch });
  }

  const modele = ordonnees[0];
  for (const fs of formatsSeuls) {
    const f = formats.find((x) => x.id === fs.id && x.km === fs.km)!;
    const { date, confirmee } = dateAEcrire(f, null);
    const type = typeDe(f.discipline, f.km);
    plan.ajouts.push({
      name: modele?.name ?? fiche.nom, city: modele?.city ?? fiche.ville ?? "",
      // Outre-mer : le fil d'Ariane de la source n'a pas le département (48 courses de La
      // Réunion, Martinique… sans lui le 30/09) ; il se déduit du code pays, sans ambiguïté.
      department: modele?.department || departementOutreMer(fiche.pays) || fiche.departement || "",
      region: modele?.region ?? REGION_OUTRE_MER[String(fiche.pays)] ?? slugRegion(fiche.region) ?? "",
      date, distance_km: f.km, type, elevation_gain_m: dplusDe(f.dplus, estTrail(type), f.km),
      difficulty: estTrail(type) ? "blue" : "green", terrain: [], time_limits: [],
      registration_url: `https://www.finishers.com/course/${fiche.slug}`, organization: "finishers.com",
      description: null, latitude: modele?.latitude ?? fiche.lat ?? null, longitude: modele?.longitude ?? fiche.lon ?? null,
      is_itra_certified: false, itra_points: null,
      ...extras(f), ...(o.colonnesNouvelles ? { date_confirmee: confirmee } : {}),
    });
  }

  const boucles = bouclesChrono(fiche);
  for (const l of lignesSeules) {
    if (o.favoris.has(l.id)) continue;
    const km = Number(l.distance_km);
    if (boucles.some((b) => Math.abs(b - km) <= tolere(b))) continue;   // la boucle d'un 6 h, pas un format périmé
    if (deCetteFiche(l, fiche.slug)) { retirer(l.id, "perime"); continue; }
    if (formats.some((f) => Math.abs(f.km - km) <= tolere(f.km))) retirer(l.id, "doublon");
  }
  return plan;
}

/**
 * FICHES JUMELLES : le même événement publié sous DEUX adresses par la source
 * (« trail-de-haute-provence » et « trail-de-haute-provence-thp », « les-sentiers-de-l-ajar »
 * et « les-sentiers-de-l-ajar-1 »), avec les MÊMES identifiants de formats. Importées
 * chacune, elles doublaient chaque format au catalogue (29/09/2026 : 27 paires). Des
 * identifiants de courses identiques sont une preuve, pas une ressemblance.
 *
 * Seconde preuve (30/09/2026) : identifiants différents, mais même nom (`cleNomVille`) et
 * EXACTEMENT les mêmes formats — mêmes distances, mêmes dates (« Collines du diable » /
 * « Les Collines du Diable », « 10km de la Bastille » / « Les 10 Km de la Bastille »). Deux
 * fiches qui divergent (« JURAPICS » 27 km, « Jurapics » 28 km) ne sont PAS rapprochées :
 * rien ne dit laquelle est juste.
 *
 * Rend jumelle → fiche gardée. On garde celle qui a déjà des lignes au catalogue, puis la
 * plus courte adresse (sans « -1 »), puis l'ordre alphabétique — toujours la même.
 */
export function fichesJumelles(fiches: Iterable<Fiche>, aDesLignes: (slug: string) => boolean): Map<string, string> {
  const groupes = new Map<string, string[]>();
  const ajouter = (k: string, slug: string) => groupes.set(k, [...new Set([...(groupes.get(k) ?? []), slug])]);
  for (const f of fiches) {
    if (!f.ok) continue;
    const retenus = formatsRetenus(f);
    const ids = retenus.map((x) => x.id).filter(Boolean).sort();
    if (!ids.length) continue;
    ajouter(`ids:${ids.join("|")}`, f.slug);
    const formats = retenus.map((x) => `${x.km}@${String(x.date ?? f.prochaine?.debut ?? "").slice(0, 10)}`).sort().join(",");
    if (cleNomVille(f.nom, f.ville) !== "::") ajouter(`nom:${cleNomVille(f.nom, f.ville)}|${formats}`, f.slug);
  }
  const jumelles = new Map<string, string>();
  for (const slugs of groupes.values()) {
    if (slugs.length < 2) continue;
    const [gardee, ...autres] = [...slugs].sort((a, b) =>
      Number(aDesLignes(b)) - Number(aDesLignes(a)) || a.length - b.length || a.localeCompare(b));
    for (const s of autres) jumelles.set(s, gardee);
  }
  return jumelles;
}

/** Clé de rapprochement nom + ville, pour ne pas réimporter un événement venu d'une autre source. */
export function cleNomVille(nom: string | null | undefined, ville: string | null | undefined): string {
  const n = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  // Le NOM par `nomCanonique` (article, « 10 Km »/« 10km », « St ») : voir lib/races/groupes.
  return `${nomCanonique(nom)}::${n(ville)}`;
}
