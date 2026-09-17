export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, refusDe, avisDe, litAvis } from "@/lib/avis/store";
import { emailEditeur } from "@/lib/admin/acces";
import { envoyerEmail } from "@/lib/email/envoyer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * L'AVIS DE L'ATHLÈTE CONNECTÉ.
 *
 * GET  → son avis, s'il en a écrit un (pour préremplir le formulaire).
 * POST → écrit ou remplace le sien.
 *
 * ⚠️ UN COMPTE = UN AVIS. La contrainte n'est pas déclarative, elle vient de la façon
 * dont on écrit : on cherche la ligne existante et on la MET À JOUR. Sans ça, quelqu'un
 * pourrait poster cinquante fois et noyer la page.
 *
 * ⚠️ RIEN de ce que le client envoie n'atteint la base tel quel. La note est bornée, le
 * texte est validé et tronqué, l'auteur est calculé DEPUIS LE PROFIL côté serveur, et
 * `publie` est écrit EN DUR par le serveur — à vrai depuis le 17/09/2026, parce que les
 * deux filtres qui comptent (compte réel, grossièretés) tournent avant d'arriver ici.
 * Un client qui enverrait `{publie: false, auteur: "Kilian Jornet"}` obtiendrait
 * exactement le même résultat qu'un client honnête : la requête ne décide de rien.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await createAdminClient()
    .from("notifications").select("data")
    .eq("user_id", user.id).eq("type", TYPE_AVIS).maybeSingle();

  return NextResponse.json({ ok: true, avis: litAvis(data?.data ?? null) });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note, texte } = (await req.json().catch(() => ({}))) as { note?: unknown; texte?: unknown };
  const refus = refusDe(note, texte);
  if (refus) return NextResponse.json({ ok: false, error: refus }, { status: 400 });

  const admin = createAdminClient();
  // Le nom affiché vient du PROFIL, jamais de la requête.
  // `email` sert au `reply_to` de l'alerte : répondre à l'e-mail écrit à l'athlète.
  const { data: profil } = await admin.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();
  const avis = avisDe(note as number, texte as string, profil?.full_name as string | null);

  // ⚠️ L'ÉCRITURE ÉTAIT BIEN CONTRÔLÉE ; CETTE LECTURE, NON. En échec, elle passe pour
  // « pas encore d'avis » et on insère une seconde ligne — après quoi l'athlète ne peut
  // plus ni relire ni modifier le sien : les deux lectures de cette route (l. 29 et
  // l. 50) utilisent `maybeSingle()`, qui échoue dès qu'il y a deux lignes.
  const { data: existant, error: eLecture } = await admin
    .from("notifications").select("id")
    .eq("user_id", user.id).eq("type", TYPE_AVIS).maybeSingle();
  if (eLecture) return NextResponse.json({ ok: false, error: "Avis illisible pour le moment" }, { status: 500 });

  const erreur = existant?.id
    ? (await admin.from("notifications").update({ data: avis }).eq("id", existant.id)).error
    : (await admin.from("notifications").insert({
        user_id: user.id, type: TYPE_AVIS, title: "avis", body: "", data: avis,
      })).error;

  if (erreur) return NextResponse.json({ ok: false, error: erreur.message }, { status: 500 });

  /**
   * ── PRÉVENIR L'ÉDITEUR ─────────────────────────────────────────────────────
   *
   * ⚠️ RIEN NE SIGNALAIT UN NOUVEL AVIS. Ni e-mail, ni notification : il fallait penser à
   * ouvrir /admin/avis. Ce n'était pas grave tant que la publication attendait une
   * relecture — l'avis restait invisible. Depuis qu'il paraît IMMÉDIATEMENT, le silence
   * devient un vrai risque : un avis à dépublier peut rester en ligne des semaines parce
   * que personne n'a su qu'il existait.
   *
   * L'e-mail transporte l'avis en clair, donc une donnée personnelle : il ne part QUE
   * vers l'adresse de l'éditeur (`emailEditeur`), jamais vers une adresse en dur — voir
   * lib/admin/acces pour ce que ce repli a déjà coûté.
   *
   * `reply_to` = l'adresse de l'auteur : répondre à l'e-mail écrit à l'athlète.
   * Best-effort et enveloppé : l'avis est DÉJÀ enregistré, un échec d'envoi ne doit pas
   * transformer une publication réussie en erreur pour celui qui vient d'écrire.
   */
  const COACH_EMAIL = emailEditeur();
  if (process.env.RESEND_API_KEY && COACH_EMAIL) {
    try {
      const etoiles = "★".repeat(avis.note) + "☆".repeat(5 - avis.note);
      const action = existant?.id ? "a modifié son avis" : "a laissé un avis";
      await envoyerEmail("avis", {
        to: [COACH_EMAIL],
        reply_to: (profil as { email?: string } | null)?.email || undefined,
        subject: `${etoiles} ${avis.auteur} ${action}`,
        html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;color:#18181b">`
          + `<p style="font-size:15px"><b>${avis.auteur}</b> ${action} sur Pacevo :</p>`
          + `<p style="font-size:22px;letter-spacing:2px;color:#f59e0b;margin:4px 0">${etoiles} <span style="color:#71717a;font-size:14px;letter-spacing:0">${avis.note}/5</span></p>`
          + `<blockquote style="border-left:3px solid #10b981;margin:14px 0;padding:8px 16px;color:#333;background:#f6fdf9;border-radius:0 8px 8px 0">${avis.texte.replace(/</g, "&lt;")}</blockquote>`
          + `<p style="color:#71717a;font-size:13px">Il est <b>déjà en ligne</b> sur la page des avis. Tu peux le dépublier ou y répondre depuis ton espace coach.</p>`
          + `<p style="margin-top:20px"><a href="${APP_URL}/admin/avis" style="background:#059669;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">Ouvrir la modération →</a></p>`
          + `</div>`,
      }, { userId: user.id, url: "/api/avis" });
    } catch { /* best-effort : l'avis est enregistré ; l'échec d'envoi est journalisé */ }
  }

  return NextResponse.json({ ok: true, avis });
}
