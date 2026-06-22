// ─────────────────────────────────────────────────────────────────────────────
//  Couche GPS unifiée — web ↔ app native (Capacitor).
//  - WEB : navigator.geolocation (fonctionne écran ALLUMÉ — limite du navigateur).
//  - APP NATIVE : plugin background-geolocation → suivi en ARRIÈRE-PLAN, écran éteint,
//    téléphone dans la poche, exactement comme Strava.
//  AUCUN import de package Capacitor ici → le build web reste 100 % intact. La version
//  native lit le plugin injecté dans window.Capacitor (présent uniquement dans l'app).
// ─────────────────────────────────────────────────────────────────────────────

export type GeoPoint = { lat: number; lng: number; accuracy: number | null; speed: number | null; time: number };

type CapPlugins = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    BackgroundGeolocation?: {
      addWatcher: (
        opts: { backgroundMessage?: string; backgroundTitle?: string; requestPermissions?: boolean; stale?: boolean; distanceFilter?: number },
        cb: (loc: { latitude: number; longitude: number; accuracy?: number; speed?: number; time?: number } | null, err?: { code?: string; message?: string }) => void,
      ) => Promise<string>;
      removeWatcher: (opts: { id: string }) => Promise<void>;
    };
  };
};
const cap = (): CapPlugins | undefined => (typeof window !== "undefined" ? (window as unknown as { Capacitor?: CapPlugins }).Capacitor : undefined);

/** Tourne-t-on dans l'app native (Capacitor) plutôt que dans un navigateur web ? */
export const isNativeApp = (): boolean => !!cap()?.isNativePlatform?.();

/**
 * Démarre le suivi GPS de la course. Renvoie une fonction d'arrêt.
 * En app native → enregistre en arrière-plan (écran éteint). En web → écran allumé requis.
 */
export async function startRunTracking(onPoint: (p: GeoPoint) => void, onError?: (e: string) => void): Promise<() => void> {
  const BG = cap()?.Plugins?.BackgroundGeolocation;
  // ── App native : géolocalisation en arrière-plan (comme Strava) ──
  if (isNativeApp() && BG) {
    const id = await BG.addWatcher(
      {
        backgroundMessage: "Enregistrement de ta course en cours…",
        backgroundTitle: "Pacevo",
        requestPermissions: true,
        stale: false,
        distanceFilter: 5,
      },
      (loc, err) => {
        if (err) { onError?.(err.code ?? err.message ?? "gps_error"); return; }
        if (loc) onPoint({ lat: loc.latitude, lng: loc.longitude, accuracy: loc.accuracy ?? null, speed: loc.speed ?? null, time: loc.time ?? Date.now() });
      },
    );
    return () => { BG.removeWatcher({ id }).catch(() => undefined); };
  }
  // ── Web : navigateur (écran allumé) ──
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    const wid = navigator.geolocation.watchPosition(
      (pos) => onPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, speed: pos.coords.speed ?? null, time: pos.timestamp }),
      (e) => onError?.(e.message),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(wid);
  }
  onError?.("no_geolocation");
  return () => undefined;
}
