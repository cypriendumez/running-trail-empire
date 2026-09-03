import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { jourFrance } from "@/lib/races/jourFrance";
import { DATE_INCONNUE, slugCourse, type CoursePublique } from "@/lib/races/publique";

/**
 * ⚠️ CONSTAT DU 03/09/2026 : ce fichier déclarait SEPT adresses. Les 17 113 courses
 * du catalogue vivaient sous `/dashboard/races`, derrière l'authentification et
 * derrière notre propre `Disallow: /dashboard/`. Le principal actif du site était
 * invisible pour un moteur de recherche.
 *
 * ⚠️ ON NE DÉCLARE QUE CE QUI EXISTE VRAIMENT. Le sitemap applique EXACTEMENT le même
 * filtre que les pages : date réelle (« 2099 » veut dire « inconnue », pas « en
 * 2099 »), à venir, et un lien d'inscription. Déclarer une adresse qui répond 404
 * fait perdre la confiance du moteur pour tout le domaine.
 */
export const revalidate = 3600;

// Le protocole plafonne un fichier à 50 000 adresses ; on reste très en dessous, mais
// la borne est écrite pour que personne ne la découvre le jour où le catalogue double.
const MAX_SITEMAP = 45000;

// ⚠️ Définir NEXT_PUBLIC_APP_URL sur l'hébergeur au déploiement (sinon repli ci-dessous).
const RAW = process.env.NEXT_PUBLIC_APP_URL;
const BASE = RAW && RAW.startsWith("http") && !RAW.includes("localhost")
  ? RAW
  // ⚠️ CE REPLI DOIT ÊTRE LE DOMAINE RÉELLEMENT SERVI. Il pointait vers
  // « running-trail-empire.vercel.app », qui répond 404 (vérifié le 03/09/2026) : sans
  // NEXT_PUBLIC_APP_URL, robots.txt et sitemap.xml annonçaient donc aux moteurs un
  // domaine inexistant, et tout le référencement partait dans le vide.
  : "https://running-trail-empire-woad.vercel.app";

// /sitemap.xml — pages PUBLIQUES indexables (hors espace connecté).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  const fixes: MetadataRoute.Sitemap = entries.map(e => ({
    url: `${BASE}${e.path}`,
    lastModified: now,
    changeFrequency: e.freq,
    priority: e.priority,
  }));

  // ── Les courses ────────────────────────────────────────────────────────────
  let courses: MetadataRoute.Sitemap = [];
  let regions: MetadataRoute.Sitemap = [];
  try {
    const sb = createAdminClient();
    const auj = jourFrance();
    const { data } = await sb.from("races")
      .select("id,name,city,distance_km,region,date")
      .gte("date", auj).lt("date", DATE_INCONNUE)
      .not("registration_url", "is", null)
      .order("date", { ascending: true })
      .limit(MAX_SITEMAP);
    const lignes = (data ?? []) as Pick<CoursePublique, "id" | "name" | "city" | "distance_km" | "region" | "date">[];
    courses = lignes
      // Une ligne sans nom ni ville produirait une adresse réduite à un identifiant :
      // inutile pour un lecteur comme pour un moteur.
      .filter((c) => String(c.name ?? "").trim().length >= 3 && String(c.city ?? "").trim())
      .map((c) => ({
        url: `${BASE}/courses/${slugCourse(c)}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }));
    regions = [...new Set(lignes.map((c) => String(c.region ?? "")).filter(Boolean))]
      .map((r) => ({
        url: `${BASE}/courses?region=${encodeURIComponent(r)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch {
    // ⚠️ UNE BASE INJOIGNABLE NE DOIT PAS RENDRE LE SITEMAP INVALIDE. On sert alors les
    // pages fixes seules : un sitemap amputé vaut mieux qu'une erreur 500, qui ferait
    // abandonner l'exploration du site entier.
  }

  return [
    ...fixes,
    { url: `${BASE}/courses`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
    ...regions,
    ...courses,
  ];
}
