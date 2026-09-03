import type { MetadataRoute } from "next";

// Domaine public réel. ⚠️ Définir NEXT_PUBLIC_APP_URL sur l'hébergeur au déploiement.
// On ignore explicitement localhost pour ne JAMAIS émettre d'URL locale en production.
const RAW = process.env.NEXT_PUBLIC_APP_URL;
const BASE = RAW && RAW.startsWith("http") && !RAW.includes("localhost")
  ? RAW
  // ⚠️ CE REPLI DOIT ÊTRE LE DOMAINE RÉELLEMENT SERVI. Il pointait vers
  // « running-trail-empire.vercel.app », qui répond 404 (vérifié le 03/09/2026) : sans
  // NEXT_PUBLIC_APP_URL, robots.txt et sitemap.xml annonçaient donc aux moteurs un
  // domaine inexistant, et tout le référencement partait dans le vide.
  : "https://running-trail-empire-woad.vercel.app";

// /robots.txt — autorise l'indexation des pages publiques, bloque l'espace privé.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/onboarding"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
