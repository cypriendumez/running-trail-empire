/**
 * L'APPLI NATIVE (iPhone, Android) VUE DEPUIS LE SITE — 05/11/2026.
 *
 * L'appli des stores est une coquille Capacitor qui affiche pacevo.fr (voir
 * `appli/capacitor.config.ts`). Le site ne dépend d'AUCUN paquet Capacitor : il reconnaît
 * l'appli à sa signature d'agent utilisateur (`PacevoApp`, posée par `appendUserAgent`) et
 * parle aux modules natifs par le pont que Capacitor injecte (`window.Capacitor.Plugins`).
 *
 * Pourquoi c'est important : dans l'appli, Apple et Google interdisent de vendre
 * l'abonnement par un autre moyen que leur achat intégré, et même d'y inviter (règle 3.1.1
 * d'Apple, hors États-Unis). Le paiement Stripe ne doit donc JAMAIS apparaître dans l'appli
 * — la page d'abonnement y bascule sur l'achat intégré, et le serveur refuse le paiement
 * web à l'appli (`/api/stripe/checkout`).
 */

/** La signature que la coquille ajoute à l'agent utilisateur (`appendUserAgent`). */
export const SIGNATURE_APPLI = "PacevoApp";

/** La requête vient-elle de l'appli native ? Lu côté serveur sur l'en-tête `user-agent`. */
export function estAppliNativeUA(userAgent: string | null | undefined): boolean {
  return new RegExp(`\\b${SIGNATURE_APPLI}\\b`).test(String(userAgent ?? ""));
}

type PontCapacitor = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, unknown>;
};
const pont = (): PontCapacitor | null =>
  typeof window === "undefined" ? null : ((window as unknown as { Capacitor?: PontCapacitor }).Capacitor ?? null);

/**
 * Le navigateur est-il l'appli native ? Côté client SEULEMENT, et à lire après le montage
 * (dans un `useEffect`) : le serveur ne connaît pas `window`, et un rendu différent au
 * serveur et au téléphone est une erreur React #418.
 */
export function estAppliNative(): boolean {
  if (typeof window === "undefined") return false;
  return pont()?.isNativePlatform?.() === true || estAppliNativeUA(navigator.userAgent);
}

/** « ios », « android », ou `null` hors de l'appli. */
export function plateformeNative(): "ios" | "android" | null {
  if (!estAppliNative()) return null;
  const p = pont()?.getPlatform?.();
  if (p === "ios" || p === "android") return p;
  return /android/i.test(navigator.userAgent) ? "android" : "ios";
}

/** Un module natif enregistré sur le pont (`Purchases`, `PushNotifications`…), ou `null`. */
export function moduleNatif<T>(nom: string): T | null {
  return (pont()?.Plugins?.[nom] as T | undefined) ?? null;
}
