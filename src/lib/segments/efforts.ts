import type { StoredEffort } from "./match";

/**
 * LIRE TOUS LES EFFORTS D'UNE LISTE DE SEGMENTS.
 *
 * ⚠️ POSTGREST PLAFONNE UNE RÉPONSE À 1 000 LIGNES, quel que soit le nombre demandé, et
 * SANS erreur. Constaté le 03/09/2026 : la base comptait 1 063 efforts et les deux
 * écrans qui affichent des classements en lisaient 1 000 — 63 passages disparaissaient
 * en silence. Un classement amputé n'a l'air de rien : il affiche un record, un rang et
 * un « Maître du segment », tous faux, et d'autant plus faux que l'historique grandit.
 *
 * ⚠️ `range` EXIGE UN ORDRE EXPLICITE. Sans lui, deux pages successives peuvent se
 * recouvrir ou sauter des lignes : on trierait alors un classement sur un échantillon
 * différent à chaque chargement.
 */
const PAS = 1000;

type ClientLecture = {
  from: (t: string) => {
    select: (c: string) => {
      in: (col: string, v: string[]) => {
        order: (c: string, o: { ascending: boolean }) => {
          range: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
  };
};

export async function lireEfforts(sb: unknown, segmentIds: string[]): Promise<Map<string, StoredEffort[]>> {
  const parSegment = new Map<string, StoredEffort[]>();
  if (!segmentIds.length) return parSegment;

  const client = sb as ClientLecture;
  for (let debut = 0; debut < 200000; debut += PAS) {
    const { data, error } = await client.from("segment_efforts")
      .select("segment_id, user_id, elapsed_seconds, started_at")
      .in("segment_id", segmentIds)
      .order("id", { ascending: true })
      .range(debut, debut + PAS - 1);
    // ⚠️ UNE ERREUR ARRÊTE LA LECTURE, elle ne la fait pas continuer à vide : boucler
    // sur une erreur reproduirait la même requête jusqu'à la borne haute.
    if (error) break;
    const lot = (data ?? []) as Record<string, unknown>[];
    for (const e of lot) {
      const k = String(e.segment_id);
      const arr = parSegment.get(k) ?? [];
      arr.push({
        user_id: String(e.user_id),
        elapsed_seconds: Number(e.elapsed_seconds),
        started_at: String(e.started_at),
      });
      parSegment.set(k, arr);
    }
    if (lot.length < PAS) break;
  }
  return parSegment;
}
