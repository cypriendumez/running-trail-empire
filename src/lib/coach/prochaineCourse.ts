/**
 * LA PROCHAINE COURSE — une seule réponse, quelle que soit la partie de l'application.
 *
 * ⚠️ IL Y AVAIT DEUX SOURCES, ET ELLES SE CONTREDISAIENT. Mesuré le 23/09/2026 sur le
 * compte de Cyprien :
 *   · `race_objective` (une ligne, l'objectif DÉCLARÉ) → « Marathon International de
 *     Lille, 25/10/2026 » — c'est ce que montre le tableau de bord et ce autour de quoi
 *     le plan est construit ;
 *   · `planned_race` (les courses ajoutées au calendrier) → « Foulées de Bondues,
 *     23/05/2027 », et Lille N'Y FIGURE PAS.
 *
 * Le kiné IA et le cours lisaient UNIQUEMENT `planned_race`. Le kiné parlait donc des
 * Foulées de Bondues à quelqu'un qui prépare le marathon de Lille dans un mois — avec
 * des conseils de reprise calés sur une échéance située huit mois trop loin.
 *
 * Ici, les deux sources se rejoignent : on garde ce qui est à venir, on dédoublonne, on
 * rend la plus PROCHE. L'objectif déclaré en fait partie de plein droit — c'est même la
 * course qui compte le plus.
 */

export type CourseAVenir = {
  nom: string;
  /** AAAA-MM-JJ. */
  date: string;
  distanceKm?: number | null;
  /** D'où elle vient — utile pour le dire à l'athlète sans deviner. */
  source: "objectif" | "calendrier";
};

type BrutObjectif = { race?: unknown; raceDate?: unknown; distanceKm?: unknown } | null | undefined;
type BrutPlanifiee = { name?: unknown; date?: unknown; distanceKm?: unknown } | null | undefined;

const jour = (v: unknown): string => String(v ?? "").slice(0, 10);
const texte = (v: unknown): string => String(v ?? "").trim();
const km = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Clé de dédoublonnage : le même nom le même jour, quelle que soit la casse. */
const cle = (c: CourseAVenir) => `${c.date}|${c.nom.toLowerCase().replace(/\s+/g, " ")}`;

/**
 * Toutes les courses à venir, les plus proches d'abord.
 *
 * ⚠️ `aujourdhui` EST FOURNI, jamais lu de l'horloge ici : le serveur est à iad1 (USA) et
 * les coureurs sont en France. Une course du jour même disparaîtrait de la liste pendant
 * six heures chaque nuit.
 */
export function coursesAVenir(
  objectif: BrutObjectif,
  planifiees: readonly BrutPlanifiee[],
  aujourdhui: string,
): CourseAVenir[] {
  const out: CourseAVenir[] = [];

  const nomObj = texte(objectif?.race);
  const dateObj = jour(objectif?.raceDate);
  if (nomObj && dateObj >= aujourdhui) {
    out.push({ nom: nomObj, date: dateObj, distanceKm: km(objectif?.distanceKm), source: "objectif" });
  }
  for (const p of planifiees ?? []) {
    const nom = texte(p?.name);
    const date = jour(p?.date);
    if (!nom || date < aujourdhui) continue;
    out.push({ nom, date, distanceKm: km(p?.distanceKm), source: "calendrier" });
  }

  // ⚠️ L'OBJECTIF GAGNE LE DÉDOUBLONNAGE. La même course peut être à la fois l'objectif
  // et une ligne du calendrier ; garder la version « calendrier » perdrait la distance
  // et l'information que c'est LA course préparée.
  const vues = new Map<string, CourseAVenir>();
  for (const c of out) {
    const k = cle(c);
    const dejaVue = vues.get(k);
    if (!dejaVue || (dejaVue.source === "calendrier" && c.source === "objectif")) vues.set(k, c);
  }
  return [...vues.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** La plus proche, ou `null` si l'athlète n'a aucune course devant lui. */
export function prochaineCourse(
  objectif: BrutObjectif,
  planifiees: readonly BrutPlanifiee[],
  aujourdhui: string,
): CourseAVenir | null {
  return coursesAVenir(objectif, planifiees, aujourdhui)[0] ?? null;
}

/** Jours restants avant une course, à partir d'un jour civil donné. */
export function joursAvant(course: CourseAVenir, aujourdhui: string): number {
  const a = Date.parse(`${aujourdhui}T12:00:00`);
  const b = Date.parse(`${course.date}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}
