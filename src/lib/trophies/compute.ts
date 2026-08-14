// ─────────────────────────────────────────────────────────────────────────────
//  TROPHÉES — calculés à la lecture, à partir des séances réelles.
//
//  POURQUOI PAS UNE TABLE. Un trophée n'est pas une donnée saisie : c'est une
//  CONCLUSION tirée de l'historique. Le persister, c'est risquer qu'il survive à la
//  correction ou à la suppression de la séance qui l'a produit — une vitrine qui
//  raconterait une performance effacée. Même raisonnement que la VMA estimée, déjà
//  calculée à la lecture ailleurs dans l'app.
//
//  RÈGLE ABSOLUE ICI : aucun trophée sans preuve. Pas de palier « en cours », pas de
//  médaille de participation, aucun chrono déduit d'une distance approchante sans
//  le dire. S'il n'y a rien à décerner, on ne décerne rien — un mur de trophées
//  offerts ne récompense plus rien et ment sur le niveau de l'athlète.
// ─────────────────────────────────────────────────────────────────────────────

import { isRun as isRunSport } from "@/lib/intervals/sport";

export type Tier = "bronze" | "argent" | "or" | "platine";

export type Trophy = {
  /** Clé stable : sert de `key` React et de garde anti-doublon. */
  id: string;
  kind: "record" | "chrono" | "palier" | "serie" | "volume" | "course";
  label: string;
  value: string;
  /** Ce qui PROUVE le trophée (date, distance réelle) — jamais décoratif. */
  detail?: string;
  date?: string;
  tier?: Tier;
};

export type TrophyWorkout = {
  date: string;
  title?: string | null;
  type?: string | null;
  sport?: string | null;
  distance_km?: number | null;
  duration_seconds?: number | null;
  elevation_gain_m?: number | null;
};

const km1 = (n: number) => `${n.toFixed(1).replace(".", ",")} km`;
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Durée en h/min, sans jamais afficher « 0 h ». */
export function hms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")}`;
  if (m > 0) return `${m} min ${String(s).padStart(2, "0")}`;
  return `${s} s`;
}

/** Seules les séances de course comptent : une sortie vélo n'est pas un record de course.
 *
 *  Le filtre listait les sports INTERDITS. Depuis l'élargissement de la table des sports,
 *  tout ce qui n'était pas dans la liste passait pour de la course : 2 h de ski de fond
 *  ou une séance de renfo pouvaient décrocher un record de « plus longue sortie ».
 *  On teste maintenant l'appartenance à la course, et la liste de mots ne sert plus
 *  qu'aux lignes sans `sport` (antérieures à la migration 015). */
const isRunLike = (w: TrophyWorkout) => {
  if (w.sport != null) return isRunSport(w.sport);
  return !/ride|bike|velo|vélo|swim|natation|row|elliptical|walk|marche|hike|rando/.test(String(w.type ?? "").toLowerCase());
};

/** Distances de référence, avec la TOLÉRANCE assumée et affichée. */
const REFERENCES: { key: string; label: string; km: number }[] = [
  { key: "5k", label: "5 km", km: 5 },
  { key: "10k", label: "10 km", km: 10 },
  { key: "semi", label: "Semi-marathon", km: 21.0975 },
  { key: "marathon", label: "Marathon", km: 42.195 },
];

/**
 * Meilleur temps sur une distance de référence.
 *
 * ⚠️ HONNÊTETÉ DU CHRONO. Sans les découpes kilométriques (elles vivent dans les flux
 * GPS, non importés), on ne peut PAS connaître le temps de passage au 10ᵉ km d'une
 * sortie de 14 km. On ne retient donc que les sorties dont la distance est comprise
 * entre la référence et +6 %, et on AFFICHE la distance réelle. Élargir la fenêtre
 * ferait passer un 9,2 km pour un record sur 10 km : un chrono flatteur et faux.
 */
