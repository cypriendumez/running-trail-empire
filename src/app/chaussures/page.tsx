import type { Metadata } from "next";
import Link from "next/link";
import { CATALOGUE, marques } from "@/lib/shop/catalogue";
import { connues } from "@/lib/shop/publique";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { texteGear } from "./gearI18n";

/**
 * L'INDEX PUBLIC DU COMPARATEUR.
 *
 * ⚠️ VOLONTAIREMENT LÉGER. La page du comparateur connecté a déjà servi 1,6 Mo de HTML
 * une fois — c'est ce qui rend une page inutilisable en 4G et invisible pour un moteur.
 * Celle-ci ne rend qu'un lien et deux cotes par modèle, groupés par marque : le détail
 * vit sur la fiche, qui est statique.
 */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await getPublicLang();
  return {
    title: texteGear(lang, "index.metaTitre", { n: CATALOGUE.length }),
    description: texteGear(lang, "index.meta", { n: CATALOGUE.length }),
    alternates: { canonical: "/chaussures" },
  };
}

export default async function IndexChaussures() {
  const lang = await getPublicLang();
  const t = (k: string, p?: Record<string, string | number>) => texteGear(lang, k, p);
  const parMarque = marques().map((marque) => ({
    marque,
    modeles: CATALOGUE.filter((m) => m.marque === marque).sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
  })).filter((g) => g.modeles.length > 0);

  const renseignes = CATALOGUE.filter((m) => connues(m) >= 4).length;

  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("index.titre")}
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          {t("index.sous", { n: CATALOGUE.length })}
        </p>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          {/* Un chiffre qui se recompte, et qui ne se vante pas : tous les modèles n'ont
              pas toutes leurs cotes, et la fiche l'écrit noir sur blanc. */}
          {t("index.honnete", { n: renseignes })}
        </p>
      </header>

      {parMarque.map(({ marque, modeles }) => (
        <section key={marque} className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {marque} <span className="font-normal text-zinc-400">· {modeles.length}</span>
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modeles.map((m) => (
              <li key={m.slug}>
                <Link href={`/chaussures/${m.slug}`}
                  className="flex items-baseline justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 hover:border-emerald-400 dark:border-zinc-800">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.nom}</span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    {m.poidsG?.valeur ? `${m.poidsG.valeur} g` : "—"}
                    {m.dropMm?.valeur != null ? ` · ${m.dropMm.valeur} mm` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-12 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
        <h2 className="text-base font-bold text-emerald-900 dark:text-emerald-200">{t("porte.titreIndex")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-emerald-900/80 dark:text-emerald-100/70">
          {t("porte.texteIndex")}
        </p>
        <Link href="/signup" className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          {t("porte.bouton")}
        </Link>
      </section>
    </main>
  );
}
