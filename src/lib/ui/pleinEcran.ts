"use client";
import { useEffect } from "react";

/**
 * « UNE VUE PLEIN ÉCRAN EST OUVERTE » — signal global, lu par la feuille de style.
 *
 * ⚠️ LA BULLE D'AIDE MASQUAIT LE BOUTON « M'ENTRAÎNER POUR CETTE COURSE ». Elle est fixée
 * en bas à droite au même étage (z-50) que la carte plein écran des courses, et rendue
 * APRÈS elle : elle passait donc par-dessus le pied de la fiche (capture de Cyprien,
 * 28/09/2026). Une vue plein écran pose ce drapeau sur <html>, et la feuille de style
 * retire la bulle tant qu'il est là (`[data-bulle-aide]`, globals.css).
 *
 * Un COMPTEUR, pas un booléen : si deux vues s'ouvrent l'une sur l'autre, fermer la
 * première ne doit pas faire réapparaître la bulle sur la seconde.
 */
const CLE = "pleinEcran";

export function usePleinEcran(actif = true): void {
  useEffect(() => {
    if (!actif || typeof document === "undefined") return;
    const el = document.documentElement;
    el.dataset[CLE] = String(Number(el.dataset[CLE] ?? 0) + 1);
    return () => {
      const n = Number(el.dataset[CLE] ?? 1) - 1;
      if (n > 0) el.dataset[CLE] = String(n);
      else delete el.dataset[CLE];
    };
  }, [actif]);
}
