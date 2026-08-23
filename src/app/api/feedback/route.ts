export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailEditeur } from "@/lib/admin/acces";
import { createAdminClient } from "@/lib/supabase/admin";
import { coquilleEmail, ech } from "@/lib/newsletter/gabarit";

// POST /api/feedback {date, title, rpe (0-10), pain: string[], note}
// → enregistre le ressenti post-séance (lu par le coach, informe la perso IA).
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date, title, rpe, pain, note } = await req.json() as { date?: string; title?: string; rpe?: number; pain?: string[]; note?: string };
  if (date == null || rpe == null) return NextResponse.json({ error: "date et rpe requis" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: user.id,
    type: "session_feedback",
    title: "Ressenti séance",
    body: `RPE ${Math.round(Number(rpe))}/10`,
    data: {
      date: String(date).slice(0, 10),
      title: String(title ?? "").slice(0, 80),
      rpe: Math.max(0, Math.min(10, Math.round(Number(rpe)))),
      pain: Array.isArray(pain) ? pain.slice(0, 4).map((p) => String(p).slice(0, 24)) : [],
      note: String(note ?? "").slice(0, 500),
      ts: new Date().toISOString(),
    },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ── ALERTE AU COACH ────────────────────────────────────────────────────────
  // Elle partait en TEXTE BRUT, sans logo ni mise en forme : une ligne de puces au
  // milieu d'une boîte de réception. Or ce message a une fonction précise — il doit se
  // TRIER D'UN COUP D'ŒIL. Un coach ne lit pas ses alertes, il les balaie : ce qui
  // compte, c'est de distinguer en une seconde « séance normale » de « douleur signalée
  // à 9/10 ». D'où un bandeau dont la couleur porte le verdict, avant même le texte.
  //
  // ⚠️ Le seuil est posé ici, une seule fois : RPE ≥ 8 OU une douleur. En dessous, le
  // message reste sobre — un bandeau rouge permanent ne veut plus rien dire.
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const COACH_EMAIL = emailEditeur();
  const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://running-trail-empire-woad.vercel.app";
  // Sans destinataire exploitable, on n'envoie PAS plutôt que d'écrire au mauvais.
  if (RESEND_API_KEY && COACH_EMAIL) {
    try {
      const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", user.id).single();
      const name = (prof?.full_name as string) || (prof?.email as string) || "Un client";
      const r = Math.round(Number(rpe));
      const douleurs = Array.isArray(pain) ? pain.filter(Boolean).map(String) : [];
      const painTxt = douleurs.length ? douleurs.join(", ") : "aucune douleur signalée";
      const alerte = r >= 8 || douleurs.length > 0;
      const dateFr = new Date(String(date).slice(0, 10) + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

      const teinte = alerte
        ? { fond: "#fef2f2", bord: "#fecaca", texte: "#991b1b", pastille: "#dc2626" }
        : { fond: "#f0fdf4", bord: "#bbf7d0", texte: "#166534", pastille: "#16a34a" };

      const bloc = (etiquette: string, valeur: string, fort = false) => `
        <td style="padding:14px 16px;background:#fafafa;border:1px solid #f4f4f5;border-radius:12px;vertical-align:top">
          <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa">${ech(etiquette)}</div>
          <div style="margin-top:6px;font-size:${fort ? "22px" : "15px"};font-weight:${fort ? "800" : "600"};color:#18181b;line-height:1.35">${ech(valeur)}</div>
        </td>`;

      const corps = `
      <div style="display:inline-block;padding:5px 12px;border-radius:999px;background:${teinte.fond};border:1px solid ${teinte.bord};font-size:12px;font-weight:700;color:${teinte.texte}">
        <span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:${teinte.pastille};margin-right:6px"></span>${alerte ? "À REGARDER" : "RAS"}
      </div>

      <h1 style="margin:14px 0 4px;font-size:22px;line-height:1.3;color:#18181b;font-weight:800">${ech(name)}</h1>
      <p style="margin:0 0 20px;font-size:14px;color:#71717a">${ech(title ? String(title) : "Séance")} · ${ech(dateFr)}</p>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:8px 0">
        <tr>${bloc("Ressenti d'effort", `${r}/10`, true)}${bloc("Douleurs", painTxt)}</tr>
      </table>

      ${note ? `<div style="margin-top:16px;padding:14px 16px;border-left:3px solid #e4e4e7;background:#fafafa;border-radius:0 10px 10px 0">
        <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a1a1aa">Son mot</div>
        <p style="margin:6px 0 0;font-size:15px;line-height:1.65;color:#3f3f46;white-space:pre-line">${ech(String(note))}</p>
      </div>` : ""}

      <div style="margin-top:24px">
        <a href="${ech(BASE)}/admin" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 22px;border-radius:999px">Ouvrir l'espace coach</a>
      </div>`;

      const pied = `<p style="margin:0">Tu reçois ce message parce que ${ech(name)} vient d'enregistrer un ressenti dans Pacevo.<br>Réponds à cet e-mail pour lui écrire directement.</p>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Pacevo <onboarding@resend.dev>",
          to: [COACH_EMAIL],
          reply_to: (prof?.email as string) || undefined,
          // ⚠️ L'objet porte le verdict EN PREMIER : c'est la seule partie visible dans
          // une liste de messages, et c'est là que le tri se fait réellement.
          subject: `${alerte ? "⚠️" : "🏃"} ${name} · RPE ${r}/10${douleurs.length ? " · douleur" : ""}${title ? ` — ${title}` : ""}`,
          text: `${name} vient de noter sa séance${title ? ` « ${title}` + " »" : ""} :\n\n• Ressenti d'effort : ${r}/10\n• Douleurs : ${painTxt}\n${note ? `• Note : « ${note} »\n` : ""}\n→ ${BASE}/admin`,
          html: coquilleEmail({ base: BASE, corps, pied }),
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch { /* e-mail best-effort, le ressenti est déjà enregistré */ }
  }

  return NextResponse.json({ ok: true });
}
