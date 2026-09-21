"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { normLang, fill, type Lang, type Dict } from "./base";

type TParams = Record<string, string | number>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string, params?: TParams) => string };
// Sans provider (global-error, tests), `t` rend la clé : il n'y a plus de dictionnaire
// « par défaut » côté navigateur — c'est le prix des 183 kB économisés sur chaque page.
const LanguageContext = createContext<Ctx>({ lang: "fr", setLang: () => {}, t: (k, p) => fill(k, p) });

/**
 * ⚠️ LE DICTIONNAIRE ARRIVE EN PROP, DEPUIS LE SERVEUR (22/09/2026). Avant, ce provider
 * importait les cinq langues : 183 kB de JavaScript sur CHAQUE page, publique ou non,
 * dont 80 % ne serviraient jamais à la personne. Le layout serveur connaît la langue et
 * passe `T[lang]` — seule celle-là voyage. Au changement de langue, les autres se
 * chargent paresseusement (`import("./translations")`).
 */
export function LanguageProvider({ initialLang, dict, userId, children }: { initialLang: string; dict: Dict; userId?: string; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(normLang(initialLang));
  const [dico, setDico] = useState<Dict>(dict);

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
    // La nouvelle langue s'affiche dès que son dictionnaire est là — jamais avant, pour
    // ne pas montrer des clés brutes le temps du chargement.
    import("./translations").then((m) => { setDico(m.T[l] ?? m.T.fr); setLangState(l); }).catch(() => { /* hors ligne : on garde la langue courante */ });
    try { document.documentElement.lang = l; } catch { /* ignore */ }
    // Mémorisation côté visiteur (pages publiques, pas de compte) — cookie lu par le serveur.
    try { document.cookie = `pacevo_lang=${l}; path=/; max-age=31536000; SameSite=Lax`; } catch { /* ignore */ }
    // Persistance compte (profiles.preferred_language) — l'app s'affiche dans cette langue à chaque visite.
    // Import PARESSEUX : ce provider enveloppe TOUTES les pages, publiques comprises ; le
    // client Supabase (≈ 220 kB de JS) ne doit se charger qu'au changement de langue.
    if (userId) {
      import("@/lib/supabase/client")
        .then(({ createClient }) => createClient().from("profiles").update({ preferred_language: l }).eq("id", userId))
        .then((r) => { if (r.error) console.error("[langue] non mémorisée :", r.error.message); })
        .catch(() => { /* hors ligne : la langue reste celle de la session et du cookie */ });
    }
  }, [userId]);

  const t = useCallback((k: string, params?: TParams) => fill(dico[k] ?? k, params), [dico]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext);
