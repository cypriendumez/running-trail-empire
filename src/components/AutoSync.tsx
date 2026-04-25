"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "rte_last_auto_sync";
const MIN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes minimum between auto-syncs
const AUTO_SYNC_DAYS = 3; // sync last 3 days on auto

/**
 * Invisible component that silently syncs Intervals.icu data when:
 * - User visits the dashboard
 * - Last auto-sync was more than 15 minutes ago
 * - User has Intervals.icu configured
 */
export function AutoSync() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const lastSync = localStorage.getItem(STORAGE_KEY);
    const now = Date.now();

    if (lastSync && now - parseInt(lastSync) < MIN_INTERVAL_MS) return;

    // Check if configured first
    fetch("/api/intervals/status")
      .then(r => r.json())
      .then(d => {
        if (!d.configured) return;

        // Fire sync in background — don't await, don't show any UI
        fetch(`/api/intervals/sync?days=${AUTO_SYNC_DAYS}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.synced) {
              localStorage.setItem(STORAGE_KEY, String(Date.now()));
              const total = (data.synced.workouts ?? 0) + (data.synced.hrv ?? 0) + (data.synced.sleep ?? 0);
              if (total > 0) {
                console.log(`[AutoSync] ✓ ${data.synced.workouts} activités, ${data.synced.hrv} VFC, ${data.synced.sleep} nuits`);
              }
            }
          })
          .catch(() => {}); // Fail silently
      })
      .catch(() => {});
  }, []);

  return null; // Renders nothing
}
