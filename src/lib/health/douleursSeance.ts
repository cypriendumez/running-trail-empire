// ─────────────────────────────────────────────────────────────────────────────
//  LES DOULEURS COCHÉES APRÈS UNE SÉANCE — quand cessent-elles de compter ?
//
//  Le ressenti d'après séance (`session_feedback`, /api/feedback) porte une liste de
//  douleurs (« Tibia (périoste) »…). Le coach les lisait SANS FIN : tant qu'un ressenti
//  restait parmi les cinq derniers, sa douleur retirait de l'intensité, même des semaines
//  plus tard, et rien ne permettait de dire « c'est passé ». Cyprien, 09/11/2026 :
//  périostite depuis son marathon, « ça va de mieux en mieux » — il doit pouvoir l'éteindre.
//
//  Une douleur cochée après une séance compte tant que :
//   1. la séance a moins de `PEREMPTION_JOURS` (14 j, la même péremption que les douleurs
//      déclarées dans Santé : elle protège de l'oubli) ;
//   2. l'athlète ne l'a pas dite PASSÉE (`painPasse` du ressenti, écrit par
//      /api/health/douleur-seance) ;
//   3. aucun ressenti PLUS RÉCENT ne dit « Aucune douleur » : c'est une déclaration
//      explicite, pas un oubli de cocher.
//  Un ressenti plus récent qui ne la recoche pas ne l'éteint PAS : ne rien cocher n'est
//  pas dire « je n'ai plus mal ». Une douleur qui revient sur une séance suivante est un
//  nouveau ressenti, sans `painPasse` : elle compte de nouveau.
// ─────────────────────────────────────────────────────────────────────────────
import { AUCUNE_DOULEUR, douleursDeclarees } from "@/lib/coach/painZonesI18n";
import { PEREMPTION_JOURS } from "@/lib/health/douleurs";

/** Le `data` d'un ressenti tel que stocké. */
export type RessentiDouleur = {
  date?: string | null;
  /** Instant de saisie (ISO) : départage deux ressentis du même jour. */
  ts?: string | null;
  pain?: unknown;
  /** Les douleurs de CE ressenti que l'athlète a déclarées passées. */
  painPasse?: unknown;
};

export type DouleurSeance = {
  /** La valeur stockée, en français (canonique : le coach la reconnaît par mots-clés). */
  zone: string;
  /** Date de la séance la plus récente où elle a été cochée. */
  date: string;
  /** Date de la PREMIÈRE séance (encore comptée) où elle a été cochée : « depuis X jours ». */
  premiere: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}/;
const ecartJours = (de: string, a: string) =>
  Math.round((new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${de.slice(0, 10)}T12:00:00Z`).getTime()) / 86400000);
const liste = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : []);
/** Ordre chronologique : la date de séance, puis l'instant de saisie. */
const cle = (r: RessentiDouleur) => `${String(r.date ?? "").slice(0, 10)}|${String(r.ts ?? "")}`;

/** Les douleurs cochées après une séance qui pèsent encore aujourd'hui, la plus récente d'abord. */
export function douleursDeSeance(ressentis: readonly RessentiDouleur[], aujourdhui: string, peremptionJours = PEREMPTION_JOURS): DouleurSeance[] {
  const valides = ressentis.filter((r) => DATE.test(String(r?.date ?? "")));
  // Le dernier « Aucune douleur » explicite : tout ce qui a été coché avant est éteint.
  const derniereSansDouleur = valides
    .filter((r) => liste(r.pain).includes(AUCUNE_DOULEUR))
    .map(cle).sort().pop() ?? "";
  const vues = new Map<string, string>();
  const premieres = new Map<string, string>();
  // Du plus récent au plus ancien : une douleur dite passée sur un ressenti éteint aussi ses
  // occurrences PLUS ANCIENNES ; recochée APRÈS, elle compte de nouveau.
  const eteintes = new Set<string>();
  for (const r of [...valides].sort((a, b) => cle(b).localeCompare(cle(a)))) {
    const date = String(r.date).slice(0, 10);
    const age = ecartJours(date, aujourdhui);
    if (age < 0 || age > peremptionJours) continue;
    if (derniereSansDouleur && cle(r) < derniereSansDouleur) continue;
    const passees = new Set(liste(r.painPasse));
    for (const z of douleursDeclarees(r.pain)) {
      if (passees.has(z)) { eteintes.add(z); continue; }
      if (eteintes.has(z)) continue;
      if (!vues.has(z)) vues.set(z, date);
      premieres.set(z, date);
    }
  }
  return [...vues].map(([zone, date]) => ({ zone, date, premiere: premieres.get(zone) ?? date }));
}
