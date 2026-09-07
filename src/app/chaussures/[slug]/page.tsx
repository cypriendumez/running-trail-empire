import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { CATALOGUE, parSlug } from "@/lib/shop/catalogue";
import { caracteristiques, nomComplet, titrePage, descriptionPage, voisins, connues } from "@/lib/shop/publique";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { texteGear } from "../gearI18n";

/**
 * LA FICHE PUBLIQUE D'UN MODÈLE.
 *
 * ⚠️ ELLE EXISTE POUR ÊTRE TROUVÉE. Le comparateur vivait derrière la connexion : il ne
 * coûte pourtant rien à servir et il répond à des questions que des gens tapent dans un
 * moteur de recherche. Il ne rapportait donc aucune visite, alors que les fiches de
 * courses, elles, sont publiques et indexées depuis le 3 septembre.
 *
 * ⚠️ CE QUI RESTE DERRIÈRE LE COMPTE : le verdict PERSONNEL. Cette page dit ce que pèse
 * la chaussure ; elle ne dit pas si elle convient à CE coureur — cela demande son
 * kilométrage, son terrain et ses paires actuelles, et c'est la seule chose que ce
 * produit sait faire qu'un site de test ne fait pas. La porte se déplace, elle ne
 * disparaît pas.
 *
 * Pages STATIQUES : le catalogue est un fichier, pas une base. Les 309 fiches sont donc
 * construites une fois et servies sans le moindre calcul.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return CATALOGUE.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = parSlug((await params).slug);
  const lang = await getPublicLang();
  if (!m) return { title: texteGear(lang, "index.titre") };
  return {
    title: titrePage(m, lang),
    description: descriptionPage(m, lang),
    alternates: { canonical: `/chaussures/${m.slug}` },
    openGraph: { title: titrePage(m, lang), description: descriptionPage(m, lang), type: "article" },
  };
}

export default async function FichePublique({ params }: { params: Promise<{ slug: string }> }) {
  const m = parSlug((await params).slug);
  if (!m) notFound();
  const lang = await getPublicLang();
  const t = (k: string, p?: Record<string, string | number>) => texteGear(lang, k, p);

  const specs = caracteristiques(m);
  const nb = connues(m);
  const proches = voisins(m);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/chaussures" className="hover:text-emerald-700">{t("fil.comparateur")}</Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 dark:text-zinc-300">{nomComplet(m)}</span>
      </nav>

      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">{m.marque}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {m.nom}{m.annee ? <span className="ml-2 text-xl font-normal text-zinc-400">{m.annee}</span> : null}
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          {/* On annonce ce qu'on a, pas ce qu'on voudrait avoir. */}
          {t("fiche.combien", { n: nb, total: specs.length })}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{t("fiche.specs")}</h2>
        <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {specs.map((c) => (
            <div key={c.cle} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">{t(c.labelCle)}</dt>
              <dd className={`text-sm font-semibold tabular-nums ${c.valeur ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-600"}`}>
                {/* ⚠️ « Non communiqué » est une RÉPONSE. La ligne disparaîtrait qu'on
                    laisserait croire que la fiche est complète. */}
                {c.valeur == null ? t("fiche.inconnu") : c.booleen ? t(c.valeur) : c.valeur}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {m.sources?.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{t("fiche.sources")}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {t("fiche.releves", { liste: m.sources.join(", ") })}
            {m.sourceFabricant ? t("fiche.fabricant") : ""}
          </p>
        </section>
      ) : null}

      {/* ── LA PORTE. Ce que la page publique ne fait pas, et qui demande un compte. ── */}
      <section className="mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
        <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-200">{t("porte.titre")}</h2>
        <p className="mt-2 text-sm text-emerald-900/80 dark:text-emerald-100/70">
          {t("porte.texte")}
        </p>
        <Link href="/signup" className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          {t("porte.bouton")}
        </Link>
      </section>

      {proches.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{t("fiche.proches")}</h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {proches.map((v) => (
              <li key={v.slug}>
                <Link href={`/chaussures/${v.slug}`}
                  className="block rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:border-emerald-400 dark:border-zinc-800">
                  <span className="block text-xs text-zinc-500">{v.marque}</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{v.nom}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
