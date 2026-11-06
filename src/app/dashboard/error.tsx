"use client";

import { startTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageProvider";
import { erreurReseau } from "@/lib/erreurs/reseau";

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
  const router = useRouter();
  const reseau = erreurReseau(error);
  // ⚠️ `reset()` SEUL NE RECHARGE RIEN : il réaffiche le segment avec la même réponse serveur,
  // donc la même erreur. Après une coupure, il faut redemander la page au serveur.
  const relancer = useCallback(() => {
    startTransition(() => { router.refresh(); reset(); });
  }, [router, reset]);
  // Coupure réseau : on se relève SEUL dès que la connexion revient, et une fois après 4 s.
  useEffect(() => {
    if (!reseau) return;
    const auRetour = () => relancer();
    window.addEventListener("online", auRetour);
    const minuteur = window.setTimeout(() => { if (navigator.onLine !== false) relancer(); }, 4000);
    return () => { window.removeEventListener("online", auRetour); window.clearTimeout(minuteur); };
  }, [reseau, relancer]);
  useEffect(() => {
    try {
      fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Une coupure du réseau de l'athlète est rangée à part : ce n'est pas un écran planté.
          source: reseau ? "reseau" : "client-render",
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
      <h2 className="text-lg font-bold text-zinc-900">{t(reseau ? "err.reseau.title" : "err.title")}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        {t(reseau ? "err.reseau.desc" : "err.desc")}
      </p>
      <button
        onClick={relancer}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {t("err.retry")}
      </button>
    </div>
  );
}
