/**
 * LES LECTURES DU CATALOGUE PUBLIC, mises en cache.
 *
 * ⚠️ MESURÉ EN PRODUCTION LE 03/09/2026 : `/courses` répondait en 2,45 s (TTFB), contre
 * 0,41 s pour une fiche. La page lisait `searchParams`, ce qui la rend DYNAMIQUE dans
 * Next : `revalidate` ne s'y applique pas, et elle repayait à chaque visite les onze
 * allers-retours de pagination servant à construire la liste des régions. Sur les pages
 * qui vont recevoir tout le trafic de recherche, 2,5 s est un temps que Google mesure et
 * qu'un visiteur n'attend pas.
 *
 * Les lectures vivent donc ici, derrière un cache : le premier visiteur d'une heure les
 * paie, les suivants non.
 */
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { jourFrance } from "@/lib/races/jourFrance";
import { DATE_INCONNUE, type CoursePublique } from "@/lib/races/publique";
import { regionCanonique, nomRegion, ECRITURES_REGION } from "@/lib/races/libelles";

const CHAMPS = "id,name,city,department,region,date,distance_km,elevation_gain_m,type,terrain,registration_url,latitude,longitude,organization,description,is_itra_certified,itra_points";
const PAS = 1000;

/** Une heure : le catalogue bouge de quelques lignes par jour, pas par minute. */
const DUREE = 3600;

/**
 * Les régions qui comptent au moins une course à venir.
 *
 * ⚠️ ON PARCOURT TOUT, ON N'ÉCHANTILLONNE PAS. Un `limit(1000)` sans ordre rendait
 * 1 000 lignes arbitraires sur 10 700 : La Réunion, une seule course, disparaissait de
 * la navigation. Ces pages de région sont le maillage interne du catalogue.
 */
export const regionsAvecCourses = unstable_cache(
  async (): Promise<{ slug: string; nom: string }[]> => {
    const sb = createAdminClient();
    const auj = jourFrance();
    const brutes: string[] = [];
    for (let debut = 0; debut < 50000; debut += PAS) {
      const { data, error } = await sb.from("races").select("region")
        .gte("date", auj).lt("date", DATE_INCONNUE).not("region", "is", null)
        .order("id", { ascending: true }).range(debut, debut + PAS - 1);
      if (error) break;
      const lot = data ?? [];
      brutes.push(...lot.map((r) => String(r.region ?? "")));
      if (lot.length < PAS) break;
    }
    return [...new Set(brutes.map(regionCanonique).filter(Boolean))]
      .map((slug) => ({ slug, nom: nomRegion(slug) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  },
  ["regions-avec-courses"],
  { revalidate: DUREE, tags: ["catalogue"] },
);

/** Les prochaines épreuves, toutes régions ou pour une seule. */
export const prochainesCourses = unstable_cache(
  async (canonique: string, combien: number): Promise<CoursePublique[]> => {
    const sb = createAdminClient();
    let q = sb.from("races").select(CHAMPS)
      .gte("date", jourFrance()).lt("date", DATE_INCONNUE)
      .not("registration_url", "is", null)
      .order("date", { ascending: true }).limit(combien);
    if (canonique) {
      // ⚠️ TOUTES LES ÉCRITURES DE LA RÉGION. « provence-alpes-cote-azur » (33 courses)
      // et « provence-alpes-cote-d-azur » (1 088) désignent la même : chercher une seule
      // écriture rendait 33 courses pratiquement introuvables.
      q = q.in("region", ECRITURES_REGION[canonique] ?? [canonique]);
    }
    const { data } = await q;
    return (data ?? []) as CoursePublique[];
  },
  ["prochaines-courses"],
  { revalidate: DUREE, tags: ["catalogue"] },
);
