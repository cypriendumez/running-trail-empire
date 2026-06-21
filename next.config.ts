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
