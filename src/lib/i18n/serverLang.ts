import { cookies, headers } from "next/headers";
import { normLang, type Lang } from "./translations";

/**
 * Langue d'un athlète CONNECTÉ, lue à sa source : `profiles.preferred_language`.
 *
 * Le cookie ne suffit pas ici — il peut porter la langue du navigateur d'un visiteur
 * qui vient de se connecter, pas celle qu'il a choisie dans ses réglages. Le motif
 * était déjà recopié dans `races/page.tsx` ; quatre pages serveur de plus allaient le
 * recopier à leur tour, chacune avec sa propre chance de se tromper de repli.
 */
export async function getAccountLang(
  // Le client Supabase réel, pas une forme structurelle réécrite à la main : la version
  // manuscrite ne décrivait pas `PostgrestBuilder` (pas de `catch`/`finally`) et faisait
  // échouer le typage sur chaque page appelante.
  sb: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
): Promise<Lang> {
  try {
    const { data } = await sb.from("profiles").select("preferred_language").eq("id", userId).single();
    return normLang(data?.preferred_language ?? "fr");
  } catch {
    return "fr";
  }
}

// Langue pour les pages PUBLIQUES (visiteur non connecté) :
// cookie `pacevo_lang` posé par le sélecteur, sinon en-tête navigateur Accept-Language, sinon fr.
export async function getPublicLang(): Promise<Lang> {
  const cookieLang = (await cookies()).get("pacevo_lang")?.value;
  if (cookieLang) return normLang(cookieLang);
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.split("-")[0]?.trim();
  return normLang(first || "fr");
}
