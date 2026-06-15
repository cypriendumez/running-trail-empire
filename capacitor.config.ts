// Configuration Capacitor — base prête pour l'app native iOS/Android.
// (Aucun effet sur l'app web : ce fichier n'est lu que par les outils Capacitor.)
// L'app native charge le site Next.js déployé (server.url) et y branche les plugins natifs
// (géolocalisation en arrière-plan). Remplace server.url par ton URL de prod avant de compiler.
const config = {
  appId: "com.runningtrailempire.app",
  appName: "Running & Trail Empire",
  webDir: "public", // non utilisé en mode server.url, requis par la CLI
  server: {
    // ⚠️ À remplacer par ton URL HTTPS de production (Railway/Vercel) avant `npx cap sync`.
    url: "https://running-trail-empire-production.up.railway.app",
    cleartext: false,
  },
  plugins: {
    BackgroundGeolocation: {},
  },
  ios: { contentInset: "always" },
};

export default config;
