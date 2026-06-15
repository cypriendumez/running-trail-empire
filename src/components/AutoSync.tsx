"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "rte_last_auto_sync";
const THROTTLE_MS = 60 * 1000;   // 60 s mini entre deux syncs (anti-martèlement de l'API)
const POLL_MS = 120 * 1000;      // re-check toutes les 2 min tant que l'onglet est ouvert
const AUTO_SYNC_DAYS = 3;        // on tire les 3 derniers jours (inclut aujourd'hui)

/**
 * Composant invisible (monté dans le layout dashboard) qui garde les activités
 * fraîches SANS action de l'utilisateur. Il synchronise Intervals.icu :
 *  - au chargement,
 *  - dès que l'onglet (re)devient visible (ex. retour sur l'app après une sortie),
 *  - puis toutes les 2 min tant que le dashboard est ouvert.
 * Dès qu'une sync ramène du neuf, router.refresh() met à jour l'écran tout seul.
 * Throttle 60 s pour ne pas marteler l'API. NB : sur un déploiement public, le
 * webhook Intervals.icu rend l'arrivée d'activité INSTANTANÉE (push, pas de poll).
 */
export function AutoSync() {
  const router = useRouter();
  const busy = useRef(false);
  const configured = useRef<boolean | null>(null);

  useEffect(() => {
    let stopped = false;

    const trigger = async () => {
      if (busy.current || stopped) return;
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (Date.now() - last < THROTTLE_MS) return;

      // Vérifie une seule fois si Intervals.icu est configuré, puis met en cache.
      if (configured.current === null) {
        try { const s = await fetch("/api/intervals/status").then(r => r.json()); configured.current = !!s.configured; }
        catch { configured.current = false; }
      }
      if (!configured.current) return;

      busy.current = true;
      try {
        const data = await fetch(`/api/intervals/sync?days=${AUTO_SYNC_DAYS}`).then(r => r.ok ? r.json() : null);
        if (data?.synced) {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          const total = (data.synced.workouts ?? 0) + (data.synced.hrv ?? 0) + (data.synced.sleep ?? 0);
          if (total > 0 && !stopped) router.refresh(); // du neuf est arrivé → on met à jour l'écran
        }
      } catch { /* échec silencieux, on retentera au prochain tick */ }
      finally { busy.current = false; }
    };

    trigger();
    const onVisible = () => { if (document.visibilityState === "visible") trigger(); };
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => { if (document.visibilityState === "visible") trigger(); }, POLL_MS);

    return () => { stopped = true; document.removeEventListener("visibilitychange", onVisible); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
