"use client";
import { useMemo, useState } from "react";
import { Star, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/translations";
import { LOCALE, nLoc } from "@/lib/i18n/multi";
import { FUSEAU_DEFAUT } from "@/lib/time/fuseau";

/**
 * NOTES ET AVIS — le bloc de synthèse, les filtres, et la liste.
 *
 * Reprend la disposition que l'App Store a imposée comme standard, parce qu'elle répond
 * dans le bon ordre aux trois questions d'un lecteur : quelle note globale, comment elle
 * se répartit, et qu'est-ce que les gens disent.
 *
 * ⚠️ AUCUN CHIFFRE N'EST ÉCRIT NULLE PART. La moyenne et l'histogramme se recalculent à
 * chaque rendu depuis les avis RÉELLEMENT publiés qu'on reçoit en props. C'est la seule
 * façon acceptable : cette page a déjà porté 26 faux témoignages et un « 4,9 ★ » inventés,
 * et publier de faux avis de consommateurs est une pratique réputée trompeuse EN TOUTES
 * CIRCONSTANCES (directive UE 2019/2161, art. L121-4). `tests/chiffres.test.ts` garde.
 *
 * ⚠️ ET LA MOYENNE NE S'AFFICHE JAMAIS SANS SON COMPTE. « 5,0 » seul, sur un unique avis,
 * se lit comme un argument commercial ; « 5,0 sur 5 · 1 avis » se lit comme un fait.
 *
 * ⚠️ LE FILTRE NE DOIT PAS POUVOIR CACHER LES MAUVAISES NOTES PAR DÉFAUT. Il part donc
 * toujours de « tout », et le tri par défaut est le plus RÉCENT — pas le mieux noté.
 * Filtrer les avis négatifs tombe sous la même interdiction que les inventer.
 */
export type AvisPublie = { note: number; texte: string; auteur: string; at: string; reponse?: string; reponseAt?: string };

type Tri = "recent" | "haut" | "bas";

const T: Record<string, {
  titre: string; sur5: string; unAvis: string; nAvis: string; toutVoir: string; filtrer: string;
  tri: Record<Tri, string>; aucunPourCeFiltre: string; reinitialiser: string; reponseDe: string;
}> = {
  fr: {
    titre: "Notes et avis", sur5: "sur 5", unAvis: "1 avis", nAvis: "{n} avis", toutVoir: "Toutes les notes",
    filtrer: "Filtrer", tri: { recent: "Plus récents", haut: "Meilleures notes", bas: "Notes les plus basses" },
    aucunPourCeFiltre: "Aucun avis avec cette note.", reinitialiser: "Voir tous les avis", reponseDe: "Réponse de Pacevo",
  },
  en: {
    titre: "Ratings and reviews", sur5: "out of 5", unAvis: "1 review", nAvis: "{n} reviews", toutVoir: "All ratings",
    filtrer: "Filter", tri: { recent: "Most recent", haut: "Highest rated", bas: "Lowest rated" },
    aucunPourCeFiltre: "No review with this rating.", reinitialiser: "See all reviews", reponseDe: "Reply from Pacevo",
  },
  de: {
    titre: "Bewertungen", sur5: "von 5", unAvis: "1 Bewertung", nAvis: "{n} Bewertungen", toutVoir: "Alle Bewertungen",
    filtrer: "Filtern", tri: { recent: "Neueste", haut: "Beste Bewertung", bas: "Schlechteste Bewertung" },
    aucunPourCeFiltre: "Keine Bewertung mit dieser Note.", reinitialiser: "Alle Bewertungen ansehen", reponseDe: "Antwort von Pacevo",
  },
  es: {
    titre: "Valoraciones y opiniones", sur5: "de 5", unAvis: "1 opinión", nAvis: "{n} opiniones", toutVoir: "Todas las valoraciones",
    filtrer: "Filtrar", tri: { recent: "Más recientes", haut: "Mejor valoradas", bas: "Peor valoradas" },
    aucunPourCeFiltre: "Ninguna opinión con esta valoración.", reinitialiser: "Ver todas las opiniones", reponseDe: "Respuesta de Pacevo",
  },
  pt: {
    titre: "Classificações e avaliações", sur5: "de 5", unAvis: "1 avaliação", nAvis: "{n} avaliações", toutVoir: "Todas as classificações",
    filtrer: "Filtrar", tri: { recent: "Mais recentes", haut: "Melhor classificadas", bas: "Pior classificadas" },
    aucunPourCeFiltre: "Nenhuma avaliação com esta classificação.", reinitialiser: "Ver todas as avaliações", reponseDe: "Resposta da Pacevo",
  },
};

/**
 * Date d'un avis, dans la langue du lecteur (« 18 sept. 2026 », pas « 2026-09-18 »).
 * ⚠️ FUSEAU FIXÉ : ce composant est rendu côté serveur (iad1, USA) PUIS hydraté côté
 * client (France). Sans fuseau imposé, un avis écrit à 23 h à Paris change de jour entre
 * les deux rendus → erreur d'hydratation React #418 (cf. lib/time/fuseau).
 */
const dateAvis = (iso: string, lang: Lang) =>
  new Date(iso).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "short", year: "numeric", timeZone: FUSEAU_DEFAUT });

/** Étoiles d'affichage — jamais interactives ici, c'est une valeur, pas un champ. */
function Etoiles({ note, taille = "h-4 w-4" }: { note: number; taille?: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${note}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden className={`${taille} ${i < note ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"}`} />
      ))}
    </div>
  );
}

