import { statutDepuisUtilisateur, type StatutCompte, type UtilisateurAuth } from "@/lib/auth/statut";

/**
 * CHERCHE LE COMPTE D'UNE ADRESSE — côté serveur uniquement (clé de service).
 *
 * supabase-js n'a pas de « trouver par e-mail » ; l'API d'administration de GoTrue, si :
 * `GET /auth/v1/admin/users?filter=…` (GoTrue v2.197.0, `FindUsersInAudience`). Le filtre
 * est un `LIKE '%…%'` sur l'e-mail OU le nom — il ramène donc aussi « xcyprien@… », et un
 * `_` dans l'adresse y vaut n'importe quel caractère : seule l'égalité EXACTE compte ici.
 * Lecture pure, sans effet de bord (contrairement à `generateLink`, qui crée ou régénère).
 *
 * Rend `null` si la recherche échoue (réseau, configuration) : l'appelant retombe alors sur
 * un message générique plutôt que d'affirmer « aucun compte » à tort.
 */
export async function statutCompte(adresse: string): Promise<StatutCompte | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cible = adresse.trim().toLowerCase();
  if (!base || !cle || !cible) return null;
  try {
    // Quelques pages au plus : avec l'adresse entière comme filtre, la première suffit
    // presque toujours.
    for (let page = 1; page <= 5; page++) {
      const r = await fetch(`${base}/auth/v1/admin/users?filter=${encodeURIComponent(cible)}&per_page=100&page=${page}`, {
        headers: { apikey: cle, Authorization: `Bearer ${cle}` },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) return null;
      const { users } = (await r.json()) as { users?: (UtilisateurAuth & { email?: string })[] };
      const liste = users ?? [];
      const trouve = liste.find((u) => String(u.email ?? "").toLowerCase() === cible);
      if (trouve) return statutDepuisUtilisateur(trouve);
      if (liste.length < 100) break;
    }
    return statutDepuisUtilisateur(null);
  } catch {
    return null;
  }
}
