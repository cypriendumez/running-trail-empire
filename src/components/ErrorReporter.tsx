"use client";

import { useEffect } from "react";

// Capture les erreurs JS non gérées (runtime + promesses rejetées) et les envoie à /api/log-error.
// Dédupe + plafond par session pour ne pas inonder la base en cas de boucle d'erreurs.
//
// ⚠️ ET DEPUIS LE 14/09/2026, LES APPELS RÉSEAU QUI ÉCHOUENT. Le premier vrai inscrit a vu
// « Erreur lors de la sauvegarde » sur le dernier bouton de l'inscription : une écriture
// Supabase refusée (42501, politique RLS absente). Rien n'est remonté — l'erreur était
// GÉRÉE (un toast), donc invisible de `window.onerror`, et le journal ne connaissait que
// les erreurs non gérées. Un bouton qui « ne marche pas » est presque toujours un appel qui
// répond mal : c'est cet appel qu'il faut journaliser, pas seulement les exceptions.
//
// Ce qui est journalisé, et rien d'autre :
//  · nos routes `/api/*` qui répondent ≥ 500 (une 401 ou une 422 est une réponse, pas un bug) ;
//  · une ÉCRITURE Supabase depuis le navigateur (POST/PATCH/PUT/DELETE) refusée ≥ 400 —
//    l'application ne tente jamais une écriture qu'elle sait interdite ;
//  · une panne réseau sur ces mêmes appels (hors annulation volontaire).
// Le corps de la REQUÊTE n'est jamais envoyé (il peut porter des données personnelles) ;
// seul un extrait de la RÉPONSE d'erreur l'est, c'est lui qui nomme la cause.

const SUPABASE_HOTE = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host; } catch { return ""; }
})();
/** Les deux balises qui écrivent le journal : les surveiller ferait une boucle. */
const EXCLUS = /\/api\/(log-error|visite)(\/|$|\?)/;

/** L'adresse sans hôte ni paramètres : un paramètre peut porter un jeton ou un identifiant. */
export function cheminSansParametres(url: string): string {
  try { return new URL(url, typeof location !== "undefined" ? location.origin : "http://x").pathname; }
  catch { return String(url).split(/[?#]/)[0]; }
}

/** Faut-il regarder cet appel ? Pur, pour être testable. */
export function appelSurveille(url: string, method: string, supabaseHote = SUPABASE_HOTE): "api" | "supabase" | null {
  if (EXCLUS.test(url)) return null;
  const chemin = cheminSansParametres(url);
  const local = url.startsWith("/") || (typeof location !== "undefined" && url.startsWith(location.origin));
  if (local && chemin.startsWith("/api/")) return "api";
  if (supabaseHote && url.includes(`${supabaseHote}/rest/v1/`) && /^(POST|PATCH|PUT|DELETE)$/i.test(method)) return "supabase";
  return null;
}

export function reponseAnormale(genre: "api" | "supabase", status: number): boolean {
  return genre === "api" ? status >= 500 : status >= 400;
}

export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    let count = 0;
    const send = (message: string, stack?: string, meta?: Record<string, unknown>, source = "client") => {
      if (count >= 25) return; // garde-fou par session
      const key = (message + (stack ?? "")).slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key); count++;
      try {
        fetch("/api/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, message, stack, url: location.href, meta }),
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

    // ── LES APPELS RÉSEAU QUI RÉPONDENT MAL ────────────────────────────────────
    // `fetch` est enveloppé, jamais remplacé dans son comportement : la réponse est
    // rendue telle quelle (lue sur un clone), et toute erreur de l'enveloppe est avalée.
    const original = window.fetch;
    const enveloppe: typeof window.fetch = async function (input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      const genre = appelSurveille(url, method);
      let res: Response;
      try {
        res = await original.call(window, input, init);
      } catch (e) {
        const err = e as { name?: string; message?: string };
        if (genre && err?.name !== "AbortError") {
          // « HTTP 0 » : la convention pour « aucune réponse » (réseau coupé, DNS, CORS).
          send(`HTTP 0 : ${method} ${cheminSansParametres(url)} — ${err?.message ?? "?"}`, undefined,
            { reseau: true, method, chemin: cheminSansParametres(url), genre }, "client-reseau");
        }
        throw e;
      }
      if (genre && reponseAnormale(genre, res.status)) {
        let extrait = "";
        try { extrait = (await res.clone().text()).slice(0, 300); } catch { /* corps illisible */ }
        send(`HTTP ${res.status} : ${method} ${cheminSansParametres(url)}`, undefined,
          { http: res.status, method, chemin: cheminSansParametres(url), genre, extrait }, "client-reseau");
      }
      return res;
    };
    window.fetch = enveloppe;

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      if (window.fetch === enveloppe) window.fetch = original;
    };
  }, []);
  return null;
}
