/**
 * ABONNEMENT PUSH CÔTÉ NAVIGATEUR.
 *
 * ⚠️ TROIS CONDITIONS, ET SUR iPHONE LA PLUS DURE. Le push web exige un service worker
 * (`serviceWorker`), l'API Push (`PushManager`) et la permission Notification. Sur iPhone,
 * Apple n'autorise le push QUE si l'app a été ajoutée à l'écran d'accueil (PWA installée) et
 * seulement depuis iOS 16.4. Tant que ces conditions ne sont pas réunies, on renvoie un état
 * clair plutôt que de faire semblant.
 */
const cle = () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushDisponible(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
    && !!cle();
}

/** La clé VAPID publique (base64url) doit être passée en Uint8Array à `pushManager.subscribe`. */
function cleEnTableau(base64: string): Uint8Array {
  const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(b64);
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

export type EtatPush = "active" | "inactive" | "bloque" | "indispo" | "erreur";

/** Demande la permission, crée l'abonnement et l'enregistre côté serveur. */
export async function activerPush(): Promise<EtatPush> {
  if (!pushDisponible()) return "indispo";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "bloque";
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true, // exigé : chaque push doit produire une notification visible
      // `as BufferSource` : un Uint8Array EST une vue de tampon valide ; le cast lève la
      // stricte incompatibilité de types (Uint8Array<ArrayBufferLike> vs BufferSource) de TS.
      applicationServerKey: cleEnTableau(cle()) as BufferSource,
    });
    const r = await fetch("/api/push/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub),
    });
    return r.ok ? "active" : "erreur";
  } catch {
    return "erreur";
  }
}

/** Se désabonne côté navigateur ET côté serveur. */
export async function desactiverPush(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/push/unsubscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  } catch { /* best effort */ }
}
