// ─────────────────────────────────────────────────────────────────────────────
//  LA VITRINE — mur de trophées.
//
//  Parti pris conservé : un trophée porte le chiffre qui l'a mérité, en gros, et la
//  PREUVE juste en dessous (date, distance réelle). Une vitrine où l'on ne peut pas
//  vérifier d'où sort la médaille n'est qu'une décoration.
//
//  Refonte du 05/09/2026 — trois défauts de la version précédente :
//   • la preuve était en `text-zinc-400` sur blanc, soit un contraste de 2,6:1 quand
//     la règle en demande 4,5. Elle était donc illisible : le chiffre affirmait sans
//     que rien ne le justifie à l'œil.
//   • des cartes hautes et vides, sans ancrage visuel, qui donnaient une page pâle.
//     Le palier est maintenant une BARRE de couleur à gauche — on lit la hiérarchie
//     d'un coup d'œil, sans dégradé pastel derrière le texte.
//   • les intitulés de sections étaient en français en dur, dans une application qui
//     parle cinq langues.
// ─────────────────────────────────────────────────────────────────────────────
import { Trophy as TrophyIcon, Timer, Mountain, Flame, CalendarRange, Medal } from "lucide-react";
import type { Trophy } from "@/lib/trophies/compute";

/** Palier → barre latérale + teinte de l'icône. Les trophées SANS palier (chronos,
 *  records) restent neutres : ils ne se hiérarchisent pas, ils se battent. */
const TIER_STYLE: Record<string, { barre: string; icone: string; puce: string }> = {
  bronze:  { barre: "bg-amber-400",   icone: "text-amber-700",   puce: "bg-amber-100 text-amber-800" },
  argent:  { barre: "bg-zinc-400",    icone: "text-zinc-700",    puce: "bg-zinc-100 text-zinc-700" },
  or:      { barre: "bg-yellow-400",  icone: "text-yellow-700",  puce: "bg-yellow-100 text-yellow-800" },
  platine: { barre: "bg-emerald-500", icone: "text-emerald-700", puce: "bg-emerald-100 text-emerald-800" },
};

const ICONS: Record<Trophy["kind"], typeof TrophyIcon> = {
  chrono: Timer, record: Mountain, palier: Medal, serie: Flame, volume: CalendarRange, course: TrophyIcon,
};

export type TexteVitrine = {
  vide: string; videSub: string;
  sections: { kinds: Trophy["kind"][]; titre: string; sous: string }[];
};

function Card({ t }: { t: Trophy }) {
  const Icon = ICONS[t.kind] ?? TrophyIcon;
  const style = t.tier ? TIER_STYLE[t.tier] : null;
  return (
    <div className="group relative flex overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:border-zinc-300 hover:shadow-md">
      <div className={`w-1 shrink-0 ${style?.barre ?? "bg-zinc-200"}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Icon className={`h-4 w-4 shrink-0 ${style?.icone ?? "text-emerald-600"}`} strokeWidth={2.2} aria-hidden="true" />
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-600">{t.label}</span>
          </div>
          {t.tier && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style?.puce}`}>
              {t.tier}
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl font-black leading-none tracking-tight text-zinc-900">{t.value}</div>
        {/* La preuve. Sans elle, le chiffre au-dessus n'est qu'une affirmation — et en
            zinc-400 elle n'était pas lisible, ce qui revenait à ne pas l'afficher. */}
        {t.detail && <div className="mt-1.5 text-xs text-zinc-500">{t.detail}</div>}
      </div>
    </div>
  );
}

export function TrophyWall({ trophies, textes }: { trophies: Trophy[]; textes: TexteVitrine }) {
  if (trophies.length === 0) {
    // Aucun trophée décerné : on l'explique au lieu d'afficher des cases grisées
    // « à débloquer », qui laisseraient croire à un catalogue promis.
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <TrophyIcon className="mx-auto mb-3 h-8 w-8 text-zinc-400" aria-hidden="true" />
        <p className="font-semibold text-zinc-900">{textes.vide}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">{textes.videSub}</p>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {textes.sections.map((s) => {
        const items = trophies.filter((t) => s.kinds.includes(t.kind));
        if (!items.length) return null; // une section vide ne s'affiche pas
        return (
          <section key={s.titre}>
            <div className="mb-3 flex items-baseline gap-3 border-b border-zinc-200 pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">{s.titre}</h2>
              <p className="truncate text-xs text-zinc-500">{s.sous}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((t) => <Card key={t.id} t={t} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
