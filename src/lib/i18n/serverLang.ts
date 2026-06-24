import { cookies, headers } from "next/headers";
import { normLang, type Lang } from "./translations";

// Langue pour les pages PUBLIQUES (visiteur non connecté) :
// cookie `pacevo_lang` posé par le sélecteur, sinon en-tête navigateur Accept-Language, sinon fr.
export async function getPublicLang(): Promise<Lang> {
  const cookieLang = (await cookies()).get("pacevo_lang")?.value;
  if (cookieLang) return normLang(cookieLang);
  const accept = (await headers()).get("accept-language") ?? "";
  const first = accept.split(",")[0]?.split("-")[0]?.trim();
  return normLang(first || "fr");
}
