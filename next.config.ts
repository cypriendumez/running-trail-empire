import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * LA VERSION QUE CE BUILD EMBARQUE — lue dans le tampon que `prebuild` vient d'écrire.
 * Le navigateur la compare à `/version.json` en ligne (`MiseAJour`) : un onglet resté
 * ouvert pendant une mise en ligne se met à jour tout seul, au lieu de montrer l'ancien
 * menu pendant des heures (constaté le 29/09/2026 sur les captures de Cyprien).
 */
const VERSION_BUILD = (() => {
  try { return String(JSON.parse(readFileSync("public/version.json", "utf8")).commit ?? ""); } catch { return ""; }
})();

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_VERSION: VERSION_BUILD },
  // Tree-shaking ciblé des grosses libs à barrel-file → JS par page nettement plus léger
  // (recharts, framer-motion, lucide importent énormément par défaut). Transitions plus fluides.
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "recharts", "date-fns"],
    /**
     * FLUIDITÉ DES ALLERS-RETOURS ENTRE ONGLETS (22/09/2026). Toutes les pages du tableau
     * de bord sont dynamiques ; par défaut (`dynamic: 0`) le routeur les redemande au
     * serveur À CHAQUE retour — Accueil → Calendrier → Accueil = trois rendus serveur,
     * trois attentes de 0,5 à 1 s, trois squelettes. Trente secondes de garde en mémoire
     * rendent le retour instantané ; une action qui change les données appelle
     * `router.refresh()` et repart de zéro. Les pages publiques (statiques) gardent
     * trois minutes.
     */
    staleTimes: { dynamic: 30, static: 180 },
  },
  /**
   * CE QUE LA FONCTION SERVEUR EMBARQUE (22/09/2026). Le traceur suivait
   * `path.join(process.cwd(), "data", …)` et incluait le dossier `data/` ENTIER — 36 Mo
   * de JSON de crawl — dans l'unique fonction qui sert toutes les pages ; chaque
   * démarrage à froid la téléchargeait (7,4 s mesurées sur la première visite). Seul
   * le catalogue compacté (1,1 Mo, `scripts/parcours-compacter.ts`) est nécessaire.
   */
  outputFileTracingExcludes: {
    // Nommés un par un, sans motif d'étoile après une barre : les tests qui relisent ce
    // fichier retirent les commentaires, et ce motif dans une chaîne en ouvrirait un faux.
    "*": ["./data/dataset.json", "./data/dataset_france.json", "./data/parcours_certifies.json", "./data/finishers-dates.jsonl", "./data/jp-dates.jsonl", "./data/finishers-catalog.progress", "./data/CRAWL_DONE", "./data/data_scan.json", "./data/water_routes.json"],
  },
  outputFileTracingIncludes: {
    "/api/parcours": ["./data/parcours_certifies.min.json.gz"],
  },
  images: {
    // ⚠️ NEXT 16 N'ACCEPTE QUE LES QUALITÉS DÉCLARÉES ICI. Sans cette liste, un
    // `quality={82}` sur un composant `<Image>` est SILENCIEUSEMENT ramené à 75 : le
    // code affiche une intention que le serveur ignore, et rien ne le signale. Constaté
    // sur la page « Notre histoire » — les URL servies portaient toutes `q=75` alors que
    // le composant demandait 82. Ajouter une valeur ici est le seul moyen de l'autoriser.
    // 55 : les visuels de l'Actualité sont décoratifs et passent sous un voile coloré à
    // 50 % d'opacité — la différence ne se voit pas, le poids si (−35 % mesuré).
    qualities: [55, 75, 82],
    remotePatterns: [
      { hostname: "*.supabase.co" },
      { hostname: "images.unsplash.com" },
      // Les visuels de thème de l'Actualité (22/09/2026) : servis en direct par Pexels,
      // c'était 48 JPEG de ~90 ko et un aller-retour vers un CDN tiers par carte.
      // Via l'optimiseur, ils deviennent de l'AVIF servi depuis notre propre domaine.
      { hostname: "images.pexels.com" },
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
    /**
     * ⚠️ CSP APPLIQUÉE depuis le 08/11/2026 (elle était en report-only depuis l'audit M4, 16/10).
     *
     * POURQUOI : le jeton de session Supabase vit dans un cookie LISIBLE par JavaScript, par
     * conception (`@supabase/ssr` : le client navigateur en a besoin ; le passer en httpOnly
     * casserait tous les appels Supabase du navigateur). La parade contre son vol, c'est
     * d'empêcher un script HÉBERGÉ AILLEURS de s'exécuter (`script-src 'self'`) et de borner les
     * destinations de tout script (`connect-src`, `img-src`, `form-action` : seulement nos
     * services). En report-only, rien de tout cela ne protégeait : le navigateur signalait et
     * laissait faire.
     *
     * ⚠️ CE QU'ELLE NE FAIT PAS, à dire honnêtement : à cause de `'unsafe-inline'`, un script
     * injecté EN LIGNE (faille XSS dans notre code) s'exécute quand même ; il ne peut alors
     * envoyer le jeton qu'aux services listés ici — d'où l'hôte Supabase EXACT, pas le joker —
     * mais rien n'empêche une simple navigation vers un autre site (`location = …`), que la CSP
     * ne sait pas bloquer. La première défense contre le XSS reste React, qui échappe le texte.
     *
     * ⚠️ `'unsafe-inline'` RESTE dans script-src : Next écrit ses propres scripts en ligne
     * (hydratation, flux RSC). Les nonces les remplaceraient, mais imposent un rendu dynamique de
     * CHAQUE page (doc Next, « Content Security Policy ») : les 17 000 fiches de course et les pages
     * publiques perdraient leur rendu statique. Choix fait : pas de nonces ; `eval` reste interdit.
     * `'unsafe-eval'` n'est ajouté qu'en développement (Turbopack s'en sert, rapports du 17/10).
     *
     * Avant d'appliquer, les 185 rapports reçus du 17/10 au 06/11 ont été classés : extensions des
     * visiteurs (Joko, Firebase, scite, polices Google injectées), poste de développement, et
     * BigDataCloud bloqué par un bloqueur de publicité qui redirige la requête (vérifié : sous
     * cette même politique appliquée, l'appel passe dans un navigateur sans bloqueur).
     *
     * ⚠️ TOUTE NOUVELLE SOURCE EXTERNE doit entrer ici, sinon elle est BLOQUÉE sans erreur visible
     * (carte grise, image vide). `tests/entetes.test.ts` relève les couches de carte et les appels
     * `fetch("https://…")` du code et refuse un hôte absent de la politique.
     */
    // Fonds de carte : Leaflet les charge en <img> (img-src), MapLibre (Relief 3D) par fetch
    // (connect-src) — d'où leur présence dans les DEUX listes. Relevés dans `lib/trail/couches.ts`,
    // `lib/courses/fondsCarte.ts`, `components/trail`, `components/races`, `components/segments`.
    const tuiles = [
      "https://api.maptiler.com",
      "https://*.mapbox.com",
      "https://tile.openstreetmap.org",
      "https://*.tile.openstreetmap.org",
      "https://*.tile.opentopomap.org",
      "https://*.tile-cyclosm.openstreetmap.fr",
      "https://tile.waymarkedtrails.org",
      "https://data.geopf.fr",
      "https://wmts.geo.admin.ch",
      "https://www.ign.es",
      "https://sgx.geodatenzentrum.de",
      "https://server.arcgisonline.com",
      "https://basemap.nationalmap.gov",
    ].join(" ");
    const dev = process.env.NODE_ENV !== "production";
    // ⚠️ L'HÔTE EXACT DU PROJET SUPABASE, PAS `*.supabase.co` (relecture du 08/11/2026). Le joker
    // couvrait les projets de TOUT LE MONDE : un script injecté pouvait envoyer le jeton de session
    // vers le projet Supabase d'un attaquant, et la CSP le laissait passer. Sans l'adresse (poste
    // sans `.env`), on retombe sur le joker pour ne pas casser le développement.
    const supabase = (() => {
      try { const h = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host; if (h) return { https: `https://${h}`, wss: `wss://${h}` }; } catch { /* adresse absente ou illisible */ }
      return { https: "https://*.supabase.co", wss: "wss://*.supabase.co" };
    })();
    // CAPTCHA Cloudflare Turnstile (`components/auth/Turnstile`) : son script et son cadre ne sont
    // autorisés QUE si la clé est posée — sans elle, aucune porte n'est ouverte pour rien.
    // Directives exigées par Cloudflare (doc « Turnstile — Content Security Policy », lue le 08/11/2026).
    const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? " https://challenges.cloudflare.com" : "";
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}${turnstile}`,
      ...(turnstile ? [`frame-src${turnstile}`] : []),
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `img-src 'self' data: blob: ${supabase.https} https://images.unsplash.com https://images.pexels.com https://cdnjs.cloudflare.com https://icons.duckduckgo.com ${tuiles}`,
      `connect-src 'self' ${supabase.https} ${supabase.wss} https://*.open-meteo.com https://api.bigdatacloud.net https://router.project-osrm.org ${tuiles}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "report-uri /api/csp-report",
    ].join("; ");
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
          /**
           * ⚠️ `camera=(self)` ET PLUS `()` (08/11/2026) : « Ajouter des amis » scanne le QR code
           * d'un ami avec la caméra (`getUserMedia` dans `components/social/AjouterAmis.tsx`).
           * `camera=()` faisait refuser la caméra par le navigateur, en silence — la panne même
           * que le commentaire de la géolocalisation ci-dessus voulait éviter.
           */
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), payment=(), usb=(), geolocation=(self)" },
          // Appliquée : voir le commentaire de `csp` ci-dessus.
          { key: "Content-Security-Policy", value: csp },
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
