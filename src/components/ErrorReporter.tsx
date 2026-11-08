"use client";

import { useEffect } from "react";
import { toast } from "sonner";

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

/**
 * Nos routes : ≥ 500, et les refus qui ne peuvent venir que d'un défaut du CODE (07/11/2026) —
 * 400 (requête mal formée par notre propre page), 404 (route ou ressource introuvable), 405
 * (mauvaise méthode), 413 / 415 (corps refusé). Une 401 (session), 402/403 (formule), 409, 422
 * (saisie) ou 429 (quota) restent des RÉPONSES : l'application les attend et les explique.
 */
const REFUS_DE_CODE = new Set([400, 404, 405, 413, 415]);
export function reponseAnormale(genre: "api" | "supabase", status: number): boolean {
  return genre === "api" ? status >= 500 || REFUS_DE_CODE.has(status) : status >= 400;
}

/**
 * Le libellé du bouton cliqué : c'est lui qui dit, dans l'onglet Bugs, QUEL bouton a échoué.
 * Seulement les boutons (pas les liens, qui peuvent porter un nom de séance ou de personne),
 * coupé à 80 caractères.
 */
export function libelleBouton(el: Element | null): string | null {
  const b = el?.closest?.('button, [role="button"], input[type="submit"], input[type="button"]');
  if (!b) return null;
  const brut = b.getAttribute("aria-label") || (b as HTMLInputElement).value || b.textContent || b.getAttribute("title") || "";
  const l = brut.replace(/\s+/g, " ").trim().slice(0, 80);
  return l || null;
}

export function ErrorReporter() {
  useEffect(() => {
    const seen = new Set<string>();
    let count = 0;
    // ── LE DERNIER BOUTON CLIQUÉ (15 s) ────────────────────────────────────────
    // Un échec qui suit un clic est rattaché à CE bouton : « Enregistrer » plutôt qu'une URL.
    let dernierClic: { libelle: string; t: number } | null = null;
    const onClic = (e: MouseEvent) => {
      const libelle = libelleBouton(e.target as Element | null);
      if (libelle) dernierClic = { libelle, t: Date.now() };
    };
    document.addEventListener("click", onClic, true);
    const clicRecent = () => (dernierClic && Date.now() - dernierClic.t < 15_000 ? dernierClic.libelle : null);
    const send = (message: string, stack?: string, meta?: Record<string, unknown>, source = "client") => {
      if (count >= 25) return; // garde-fou par session
      const key = (message + (stack ?? "")).slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key); count++;
      try {
        fetch("/api/log-error", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, message, stack, url: location.origin + location.pathname, meta: { ...meta, clic: clicRecent() } }),
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

    // ── LES ÉCHECS QUE L'APPLICATION AFFICHE ELLE-MÊME (07/11/2026) ───────────────
    // Un bouton qui échoue montre presque toujours un message d'erreur (`toast.error`) :
    // l'erreur est GÉRÉE, donc invisible de `window.onerror`, et si l'appel répond 200 avec
    // un `{ error }` ou si l'échec est local (géolocalisation, fichier illisible…), rien ne
    // remontait. Ce que l'athlète lit comme un échec part désormais dans l'onglet Bugs,
    // avec le bouton cliqué juste avant. L'affichage, lui, est inchangé.
    const toastErreur = toast.error;
    const toastEnveloppe = ((message: unknown, data?: unknown) => {
      try {
        const texte = typeof message === "string" ? message : typeof message === "function" ? "(message dynamique)" : "(message riche)";
        send(`Échec affiché : ${texte.slice(0, 300)}`, undefined, { affiche: true }, "bouton");
      } catch { /* ne jamais casser l'affichage */ }
      return (toastErreur as (m: unknown, d?: unknown) => string | number)(message, data);
    }) as typeof toast.error;
    toast.error = toastEnveloppe;

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      if (window.fetch === enveloppe) window.fetch = original;
      if (toast.error === toastEnveloppe) toast.error = toastErreur;
      document.removeEventListener("click", onClic, true);
    };
  }, []);
  return null;
}
