// ─────────────────────────────────────────────────────────────────────────────
//  GARDE DES ROUTES DE MAINTENANCE
//
//  Les routes de maintenance du catalogue de courses (import, dédoublonnage,
//  géocodage) utilisent la clé service_role et ÉCRIVENT — dont une qui SUPPRIME des
//  lignes. Aucune ne vérifiait quoi que ce soit : constaté en production, elles
//  répondaient 200 à une requête anonyme. Sur 17 027 courses, un simple POST suffisait
//  à déclencher un dédoublonnage, une réécriture complète, ou à épuiser le quota de
//  géocodage.
//
//  Une seule clé : le compte administrateur connecté ET son appareil de confiance,
//  comme le panneau. ⚠️ Le secret partagé `x-admin-secret` ouvrait aussi ces routes,
//  SANS second facteur — dont `races/dedup`, qui supprime des lignes. Aucun script,
//  workflow ni écran ne l'envoyait plus : retiré le 08/11/2026. La synchro planifiée
//  du catalogue (`races/sync`) garde son propre `CRON_SECRET`.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase/server";
import { estAdmin, appareilRefuse } from "@/lib/admin/acces";

/** `null` si l'appel est autorisé, sinon le motif du refus. */
// `req` reste dans la signature : les routes l'appellent ainsi, et un futur contrôle
// (origine, en-tête) se lira là.
export async function denyIfNotAdmin(_req: Request): Promise<string | null> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    // Le compte administrateur ET son appareil de confiance, comme le panneau (08/11/2026).
    if (user && estAdmin(user.email) && !(await appareilRefuse(user.id))) return null;
  } catch { /* pas de session exploitable : refus */ }
  return "Forbidden";
}

/**
 * Garde plus souple : un compte CONNECTÉ suffit.
 *
 * Sert aux routes qu'un athlète déclenche lui-même et qui consomment un service externe
 * (tracés Overpass du Trail Builder) : les laisser ouvertes aux requêtes ANONYMES
 * revenait à offrir notre quota au premier venu.
 *
 * ⚠️ Le géocodage du catalogue l'utilisait aussi, via un bouton « Géolocaliser » de la
 * carte des courses que les athlètes prenaient pour « me localiser ». Il est passé sous
 * `denyIfNotAdmin` le 28/09/2026 : c'est une maintenance, pas une fonction d'athlète.
 */
export async function denyIfAnonymous(): Promise<string | null> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    return user ? null : "Unauthorized";
  } catch { return "Unauthorized"; }
}
