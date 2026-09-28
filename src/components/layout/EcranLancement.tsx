"use client";
import { useEffect } from "react";
import { CLE_SESSION_LANCEMENT as CLE_SESSION } from "@/lib/ui/lancement";

/**
 * L'ÉCRAN DE LANCEMENT — comme à l'ouverture d'une application mobile.
 *
 * Demandé par Cyprien le 28/09/2026 : « sur toutes les applications mobiles il y a un
 * chargement quand on entre : fais de même, très pro — et profites-en pour charger les
 * choses les plus lourdes ».
 *
 * Le décor (logo, nom, barre) est rendu PAR LE SERVEUR dans le layout, pour être là dès la
 * première image — un écran de lancement qui attend le JavaScript arrive après ce qu'il
 * devait cacher. Ce composant ne fait que DÉCIDER DE SA SORTIE :
 *  · pas avant `DUREE_MIN_MS` depuis le début de la navigation (sinon il clignote) ;
 *  · dès que la page est entièrement chargée (images comprises : pas de « pop » derrière) ;
 *  · jamais après `DUREE_MAX_MS` — un réseau lent ne doit pas tenir l'athlète en otage.
 * Une seule fois par session : recharger une page ne rejoue pas l'ouverture de l'app.
 *
 * Puis il PRÉCHAUFFE, au repos, ce qui est lourd plus loin :
 *  · la bibliothèque de cartes (Leaflet) — carte des courses, Enregistrer, activités ;
 *  · le catalogue des 17 500 courses (~1 Mo compressé, 4 s à froid mesurées le
 *    28/09/2026), que le navigateur garde 30 min (`max-age=1800`) : l'onglet Courses
 *    s'ouvre alors instantanément. Jamais en « économie de données » ni en 2G/3G.
 */
export const DUREE_MIN_MS = 650;
export const DUREE_MAX_MS = 2500;
export const DUREE_SORTIE_MS = 450;

type Connexion = { saveData?: boolean; effectiveType?: string };

/** Le réseau permet-il de télécharger ~1 Mo sans y être invité ? */
export function reseauGenereux(c: Connexion | undefined | null): boolean {
  if (!c) return true;                       // Safari, Firefox : pas d'API → on ne sait pas, on ose
  if (c.saveData) return false;              // l'athlète a demandé d'économiser ses données
  return !["slow-2g", "2g", "3g"].includes(String(c.effectiveType ?? ""));
}

function prechauffer() {
  const lancer = () => {
    void import("leaflet").catch(() => {});
    const c = (navigator as Navigator & { connection?: Connexion }).connection;
    if (reseauGenereux(c)) {
      // MÊME URL que RacesHub, sans option qui changerait la clé de cache.
      void fetch("/api/races/list").catch(() => {});
    }
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(lancer, { timeout: 4000 });
  else setTimeout(lancer, 1500);
}

export function EcranLancement() {
  useEffect(() => {
    const el = document.getElementById("lancement");
    let dejaVu = false;
    try { dejaVu = !!sessionStorage.getItem(CLE_SESSION); } catch { /* stockage bloqué : on joue l'écran */ }
    if (!el || dejaVu || el.hasAttribute("data-vu")) {
      el?.setAttribute("data-vu", "");
      return;
    }
    let fini = false;
    const minuteries: number[] = [];
    const terminer = () => {
      if (fini) return;
      fini = true;
      // `performance.now()` part du DÉBUT de la navigation, pas du montage : les 650 ms
      // comptent le temps déjà passé à attendre le serveur.
      const reste = Math.max(0, DUREE_MIN_MS - performance.now());
      minuteries.push(window.setTimeout(() => {
        el.setAttribute("data-sortie", "");
        try { sessionStorage.setItem(CLE_SESSION, "1"); } catch { /* sans stockage, il rejouera : sans gravité */ }
        minuteries.push(window.setTimeout(() => el.setAttribute("data-vu", ""), DUREE_SORTIE_MS));
        prechauffer();
      }, reste));
    };
    if (document.readyState === "complete") terminer();
    else window.addEventListener("load", terminer, { once: true });
    minuteries.push(window.setTimeout(terminer, Math.max(0, DUREE_MAX_MS - performance.now())));
    return () => {
      window.removeEventListener("load", terminer);
      minuteries.forEach((m) => window.clearTimeout(m));
    };
  }, []);
  return null;
}
