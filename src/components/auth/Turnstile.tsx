"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { toast } from "sonner";

/**
 * LE WIDGET CLOUDFLARE TURNSTILE (anti-robots), en sommeil sans clé.
 *
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` absente → le composant ne rend RIEN et ne charge aucun script :
 * connexion et inscription fonctionnent exactement comme avant. Posée → le script de Cloudflare
 * est chargé (autorisé dans la CSP de `next.config.ts` seulement dans ce cas), le widget reste
 * INVISIBLE sauf si Cloudflare a un doute (`appearance: "interaction-only"`), et le jeton obtenu
 * remonte par `onJeton`.
 *
 * ⚠️ UN JETON NE SERT QU'UNE FOIS (et expire en 5 minutes). Après chaque envoi, réussi ou non,
 * l'appelant doit appeler `reinitialiser()` : sinon le second essai part avec un jeton déjà
 * consommé et Cloudflare le refuse.
 */

export const CLE_TURNSTILE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type ApiTurnstile = {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: ApiTurnstile } }

let chargement: Promise<ApiTurnstile> | null = null;
function chargerScript(): Promise<ApiTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (chargement) return chargement;
  chargement = new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => (window.turnstile ? ok(window.turnstile) : ko(new Error("turnstile absent")));
    s.onerror = () => { chargement = null; ko(new Error("script Turnstile non chargé")); };
    document.head.appendChild(s);
  });
  return chargement;
}

export type TurnstileRef = { reinitialiser: () => void };

/**
 * L'identifiant de LA notification « vérification anti-robot en cours » (09/11/2026, capture de
 * Cyprien sur iPhone). Touchée du doigt, une notification Sonner met son compte à rebours en pause
 * et ne le reprend jamais sur téléphone : celle-ci restait collée sur le tableau de bord après la
 * connexion. Un seul identifiant pour les quatre pages (connexion, inscription, oubli, Réglages) :
 * elles ne s'empilent plus, et le widget la retire lui-même dès que son jeton arrive.
 */
export const TOAST_CAPTCHA = "captcha-attente";

/**
 * `onErreur` : le script ne se charge pas (bloqueur de publicité, réseau d'entreprise) ou le widget
 * échoue. Sans jeton, la connexion est refusée par GoTrue : l'écran doit DIRE pourquoi, au lieu de
 * répéter « patiente » sans fin (relecture du 08/11/2026).
 */
export const Turnstile = forwardRef<TurnstileRef, { onJeton: (jeton: string | null) => void; onErreur?: () => void; langue?: string }>(
  function Turnstile({ onJeton, onErreur, langue }, ref) {
    const boite = useRef<HTMLDivElement>(null);
    const id = useRef<string | null>(null);
    const rappel = useRef(onJeton);
    rappel.current = onJeton;
    const erreur = useRef(onErreur);
    erreur.current = onErreur;

    useImperativeHandle(ref, () => ({
      reinitialiser: () => {
        rappel.current(null);
        if (id.current && window.turnstile) window.turnstile.reset(id.current);
      },
    }), []);

    useEffect(() => {
      if (!CLE_TURNSTILE || !boite.current) return;
      let annule = false;
      chargerScript().then((t) => {
        if (annule || !boite.current) return;
        id.current = t.render(boite.current, {
          sitekey: CLE_TURNSTILE,
          appearance: "interaction-only",
          language: langue ?? "auto",
          // Le jeton est là : l'attente annoncée n'a plus lieu d'être, on retire son message.
          callback: (jeton: string) => { toast.dismiss(TOAST_CAPTCHA); rappel.current(jeton); },
          "expired-callback": () => rappel.current(null),
          "error-callback": () => { rappel.current(null); erreur.current?.(); },
        });
      }).catch(() => { rappel.current(null); erreur.current?.(); });
      return () => {
        annule = true;
        if (id.current && window.turnstile) window.turnstile.remove(id.current);
        id.current = null;
      };
    }, [langue]);

    if (!CLE_TURNSTILE) return null;
    return <div ref={boite} className="flex justify-center empty:hidden" />;
  },
);