export function AvisListe({ avis }: { avis: AvisPublie[] }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const [filtre, setFiltre] = useState<number | null>(null);
  const [tri, setTri] = useState<Tri>("recent");

  const { moyenne, repartition } = useMemo(() => {
    const rep = [5, 4, 3, 2, 1].map((n) => ({ n, nb: avis.filter((a) => a.note === n).length }));
    return { moyenne: Math.round((avis.reduce((s, a) => s + a.note, 0) / avis.length) * 10) / 10, repartition: rep };
  }, [avis]);

  const liste = useMemo(() => {
    const l = filtre ? avis.filter((a) => a.note === filtre) : [...avis];
    if (tri === "haut") l.sort((a, b) => b.note - a.note || b.at.localeCompare(a.at));
    else if (tri === "bas") l.sort((a, b) => a.note - b.note || b.at.localeCompare(a.at));
    else l.sort((a, b) => b.at.localeCompare(a.at));
    return l;
  }, [avis, filtre, tri]);

  const compte = (n: number) => (n === 1 ? t.unAvis : t.nAvis.replace("{n}", String(n)));

  return (
    <div className="mx-auto max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{t.titre}</h2>

      {/* ── SYNTHÈSE : la note, puis sa répartition ──────────────────────────────── */}
      <div className="mt-6 grid gap-8 border-b border-zinc-200 pb-8 sm:grid-cols-[auto_1fr] sm:gap-12">
        <div>
          <div className="flex items-end gap-2">
            <span className="text-6xl font-bold leading-none tracking-tight text-zinc-900 tabular-nums">{nLoc(moyenne, lang, 1)}</span>
            <span className="pb-1.5 text-sm font-medium text-zinc-500">{t.sur5}</span>
          </div>
          <div className="mt-3"><Etoiles note={Math.round(moyenne)} taille="h-5 w-5" /></div>
          {/* Le compte accompagne TOUJOURS la moyenne : c'est lui qui la rend honnête. */}
          <p className="mt-2 text-sm text-zinc-500">{compte(avis.length)}</p>
        </div>

        {/* ⚠️ L'HISTOGRAMME EST AUSSI LE FILTRE. C'est ce que fait l'App Store, et c'est la
            seule façon de rendre le filtre découvrable sans ajouter un menu de plus : on
            clique la ligne qu'on veut lire. Une ligne à zéro n'est pas cliquable — un
            filtre qui ne rend rien est une impasse. */}
        <div className="space-y-1.5">
          {repartition.map(({ n, nb }) => {
            const pct = avis.length ? Math.round((nb / avis.length) * 100) : 0;
            const actif = filtre === n;
            return (
              <button
                key={n}
                type="button"
                disabled={nb === 0}
                onClick={() => setFiltre(actif ? null : n)}
                aria-pressed={actif}
                aria-label={`${n}/5 · ${compte(nb)}`}
                className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors ${
                  nb === 0 ? "cursor-default opacity-50" : actif ? "bg-emerald-50" : "hover:bg-zinc-50"
                }`}
              >
                <span className="flex w-16 shrink-0 items-center gap-0.5" aria-hidden>
                  {Array.from({ length: n }, (_, i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-zinc-400 text-zinc-400" />
                  ))}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <span
                    className={`block h-full rounded-full transition-all ${actif ? "bg-emerald-500" : "bg-zinc-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-400">{nb || ""}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TRI, ET LE FILTRE ACTIF QU'ON PEUT RETIRER ──────────────────────────── */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label htmlFor="avis-tri" className="inline-flex items-center gap-1.5 text-sm text-zinc-500">
          <SlidersHorizontal className="h-4 w-4" /> {t.filtrer}
        </label>
        <select
          id="avis-tri" value={tri} onChange={(e) => setTri(e.target.value as Tri)}
          className="rounded-xl bg-white py-2 pl-3 pr-8 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-300 outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="recent">{t.tri.recent}</option>
          <option value="haut">{t.tri.haut}</option>
          <option value="bas">{t.tri.bas}</option>
        </select>
        {filtre && (
          <button
            onClick={() => setFiltre(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 py-1.5 pl-3 pr-2 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 transition-colors hover:bg-emerald-100"
          >
            {filtre} <Star className="h-3 w-3 fill-emerald-700 text-emerald-700" />
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span className="ml-auto text-sm text-zinc-400">{compte(liste.length)}</span>
      </div>

      {/* ── LES AVIS ─────────────────────────────────────────────────────────────── */}
      {liste.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-500">{t.aucunPourCeFiltre}</p>
          <button onClick={() => setFiltre(null)} className="mt-3 text-sm font-semibold text-emerald-700 underline decoration-emerald-300 underline-offset-4">
            {t.reinitialiser}
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {liste.map((a) => (
            <article key={`${a.auteur}-${a.at}`} className="rounded-2xl bg-zinc-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <Etoiles note={a.note} />
                <time className="shrink-0 text-xs text-zinc-400" dateTime={a.at}>{dateAvis(a.at, lang)}</time>
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-zinc-800">{a.texte}</p>
              <p className="mt-3 text-xs font-medium text-zinc-500">{a.auteur}</p>
              {/* ⚠️ LA RÉPONSE S'AFFICHE SOUS L'AVIS, JAMAIS À SA PLACE : c'est ce qui rend
                  vraie la promesse « publiés tels qu'ils sont écrits ». Le texte de
                  l'athlète reste intact et vérifiable, la réponse est attribuée. */}
              {a.reponse && (
                <div className="mt-4 rounded-xl border-l-2 border-emerald-500 bg-white py-3 pl-4 pr-3">
                  <div className="text-xs font-semibold text-emerald-700">
                    {t.reponseDe}
                    {a.reponseAt ? <span className="ml-2 font-normal text-zinc-400">{dateAvis(a.reponseAt, lang)}</span> : null}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-zinc-600">{a.reponse}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
