export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * L'ABONNEMENT VU DEPUIS LE COMPTE.
 *
 * Le lien de désinscription des e-mails existe, mais il suppose d'avoir un e-mail sous
 * la main. Quelqu'un qui veut simplement arrêter, sans retrouver un vieux message,
 * n'avait aucun moyen de le faire depuis l'app.
 *
 * ── ON APPARIE PAR E-MAIL, PAS PAR user_id ───────────────────────────────────
 * `newsletter_subscribers.user_id` n'est renseigné que si la personne était CONNECTÉE au
 * moment de s'abonner. Quelqu'un qui s'est abonné depuis la page d'accueil avant de
 * créer son compte a un `user_id` à null : chercher par identifiant ne trouverait rien,
 * et l'écran afficherait « non abonné » à quelqu'un qui reçoit la lettre chaque lundi.
 * L'e-mail du compte est le seul lien fiable entre les deux.
 *
 * On en profite pour rattacher le compte au passage : la ligne cesse d'être orpheline.
 */

async function utilisateur() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user?.email ? { id: user.id, email: user.email.toLowerCase() } : null;
}

/** GET → { abonne: boolean, connu: boolean } */
export async function GET() {
  const u = await utilisateur();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("newsletter_subscribers")
    .select("unsubscribed")
    .eq("email", u.email)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Jamais inscrit et inscrit-puis-parti sont deux états différents : le premier propose
  // de s'abonner, le second de revenir. L'écran doit pouvoir les distinguer.
  const connu = data !== null;
  return NextResponse.json({ ok: true, connu, abonne: connu && data.unsubscribed !== true });
}

/** POST { abonne: boolean } */
export async function POST(req: Request) {
  const u = await utilisateur();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { abonne } = (await req.json().catch(() => ({}))) as { abonne?: boolean };
  if (typeof abonne !== "boolean") {
    return NextResponse.json({ ok: false, error: "Paramètre « abonne » attendu" }, { status: 400 });
  }

  const admin = createAdminClient();
  // Un upsert plutôt qu'un update : quelqu'un qui n'a jamais été dans la table doit
  // pouvoir s'abonner depuis ses réglages, pas seulement depuis le pied de page.
  const { error } = await admin.from("newsletter_subscribers").upsert(
    { email: u.email, user_id: u.id, unsubscribed: !abonne },
    { onConflict: "email" },
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, abonne });
}
