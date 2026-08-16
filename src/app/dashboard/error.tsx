"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Error boundary au niveau du dashboard : l'erreur reste contenue dans la zone de contenu
// (la barre latérale reste en place), est journalisée via /api/log-error, et l'utilisateur
// peut réessayer sans recharger toute l'app.
//
// La frontière d'erreur est imbriquée DANS le layout du segment : le LanguageProvider du
// dashboard est donc encore monté, et `useT()` fonctionne ici. L'écran d'erreur était le
// seul endroit de l'app qui parlait français à tout le monde — précisément au moment où
// l'athlète a le plus besoin de comprendre ce qui se passe.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
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
      <h2 className="text-lg font-bold text-zinc-900">{t("err.title")}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {t("err.desc")}
      </p>
      <button
        onClick={() => reset()}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {t("err.retry")}
      </button>
    </div>
  );
}
