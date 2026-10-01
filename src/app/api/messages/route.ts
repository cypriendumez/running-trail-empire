export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailEditeur } from "@/lib/admin/acces";
import { createAdminClient } from "@/lib/supabase/admin";
import { peutEcrire, type Lien } from "@/lib/social/amis";
import { envoyerEmail } from "@/lib/email/envoyer";
import { esc } from "@/lib/notify/gabarit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
type Attachment = { url: string; name: string; type: string };

const cleanAtt = (a: unknown): Attachment[] => Array.isArray(a)
  ? a.slice(0, 5).map((x) => ({ url: String((x as Attachment).url ?? "").slice(0, 600), name: String((x as Attachment).name ?? "fichier").slice(0, 120), type: String((x as Attachment).type ?? "").slice(0, 80) })).filter((x) => x.url)
  : [];

/**
 * Le début d'un message, pour l'objet de l'e-mail au coach.
 *
 * ⚠️ LA MESSAGERIE NE DEMANDE PLUS D'OBJET (30/09/2026, refonte « messages privés »).
 * Sans cet extrait, la boîte Outlook du coach alignait des « 📩 Marie t'a écrit » tous
 * identiques : il fallait ouvrir chaque e-mail pour savoir de quoi il parlait.
 */
function extrait(texte: string, max = 60): string {
  const t = texte.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const coupe = t.slice(0, max);
  const espace = coupe.lastIndexOf(" ");
  return `${(espace > max * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd()}…`;
}

