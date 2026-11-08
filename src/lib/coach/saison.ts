// ─────────────────────────────────────────────────────────────────────────────
//  LA SAISON — plusieurs courses, chacune à sa priorité.
//
//  Cyprien, 05/11/2026 : « pour l'élite : les saisons à plusieurs pics ». Le coach ne
//  connaissait qu'UNE course, l'objectif déclaré. Les courses notées au calendrier
//  n'existaient pour lui que sur l'écran : il pouvait prescrire une VMA le jour même d'une
//  course inscrite. Et ajouter une course depuis la page Courses REMPLAÇAIT l'objectif,
//  si bien qu'une saison à deux courses était impossible à décrire.
//
//  LA RÈGLE (le vocabulaire de tous les entraîneurs) :
//    · A — une course qu'on prépare et qu'on affûte : le coach vise la plus PROCHE ; quand
//      elle est passée, la suivante prend le relais. L'objectif déclaré est toujours A.
//    · B — une course de préparation : deux jours calmes avant, la semaine allégée de 15 %,
//      la récupération après (`lib/coach/apresCourse`).
//    · C — une course d'entraînement : elle remplace une séance de qualité de la semaine,
//      sans affûtage ; la veille reste calme.
//  Une course notée sans priorité est une C : la noter ne doit rien bouleverser, mais le
//  coach ne la piétine plus.
// ─────────────────────────────────────────────────────────────────────────────
import { ecartJours } from "@/lib/coach/recuperation";

export type Priorite = "A" | "B" | "C";
export type CourseSaison = {
  nom: string;
  /** AAAA-MM-JJ. */
  date: string;
  distanceKm: number | null;
  priorite: Priorite;
  /** L'objectif déclaré (`race_objective`), pas une course du calendrier. */
  declaree: boolean;
};

/** Volume de la semaine d'une course B : un mini-affûtage. */
export const PART_VOLUME_COURSE_B = 0.85;
/** Une course passée de plus de quatre semaines ne commande plus aucune récupération. */
export const JOURS_COURSE_PASSEE = 28;

/** La priorité lue : celle choisie, sinon C. */
export function prioriteDe(v: unknown): Priorite {
  return v === "A" || v === "B" || v === "C" ? v : "C";
}

const RANG: Record<Priorite, number> = { A: 0, B: 1, C: 2 };
const nomNormal = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Les courses de la saison : l'objectif déclaré (toujours A) et les courses du calendrier.
 * Le même nom le même jour n'est qu'UNE course (« M'entraîner pour cette course » écrit les
 * deux lignes) ; elle garde la priorité la plus haute.
 */
export function coursesDeSaison(
  objectif: { race?: unknown; raceDate?: unknown; distanceKm?: unknown } | null | undefined,
  planifiees: readonly { name?: unknown; date?: unknown; distanceKm?: unknown; priorite?: unknown }[],
): CourseSaison[] {
  const toutes: CourseSaison[] = [];
  const date = (v: unknown) => String(v ?? "").slice(0, 10);
  const km = (v: unknown) => (Number(v) > 0 ? Number(v) : null);
  if (objectif && /^\d{4}-\d{2}-\d{2}$/.test(date(objectif.raceDate)) && String(objectif.race ?? "").trim()) {
    toutes.push({ nom: String(objectif.race).trim(), date: date(objectif.raceDate), distanceKm: km(objectif.distanceKm), priorite: "A", declaree: true });
  }
  for (const p of planifiees) {
    const d = date(p.date), n = String(p.name ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !n || d.startsWith("2099")) continue;
    toutes.push({ nom: n, date: d, distanceKm: km(p.distanceKm), priorite: prioriteDe(p.priorite), declaree: false });
  }
  const parCle = new Map<string, CourseSaison>();
  for (const c of toutes) {
    const cle = `${c.date}|${nomNormal(c.nom)}`;
    const deja = parCle.get(cle);
    if (!deja || RANG[c.priorite] < RANG[deja.priorite] || (c.declaree && RANG[c.priorite] === RANG[deja.priorite])) {
      parCle.set(cle, { ...c, distanceKm: c.distanceKm ?? deja?.distanceKm ?? null, declaree: c.declaree || !!deja?.declaree });
    }
  }
  return [...parCle.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** La course A à venir la plus proche (aujourd'hui compris), ou `null`. */
export function prochaineCourseA(saison: readonly CourseSaison[], aujourdhui: string): CourseSaison | null {
  return saison.find((c) => c.priorite === "A" && c.date >= aujourdhui && (c.distanceKm ?? 0) > 0) ?? null;
}

/** La première course B ou C des sept jours du plan (0 = aujourd'hui), hors objectif visé. */
export function courseSecondaireDeLaSemaine(
  saison: readonly CourseSaison[], aujourdhui: string, dateObjectif: string | null,
): { idx: number; course: CourseSaison } | null {
  for (const c of saison) {
    if (c.priorite === "A" || c.date === dateObjectif) continue;
    const idx = ecartJours(c.date, aujourdhui);
    if (idx != null && idx >= 0 && idx <= 6) return { idx, course: c };
  }
  return null;
}

/** Les courses passées depuis quatre semaines au plus, la plus récente d'abord. */
export function coursesPassees(saison: readonly CourseSaison[], aujourdhui: string): CourseSaison[] {
  return saison.filter((c) => {
    const ilYa = ecartJours(aujourdhui, c.date);
    return ilYa != null && ilYa >= 1 && ilYa <= JOURS_COURSE_PASSEE && (c.distanceKm ?? 0) > 0;
  }).sort((a, b) => b.date.localeCompare(a.date));
}
