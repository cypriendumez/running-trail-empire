export const dynamic = "force-dynamic";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { secretOAuth } from "@/lib/intervals/auth";
import {
  CHEMIN_COOKIE, COOKIE_ETAT, PAGE_RETOUR, codeManquantes, configurationOAuth, echangerCode,
  etatsEgaux, lireCookie,
} from "@/lib/intervals/oauth";

/**
 * GET /api/intervals/oauth/callback?code=…&state=… (ou ?error=access_denied)
 * L'adresse de retour déclarée chez intervals.icu : https://pacevo.fr/api/intervals/oauth/callback
 *
 * L'ORDRE COMPTE :
 *  1. le `state` reçu doit être celui du cookie posé au départ, AVANT tout échange de code.
 *     Sans ce contrôle, un tiers pourrait faire ouvrir à un athlète une adresse de retour
 *     portant SON propre code : le compte Pacevo de l'athlète serait relié au compte
 *     intervals.icu du tiers — ses séances partiraient sur la montre d'un inconnu, les
 *     sorties d'un inconnu entreraient dans son plan, et rien ne le signalerait ;
 *  2. le cookie est effacé à CHAQUE sortie : un `state` ne sert qu'une fois ;
 *  3. on revient toujours sur une page FIXE (`PAGE_RETOUR`), jamais sur une adresse lue
 *     dans l'URL (pas de redirection ouverte).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const lu = lireCookie(req.cookies.get(COOKIE_ETAT)?.value);

  const sortie = (statut: string, manque?: string) => {
    const page = new URL(PAGE_RETOUR, url.origin);
    page.searchParams.set("intervals", statut);
    if (manque) page.searchParams.set("manque", manque);
    if (lu?.retour === "inscription") page.searchParams.set("depuis", "inscription");
    const res = NextResponse.redirect(page, 303);
    res.cookies.set(COOKIE_ETAT, "", { path: CHEMIN_COOKIE, maxAge: 0 });
    return res;
  };

  // L'athlète a refusé sur l'écran d'intervals.icu : rien n'est enregistré.
  if (url.searchParams.get("error")) return sortie("refuse");

  const code = url.searchParams.get("code") ?? "";
  const etat = url.searchParams.get("state") ?? "";
  if (!lu || !code || !etatsEgaux(etat, lu.etat)) return sortie("invalide");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin), 303);

  const conf = configurationOAuth();
  if (!conf) return sortie("indisponible");

  const r = await echangerCode({ ...conf, code });
  if (!r.ok) {
    await journaliser(user.id, `échange du code refusé (${r.code}, HTTP ${r.status})`, { cause: r.code, status: r.status });
    return sortie(r.code === "indisponible" ? "indisponible" : "erreur");
  }

  // Même écriture que la clé API, avec la session de l'athlète (RLS) : le jeton prend la
  // place de la clé, précédé de « oauth: » (voir `lib/intervals/auth`).
  const { error } = await supabase
    .from("profiles")
    .update({ intervals_athlete_id: r.athleteId, intervals_api_key: secretOAuth(r.jeton) })
    .eq("id", user.id);
  if (error) {
    await journaliser(user.id, `jeton reçu mais non enregistré : ${error.message}`, { db: error.code ?? null });
    return sortie("erreur");
  }

  return r.manquantes.length ? sortie("partiel", codeManquantes(r.manquantes)) : sortie("ok");
}

/** Au journal de /admin › Bugs. Jamais le code, le secret ni le jeton : seulement la cause. */
async function journaliser(userId: string, message: string, meta: Record<string, unknown>): Promise<void> {
  try {
    const { error } = await createAdminClient().from("error_logs").insert({
      user_id: userId, source: "intervals-oauth", message: message.slice(0, 2000),
      url: "/api/intervals/oauth/callback", meta,
    });
    if (error) console.error("[intervals-oauth] journal non écrit :", error.message);
  } catch (e) {
    console.error("[intervals-oauth] journal non écrit :", e instanceof Error ? e.message : String(e));
  }
}
