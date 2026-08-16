"use client";

import { useEffect, useState } from "react";
import { T, normLang, type Lang } from "@/lib/i18n/translations";

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
  const d = T[lang];

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
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>{d["err.title"]}</h1>
          <p style={{ color: "#71717a", fontSize: 14, margin: "0 0 20px" }}>
            {d["err.desc"]}
          </p>
          <button
            onClick={() => reset()}
            style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            {d["err.retry"]}
          </button>
        </div>
      </body>
    </html>
  );
}
