// ─────────────────────────────────────────────────────────────────────────────
//  LA VITRINE — mur de trophées.
//
//  Parti pris : un trophée n'est PAS une pastille dans une grille. Chacun porte le
//  chiffre qui l'a mérité, en très gros, et la preuve juste en dessous (date,
//  distance réelle). Une vitrine où l'on ne peut pas vérifier d'où sort la médaille
//  n'est qu'une décoration ; ici chaque carte se justifie elle-même.
// ─────────────────────────────────────────────────────────────────────────────
import { Trophy as TrophyIcon, Timer, Mountain, Flame, CalendarRange, Medal } from "lucide-react";
import type { Trophy } from "@/lib/trophies/compute";

/** Palette par palier. Le « sans palier » (records, chronos) reste sobre : ces
 *  trophées-là ne se hiérarchisent pas, ils se battent. */
const TIER_STYLE: Record<string, { ring: string; glow: string; text: string }> = {
  bronze:  { ring: "ring-amber-200",  glow: "from-amber-50 to-orange-50",   text: "text-amber-700" },
  argent:  { ring: "ring-zinc-300",   glow: "from-zinc-50 to-slate-100",    text: "text-zinc-600" },
  or:      { ring: "ring-yellow-300", glow: "from-yellow-50 to-amber-100",  text: "text-yellow-700" },
  platine: { ring: "ring-emerald-300", glow: "from-emerald-50 to-teal-100", text: "text-emerald-700" },
};

const ICONS: Record<Trophy["kind"], typeof TrophyIcon> = {
  chrono: Timer, record: Mountain, palier: Medal, serie: Flame, volume: CalendarRange, course: TrophyIcon,
};

function Card({ t }: { t: Trophy }) {
  const Icon = ICONS[t.kind] ?? TrophyIcon;
  const style = t.tier ? TIER_STYLE[t.tier] : null;
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${
      style ? `ring-1 ${style.ring}` : ""}`}>
      {style && <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.glow} opacity-60`} />}
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 ${style?.text ?? "text-emerald-600"}`}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
          </div>
          {t.tier && (
            <span className={`rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style?.text}`}>
              {t.tier}
            </span>
          )}
        </div>
        <div className="text-3xl font-black leading-none tracking-tight text-zinc-900">{t.value}</div>
        <div className="mt-1.5 text-sm font-semibold text-zinc-700">{t.label}</div>
        {/* La preuve. Sans elle, le chiffre au-dessus n'est qu'une affirmation. */}
        {t.detail && <div className="mt-0.5 text-xs text-zinc-400">{t.detail}</div>}
      </div>
    </div>
  );
}

const SECTIONS: { kinds: Trophy["kind"][]; title: string; sub: string }[] = [
  { kinds: ["course"], title: "Courses", sub: "Ce que tu as terminé en compétition" },
  { kinds: ["chrono"], title: "Chronos de référence", sub: "Ton meilleur temps sur chaque distance" },
  { kinds: ["record"], title: "Records personnels", sub: "Tes extrêmes, toutes sorties confondues" },
  { kinds: ["palier", "serie", "volume"], title: "Régularité & volume", sub: "Ce que l'accumulation raconte" },
];

export function TrophyWall({ trophies }: { trophies: Trophy[] }) {
  if (trophies.length === 0) {
    // Aucun trophée décerné : on l'explique au lieu d'afficher des cases grisées
    // « à débloquer », qui laisseraient croire à un catalogue promis.
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <TrophyIcon className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
        <p className="font-semibold text-zinc-900">Aucun trophée pour l&apos;instant</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
          Ils se calculent sur tes séances enregistrées. Dès ta première sortie synchronisée,
          tes records apparaîtront ici — rien n&apos;est offert d&apos;avance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map((s) => {
        const items = trophies.filter((t) => s.kinds.includes(t.kind));
        if (!items.length) return null; // une section vide ne s'affiche pas
        return (
          <section key={s.title}>
            <div className="mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">{s.title}</h2>
              <p className="text-xs text-zinc-400">{s.sub}</p>
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
