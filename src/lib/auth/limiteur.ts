import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LIMITEUR DE DÉBIT — le prix de « cette adresse a déjà un compte ».
 *
 * Depuis que l'écran dit si une adresse est inscrite (décision du 11/10/2026, voir
 * `statut.ts`), un script pourrait essayer des milliers d'adresses pour dresser la liste
 * des inscrits. Chaque route qui répond sur un compte passe donc ici : au-delà de `max`
 * appels par fenêtre et par adresse IP, elle répond 429.
 *
 * ⚠️ HONNÊTEMENT : c'est une mémoire PAR INSTANCE de fonction. Vercel réutilise ses
 * instances (une rafale tombe surtout sur la même), mais plusieurs instances ont chacune
 * leur compteur. C'est un ralentisseur, pas un mur — le mur demanderait une table partagée.
 */
const APPELS = new Map<string, number[]>();
const CLES_MAX = 10_000;

/** Vrai si l'appel est permis (et le compte), faux s'il dépasse `max` sur `fenetreMs`. */
export function autoriser(cle: string, max: number, fenetreMs: number, maintenant = Date.now()): boolean {
  const recents = (APPELS.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
  if (recents.length >= max) {
    APPELS.set(cle, recents);
    return false;
  }
  recents.push(maintenant);
  APPELS.delete(cle); // ré-insérée en dernier : l'ordre du Map = du plus ancien au plus récent
  APPELS.set(cle, recents);
  // Mémoire bornée : on oublie les clés les plus anciennes, jamais au-delà de CLES_MAX.
  if (APPELS.size > CLES_MAX) {
    for (const k of [...APPELS.keys()].slice(0, APPELS.size - CLES_MAX)) APPELS.delete(k);
  }
  return true;
}

/** L'adresse IP du visiteur (première de `x-forwarded-for`, posée par Vercel). */
export function ipDe(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "inconnue";
}

/**
 * LIMITEUR PARTAGÉ — le MÊME compteur pour toutes les instances (constat d'audit M3).
 *
 * `autoriser` ci-dessus compte en mémoire, donc une fois PAR INSTANCE : sur Vercel, la limite
 * réelle vaut un multiple de la limite voulue. Ici, le compteur est en base : la fonction
 * atomique `rate_limit_hit` (migration 037) incrémente la fenêtre courante et dit si l'appel passe.
 *
 * ⚠️ REPLI SYSTÉMATIQUE SUR LA MÉMOIRE. Si la fonction n'existe pas encore (migration non passée)
 * ou si la base ne répond pas, on retombe sur `autoriser` : jamais pire qu'avant, jamais un
 * blocage d'utilisateurs légitimes à cause d'un incident de base.
 */
export async function autoriserPartage(
  admin: SupabaseClient, cle: string, max: number, fenetreMs: number, maintenant = Date.now(),
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("rate_limit_hit", { p_cle: cle, p_fenetre_ms: fenetreMs, p_max: max });
    if (!error && typeof data === "boolean") return data;
  } catch { /* store partagé indisponible : repli mémoire ci-dessous */ }
  return autoriser(cle, max, fenetreMs, maintenant);
}
