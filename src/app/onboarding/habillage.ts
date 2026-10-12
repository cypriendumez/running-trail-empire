/**
 * L'habillage des contrôles du questionnaire, partagé par la page et par l'étape Montre
 * (sortie dans EtapeMontre.tsx le 12/10/2026). Un module à part : un fichier `page.tsx`
 * n'a pas le droit d'exporter autre chose que ce que Next attend d'une page.
 */
// ── Habillage des contrôles ─────────────────────────────────────────────────────
// Un seul endroit pour l'état « choisi » : contour vert, fond teinté, coche. Jamais la
// couleur seule (un daltonien doit voir la différence) : la coche ou l'ombre la double.
export const FOCUS = "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-600";
export const SEGMENT = `flex h-10 items-center justify-center rounded-lg px-2 text-center text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 peer-checked:bg-white peer-checked:text-zinc-900 peer-checked:shadow-[0_1px_2px_rgba(16,24,40,0.10),0_0_0_1px_rgba(16,24,40,0.06)] ${FOCUS}`;
export const TUILE = `flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-center text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 peer-checked:border-emerald-600 peer-checked:bg-emerald-50 peer-checked:text-emerald-900 ${FOCUS}`;
export const CHAMP = "h-11 w-full rounded-xl border border-zinc-200 bg-white pl-3 pr-10 text-base tabular-nums text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 sm:text-[15px]";