export function chronoRecords(workouts: TrophyWorkout[]): Trophy[] {
  const out: Trophy[] = [];
  for (const ref of REFERENCES) {
    const candidats = workouts.filter((w) =>
      isRunLike(w) && (w.distance_km ?? 0) >= ref.km && (w.distance_km ?? 0) <= ref.km * 1.06
      && (w.duration_seconds ?? 0) > 0);
    if (!candidats.length) continue;
    const best = candidats.reduce((a, b) => (a.duration_seconds! <= b.duration_seconds! ? a : b));
    out.push({
      id: `chrono-${ref.key}`,
      kind: "chrono",
      label: ref.label,
      value: hms(best.duration_seconds!),
      detail: `${km1(best.distance_km!)} le ${dateFr(best.date)}`,
      date: best.date,
    });
  }
  return out;
}

/** Records bruts : la plus longue sortie, le plus gros dénivelé. */
export function personalRecords(workouts: TrophyWorkout[]): Trophy[] {
  const runs = workouts.filter(isRunLike);
  const out: Trophy[] = [];

  const longest = runs.filter((w) => (w.distance_km ?? 0) > 0)
    .reduce<TrophyWorkout | null>((a, b) => (!a || (b.distance_km ?? 0) > (a.distance_km ?? 0) ? b : a), null);
  if (longest) {
    out.push({
      id: "record-distance", kind: "record", label: "Plus longue sortie",
      value: km1(longest.distance_km!), detail: dateFr(longest.date), date: longest.date,
    });
  }

  const climb = runs.filter((w) => (w.elevation_gain_m ?? 0) > 0)
    .reduce<TrophyWorkout | null>((a, b) => (!a || (b.elevation_gain_m ?? 0) > (a.elevation_gain_m ?? 0) ? b : a), null);
  if (climb) {
    out.push({
      id: "record-denivele", kind: "record", label: "Plus gros dénivelé",
      value: `${Math.round(climb.elevation_gain_m!)} m D+`, detail: dateFr(climb.date), date: climb.date,
    });
  }
  return out;
}

const PALIERS_KM: { km: number; tier: Tier }[] = [
  { km: 100, tier: "bronze" }, { km: 500, tier: "bronze" }, { km: 1000, tier: "argent" },
  { km: 2500, tier: "or" }, { km: 5000, tier: "or" }, { km: 10000, tier: "platine" },
];
const PALIERS_DPLUS: { m: number; tier: Tier }[] = [
  { m: 5000, tier: "bronze" }, { m: 25000, tier: "argent" }, { m: 100000, tier: "or" },
];

/**
 * Paliers cumulés. On ne décerne QUE les paliers atteints — pas de « prochain palier »
 * grimé en trophée. Le total réel est rappelé en détail pour que le chiffre soit
 * vérifiable par l'athlète.
 */
export function cumulativeMilestones(workouts: TrophyWorkout[]): Trophy[] {
  const runs = workouts.filter(isRunLike);
  const totalKm = runs.reduce((s, w) => s + (w.distance_km ?? 0), 0);
  const totalD = runs.reduce((s, w) => s + (w.elevation_gain_m ?? 0), 0);
  const out: Trophy[] = [];

  for (const p of PALIERS_KM) {
    if (totalKm >= p.km) {
      out.push({
        id: `palier-km-${p.km}`, kind: "palier", tier: p.tier,
        label: `${p.km.toLocaleString("fr-FR")} km parcourus`,
        value: `${Math.round(totalKm).toLocaleString("fr-FR")} km`, detail: "Total enregistré",
      });
    }
  }
  for (const p of PALIERS_DPLUS) {
    if (totalD >= p.m) {
      out.push({
        id: `palier-dplus-${p.m}`, kind: "palier", tier: p.tier,
        label: `${p.m.toLocaleString("fr-FR")} m de D+`,
        value: `${Math.round(totalD).toLocaleString("fr-FR")} m`, detail: "Total enregistré",
      });
    }
  }
  // On ne garde que le palier le PLUS HAUT de chaque famille : afficher les six
  // marches d'un athlète à 5 000 km transformerait la vitrine en escalier.
  const dernier = (prefix: string) => out.filter((t) => t.id.startsWith(prefix)).slice(-1);
  return [...dernier("palier-km-"), ...dernier("palier-dplus-")];
}

