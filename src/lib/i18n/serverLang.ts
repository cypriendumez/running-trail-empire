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
  sb: ClientServeur,
  userId: string,
): Promise<Lang> {
  return (await langueDuCompte(sb, userId)).lang;
}

type ClientServeur = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;

/**
 * La langue du compte, et SI LE PROFIL A PU ÊTRE LU (13/11/2026).
 *
 * Profil illisible ou langue absente : celle du NAVIGATEUR (`repli`), jamais « fr » par défaut
 * (12/11/2026 : un coureur anglophone recevait sa page en français dès que la lecture échouait).
 * `profilLu: false` = la lecture a ÉCHOUÉ : la langue est un repli de passage. Un texte d'IA écrit
 * dans cette langue ne se MÉMORISE pas — l'analyse de séance, dont le cache ignore la langue, l'aurait
 * resservi à jamais ; le bilan aurait écrasé le bon et repayé le modèle. Un profil lu sans langue
 * choisie (`profilLu: true`) est un état stable : la langue du navigateur y est la vraie réponse.
 * `repli` est injectable pour que le test EXÉCUTE la fonction hors d'une requête Next.
 */
export async function langueDuCompte(
  sb: ClientServeur,
  userId: string,
  repli: () => Promise<Lang> = getPublicLang,
): Promise<{ lang: Lang; profilLu: boolean }> {
  try {
    const { data, error } = await sb.from("profiles").select("preferred_language").eq("id", userId).maybeSingle();
    if (error) {
      console.error("[langue] profil illisible :", error.message);
      return { lang: await repli(), profilLu: false };
    }
    const pref = (data as { preferred_language?: unknown } | null)?.preferred_language;
    return { lang: typeof pref === "string" && pref.trim() ? normLang(pref) : await repli(), profilLu: true };
  } catch (e) {
    console.error("[langue] profil illisible :", e instanceof Error ? e.message : e);
    return { lang: await repli(), profilLu: false };
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

/**
 * La langue d'un écran du tableau de bord : celle du COMPTE quand elle a été lue, sinon celle du
 * navigateur (cookie `pacevo_lang`, puis Accept-Language) — jamais « fr » par défaut. Sert surtout
 * au bandeau de panne (12/11/2026) : c'est quand le profil est illisible qu'il s'affiche, et un
 * coureur anglophone le recevait alors en français.
 */
export async function langueEcran(prefCompte: unknown): Promise<Lang> {
  return typeof prefCompte === "string" && prefCompte.trim() ? normLang(prefCompte) : getPublicLang();
}
