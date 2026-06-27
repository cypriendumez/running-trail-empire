import { getPublicLang } from "@/lib/i18n/serverLang";
import { LEGAL } from "@/app/legalI18n";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

// Rendu partagé des pages juridiques (serveur) — langue détectée via cookie/Accept-Language.
export async function LegalContent({ page, date }: { page: "mentions" | "terms" | "privacy"; date: string }) {
  const lang = await getPublicLang();
  const L = LEGAL[lang] ?? LEGAL.fr;
  const p = L[page];
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-700">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">{p.heading}</h1>
        <p className="mt-2 text-sm text-zinc-500">{L.updatedLabel} : {date}</p>
        <div className="mt-8 space-y-7 text-[15px] leading-relaxed">
          {p.intro?.map((t, i) => <p key={`intro-${i}`}>{t}</p>)}
          {p.sections.map((s, i) => (
            <section key={i}>
              <h2 className="mb-1.5 text-lg font-bold text-zinc-900">{s.title}</h2>
              <div className="space-y-2 text-zinc-700">
                {s.paras?.map((t, j) => <p key={j}>{t}</p>)}
                {s.list && (
                  <ul className="list-disc space-y-1 pl-5">
                    {s.list.map((t, j) => <li key={j}>{t}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter newsletter={false} />
    </div>
  );
}
