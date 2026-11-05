// ─────────────────────────────────────────────────────────────────────────────
//  LA COQUILLE NATIVE DE PACEVO (iPhone, Android) — 05/11/2026.
//
//  L'appli affiche le site en ligne (https://pacevo.fr) : une seule application à
//  maintenir, et chaque déploiement Vercel arrive dans l'appli sans repasser par Apple.
//  Ce qui est natif passe par le pont que Capacitor injecte dans la page
//  (`window.Capacitor.Plugins`) : l'achat intégré (RevenueCat) et les notifications.
//  Le site n'importe donc AUCUN paquet Capacitor (src/lib/natif/appli.ts).
//
//  ⚠️ `appendUserAgent` est la signature de l'appli : le serveur la lit pour refuser le
//  paiement web dans l'appli (règle 3.1.1 d'Apple) — voir `estAppliNativeUA`.
//  ⚠️ `appId` est définitif dès la première publication sur les stores.
// ─────────────────────────────────────────────────────────────────────────────
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "fr.pacevo.app",
  appName: "Pacevo",
  // Page de secours, servie seulement si le site est injoignable au lancement.
  webDir: "www",
  server: {
    url: "https://pacevo.fr",
    cleartext: false,
    // La connexion Google et l'autorisation intervals.icu sortent du domaine puis y reviennent.
    allowNavigation: ["pacevo.fr", "*.pacevo.fr", "*.supabase.co", "accounts.google.com", "intervals.icu"],
  },
  ios: { appendUserAgent: "PacevoApp", contentInset: "automatic" },
  android: { appendUserAgent: "PacevoApp" },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
