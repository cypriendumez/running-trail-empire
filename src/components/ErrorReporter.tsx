"use client";

import { useEffect } from "react";

// Capture les erreurs JS non gérées (runtime + promesses rejetées) et les envoie à /api/log-error.
// Dédupe + plafond par session pour ne pas inonder la base en cas de boucle d'erreurs.
export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    let count = 0;
    const send = (message: string, stack?: string, meta?: Record<string, unknown>) => {
      if (count >= 25) return; // garde-fou par session
      const key = (message + (stack ?? "")).slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key); count++;
      try {
        fetch("/api/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "client", message, stack, url: location.href, meta }),
          keepalive: true,
        }).catch(() => {});
      } catch { /* ne jamais casser */ }
    };
    const onError = (e: ErrorEvent) =>
      send(e.message || "Error", (e.error as Error | undefined)?.stack, { file: e.filename, line: e.lineno, col: e.colno });
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string; stack?: string } | string | undefined;
      send(typeof r === "string" ? r : r?.message || "Unhandled promise rejection", typeof r === "object" ? r?.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
