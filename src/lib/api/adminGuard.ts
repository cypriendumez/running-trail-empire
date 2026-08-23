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
//  Deux clés acceptées : le secret d'administration (appel machine ou manuel) ou le
//  compte administrateur connecté (appel depuis l'interface).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "@/lib/supabase/server";
import { estAdmin } from "@/lib/admin/acces";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

/** `null` si l'appel est autorisé, sinon le motif du refus. */
export async function denyIfNotAdmin(req: Request): Promise<string | null> {
  if (ADMIN_SECRET && req.headers.get("x-admin-secret") === ADMIN_SECRET) return null;
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (estAdmin(user?.email)) return null;
  } catch { /* pas de session exploitable : refus */ }
  return "Forbidden";
}

/**
 * Garde plus souple : un compte CONNECTÉ suffit.
 *
 * Le géocodage est déclenché par la carte des courses pour compléter les 2 % de fiches
 * sans coordonnées — c'est une réparation utile, qu'on ne veut pas réserver à
 * l'administrateur. Mais elle consomme un service externe : la laisser ouverte aux
 * requêtes ANONYMES revenait à offrir notre quota au premier venu.
 */
export async function denyIfAnonymous(): Promise<string | null> {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    return user ? null : "Unauthorized";
  } catch { return "Unauthorized"; }
}
