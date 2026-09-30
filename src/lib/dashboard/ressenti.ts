/**
 * LE RESSENTI APRÈS UNE SÉANCE — quelles séances l'attendent, et le kilométrage des chaussures.
 *
 * ⚠️ CONSTAT DE CYPRIEN (30/09/2026) : « j'ai mis 3 courses et il me demandait mon ressenti,
 * mais on ne savait pas de laquelle il parlait ». Le questionnaire ne portait que la DATE et
 * un titre générique, et la réponse était rangée par date : deux sorties du même jour se
 * confondaient. Désormais une séance est désignée par son IDENTIFIANT, et présentée avec ce
 * qui la distingue — son nom, sa distance, sa durée.
 *
 * ⚠️ LES CHAUSSURES. `shoes.current_km` n'avait AUCUN écrivain (voir la mémoire du Garage) :
 * la jauge d'usure ne pouvait rien dire, faute de savoir quelle paire servait à chaque
 * sortie. Le questionnaire le demande, facultativement : c'est ce qui rend l'usure mesurable.
 */

export type SeanceRessenti = {
  id: string;
  date: string;          // AAAA-MM-JJ
  titre: string;
  distanceKm: number | null;
  dureeSec: number | null;
  /** Une chaussure a un sens pour cette séance (course, trail… pas vélo, natation, muscu). */
  aPied: boolean;
};

type Seance = { id?: unknown; date?: unknown; title?: unknown; type?: unknown; sport?: unknown; distance_km?: unknown; duration_seconds?: unknown };
type Ressenti = { date?: unknown; workout_id?: unknown };

const NON_PIED = /ride|bike|cycl|v[ée]lo|swim|natation|nage|rowing|aviron|ski|yoga|pilates|strength|weight|renfo|muscu/i;

/**
 * Les séances récentes (depuis `depuis`, AAAA-MM-JJ) sans ressenti, de la plus ANCIENNE à la
 * plus récente — dans l'ordre où on les a courues — au plus `max`.
 *
 * Une réponse couvre une séance par son identifiant ; une réponse ANCIENNE (sans identifiant,
 * rangée par date) couvre encore les séances de sa date — on ne redemande pas ce qui a été dit.
 */
export function seancesSansRessenti(seances: readonly Seance[], ressentis: readonly (Ressenti | null | undefined)[], depuis: string, max = 3): SeanceRessenti[] {
  const ids = new Set<string>(), dates = new Set<string>();
  for (const r of ressentis) {
    if (!r) continue;
    if (typeof r.workout_id === "string" && r.workout_id) ids.add(r.workout_id);
    else if (typeof r.date === "string") dates.add(r.date.slice(0, 10));
  }
  const nombre = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
  return seances
    .filter((s): s is Seance & { id: string; date: string } => typeof s?.id === "string" && typeof s?.date === "string")
    .filter((s) => s.date.slice(0, 10) >= depuis && !ids.has(s.id) && !dates.has(s.date.slice(0, 10)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, max)
    .reverse()
    .map((s) => ({
      id: s.id,
      date: s.date.slice(0, 10),
      // `||` et non `??` : un titre VIDE (« ») doit céder la place au type, comme avant.
      titre: String(s.title ?? "").trim() || String(s.type ?? "").trim() || "Séance",
      distanceKm: nombre(s.distance_km),
      dureeSec: nombre(s.duration_seconds),
      aPied: s.type !== "strength" && !NON_PIED.test(`${String(s.sport ?? "")} ${String(s.title ?? "")}`),
    }));
}

/** Le kilométrage d'une paire après une sortie, au 1/10 de km ; sans distance, inchangé. */
export function kmApres(actuel: unknown, distanceKm: number | null): number {
  const base = Math.max(0, Number(actuel) || 0);
  return distanceKm && distanceKm > 0 ? Math.round((base + distanceKm) * 10) / 10 : Math.round(base * 10) / 10;
}
