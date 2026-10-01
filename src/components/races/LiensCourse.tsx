"use client";

import { ExternalLink, Globe, Route, Search, Trophy } from "lucide-react";
import { lienInscription, lienSiteOfficiel, lienClassement, type LiensDetail } from "@/lib/races/liensCourse";
import { editionsAAfficher } from "@/lib/races/editionsResultats";
import { lienSortantPropre } from "@/lib/races/lienPropre";
import { fillR } from "./racesI18n";

/**
 * Inscription, site officiel et classement d'une course — le même bloc dans la liste et sur
 * la carte (voir `lib/races/liensCourse` pour ce qui décide du lien).
 */
export function LiensCourse({ detail, course, d, couleur }: {
  detail: LiensDetail | null | undefined;
  course: { name?: string | null; city?: string | null; date?: string | null };
  d: Record<string, string>;
  /** Couleur du bouton principal sur la carte (celle du type de course) ; absente = style de la liste. */
  couleur?: string;
}) {
  const insc = lienInscription(detail);
  const site = lienSiteOfficiel(detail);
  const classement = lienClassement(detail, course);
  // Le tracé publié par l'organisateur (veille des pages officielles, migration 034).
  const parcours = lienSortantPropre(detail?.parcours_url);
  const editions = editionsAAfficher(detail?.resultats_editions, classement?.direct ? classement : null, course);
  const libelle = insc?.sorte === "inscription" ? d["reg.inscription"] : insc?.sorte === "officiel" ? d["reg.officiel"] : d["register"];
  return (
    <div className="w-full space-y-2">
      {insc && (
        <a href={insc.url} target="_blank" rel="noopener noreferrer nofollow"
          className={couleur
            ? "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
            : "btn-secondary w-full justify-center text-sm"}
          style={couleur ? { backgroundColor: couleur } : undefined}>
          <ExternalLink className="h-4 w-4" />{libelle}
        </a>
      )}
      {site && (
        <a href={site} target="_blank" rel="noopener noreferrer nofollow"
          className="flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-800">
          <Globe className="h-3.5 w-3.5" />{d["reg.officiel"]}
        </a>
      )}
      {parcours && (
        <a href={parcours} target="_blank" rel="noopener noreferrer nofollow"
          className="flex w-full items-center justify-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-zinc-800">
          <Route className="h-3.5 w-3.5" />{d["parcours"]}
        </a>
      )}
      {classement && (
        <a href={classement.url} target="_blank" rel="noopener noreferrer nofollow"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800">
          {classement.direct ? <Trophy className="h-4 w-4 text-amber-500" /> : <Search className="h-4 w-4" />}
          {classement.direct
            ? (classement.annee ? fillR(d["res.direct"], { a: classement.annee }) : d["res.directSansAnnee"])
            : d["res.chercher"]}
        </a>
      )}
      {/* Classements des éditions PASSÉES (2025, 2024…), chacune vérifiée avant d'être écrite. */}
      {editions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-[12px] text-zinc-500">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />{d["res.editions"]}
          {editions.map((e) => (
            <a key={e.annee} href={e.url} target="_blank" rel="noopener noreferrer nofollow"
              className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 font-semibold tabular-nums text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800">
              {e.annee}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
