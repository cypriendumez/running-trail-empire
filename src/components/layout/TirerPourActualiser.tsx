"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";

/**
 * « TIRER POUR ACTUALISER » DANS L'APPLICATION INSTALLÉE.
 *
 * ⚠️ Cyprien, 27/11/2026 : « pourquoi je peux pas actualiser sur mon téléphone quand je suis
 * sur le dashboard ». Deux causes. La première (la page ne défilait pas elle-même) est
 * réglée dans `dashboard/layout.tsx`. La seconde ne se règle pas par la mise en page :
 * une application ajoutée à l'écran d'accueil (iPhone, Android) n'a PAS ce geste, le
 * navigateur le retire. On le refait ici, et seulement là : dans Safari ou Chrome, le geste
 * natif existe, le doubler rechargerait deux fois.
 *
 * Il ne part que d'en haut de la page, d'un seul doigt, et jamais :
 *  - sur une carte (on la fait glisser vers le bas sans vouloir recharger) ;
 *  - dans une zone qui défile sur elle-même et n'est pas en haut (fil de messages…) ;
 *  - pendant une vue plein écran (Enregistrer : recharger en pleine course serait grave).
 */
const SEUIL = 70; // px tirés (après amortissement) pour déclencher
const MAX = 110;
const EXCLUS = ".maplibregl-map, .leaflet-container, [data-sans-tirer], input, textarea, select, [contenteditable=true]";

/** Une zone qui défile sur elle-même, entre la cible et la page, et qui n'est pas en haut. */
function zoneDefilanteNonEnHaut(el: Element | null): boolean {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollTop > 0) {
      const oy = getComputedStyle(n).overflowY;
      if (oy === "auto" || oy === "scroll") return true;
    }
  }
  return false;
}

export function estApplicationInstallee(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

export default function TirerPourActualiser() {
  const [tire, setTire] = useState(0);
  const [recharge, setRecharge] = useState(false);
  const depart = useRef<number | null>(null);
  const tireRef = useRef(0);

  useEffect(() => {
    if (!estApplicationInstallee()) return;
    const maj = (v: number) => { tireRef.current = v; setTire(v); };

    const debut = (e: TouchEvent) => {
      depart.current = null;
      if (e.touches.length !== 1 || window.scrollY > 0) return;
      if (document.documentElement.dataset.pleinEcran) return;
      const cible = e.target instanceof Element ? e.target : null;
      if (cible?.closest(EXCLUS) || zoneDefilanteNonEnHaut(cible)) return;
      depart.current = e.touches[0].clientY;
    };
    const bouge = (e: TouchEvent) => {
      if (depart.current === null) return;
      if (e.touches.length !== 1 || window.scrollY > 0) { depart.current = null; maj(0); return; }
      const dy = e.touches[0].clientY - depart.current;
      maj(dy > 0 ? Math.min(dy * 0.5, MAX) : 0);
    };
    const fin = () => {
      if (depart.current === null) return;
      depart.current = null;
      if (tireRef.current >= SEUIL) {
        setRecharge(true);
        window.location.reload();
      } else maj(0);
    };

    window.addEventListener("touchstart", debut, { passive: true });
    window.addEventListener("touchmove", bouge, { passive: true });
    window.addEventListener("touchend", fin, { passive: true });
    window.addEventListener("touchcancel", fin, { passive: true });
    return () => {
      window.removeEventListener("touchstart", debut);
      window.removeEventListener("touchmove", bouge);
      window.removeEventListener("touchend", fin);
      window.removeEventListener("touchcancel", fin);
    };
  }, []);

  if (!tire && !recharge) return null;
  const pret = recharge || tire >= SEUIL;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center md:hidden"
      style={{ top: `calc(env(safe-area-inset-top) + ${recharge ? 72 : Math.max(tire - 24, 8)}px)` }}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-md transition-colors ${pret ? "border-emerald-200 text-emerald-600" : "border-zinc-200 text-zinc-400"}`}
        style={{ opacity: recharge ? 1 : Math.min(tire / SEUIL, 1) }}>
        <RotateCw className={`h-5 w-5 ${recharge ? "animate-spin" : ""}`}
          style={recharge ? undefined : { transform: `rotate(${(tire / SEUIL) * 270}deg)` }} />
      </span>
    </div>
  );
}
