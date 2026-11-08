import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { jourFrance } from "@/lib/races/jourFrance";
import { DATE_INCONNUE, slugCourse, type CoursePublique } from "@/lib/races/publique";
import { ARTICLES } from "@/app/blog/articles";
import { CATALOGUE } from "@/lib/shop/catalogue";
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
// ⚠️ DYNAMIQUE, SUR DES DONNÉES EN CACHE (29/09/2026). Avec `revalidate = 3600`, le
// sitemap servait encore l'état du BUILD six heures plus tard (sans les ~1 300 courses
// importées depuis) : la régénération ne se déclenchait pas en production, même une fois
// les pages lues en parallèle. Désormais chaque demande reconstruit le fichier à partir
// de la liste des adresses, gardée une heure dans le cache de données partagé
// (`unstable_cache`, le mécanisme qui sert déjà l'Actualité). Une demande de sitemap est
// rare (un moteur, une fois par jour) : le rendu à la demande ne coûte rien.
export const dynamic = "force-dynamic";
// Lecture de la base en parallèle ; 60 s (plafond Hobby) quand le cache est froid.
export const maxDuration = 60;

// Le protocole plafonne un fichier à 50 000 adresses ; on reste très en dessous, mais
// la borne est écrite pour que personne ne la découvre le jour où le catalogue double.
const MAX_SITEMAP = 45000;

// ⚠️ Définir NEXT_PUBLIC_APP_URL sur l'hébergeur au déploiement (sinon repli ci-dessous).
const RAW = process.env.NEXT_PUBLIC_APP_URL;
const BASE = RAW && RAW.startsWith("http") && !RAW.includes("localhost")
  ? RAW
  // ⚠️ CE REPLI DOIT ÊTRE LE DOMAINE RÉELLEMENT SERVI — pacevo.fr depuis le 13/09/2026
  // (l'adresse Vercel y redirige en 301). Il pointait autrefois vers
  // « running-trail-empire.vercel.app », qui répond 404 (vérifié le 03/09/2026) : sans
  // NEXT_PUBLIC_APP_URL, robots.txt et sitemap.xml annonçaient donc aux moteurs un
  // domaine inexistant, et tout le référencement partait dans le vide.
  : "https://pacevo.fr";

// /sitemap.xml — pages PUBLIQUES indexables (hors espace connecté).
/**
 * Les adresses de courses du sitemap, gardées UNE HEURE dans le cache de données partagé.
 * On ne garde que les identifiants d'adresse (~1 Mo), pas les lignes.
 */