/** Lundi de la semaine ISO d'une date, en clé `aaaa-mm-jj`. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/**
 * Plus longue série de semaines consécutives comportant au moins une sortie.
 * En SEMAINES et non en jours : une série quotidienne pousse à courir blessé, ce
 * qu'un coach ne doit jamais récompenser.
 */
export function longestStreak(workouts: TrophyWorkout[]): Trophy | null {
  const weeks = [...new Set(workouts.filter(isRunLike).filter((w) => (w.distance_km ?? 0) > 0).map((w) => weekKey(w.date)))].sort();
  if (!weeks.length) return null;

  let best = 1, cur = 1, bestEnd = weeks[0];
  for (let i = 1; i < weeks.length; i++) {
    const ecart = (Date.parse(weeks[i]) - Date.parse(weeks[i - 1])) / 604800000;
    cur = ecart === 1 ? cur + 1 : 1;
    if (cur > best) { best = cur; bestEnd = weeks[i]; }
  }
  if (best < 2) return null; // une semaine isolée n'est pas une série
  return {
    id: "serie-semaines", kind: "serie",
    label: "Plus longue série", value: `${best} semaines`,
    detail: `Sans interruption, jusqu'au ${dateFr(bestEnd)}`, date: bestEnd,
    tier: best >= 52 ? "platine" : best >= 26 ? "or" : best >= 12 ? "argent" : "bronze",
  };
}

/** Meilleure semaine en volume — le repère de charge le plus parlant. */
export function bestVolume(workouts: TrophyWorkout[]): Trophy | null {
  const parSemaine = new Map<string, number>();
  for (const w of workouts.filter(isRunLike)) {
    const km = w.distance_km ?? 0;
    if (km <= 0) continue;
    const k = weekKey(w.date);
    parSemaine.set(k, (parSemaine.get(k) ?? 0) + km);
  }
  if (!parSemaine.size) return null;
  const [semaine, km] = [...parSemaine.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    id: "volume-semaine", kind: "volume", label: "Meilleure semaine",
    value: km1(km), detail: `Semaine du ${dateFr(semaine)}`, date: semaine,
  };
}

/** Courses terminées, reconnues par le type de séance. */
export function raceTrophies(workouts: TrophyWorkout[]): Trophy[] {
  const races = workouts.filter((w) => /race|course|compétition|competition/i.test(`${w.type ?? ""}`));
  if (!races.length) return [];
  const derniere = races.reduce((a, b) => (Date.parse(b.date) > Date.parse(a.date) ? b : a));
  return [{
    id: "courses-terminees", kind: "course",
    label: races.length > 1 ? "Courses terminées" : "Première course",
    value: String(races.length),
    detail: `Dernière : ${derniere.title || "course"} le ${dateFr(derniere.date)}`,
    date: derniere.date,
    tier: races.length >= 20 ? "platine" : races.length >= 10 ? "or" : races.length >= 3 ? "argent" : "bronze",
  }];
}

/** Vitrine complète, du plus marquant au plus anecdotique. */
export function computeTrophies(workouts: TrophyWorkout[]): Trophy[] {
  const valides = workouts.filter((w) => w.date && Number.isFinite(Date.parse(w.date)));
  return [
    ...raceTrophies(valides),
    ...chronoRecords(valides),
    ...personalRecords(valides),
    ...cumulativeMilestones(valides),
    ...[longestStreak(valides), bestVolume(valides)].filter((t): t is Trophy => !!t),
  ];
}
