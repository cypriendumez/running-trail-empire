import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { nomAffichable, nomRegion, regionCanonique } from "@/lib/races/libelles";
import { texteCourses } from "../coursesI18n";
import { jourFrance } from "@/lib/races/jourFrance";
import {
  estPubliable, estPubliableSansDate, aUneDate, idDepuisSlug, bornesId, slugCourse,
  titrePage, descriptionPage, dateEnClair,
  type CoursePublique,
} from "@/lib/races/publique";

export const revalidate = 3600;

/**
 * Une course a une page si elle est datée ET à venir, OU si elle n'a pas encore de date
 * annoncée. Les 6 401 courses du second cas ne produisaient aucune page alors qu'elles
 * portent la réponse à « où et comment courir le Trail des Galopins ? ».
 */
const publiable = (c: CoursePublique) => estPubliable(c, jourFrance()) || estPubliableSansDate(c);

const CHAMPS = "id,name,city,department,region,date,distance_km,elevation_gain_m,type,terrain,registration_url,latitude,longitude,organization,description,is_itra_certified,itra_points";

/**
 * ⚠️ RECHERCHE PAR PRÉFIXE D'IDENTIFIANT, PAS PAR NOM. L'adresse se termine par les
 * huit premiers caractères de l'identifiant : c'est lui qui désigne la course, ce qui
 * laisse le libellé évoluer sans casser les liens déjà indexés.
 */
async function lire(slug: string): Promise<CoursePublique | null> {
  const bornes = bornesId(idDepuisSlug(slug) ?? "");
  if (!bornes) return null;
  const sb = createAdminClient();
  const { data, error } = await sb.from("races").select(CHAMPS)
    .gte("id", bornes.bas).lte("id", bornes.haut).limit(2);
  // Deux résultats voudraient dire que huit caractères ne suffisent plus à distinguer :
  // on préfère une page absente à une page qui parlerait d'une autre course.
  if (error || !data || data.length !== 1) return null;
  return data[0] as CoursePublique;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await lire((await params).slug);
  if (!c || !publiable(c)) return { title: texteCourses(await getPublicLang(), "introuvable") };
  const titre = titrePage(c);
  const description = descriptionPage(c);
  return {
    title: titre,
    description,
    alternates: { canonical: `/courses/${slugCourse(c)}` },
    openGraph: { title: titre, description, type: "website" },
  };
}

const Ligne = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2.5 last:border-0">
    <dt className="text-sm text-zinc-500">{k}</dt>
    <dd className="text-right text-sm font-semibold text-zinc-900">{v}</dd>
  </div>
);

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const c = await lire((await params).slug);
  const lang = await getPublicLang();
  const t = (k: string, p?: Record<string, string | number>) => texteCourses(lang, k, p);
  // ⚠️ LE MÊME FILTRE QUE LE SITEMAP. Une course sans date réelle ou déjà courue n'a pas
  // de page : la publier laisserait en ligne une information périmée que Google
  // continuerait de servir pendant des semaines.
  if (!c || !publiable(c)) notFound();

  const km = Number(c.distance_km);
  const dplus = Number(c.elevation_gain_m);
  const lieu = [c.city, c.department].filter(Boolean).join(", ");

  // Données structurées : c'est ce qui permet à un moteur d'afficher la date et le lieu
  // directement dans ses résultats. On ne déclare QUE des champs qu'on possède.
  // ⚠️ AUCUNE DONNÉE STRUCTURÉE D'ÉVÉNEMENT SANS DATE. `SportsEvent` exige `startDate` :
  // en déclarer un sans date produirait une donnée invalide, et en inventer une serait
  // pire — un moteur affiche cette date dans ses résultats comme un fait vérifié.
  const jsonLd: Record<string, unknown> | null = !aUneDate(c) ? null : {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: nomAffichable(c.name),
    startDate: c.date,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: c.city,
      address: { "@type": "PostalAddress", addressLocality: c.city, addressRegion: c.region ?? undefined, addressCountry: "FR" },
      ...(c.latitude != null && c.longitude != null
        ? { geo: { "@type": "GeoCoordinates", latitude: c.latitude, longitude: c.longitude } }
        : {}),
    },
    ...(c.registration_url ? { url: c.registration_url } : {}),
    ...(c.organization ? { organizer: { "@type": "Organization", name: c.organization } } : {}),
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}

      <nav className="mb-6 text-sm text-zinc-500">
        <Link href="/courses" className="hover:text-zinc-900">{t("fil.courses")}</Link>
        {c.region && <> · <Link href={`/courses?region=${encodeURIComponent(regionCanonique(c.region))}`} className="hover:text-zinc-900">{nomRegion(c.region)}</Link></>}
      </nav>

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">{nomAffichable(c.name)}</h1>
      <p className="mt-2 text-lg text-zinc-600">
        {/* ⚠️ JAMAIS DE DATE INVENTÉE. « 2099-01-01 » est le repère interne de
            « prochaine édition non annoncée » : l'écrire tel quel donnerait
            « 1 janvier 2099 », et le taire laisserait croire à un oubli. */}
        {aUneDate(c) ? dateEnClair(String(c.date)) : t("sansDate.liste")}{lieu && ` · ${lieu}`}
      </p>

      <dl className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5">
        {Number.isFinite(km) && km > 0 && <Ligne k={t("f.distance")} v={`${Math.round(km)} km`} />}
        {Number.isFinite(dplus) && dplus > 0 && <Ligne k={t("f.denivele")} v={`${Math.round(dplus)} m`} />}
        {c.terrain && <Ligne k={t("f.terrain")} v={String(c.terrain)} />}
        {c.organization && <Ligne k={t("f.orga")} v={String(c.organization)} />}
        {c.is_itra_certified && <Ligne k={t("f.itra")} v={c.itra_points ? t("f.points", { n: c.itra_points }) : t("f.oui")} />}
      </dl>

      {!aUneDate(c) && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <h2 className="text-sm font-bold text-amber-900">{t("sansDate.titre")}</h2>
          <p className="mt-1 text-sm text-amber-900/80">{t("sansDate.texte")}</p>
        </div>
      )}

      {c.description && (
        <p className="mt-6 whitespace-pre-wrap leading-relaxed text-zinc-700">{c.description}</p>
      )}

      {c.registration_url && (
        <a href={c.registration_url} target="_blank" rel="noopener noreferrer nofollow"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-emerald-700">
          {t("cta.inscription")}
        </a>
      )}
      {/* ⚠️ ON NE SE FAIT PAS PASSER POUR L'ORGANISATEUR. Le lien sort du site, il est
          marqué comme tel, et la page dit d'où vient l'information. */}
      <p className="mt-3 text-xs text-zinc-400">
        {t("cta.avertissement")}
      </p>

      <section className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
        <h2 className="text-lg font-bold text-zinc-900">{t("prep.titre")}</h2>
        <p className="mt-1.5 text-sm text-zinc-600">
          {t("prep.texte")}
        </p>
        <Link href="/signup" className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800">
          {t("prep.bouton")}
        </Link>
      </section>
    </main>
  );
}
