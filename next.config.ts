import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Tree-shaking ciblé des grosses libs à barrel-file → JS par page nettement plus léger
  // (recharts, framer-motion, lucide importent énormément par défaut). Transitions plus fluides.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts", "date-fns"],
  },
  images: {
    // ⚠️ NEXT 16 N'ACCEPTE QUE LES QUALITÉS DÉCLARÉES ICI. Sans cette liste, un
    // `quality={82}` sur un composant `<Image>` est SILENCIEUSEMENT ramené à 75 : le
    // code affiche une intention que le serveur ignore, et rien ne le signale. Constaté
    // sur la page « Notre histoire » — les URL servies portaient toutes `q=75` alors que
    // le composant demandait 82. Ajouter une valeur ici est le seul moyen de l'autoriser.
    qualities: [75, 82],
    remotePatterns: [
      { hostname: "*.supabase.co" },
      { hostname: "images.unsplash.com" },
      { hostname: "*.mapbox.com" },
    ],
  },
  /**
   * DOMAINE CANONIQUE. Le site a vécu quatre mois sur `running-trail-empire-woad.vercel.app`,
   * et 17 662 pages y sont indexées. Le jour où `pacevo.fr` répond, tout ce qui arrive sur
   * l'ancienne adresse — et sur `www.`, et sur `pacevo.app` — doit être renvoyé en 301 vers
   * le domaine canonique : c'est ce qui transfère le crédit de référencement au lieu de le
   * diviser entre quatre adresses qui servent la même page.
   *
   * ⚠️ PILOTÉ PAR `DOMAINE_CANONIQUE` (ex. « pacevo.fr »), lu au BUILD. Sans elle, aucune
   * redirection : on ne renvoie jamais vers un domaine qui ne répond pas encore. Les
   * aperçus Vercel (`*-git-*.vercel.app`) ne sont pas dans la liste et restent servis.
   */
  async redirects() {
    const canon = (process.env.DOMAINE_CANONIQUE ?? "").trim().toLowerCase();
    if (!canon) return [];
    const anciens = ["running-trail-empire-woad.vercel.app", `www.${canon}`, "pacevo.app", "www.pacevo.app"]
      .filter((h) => h !== canon);
    return anciens.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `https://${canon}/:path*`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          /**
           * ⚠️ CE QUI PART VERS LES SITES TIERS. Chaque fiche de course mène au site de
           * l'organisateur : sans cet en-tête, l'adresse complète de la page de départ
           * y était transmise. Les navigateurs récents appliquent déjà cette valeur par
           * défaut — l'écrire la rend indépendante de leur version, et vaut pour les
           * anciens qui envoyaient l'URL entière.
           */
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /**
           * ⚠️ `geolocation=(self)` ET PAS `()`. L'application s'en sert vraiment — c'est
           * le tri « près de moi » des parcours. La couper ici casserait la
           * fonctionnalité en silence : le navigateur refuserait sans message d'erreur
           * exploitable. Ce qu'on ferme, c'est ce que le produit n'utilise PAS.
           */
          { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)" },
        ],
      },
    ];
  },
  // Le crawl écrit des milliers de fichiers dans data/ : on les exclut du file-watcher
  // de dev (sinon le serveur se fige au démarrage). Ils restent lisibles à l'exécution.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.next/**", "**/data/**"],
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
