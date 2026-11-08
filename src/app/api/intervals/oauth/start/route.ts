export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  CHEMIN_COOKIE, COOKIE_ETAT, DUREE_COOKIE_S, PAGE_RETOUR, adresseRetour, configurationOAuth,
  nouvelEtat, urlAutorisation, valeurCookie, type Retour,
} from "@/lib/intervals/oauth";

/**
 * GET /api/intervals/oauth/start?retour=sync|inscription
 * Le bouton « Autoriser Pacevo sur intervals.icu » : on pose un `state` dans un cookie
 * httpOnly, puis on envoie l'athlète sur l'écran d'autorisation d'intervals.icu.
 *
 * ⚠️ Le cookie est en `SameSite=Lax`, pas `Strict` : le retour arrive D'intervals.icu, un
 * autre site, et un cookie `Strict` ne serait pas envoyé avec lui — chaque connexion
 * échouerait sur un « state » introuvable.
 *
 * ⚠️ L'adresse de retour se calcule sur l'ORIGINE de la requête : c'est sur ce domaine que
 * le cookie est posé, donc sur lui qu'il doit revenir. En production, c'est
 * https://pacevo.fr — l'adresse déclarée chez intervals.icu (les autres domaines y sont
 * redirigés en 308 par `next.config.ts`).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const retour: Retour = url.searchParams.get("retour") === "inscription" ? "inscription" : "sync";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin), 303);

  const conf = configurationOAuth();
  if (!conf) {
    const page = new URL(PAGE_RETOUR, url.origin);
    page.searchParams.set("intervals", "indisponible");
    return NextResponse.redirect(page, 303);
  }

  const etat = nouvelEtat();
  const res = NextResponse.redirect(
    urlAutorisation({ clientId: conf.clientId, redirectUri: adresseRetour(url.origin), etat }),
    303,
  );
  res.cookies.set(COOKIE_ETAT, valeurCookie(etat, retour), {
    httpOnly: true,
    secure: url.protocol === "https:",
    sameSite: "lax",
    path: CHEMIN_COOKIE,
    maxAge: DUREE_COOKIE_S,
  });
  return res;
}
