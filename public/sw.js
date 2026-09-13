/*
 * SERVICE WORKER PACEVO — PRUDENT PAR CONCEPTION.
 *
 * ⚠️ UN SERVICE WORKER MAL RÉGLÉ EST PIRE QUE PAS DE SERVICE WORKER. S'il met en cache une
 * page qui dépend de la session, il peut servir les données d'un athlète à un autre, ou une
 * session périmée qui « déconnecte » sans raison. Ce fichier ne met donc JAMAIS en cache :
 *   - les routes /api/ et /auth/ (réponses liées à la session, à l'utilisateur, aux jetons) ;
 *   - les requêtes vers d'autres domaines (Supabase, Resend, tuiles de carte…) ;
 *   - les écritures (tout ce qui n'est pas GET).
 *
 * Stratégie :
 *   - Navigations (pages HTML) → RÉSEAU D'ABORD : tant qu'on est en ligne, jamais de page
 *     périmée ; hors-ligne, on sert la page /offline.
 *   - Assets immuables (hachés par Next dans /_next/static/, icônes, polices, images) →
 *     CACHE D'ABORD : ils ne changent jamais sous une même URL.
 *   - Tout le reste → on ne s'en mêle pas (réseau normal).
 *
 * Le nom de cache est versionné ; à chaque activation, les anciens caches sont supprimés,
 * donc un mauvais cache ne peut pas rester coincé après une mise à jour.
 */
const VERSION = "pacevo-v1";
const CACHE = `${VERSION}-statique`;
const PAGE_HORS_LIGNE = "/offline";

self.addEventListener("install", (e) => {
  // On précharge la page hors-ligne. `catch` : si le réseau tousse pendant l'installation,
  // le SW s'installe quand même (une page hors-ligne manquante vaut mieux qu'un SW mort).
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.add(PAGE_HORS_LIGNE).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  // Ménage : on jette tout cache d'une version précédente, puis on prend la main.
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const IMMUABLE = /\.(?:png|jpe?g|svg|webp|gif|ico|woff2?|css|js)$/;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // jamais les écritures
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jamais les tiers

  // ⚠️ JAMAIS l'auth ni les API : ces réponses dépendent de la session.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  // Navigations : réseau d'abord, /offline en dernier recours.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(async () =>
        (await caches.match(PAGE_HORS_LIGNE)) ||
        new Response("Hors-ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }),
      ),
    );
    return;
  }

  // Assets immuables : cache d'abord, réseau en secours (et on garnit le cache au passage).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || IMMUABLE.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        }).catch(() => hit),
      ),
    );
    return;
  }
  // Tout le reste : réseau normal.
});
