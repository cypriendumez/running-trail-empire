import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { HISTOIRE } from "./histoireI18n";

/** Le portrait, s'il est réellement présent dans `public/`. Voir l'avertissement ci-dessus. */
const PHOTO = "/cyprien-course.jpg";
const CREDIT_PHOTO = "Photo © François Pix";

export async function generateMetadata(): Promise<Metadata> {
  const H = HISTOIRE[await getPublicLang()] ?? HISTOIRE.fr;
  return { title: H.metaTitle, description: H.metaDesc };
}

/**
 * L'ORIGINE DU PRODUIT — pas le portrait de son auteur.
 *
 * Le raisonnement d'écriture vit dans `histoireI18n.ts` : le site étant mis en vente,
 * la page raconte d'où vient l'application et quel problème elle résout, en s'appuyant
 * sur le parcours du fondateur comme PREUVE et non comme sujet. Elle reste donc vraie,
 * et publiable, après la vente.
 *
 * ⚠️ LA PHOTO PORTE SON CRÉDIT, ET CE CRÉDIT NE SE RETIRE PAS. Le cliché est signé par
 * un photographe professionnel. Le droit d'auteur sur une photographie appartient au
 * PHOTOGRAPHE, pas au coureur qui y figure, et le droit de paternité est inaliénable en
 * droit français : effacer la signature serait une atteinte distincte de la simple
 * reproduction. Cyprien avait demandé de la rogner ; on affiche la mention à la place,
 * ce qui est l'usage normal pour une photo de course et reste plus élégant qu'un
 * recadrage suspect. Ne pas « nettoyer » cette ligne.
 *
 * ⚠️ ET LE FICHIER EST FACULTATIF, à dessein. Un `<img>` vers un fichier absent affiche
 * une image cassée en production sans qu'aucune erreur ne remonte — le projet a déjà un
 * test pour ce défaut sur les logos de marques. Ici on VÉRIFIE l'existence au rendu : si
 * le fichier n'est pas là, la page se referme proprement sur ses chiffres.
 */
export default async function NotreHistoirePage() {
  const H = HISTOIRE[await getPublicLang()] ?? HISTOIRE.fr;
  const aLaPhoto = existsSync(join(process.cwd(), "public", PHOTO.replace(/^\//, "")));

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <Section className="pt-16">
        <Container>
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">{H.eyebrow}</p>
          <h1 className="mx-auto mt-5 max-w-3xl text-balance text-center text-4xl font-bold leading-[1.06] tracking-tight text-zinc-900 sm:text-5xl">
            {H.titre}
            <span className="text-emerald-600">{H.accent}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-zinc-500">{H.chapo}</p>

          {aLaPhoto && (
            <figure className="mx-auto mt-12 max-w-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {/* ⚠️ RAPPORT NATUREL, PAS DE `object-cover`. La première version imposait
                  un cadre 16/9 : la photo étant en 3/2, le recadrage mangeait le haut ET
                  LE BAS — c'est-à-dire précisément le coin où vit la signature du
                  photographe. J'aurais rogné le crédit par un choix de mise en page après
                  avoir refusé de le faire à la main. Le rapport d'origine règle les deux
                  problèmes : rien n'est coupé, et l'image reste nette.
                  Dimensions déclarées pour réserver la place et éviter que le texte ne
                  saute au chargement. */}
              <img
                src={PHOTO}
                alt=""
                width={1600}
                height={1067}
                className="h-auto w-full rounded-3xl ring-1 ring-inset ring-zinc-200"
                loading="eager"
              />
              {/* Le crédit est DANS le flux, pas incrusté sur l'image : il reste lisible,
                  copiable, et ne dépend pas du chargement du fichier. */}
              <figcaption className="mt-3 text-center text-xs text-zinc-400">{CREDIT_PHOTO}</figcaption>
            </figure>
          )}
        </Container>
      </Section>

      {/* ── LA CHRONOLOGIE ───────────────────────────────────────────────────
          Le repère de gauche porte une DATE, pas un numéro d'étape décoratif :
          l'ordre a un sens ici, et c'est la date qui le donne. Un « 01 / 02 / 03 »
          n'aurait rien ajouté que la mise en page ne dise déjà. */}
      <Section className="pt-4">
        <Container>
          <ol className="mx-auto max-w-2xl">
            {H.etapes.map((e, i) => (
              <li key={e.titre} className="relative grid gap-1.5 pb-10 pl-8 last:pb-0 sm:pl-10">
                {/* Le trait relie les repères, sauf après le dernier. */}
                {i < H.etapes.length - 1 && (
                  <span aria-hidden className="absolute left-[5px] top-3 h-full w-px bg-zinc-200 sm:left-[7px]" />
                )}
                <span aria-hidden className="absolute left-0 top-[7px] h-2.5 w-2.5 rounded-full bg-emerald-600 ring-4 ring-white sm:h-3.5 sm:w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{e.annee}</span>
                <h2 className="text-balance text-xl font-bold tracking-tight text-zinc-900">{e.titre}</h2>
                <p className="max-w-prose text-[15px] leading-relaxed text-zinc-600">{e.texte}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ── LES CHIFFRES ─────────────────────────────────────────────────────
          Ils remplacent le portrait : sur une page « à propos », ce sont eux la
          preuve, et ils sont tous relevés dans le compte réel (cf. histoireI18n). */}
      <Section className="pt-6">
        <Container>
          <div className="mx-auto max-w-3xl rounded-3xl bg-zinc-50 p-8 ring-1 ring-inset ring-zinc-200 sm:p-10">
            <h2 className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{H.chiffresTitre}</h2>
            <div className="mt-7 grid gap-7 sm:grid-cols-2">
              {H.chiffres.map((c) => (
                <div key={c.label} className="text-center sm:text-left">
                  <div className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900 sm:text-[28px]">{c.valeur}</div>
                  <div className="mt-1 text-sm leading-snug text-zinc-500">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <Section className="pt-6">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{H.fermetureTitre}</h2>
            <p className="mt-4 text-balance text-lg leading-relaxed text-zinc-700">{H.fermeture}</p>
            <Link href="/signup" className={btnClass("primary", "md", "mt-8 inline-flex items-center gap-2")}>
              {H.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
