import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { jourFrance } from "@/lib/races/jourFrance";
import { DATE_INCONNUE, slugCourse, type CoursePublique } from "@/lib/races/publique";
import { regionCanonique } from "@/lib/races/libelles";

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
    // ⚠️ POSTGREST PLAFONNE UNE RÉPONSE À 1 000 LIGNES, quel que soit le `limit`
    // demandé. Le premier sitemap déployé annonçait donc 1 022 adresses au lieu de
    // 10 700 : 90 % du catalogue restait invisible, sans le moindre message d'erreur.
    // On pagine. `range` exige un `order` explicite, sinon la pagination glisse.
    type Ligne = Pick<CoursePublique, "id" | "name" | "city" | "distance_km" | "region" | "date">;
    const PAS = 1000;
    const parcourir = async (datee: boolean): Promise<Ligne[]> => {
      const out: Ligne[] = [];
      for (let debut = 0; debut < MAX_SITEMAP; debut += PAS) {
        let q = sb.from("races").select("id,name,city,distance_km,region,date")
          .not("registration_url", "is", null)
          .order("date", { ascending: true }).order("id", { ascending: true })
          .range(debut, debut + PAS - 1);
        q = datee ? q.gte("date", auj).lt("date", DATE_INCONNUE) : q.gte("date", DATE_INCONNUE);
        const { data, error } = await q;
        if (error) break;
        const lot = (data ?? []) as Ligne[];
        out.push(...lot);
        if (lot.length < PAS) break;
      }
      return out;
    };
    const lignes = await parcourir(true);
    // ⚠️ LES ÉPREUVES SANS DATE ANNONCÉE ONT AUSSI UNE PAGE, avec une priorité MOINDRE.
    // Elles répondent à « où et comment courir le Trail des Galopins ? » — une question
    // posée toute l'année — mais elles renseignent moins qu'une épreuve datée, et le
    // dire au moteur vaut mieux que de les présenter comme équivalentes.
    const sansDate = await parcourir(false);
    // Une ligne sans nom ni ville produirait une adresse réduite à un identifiant :
    // inutile pour un lecteur comme pour un moteur.
    const exploitable = (c: Ligne) => String(c.name ?? "").trim().length >= 3 && String(c.city ?? "").trim();
    courses = [
      ...lignes.filter(exploitable).map((c) => ({
        url: `${BASE}/courses/${slugCourse(c)}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...sansDate.filter(exploitable).map((c) => ({
        url: `${BASE}/courses/${slugCourse(c)}`,
        lastModified: now,
        // Hebdomadaire : c'est précisément la page qui change le jour où l'organisateur
        // annonce sa date.
        changeFrequency: "weekly" as const,
        priority: 0.4,
      })),
    ];
    // ⚠️ IDENTIFIANT CANONIQUE. Déclarer les deux écritures de la même région
    // publierait deux adresses au contenu identique — du contenu dupliqué, que les
    // moteurs pénalisent des deux côtés.
    regions = [...new Set(lignes.map((c) => regionCanonique(c.region)).filter(Boolean))]
      .map((r) => ({
        // ⚠️ ADRESSE EN CHEMIN, PLUS EN PARAMÈTRE. `?region=` obligeait Next à rendre la
        // page à chaque visite (2,45 s de TTFB mesurés) ; l'ancienne forme redirige
        // désormais vers celle-ci, qui est engendrée une fois pour toutes.
        url: `${BASE}/courses/region/${r}`,
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
