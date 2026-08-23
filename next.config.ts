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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
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
