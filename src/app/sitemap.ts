import type { MetadataRoute } from "next";

// ⚠️ Définir NEXT_PUBLIC_APP_URL sur l'hébergeur au déploiement (sinon repli ci-dessous).
const RAW = process.env.NEXT_PUBLIC_APP_URL;
const BASE = RAW && RAW.startsWith("http") && !RAW.includes("localhost")
  ? RAW
  : "https://running-trail-empire.vercel.app";

// /sitemap.xml — pages PUBLIQUES indexables (hors espace connecté).
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: { path: string; freq: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: "", freq: "weekly", priority: 1.0 },
    { path: "/blog", freq: "weekly", priority: 0.8 },
    { path: "/avis", freq: "weekly", priority: 0.7 },
    { path: "/contact", freq: "yearly", priority: 0.4 },
    { path: "/mentions-legales", freq: "yearly", priority: 0.3 },
    { path: "/confidentialite", freq: "yearly", priority: 0.3 },
    { path: "/terms", freq: "yearly", priority: 0.3 },
  ];
  return entries.map(e => ({
    url: `${BASE}${e.path}`,
    lastModified: now,
    changeFrequency: e.freq,
    priority: e.priority,
  }));
}
