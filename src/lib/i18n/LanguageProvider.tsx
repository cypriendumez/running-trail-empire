"use client";

import { createContext, useContext, useState, useCallback } from "react";
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

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { document.documentElement.lang = l; } catch { /* ignore */ }
    // Persistance (profiles.preferred_language) — l'app s'affiche dans cette langue à chaque visite.
    if (userId) { try { void createClient().from("profiles").update({ preferred_language: l }).eq("id", userId); } catch { /* ignore */ } }
  }, [userId]);

  const t = useCallback((k: string, params?: TParams) => interpolate(T[lang]?.[k] ?? T.fr[k] ?? k, params), [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext);
