"use client";

import { useEffect } from "react";

// Capture les crashs de rendu React au niveau racine, les journalise, et affiche un écran de repli.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FAFAFA", color: "#18181b", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Une erreur est survenue</h1>
          <p style={{ color: "#71717a", fontSize: 14, margin: "0 0 20px" }}>
            Le problème a été enregistré automatiquement. Tu peux réessayer.
          </p>
          <button
            onClick={() => reset()}
            style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 12, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
