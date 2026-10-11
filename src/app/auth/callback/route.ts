import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { aConsenti, champsConsentement, COOKIE_ACCORD } from "@/lib/auth/consentement";
import { cheminSur } from "@/lib/social/amisLiens";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = cheminSur(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user!.id)
        .single();
      const destination = profile?.onboarding_completed ? next : "/onboarding";

      // ⚠️ L'ACCORD AUX DONNÉES DE SANTÉ (constaté le 11/10/2026) : « Continuer avec Google »
      // sur la page de CONNEXION créait un compte neuf sans jamais montrer la case de
      // l'inscription. Lancé depuis l'INSCRIPTION, la case a été cochée juste avant (cookie
      // posé au clic) : on l'enregistre. Sinon, l'écran `/consentement` la demande.
      // Voir `lib/auth/consentement`.
      const jar = await cookies();
      const accordCoche = jar.get(COOKIE_ACCORD)?.value === "1";
      let reponse: NextResponse;
      if (user && !aConsenti(user.app_metadata)) {
        const enregistre = accordCoche
          && !(await createAdminClient().auth.admin.updateUserById(user.id, { app_metadata: champsConsentement("google") })).error;
        reponse = enregistre
          ? NextResponse.redirect(`${origin}${destination}`)
          : NextResponse.redirect(`${origin}/consentement?next=${encodeURIComponent(destination)}`);
      } else {
        reponse = NextResponse.redirect(`${origin}${destination}`);
      }
      if (accordCoche) reponse.cookies.delete(COOKIE_ACCORD);
      return reponse;
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
