export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lienDesinscription } from "@/lib/newsletter/token";
import { emailConfirmation } from "@/lib/newsletter/confirmation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/newsletter/subscribe { email }
// Inscription publique à la newsletter. Idempotent (upsert sur l'email). Lie au compte si connecté.
export async function POST(req: Request) {
  const { email, lang } = (await req.json().catch(() => ({}))) as { email?: string; lang?: string };
  const langue = ["fr", "en", "de", "es", "pt"].includes(String(lang)) ? String(lang) : "fr";
  const clean = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(clean) || clean.length > 200) {
    return NextResponse.json({ ok: false, error: "Adresse e-mail invalide" }, { status: 400 });
  }
  // Si la personne est connectée, on relie son compte (sinon abonné anonyme).
  let userId: string | null = null;
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* visiteur non connecté */ }

  // On regarde AVANT d'écrire si l'adresse est déjà connue : l'upsert est idempotent,
  // donc sans cette lecture on ne saurait pas distinguer une inscription d'un re-clic —
  // et on renverrait un « bienvenue » à quelqu'un d'abonné depuis six mois.
  let nouvelle = true;
  try {
    const admin = createAdminClient();
    const { data: existant } = await admin
      .from("newsletter_subscribers")
      .select("email, unsubscribed")
      .eq("email", clean)
      .maybeSingle();
    // Une personne qui s'était désinscrite puis se réinscrit reçoit bien la confirmation :
    // c'est un nouveau consentement, il mérite d'être tracé côté destinataire aussi.
    nouvelle = !existant || existant.unsubscribed === true;

    // ⚠️ On tente D'ABORD avec la langue. Si la colonne `lang` n'a pas encore été
    // ajoutée à la main (le schéma se modifie manuellement sur ce projet), l'écriture
    // échoue et on réécrit sans elle : une colonne en retard ne doit jamais empêcher
    // quelqu'un de s'abonner. La lettre repart alors en français, ce qui est le repli.
    const avecLangue = await admin.from("newsletter_subscribers").upsert(
      { email: clean, user_id: userId, unsubscribed: false, lang: langue },
      { onConflict: "email" },
    );
    if (avecLangue.error) {
      const sansLangue = await admin.from("newsletter_subscribers").upsert(
        { email: clean, user_id: userId, unsubscribed: false },
        { onConflict: "email" },
      );
      if (sansLangue.error) throw new Error(sansLangue.error.message);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Inscription impossible pour le moment" }, { status: 500 });
  }

  // ── ACCUSÉ DE RÉCEPTION ────────────────────────────────────────────────────
  // Il n'existait pas : on enregistrait l'adresse et la personne n'avait aucune preuve
  // que ça avait marché. C'est aussi la seule occasion de lui donner son lien de
  // désinscription AVANT le premier envoi — un abonné doit pouvoir partir sans attendre
  // de recevoir quoi que ce soit.
  //
  // BEST EFFORT à dessein : si Resend tombe, l'inscription reste valide. Faire échouer
  // l'inscription parce que l'e-mail de courtoisie n'est pas parti serait absurde.
  if (nouvelle) {
    const CLE = process.env.RESEND_API_KEY;
    const FROM = process.env.RESEND_FROM;
    const BASE = process.env.NEXT_PUBLIC_APP_URL;
    if (CLE && FROM && BASE) {
      const lien = lienDesinscription(clean, BASE);
      // ⚠️ L'accusé partait en FRANÇAIS pour tout le monde, alors que la ligne juste
      // au-dessus vient d'écrire la langue choisie en base. Le tout premier message
      // qu'une personne reçoit décide si elle fait confiance à la suite.
      const { objet, html, texte } = emailConfirmation(langue, BASE, lien);
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM, to: [clean],
            subject: objet,
            text: texte, html,
            headers: { "List-Unsubscribe": `<${lien}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          }),
          signal: AbortSignal.timeout(8000),
        });
      } catch { /* l'inscription vaut, l'e-mail est un bonus */ }
    }
  }

  return NextResponse.json({ ok: true });
}
