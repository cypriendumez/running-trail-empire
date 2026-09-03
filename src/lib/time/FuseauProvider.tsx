"use client";
import { createContext, useContext, useEffect } from "react";
import { FUSEAU_DEFAUT, fuseauOuDefaut } from "./fuseau";

const FuseauContext = createContext<string>(FUSEAU_DEFAUT);

/** Le fuseau de l'athlète, identique côté serveur et côté navigateur. */
export function useFuseau(): string {
  return useContext(FuseauContext);
}

/**
 * Diffuse le fuseau, et l'apprend pour la prochaine visite.
 *
 * ⚠️ LE FUSEAU DU RENDU VIENT DU COOKIE, PAS DU NAVIGATEUR. Lire
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` pendant le rendu rétablirait
 * EXACTEMENT le défaut qu'on corrige : le serveur ne connaît pas cette valeur, il
 * écrirait donc un autre texte que le navigateur, et React #418 reviendrait. Le
 * navigateur ne fait que DÉPOSER le cookie, après le montage ; le rendu suivant en
 * bénéficie. La première visite se fait donc sur le repli, mais identique des deux côtés.
 *
 * Même mécanisme que `pacevo_lang`, volontairement : un seul motif à comprendre.
 */
export function FuseauProvider({ fuseau, children }: { fuseau: string; children: React.ReactNode }) {
  const tz = fuseauOuDefaut(fuseau);
  useEffect(() => {
    try {
      const reel = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!reel || reel === tz) return;
      // 400 jours : le fuseau d'un athlète change quand il déménage, pas chaque semaine.
      document.cookie = `pacevo_tz=${encodeURIComponent(reel)}; path=/; max-age=34560000; SameSite=Lax`;
    } catch { /* navigateur sans Intl complet : on garde le repli */ }
  }, [tz]);
  return <FuseauContext.Provider value={tz}>{children}</FuseauContext.Provider>;
}