// POST = envoyer un message (ou {action:"restore", id} pour restaurer).
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const b = await req.json() as { action?: string; id?: string; subject?: string; body?: string; attachments?: unknown; to?: string };

  if (b.action === "restore" && b.id) {
    const { data: row } = await admin.from("notifications").select("data").eq("id", b.id).eq("user_id", user.id).single();
    // ⚠️ « ok: true » ÉTAIT RENVOYÉ MÊME QUAND RIEN N'AVAIT ÉTÉ RESTAURÉ. Le filtre sur
    // `user_id` protège bien — un message d'autrui n'est jamais touché, vérifié — mais
    // la réponse affirmait le contraire de ce qui s'était passé. Un athlète dont la
    // restauration échoue (identifiant périmé, message déjà supprimé) lisait « c'est
    // fait » et cherchait ensuite son message dans une corbeille où il était resté.
    if (!row) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
    const { error: eMaj } = await admin.from("notifications")
      .update({ data: { ...(row.data as object), deleted: false } })
      .eq("id", b.id).eq("user_id", user.id);
    if (eMaj) return NextResponse.json({ error: "Restauration impossible" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const atts = cleanAtt(b.attachments);
  if (!b.body?.trim() && atts.length === 0) return NextResponse.json({ error: "Message vide" }, { status: 400 });

  // ── MESSAGE À UN AUTRE ATHLÈTE ─────────────────────────────────────────────
  //
  // ⚠️ LE DROIT D'ÉCRIRE SE VÉRIFIE ICI, PAS DANS LA LISTE DE CONTACTS. Masquer un
  // destinataire à l'écran n'empêche personne d'appeler cette route à la main avec
  // l'identifiant de son choix — et un athlète n'a pas à recevoir un message de
  // quelqu'un qu'il n'a pas choisi.
  const destinataire = String(b.to ?? "").trim();
  if (destinataire) {
    const { data: liens } = await admin.from("follows")
      .select("follower_id,following_id")
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);
    if (!peutEcrire(user.id, destinataire, (liens ?? []) as Lien[])) {
      // On ne dit pas si la personne existe : répondre « athlète inconnu » d'un côté et
      // « pas ami » de l'autre laisserait deviner qui est inscrit.
      return NextResponse.json({ error: "Vous ne pouvez pas écrire à cet athlète." }, { status: 403 });
    }
    // Les deux noms en une lecture. Celui du DESTINATAIRE est recopié dans le message :
    // la conversation doit rester nommée chez l'expéditeur même le jour où ils ne se
    // suivent plus — la liste d'amis, elle, ne le connaîtra plus.
    const { data: noms } = await admin.from("profiles").select("id, full_name").in("id", [user.id, destinataire]);
    const nomDe = (id: string) => String(noms?.find((p) => p.id === id)?.full_name ?? "").trim();
    const expediteur = nomDe(user.id) || "Un athlète";
    const contenu = {
      from: "athlete", from_id: user.id, from_name: expediteur, to_id: destinataire, to_name: nomDe(destinataire),
      subject: String(b.subject ?? "").slice(0, 120), body: String(b.body ?? "").slice(0, 2000),
      attachments: atts, ts: new Date().toISOString(),
    };
    // Deux lignes : celle du destinataire alimente sa boîte de réception, celle de
    // l'expéditeur son dossier « Envoyés ». Une seule ligne obligerait chaque lecture à
    // interroger les deux sens, et le dossier « Envoyés » resterait vide.
    const { data: lignes, error: eEnvoi } = await admin.from("notifications").insert([
      { user_id: destinataire, type: "athlete_message",
        title: `${expediteur} — ${(b.subject?.trim() || "Message").slice(0, 60)}`,
        body: (b.body || `📎 ${atts.length} pièce(s) jointe(s)`).slice(0, 200), data: contenu },
      { user_id: user.id, type: "athlete_message_sent",
        title: (b.subject?.trim() || "Message").slice(0, 80),
        body: (b.body || `📎 ${atts.length} pièce(s) jointe(s)`).slice(0, 200), data: contenu },
    ]).select("id, type");
    if (eEnvoi) return NextResponse.json({ error: eEnvoi.message }, { status: 500 });
    // ⚠️ L'IDENTIFIANT DE LA COPIE DE L'EXPÉDITEUR EST RENVOYÉ. Sans lui, l'écran rangeait
    // le message sous un identifiant provisoire : le supprimer aussitôt appelait DELETE
    // sur un identifiant que la base ne connaît pas — refusé, et le message revenait au
    // rechargement.
    const envoye = (lignes ?? []).find((l) => l.type === "athlete_message_sent");
    return NextResponse.json({ ok: true, a: destinataire, id: envoye?.id });
  }

  const { data: ins, error } = await admin.from("notifications").insert({
    user_id: user.id, type: "client_message",
    title: (b.subject?.trim() || "Message").slice(0, 80),
    body: (b.body || (atts.length ? `📎 ${atts.length} pièce(s) jointe(s)` : "")).slice(0, 200),
    data: { from: "client", subject: String(b.subject ?? "").slice(0, 120), body: String(b.body ?? "").slice(0, 2000), attachments: atts, ts: new Date().toISOString() },
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── CHAQUE MESSAGE AU COACH ARRIVE AUSSI DANS SA BOÎTE MAIL ─────────────────
  //
  // L'écran le promet à l'athlète (« tes messages arrivent aussi directement dans la
  // boîte mail de ton coach ») : cette promesse doit tenir pour TOUS les messages.
  //
  // ⚠️ RELU LE 30/09/2026, TROIS FUITES SILENCIEUSES :
  //  · l'envoi était conditionné à `RESEND_API_KEY` — une clé absente sautait l'e-mail
  //    SANS TRACE, alors que la porte unique (`envoyerEmail`) sait justement journaliser
  //    « clé absente » dans `error_logs`. On la laisse faire : l'éditeur le verra dans
  //    /admin au lieu de croire que personne ne lui écrit ;
  //  · l'adresse de réponse venait du seul profil — un profil illisible, et le coach
  //    recevait un e-mail auquel il ne pouvait pas répondre depuis Outlook. L'adresse de
  //    CONNEXION (`user.email`) fait foi, le profil n'en est qu'une copie ;
  //  · le nom de l'athlète partait dans le HTML sans échappement.
  //
  // Seul cas où rien ne part : aucun destinataire exploitable. `emailEditeur()` l'a déjà
  // signalé — écrire au mauvais ne se rattrape pas, ne pas écrire se voit et se répare.
  //
  // ⚠️ `await` INDISPENSABLE : sur Vercel, ce qui n'est pas attendu avant la réponse est
  // coupé avec la fonction. Et pas de `try/catch` : ni Supabase ni `envoyerEmail` ne
  // lèvent, ils RENDENT leurs erreurs — un `catch` ici n'attraperait rien.
  const COACH_EMAIL = emailEditeur();
  if (COACH_EMAIL) {
    const { data: prof, error: eProf } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
    if (eProf) console.error("[messages] profil illisible pour l'e-mail au coach :", eProf.message);
    const emailAthlete = String(user.email || prof?.email || "").trim();
    const name = String(prof?.full_name ?? "").trim() || emailAthlete || "Un client";
    const texte = String(b.body ?? "").trim();
    const objet = String(b.subject ?? "").trim() || extrait(texte) || "pièce jointe";
    const link = `${APP_URL}/admin/messages?client=${user.id}`;
    // Les pièces jointes sont CLIQUABLES : le coach les ouvre depuis Outlook, sans
    // passer par l'application. Seules les adresses web sont reprises en lien.
    const liens = atts.filter((a) => /^https?:\/\//i.test(a.url))
      .map((a) => `<a href="${esc(a.url)}" style="color:#047857">${esc(a.name)}</a>`).join("<br>");
    const attLine = atts.length ? `<p style="color:#666;font-size:13px">📎 ${atts.length} pièce(s) jointe(s)${liens ? `<br>${liens}` : ""}</p>` : "";
    const repondre = emailAthlete
      ? `<p style="color:#999;font-size:12px;margin-top:18px">Répondre à cet e-mail écrit directement à ${esc(emailAthlete)} — hors de l'application. Le bouton, lui, répond dans la messagerie Pacevo.</p>`
      : `<p style="color:#999;font-size:12px;margin-top:18px">Ce bouton ouvre directement la conversation dans ton espace coach.</p>`;
    await envoyerEmail("messages", {
      to: [COACH_EMAIL], reply_to: emailAthlete || undefined,
      subject: `📩 ${name} t'a écrit : ${objet}`,
      html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:540px;color:#18181b"><p style="font-size:15px"><b>${esc(name)}</b> t'a envoyé un message via Pacevo :</p><blockquote style="border-left:3px solid #10b981;margin:14px 0;padding:8px 16px;color:#333;background:#f6fdf9;border-radius:0 8px 8px 0;white-space:pre-wrap">${esc(texte) || "(pièce jointe)"}</blockquote>${attLine}<p style="margin-top:20px"><a href="${link}" style="background:#059669;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">Répondre à ${esc(name)} →</a></p>${repondre}</div>`,
    }, { userId: user.id, url: "/api/messages" });
  }
  return NextResponse.json({ ok: true, id: ins?.id });
}

// DELETE ?id= → mise à la corbeille (soft-delete).
export async function DELETE(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const admin = createAdminClient();
  // ⚠️ LES QUATRE TYPES (30/09/2026). Seuls les messages avec le coach étaient acceptés :
  // supprimer un message échangé avec un AMI répondait 404, l'écran l'effaçait quand
  // même, et il revenait au rechargement. Chacun ne supprime que SA copie (filtre
  // `user_id`) — l'autre athlète garde la sienne, comme dans toute messagerie privée.
  const { data: row } = await admin.from("notifications").select("data").eq("id", id).eq("user_id", user.id)
    .in("type", ["client_message", "coach_message", "athlete_message", "athlete_message_sent"]).single();
  // ⚠️ LE PENDANT DU DÉFAUT DÉJÀ CORRIGÉ SUR LA RESTAURATION. Là, une restauration qui
  // n'avait rien restauré répondait « c'est fait » ; ici, une suppression qui n'a rien
  // supprimé faisait de même — le message disparaissait de l'écran et revenait au
  // rechargement. Et l'athlète le supprimait peut-être pour de bonnes raisons.
  if (!row) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
  const { error } = await admin.from("notifications")
    .update({ data: { ...(row.data as object), deleted: true } }).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Suppression impossible" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