const adressesCourses = unstable_cache(async (): Promise<{ datees: string[]; sansDate: string[]; regions: string[] }> => {
  const sb = createAdminClient();
  const auj = jourFrance();
  // ⚠️ POSTGREST PLAFONNE UNE RÉPONSE À 1 000 LIGNES, quel que soit le `limit`
  // demandé. Le premier sitemap déployé annonçait donc 1 022 adresses au lieu de
  // 10 700 : 90 % du catalogue restait invisible, sans le moindre message d'erreur.
  // On pagine. `range` exige un `order` explicite, sinon la pagination glisse.
  type Ligne = Pick<CoursePublique, "id" | "name" | "city" | "distance_km" | "region" | "date">;
  const PAS = 1000;
  const parcourir = async (datee: boolean): Promise<Ligne[]> => {
    const filtre = <T extends { gte: (c: string, v: string) => T; lt: (c: string, v: string) => T }>(q: T) =>
      datee ? q.gte("date", auj).lt("date", DATE_INCONNUE) : q.gte("date", DATE_INCONNUE);
    const { count, error: eCompte } = await filtre(sb.from("races").select("id", { count: "exact", head: true }).not("registration_url", "is", null));
    if (eCompte) throw new Error(eCompte.message);
    if (!count) return [];
    const debuts = Array.from({ length: Math.ceil(Math.min(count, MAX_SITEMAP) / PAS) }, (_, i) => i * PAS);
    const lots = await Promise.all(debuts.map(async (debut) => {
      const { data, error } = await filtre(sb.from("races").select("id,name,city,distance_km,region,date")
        .not("registration_url", "is", null)
        .order("date", { ascending: true }).order("id", { ascending: true })
        .range(debut, debut + PAS - 1));
      if (error) throw new Error(error.message);   // une page manquante ne passe pas en silence
      return (data ?? []) as Ligne[];
    }));
    return lots.flat();
  };
  const [lignes, sansDate] = await Promise.all([
    parcourir(true),
    // ⚠️ LES ÉPREUVES SANS DATE ANNONCÉE ONT AUSSI UNE PAGE, avec une priorité MOINDRE.
    // Elles répondent à « où et comment courir le Trail des Galopins ? » — une question
    // posée toute l'année — mais elles renseignent moins qu'une épreuve datée, et le
    // dire au moteur vaut mieux que de les présenter comme équivalentes.
    parcourir(false),
  ]);
  // Une ligne sans nom ni ville produirait une adresse réduite à un identifiant :
  // inutile pour un lecteur comme pour un moteur.
  const exploitable = (c: Ligne) => String(c.name ?? "").trim().length >= 3 && !!String(c.city ?? "").trim();
  return {
    datees: lignes.filter(exploitable).map((c) => slugCourse(c)),
    sansDate: sansDate.filter(exploitable).map((c) => slugCourse(c)),
    // ⚠️ IDENTIFIANT CANONIQUE. Déclarer les deux écritures de la même région
    // publierait deux adresses au contenu identique — du contenu dupliqué, que les
    // moteurs pénalisent des deux côtés.
    regions: [...new Set(lignes.map((c) => regionCanonique(c.region)).filter(Boolean))],
  };
}, ["sitemap-courses-v1"], { revalidate: 3600 });

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: { path: string; freq: MetadataRoute.Sitemap[number]["changeFrequency"]; priority: number }[] = [
    { path: "", freq: "weekly", priority: 1.0 },
    { path: "/blog", freq: "weekly", priority: 0.8 },
    // ⚠️ LES ARTICLES EUX-MÊMES, PAS SEULEMENT L'INDEX. Onze articles sourcés étaient en
    // ligne depuis le 21/08/2026 sans qu'aucune de leurs URL ne soit déclarée : les moteurs
    // ne les découvraient qu'en suivant les cartes. La liste vient de `ARTICLES`, donc un
    // article ajouté (à la main ou par la routine bimensuelle) est déclaré sans y penser.
    ...ARTICLES.map((a) => ({ path: `/blog/${a.slug}`, freq: "monthly" as const, priority: 0.6 })),
    { path: "/avis", freq: "weekly", priority: 0.7 },
    { path: "/contact", freq: "yearly", priority: 0.4 },
    { path: "/mentions-legales", freq: "yearly", priority: 0.3 },
    { path: "/confidentialite", freq: "yearly", priority: 0.3 },
    { path: "/terms", freq: "yearly", priority: 0.3 },
    { path: "/robot", freq: "yearly", priority: 0.2 },
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
    const a = await adressesCourses();
    courses = [
      ...a.datees.map((slug) => ({
        url: `${BASE}/courses/${slug}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...a.sansDate.map((slug) => ({
        url: `${BASE}/courses/${slug}`,
        lastModified: now,
        // Hebdomadaire : c'est précisément la page qui change le jour où l'organisateur
        // annonce sa date.
        changeFrequency: "weekly" as const,
        priority: 0.4,
      })),
    ];
    regions = a.regions.map((r) => ({
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
    // abandonner l'exploration du site entier. (Une erreur n'est pas mise en cache : la
    // demande suivante réessaie.)
  }

  // ── LE COMPARATEUR D'ÉQUIPEMENT ────────────────────────────────────────────
  // Il vivait derrière la connexion : aucune de ses fiches n'était atteignable depuis un
  // moteur de recherche, alors qu'elles répondent à « drop de la Clifton 10 » et qu'elles
  // ne coûtent rien à servir. Le catalogue est un FICHIER : cette liste ne peut pas
  // échouer, contrairement aux courses qui dépendent de la base.
  const chaussures = CATALOGUE.map((m) => ({
    url: `${BASE}/chaussures/${m.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    ...fixes,
    { url: `${BASE}/courses`, lastModified: now, changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${BASE}/chaussures`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 },
    ...regions,
    ...courses,
    ...chaussures,
  ];
}
