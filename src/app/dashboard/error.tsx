"use client";

import { useEffect } from "react";

// Error boundary au niveau du dashboard : l'erreur reste contenue dans la zone de contenu
// (la barre latérale reste en place), est journalisée via /api/log-error, et l'utilisateur
// peut réessayer sans recharger toute l'app.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "client-render",
          message: error.message || "Dashboard render error",
          stack: error.stack,
          url: typeof location !== "undefined" ? location.href : null,
          meta: { digest: error.digest, scope: "dashboard" },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-4xl">⚠️</div>
      <h2 className="text-lg font-bold text-zinc-900">Oups, un souci est survenu</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        Le problème a été enregistré automatiquement. Tu peux réessayer cette page.
      </p>
      <button
        onClick={() => reset()}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        Réessayer
      </button>
    </div>
  );
}
