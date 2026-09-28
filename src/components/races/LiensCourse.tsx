"use client";

import { ExternalLink, Globe, Search, Trophy } from "lucide-react";
import { lienInscription, lienSiteOfficiel, lienClassement, type LiensDetail } from "@/lib/races/liensCourse";
import { fillR } from "./racesI18n";

/**
 * Inscription, site officiel et classement d'une course — le même bloc dans la liste et sur
 * la carte (voir `lib/races/liensCourse` pour ce qui décide du lien).
 */
export function LiensCourse({ detail, course, d, couleur }: {
  detail: LiensDetail | null | undefined;
  course: { name?: string | null; city?: string | null };
  d: Record<string, string>;
  /** Couleur du bouton principal sur la carte (celle du type de course) ; absente = style de la liste. */
  couleur?: string;
}) {
  const insc = lienInscription(detail);
  const site = lienSiteOfficiel(detail);
  const classement = lienClassement(detail, course);
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
      {classement && (
        <a href={classement.url} target="_blank" rel="noopener noreferrer nofollow"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800">
          {classement.direct ? <Trophy className="h-4 w-4 text-amber-500" /> : <Search className="h-4 w-4" />}
          {classement.direct
            ? (classement.annee ? fillR(d["res.direct"], { a: classement.annee }) : d["res.directSansAnnee"])
            : d["res.chercher"]}
        </a>
      )}
    </div>
  );
}
