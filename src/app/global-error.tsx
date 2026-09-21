"use client";

import { useEffect, useState } from "react";
import { normLang, type Lang } from "@/lib/i18n/base";

/**
 * ⚠️ TROIS PHRASES, PAS LE DICTIONNAIRE ENTIER. Cet écran importait `translations.ts`
 * (cinq langues, 183 kB de JavaScript) — et comme Next charge le module global-error
 * avec CHAQUE page (c'est la frontière d'erreur de la racine), le dictionnaire complet
 * voyageait sur toutes les pages, y compris publiques. Les trois phrases vivent ici ;
 * `tests/i18n.test.ts` vérifie qu'elles restent alignées sur le dictionnaire.
 */
const ERR: Record<Lang, { title: string; desc: string; retry: string }> = {
  fr: { title: "Oups, un souci est survenu", desc: "Le problème a été enregistré automatiquement. Tu peux réessayer cette page.", retry: "Réessayer" },
  en: { title: "Something went wrong", desc: "The problem was logged automatically. You can try this page again.", retry: "Try again" },
  de: { title: "Da ist etwas schiefgelaufen", desc: "Das Problem wurde automatisch protokolliert. Du kannst die Seite erneut laden.", retry: "Erneut versuchen" },
  es: { title: "Vaya, algo ha fallado", desc: "El problema se ha registrado automáticamente. Puedes volver a intentarlo.", retry: "Reintentar" },
  pt: { title: "Ocorreu um problema", desc: "O problema foi registado automaticamente. Podes tentar novamente.", retry: "Tentar novamente" },
};

// Capture les crashs de rendu React au niveau racine, les journalise, et affiche un écran de repli.
//
// ⚠️ CET ÉCRAN REMPLACE LE LAYOUT RACINE : le LanguageProvider n'existe plus, `useT()` est
// donc impossible ici. On relit la langue à la source — le cookie `pacevo_lang`, sinon la
// langue du navigateur. La lecture se fait dans un effet et non au rendu : `document`
// n'existe pas côté serveur, et lire le cookie pendant le rendu produirait une
// désynchronisation d'hydratation. L'écran s'affiche donc en français une fraction de
// seconde avant de basculer — un compromis assumé sur un écran de plantage.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<Lang>("fr");
  useEffect(() => {
    try {
      const c = document.cookie.match(/(?:^|;\s*)pacevo_lang=([^;]+)/)?.[1];
      setLang(normLang(c ?? navigator.language?.split("-")[0]));
    } catch { /* ignore */ }
  }, []);
  const d = ERR[lang] ?? ERR.fr;

  useEffect(() => {
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client-render",
          message: error.message || "Render error",
          stack: error.stack,
          url: typeof location !== "undefined" ? location.href : null,
          meta: { digest: error.digest },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [error]);

  return (
    <html lang={lang}>
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAFAFA", color: "#18181b", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{d.title}</h1>
          <p style={{ color: "#71717a", fontSize: 14, margin: "0 0 20px" }}>
            {d.desc}
          </p>
          <button
            onClick={() => reset()}
            style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            {d.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
