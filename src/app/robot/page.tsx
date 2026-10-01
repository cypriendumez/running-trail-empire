import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { EDITEUR } from "@/lib/brand/editeur";
import { UA_PACEVOBOT } from "@/lib/races/robot";
import { TEXTES_ROBOT, ROBOTS_TXT_REFUS } from "./textes";

export const metadata: Metadata = {
  title: "Robot d'exploration",
  description: "Ce que lit le robot de Pacevo, comment il respecte robots.txt et comment s'y opposer.",
};

/**
 * LA PAGE DU ROBOT — l'adresse que PacevoBot donne dans son identité (01/10/2026).
 *
 * Un organisateur qui voit « PacevoBot » dans ses journaux doit savoir, en une page : qui
 * lit, quoi, à quel rythme, ce qui est gardé — et comment dire non. Chaque affirmation est
 * VRAIE dans le code (lib/races/robot, scripts/acces-poli, lib/races/veille) : robots.txt
 * respecté par l'agent « PacevoBot » ou « * », une page à la fois par site, seuls des liens
 * et des dates sont gardés, et la liste d'opposition est lue par chaque robot.
 */
export default async function RobotPage() {
  const lang = await getPublicLang();
  const t = TEXTES_ROBOT[lang] ?? TEXTES_ROBOT.fr;
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-700">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{t.titre}</h1>
        <p className="mt-4 text-[15px] leading-relaxed">{t.intro}</p>

        <h2 className="mt-10 text-lg font-bold text-zinc-900">{t.quoiT}</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed">
          {t.quoi.map((x) => <li key={x}>{x}</li>)}
        </ul>

        <h2 className="mt-10 text-lg font-bold text-zinc-900">{t.gardeT}</h2>
        <p className="mt-3 text-[15px] leading-relaxed">{t.garde}</p>

        <h2 className="mt-10 text-lg font-bold text-zinc-900">{t.refusT}</h2>
        <p className="mt-3 text-[15px] leading-relaxed">{t.refusA}</p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-200">{ROBOTS_TXT_REFUS}</pre>
        <p className="mt-3 text-[15px] leading-relaxed">
          {t.refusB} <a href={`mailto:${EDITEUR.email}?subject=${encodeURIComponent("PacevoBot")}`} className="font-semibold text-emerald-700 hover:text-emerald-800">{EDITEUR.email}</a> {t.refusC}
        </p>

        <h2 className="mt-10 text-lg font-bold text-zinc-900">{t.idT}</h2>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-200">{UA_PACEVOBOT}</pre>
      </main>
      <SiteFooter newsletter={false} />
    </div>
  );
}
