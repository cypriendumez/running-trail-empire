/**
 * LA CARTE « ANALYSE IA » DU TABLEAU DE BORD (06/11/2026).
 *
 * L'ancienne carte affichait le « pourquoi » de la séance du jour, mot pour mot celui de
 * la carte verte voisine, sous un badge « Beta » écrit en dur. Elle montre désormais ce
 * qu'on ne voit nulle part ailleurs sur la page : l'ANALYSE de la dernière séance courue,
 * écrite par `/api/ai/analyse-seance` et mémorisée en `notifications` (`seance_analyse`).
 *
 * ⚠️ LE TABLEAU DE BORD NE DÉCLENCHE AUCUNE ANALYSE. Chaque analyse est un appel payant
 * au modèle : c'est l'athlète qui la demande, sur la page de la séance. Ici on lit
 * seulement ce qui est mémorisé ; s'il n'y a rien, on propose le lien.
 */

export type SeanceListee = { id?: string | null; date: string; distance_km?: number | null; title?: string | null; sport?: string | null };
export type AnalyseMemorisee = { body: string | null; data: { workout_id?: unknown; date?: unknown } | null };

export type DerniereAnalyse = {
  seance: SeanceListee;
  /** Le texte mémorisé, ou `null` : la séance n'a pas encore été analysée. */
  texte: string | null;
};

/**
 * Le dernier JOUR couru, et sa séance : celle qui a une analyse si l'une d'elles en a une,
 * sinon la plus longue (le marathon, pas les 2 km de retour au calme du même jour).
 */
export function derniereAnalyse(seances: readonly SeanceListee[], analyses: readonly AnalyseMemorisee[]): DerniereAnalyse | null {
  const jours = seances.map((s) => String(s.date ?? "").slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!jours.length) return null;
  const dernier = jours.sort().at(-1)!;
  const duJour = seances.filter((s) => String(s.date).slice(0, 10) === dernier);
  const parSeance = new Map<string, string>();
  for (const a of analyses) {
    const id = String(a.data?.workout_id ?? "");
    const texte = String(a.body ?? "").trim();
    if (id && texte && !parSeance.has(id)) parSeance.set(id, texte);
  }
  const analysee = duJour.find((s) => s.id && parSeance.has(String(s.id)));
  if (analysee) return { seance: analysee, texte: parSeance.get(String(analysee.id))! };
  const plusLongue = [...duJour].sort((a, b) => (Number(b.distance_km) || 0) - (Number(a.distance_km) || 0))[0];
  return { seance: plusLongue, texte: null };
}

/** Le lien de la page de la séance — le même format que la liste « Activités récentes ». */
export const lienSeance = (s: SeanceListee): string =>
  `/dashboard/activite?date=${String(s.date).slice(0, 10)}&dist=${s.distance_km ?? ""}&title=${encodeURIComponent(s.title ?? "")}`;
