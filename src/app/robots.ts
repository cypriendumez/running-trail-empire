import type { MetadataRoute } from "next";

// Domaine public réel. ⚠️ Définir NEXT_PUBLIC_APP_URL sur l'hébergeur au déploiement.
// On ignore explicitement localhost pour ne JAMAIS émettre d'URL locale en production.
const RAW = process.env.NEXT_PUBLIC_APP_URL;
const BASE = RAW && RAW.startsWith("http") && !RAW.includes("localhost")
  ? RAW
  : "https://running-trail-empire.vercel.app";

// /robots.txt — autorise l'indexation des pages publiques, bloque l'espace privé.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/admin/", "/api/", "/onboarding", "/preview-x", "/preview-msg"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
