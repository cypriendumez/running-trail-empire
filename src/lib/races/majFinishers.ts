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

export type FormatFiche = { id: string; titre: string | null; discipline: string | null; distanceM: number | null; dplus: number | null; date: string | null; heure: string | null; inscription: string | null; statut: string | null };
export type Edition = { annee: number; debut: string | null; statut: string | null };
export type Fiche = {
  slug: string; ok: boolean; pays?: string | null; nom?: string; ville?: string | null; departement?: string | null; region?: string | null;
  lat?: number | null; lon?: number | null; derniere?: Edition | null; prochaine?: Edition | null; formats?: FormatFiche[];
  siteOfficiel?: string | null; inscription?: string | null; resultats?: { page: string | null; classement: string | null } | null;
};
export type LigneCourse = {
  id: string; name: string; city: string | null; date: string; distance_km: number | null; elevation_gain_m: number | null;
  type: string; organization: string | null; registration_url: string | null; latitude: number | null; longitude: number | null;
  region: string | null; department: string | null; difficulty: string | null; source_id?: string | null;
};

/** France métropolitaine et outre-mer (codes ISO que la source emploie pour les DROM-COM). */
export const PAYS_FRANCE = new Set(["FR", "RE", "GP", "MQ", "GF", "YT", "PM", "BL", "MF", "NC", "PF", "WF"]);
export const DATE_A_VENIR = "2099-01-01";

/** Disciplines de COURSE À PIED — la source recense aussi triathlons, vélo, nage, marche. */
export const estCourseAPied = (discipline: string | null | undefined) =>
  /^(road|trail|running|ultra|cross|stairs|mountain|vertical|skyrunning|kv)/i.test(String(discipline ?? ""))
  && !/walk|marche|nordic|bike|cycl|swim|tri|duathlon|obstacle/i.test(String(discipline ?? ""));

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
  const vertical = /vertical|kv/i.test(String(discipline ?? ""))
    || (typeof dplus === "number" && dplus >= 300 && m > 0 && dplus / (m / 1000) >= 150);
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

/**
 * La date d'un format : la sienne, sinon celle de la prochaine édition. Passée ou absente
 * → « Date à venir ». `confirmee` dit si l'organisateur l'a confirmée (sinon estimée).
 */
export function dateDe(f: FormatFiche, fiche: Fiche, aujourdhui: string): { date: string; confirmee: boolean | null } {
  const d = (f.date ?? fiche.prochaine?.debut ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < aujourdhui) return { date: DATE_A_VENIR, confirmee: null };
  const statut = f.statut ?? fiche.prochaine?.statut ?? null;
  return { date: d, confirmee: statut === "confirmed" ? true : statut ? false : null };
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

/** Les formats de course à pied retenus d'une fiche, dédoublonnés par distance. */
export function formatsRetenus(fiche: Fiche): (FormatFiche & { km: number })[] {
  const vus = new Set<number>();
  const out: (FormatFiche & { km: number })[] = [];
  for (const f of fiche.formats ?? []) {
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
  if (!f.length || formatsRetenus(fiche).length) return false;
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
  const extras = (f: FormatFiche) => (o.colonnesNouvelles ? {
    site_officiel: fiche.siteOfficiel ?? null,
    inscription_url: f.inscription ?? fiche.inscription ?? null,
    resultats_url: resultats,
    resultats_annee: resultats ? fiche.derniere?.annee ?? null : null,
    heure_depart: f.heure && /^\d{2}:\d{2}$/.test(f.heure) ? f.heure : null,
    source_id: f.id || null,
    source_maj_at: new Date().toISOString(),
  } : {});
  // La date à écrire, ou `undefined` pour laisser celle de la ligne.
  const dateAEcrire = (f: FormatFiche, existante: string | null) => {
    const { date, confirmee } = dateDe(f, fiche, o.aujourdhui);
    if (o.colonnesNouvelles || confirmee === true || date === DATE_A_VENIR) return { date, confirmee };
    plan.datesEnAttente++;
    return { date: existante ?? DATE_A_VENIR, confirmee: null };
  };

  // Les lignes de la fiche d'abord : à distance égale, c'est elle qui garde le format et la
  // copie venue d'ailleurs qui devient le doublon.
  const ordonnees = [...lignes].sort((a, b) => Number(deCetteFiche(b, fiche.slug)) - Number(deCetteFiche(a, fiche.slug)));
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
      ...(o.colonnesNouvelles ? { date_confirmee: confirmee } : {}),
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
      department: modele?.department ?? fiche.departement ?? "", region: modele?.region ?? slugRegion(fiche.region) ?? "",
      date, distance_km: f.km, type, elevation_gain_m: dplusDe(f.dplus, estTrail(type), f.km),
      difficulty: estTrail(type) ? "blue" : "green", terrain: [], time_limits: [],
      registration_url: `https://www.finishers.com/course/${fiche.slug}`, organization: "finishers.com",
      description: null, latitude: modele?.latitude ?? fiche.lat ?? null, longitude: modele?.longitude ?? fiche.lon ?? null,
      is_itra_certified: false, itra_points: null,
      ...extras(f), ...(o.colonnesNouvelles ? { date_confirmee: confirmee } : {}),
    });
  }

  for (const l of lignesSeules) {
    if (o.favoris.has(l.id)) continue;
    if (deCetteFiche(l, fiche.slug)) { retirer(l.id, "perime"); continue; }
    const km = Number(l.distance_km);
    if (formats.some((f) => Math.abs(f.km - km) <= tolere(f.km))) retirer(l.id, "doublon");
  }
  return plan;
}

/** Clé de rapprochement nom + ville, pour ne pas réimporter un événement venu d'une autre source. */
export function cleNomVille(nom: string | null | undefined, ville: string | null | undefined): string {
  const n = (s: string | null | undefined) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${n(nom)}::${n(ville)}`;
}
