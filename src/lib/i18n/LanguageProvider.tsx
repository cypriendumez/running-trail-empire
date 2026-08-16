"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { T, normLang, type Lang } from "./translations";
import { createClient } from "@/lib/supabase/client";

type TParams = Record<string, string | number>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string, params?: TParams) => string };
function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, key) => (key in params ? String(params[key]) : m));
}
const LanguageContext = createContext<Ctx>({ lang: "fr", setLang: () => {}, t: (k, p) => interpolate(T.fr[k] ?? k, p) });

export function LanguageProvider({ initialLang, userId, children }: { initialLang: string; userId?: string; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(normLang(initialLang));

  // La langue du dashboard vient de `profiles.preferred_language`, mais `<html lang>` est
  // posé par le layout RACINE, qui ne lit que le cookie et l'en-tête Accept-Language. Un
  // athlète dont le profil est en allemand, sur un navigateur français et sans cookie,
  // obtenait donc une page entièrement allemande déclarée `lang="fr"` — ce que lisent les
  // lecteurs d'écran et la traduction automatique du navigateur. On aligne les deux dès le
  // montage, ce qui donne au passage sa langue à `global-error`, qui n'a aucun provider.
  //
  // ⚠️ SEUL LE PROVIDER DU COMPTE (`userId` fourni) a le droit d'écrire. Les effets React
  // remontent des enfants vers les parents : le provider RACINE, imbriqué au-dessus de
  // celui du dashboard, s'exécute EN DERNIER. S'il synchronisait lui aussi, la langue
  // publique écraserait systématiquement celle du profil — vérifié dans le navigateur,
  // `documentElement.lang` retombait à « fr » après le passage de l'enfant.
  useEffect(() => {
    if (!userId) return;
    try {
      if (document.documentElement.lang !== lang) document.documentElement.lang = lang;
      if (!document.cookie.includes(`pacevo_lang=${lang}`)) {
        document.cookie = `pacevo_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch { /* ignore */ }
  }, [lang, userId]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { document.documentElement.lang = l; } catch { /* ignore */ }
    // Mémorisation côté visiteur (pages publiques, pas de compte) — cookie lu par le serveur.
    try { document.cookie = `pacevo_lang=${l}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* ignore */ }
    // Persistance compte (profiles.preferred_language) — l'app s'affiche dans cette langue à chaque visite.
    if (userId) { try { void createClient().from("profiles").update({ preferred_language: l }).eq("id", userId); } catch { /* ignore */ } }
  }, [userId]);

  const t = useCallback((k: string, params?: TParams) => interpolate(T[lang]?.[k] ?? T.fr[k] ?? k, params), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext);
