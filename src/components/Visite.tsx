"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * LA BALISE DE MESURE D'AUDIENCE — une page vue = un envoi, rien d'autre.
 *
 * Pas de cookie, pas d'identifiant : l'empreinte se calcule côté serveur (voir
 * `lib/visites/empreinte.ts`) et le navigateur n'envoie que le chemin, la page d'origine
 * et sa langue. `sendBeacon` part même si l'onglet se ferme dans la seconde, et son échec
 * ne remonte jamais à la page.
 *
 * ⚠️ Le poste de développement n'est pas compté (localhost) — sinon chaque rechargement
 * pendant une séance de travail deviendrait une visite dans les chiffres de l'éditeur.
 */
export function Visite() {
  const chemin = usePathname();
  const dernier = useRef<string | null>(null);

  useEffect(() => {
    if (!chemin || dernier.current === chemin) return;
    // La page d'origine n'a de sens qu'à l'ARRIVÉE : après, on navigue dans le site.
    const premiere = dernier.current === null;
    dernier.current = chemin;
    try {
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
      const corps = JSON.stringify({
        chemin,
        referent: premiere && document.referrer ? document.referrer : null,
        langue: navigator.language || null,
      });
      const envoye = typeof navigator.sendBeacon === "function"
        && navigator.sendBeacon("/api/visite", new Blob([corps], { type: "application/json" }));
      if (!envoye) {
        fetch("/api/visite", { method: "POST", headers: { "Content-Type": "application/json" }, body: corps, keepalive: true })
          .catch(() => { /* jamais bloquant */ });
      }
    } catch { /* une balise ne casse jamais une page */ }
  }, [chemin]);

  return null;
}
