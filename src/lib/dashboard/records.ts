/**
 * RECORDS PAR DISTANCE — meilleur temps réel sur 5 km / 10 km / semi / marathon.
 *
 * Sorti du composant pour être crash-testable : la carte affichait 25:48 au 5 km quand
 * le vrai record est 16:07, parce qu'elle ne voyait que les 40 dernières activités.
 */
import { fmtTime } from "@/lib/running/fitness";

export type SeanceRecord = {
  date: string;
  distance_km: number | null;
  duration_seconds: number | null;
};

/** Clé STABLE d'une distance de référence — le libellé, lui, s'affiche. */
export type CleDistance = "5k" | "10k" | "semi" | "marathon";

/**
 * UN RECORD DÉCLARÉ PAR L'ATHLÈTE.
 *
 * ⚠️ POURQUOI IL EXISTE. Cyprien, 23 puis 28/09/2026 : « mon record au semi est de 1 h 15,
 * il date de 2024 » — la carte affichait 1 h 19. Son historique de montre, dans intervals.icu,
 * ne remonte qu'au 26/04/2025 : aucun calcul ne peut retrouver une course qui n'est nulle
 * part dans les données. Seul l'athlète la connaît. On la lui laisse DIRE, et on l'affiche
 * comme telle — « Déclaré » —, jamais comme une mesure.
 *
 * ⚠️ IL NE PILOTE RIEN. Ni la VMA, ni les allures, ni le plan : ce sont des sorties
 * mesurées, fenêtrées sur la forme du moment. Un record de 2024 dit ce qu'on a su faire,
 * pas ce qu'on peut courir cette semaine.
 */
export type RecordDeclare = { distance: CleDistance; secondes: number; date: string; course?: string | null };

/** Bornes de vraisemblance (secondes) : un peu sous le record du monde, un peu au-delà des barrières horaires. */
export const BORNES_SECONDES: Record<CleDistance, readonly [number, number]> = {
  "5k": [720, 7200],        // 12 min – 2 h  (RM 12:35)
  "10k": [1560, 14400],     // 26 min – 4 h  (RM 26:11)
  semi: [3400, 28800],      // 56 min 40 – 8 h  (RM 57:30)
  marathon: [7100, 32400],  // 1 h 58 – 9 h  (RM 2:00:35)
};

/** « 1:15:32 », « 1h15m32 », « 75:32 » → secondes ; `null` si illisible. */
export function lireTemps(brut: unknown): number | null {
  const t = String(brut ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const m = t.match(/^(?:(\d{1,2})[:h])?(\d{1,3})[:m'](\d{1,2})(?:s|")?$/);
  if (!m) return null;
  const h = Number(m[1] ?? 0), min = Number(m[2]), sec = Number(m[3]);
  if (sec >= 60 || (m[1] != null && min >= 60)) return null;
  return h * 3600 + min * 60 + sec;
}

const CLES: readonly CleDistance[] = ["5k", "10k", "semi", "marathon"];

/**
 * Un record reçu du navigateur, validé — ou `null`. `aujourdhui` est FOURNI (jour de
 * l'athlète) : un record « de demain » n'est pas un record.
 */
export function validerRecordDeclare(brut: unknown, aujourdhui: string): RecordDeclare | null {
  const b = (brut ?? {}) as Record<string, unknown>;
  const distance = String(b.distance ?? "") as CleDistance;
  if (!CLES.includes(distance)) return null;
  const secondes = typeof b.secondes === "number" ? Math.round(b.secondes) : lireTemps(b.temps);
  if (secondes == null || !Number.isFinite(secondes)) return null;
  const [min, max] = BORNES_SECONDES[distance];
  if (secondes < min || secondes > max) return null;
  const date = String(b.date ?? "").slice(0, 10);
  // ⚠️ ALLER-RETOUR, pas `Date.parse` seul : « 2024-02-30 » s'y lit comme le 1er mars.
  const t = Date.parse(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) return null;
  if (date > aujourdhui || date < "1970-01-01") return null;
  const course = String(b.course ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null;
  return { distance, secondes, date, course };
}

export type LigneRecord = { cle: CleDistance; label: string; time: string; date: string; source: "mesure" | "declare"; course?: string | null };

// Records par distance — meilleur temps réel sur 5/10/semi/marathon (depuis les activités),
// ou le record DÉCLARÉ par l'athlète quand il est meilleur (voir `RecordDeclare`).
export function computeDistancePRs(
  workouts: SeanceRecord[],
  lang: string,
  declares: readonly RecordDeclare[] = [],
): LigneRecord[] {
  const targets: { cle: CleDistance; l: string; lo: number; hi: number }[] = [
    { cle: "5k", l: "5 km", lo: 4.7, hi: 5.4 },
    { cle: "10k", l: "10 km", lo: 9.4, hi: 10.6 },
    { cle: "semi", l: "Semi", lo: 20, hi: 22 },
    { cle: "marathon", l: "Marathon", lo: 40.5, hi: 43.5 },
  ];
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
  const out: LigneRecord[] = [];
  for (const tgt of targets) {
    const cands = workouts.filter((w) => (w.distance_km ?? 0) >= tgt.lo && (w.distance_km ?? 0) <= tgt.hi && (w.duration_seconds ?? 0) > 0);
    const best = cands.length ? cands.reduce((a, b) => ((a.duration_seconds ?? 1e9) <= (b.duration_seconds ?? 1e9) ? a : b)) : null;
    const decl = declares.filter((r) => r.distance === tgt.cle).sort((a, b) => a.secondes - b.secondes)[0] ?? null;
    // Le déclaré ne l'emporte que s'il est STRICTEMENT meilleur : à égalité, la mesure gagne.
    if (decl && (!best || decl.secondes < (best.duration_seconds as number))) {
      out.push({ cle: tgt.cle, label: tgt.l, time: fmtTime(decl.secondes), date: fmtDate(`${decl.date}T12:00:00Z`), source: "declare", course: decl.course ?? null });
    } else if (best) {
      out.push({ cle: tgt.cle, label: tgt.l, time: fmtTime(best.duration_seconds as number), date: fmtDate(best.date), source: "mesure" });
    }
  }
  return out;
}
