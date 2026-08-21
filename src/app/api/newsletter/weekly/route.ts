export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lienDesinscription } from "@/lib/newsletter/token";

/**
 * LE RÉSUMÉ DU LUNDI MATIN.
 *
 * L'inscription à la newsletter existait depuis longtemps et n'envoyait RIEN : elle
 * enregistrait une adresse dans `newsletter_subscribers`, point. Pas d'accusé de
 * réception, pas d'envoi récurrent, et pas de désinscription — alors que le pied de
 * page promettait « désinscription en un clic ». Cette route est la moitié manquante.
 *
 * ── CE QU'ON ENVOIE, ET POURQUOI C'EST LÉGAL ─────────────────────────────────
 * UNIQUEMENT titre + source + lien. Aucun extrait, aucune image, aucun article recopié.
 * C'est déjà la règle de l'agrégateur du fil Communauté, et elle vaut d'autant plus par
 * e-mail : reproduire le contenu d'un éditeur dans un courrier commercial, c'est de la
 * contrefaçon, pas de la curation. Le clic va chez l'éditeur, qui garde son audience.
 *
 * ── TROIS GARDE-FOUS QUI COMPTENT ────────────────────────────────────────────
 * 1. `CRON_SECRET` obligatoire. Sans cela, n'importe qui déclencherait un envoi de masse
 *    en visitant une URL — le pire bouton du monde.
 * 2. On n'envoie QU'AUX abonnés `unsubscribed = false`. Jamais aux comptes qui ne se
 *    sont pas abonnés : avoir un compte n'est pas consentir à de la prospection.
 * 3. Chaque e-mail porte son lien de désinscription ET les en-têtes `List-Unsubscribe`,
 *    qui permettent au client de messagerie d'offrir le bouton natif. Un envoi sans cela
 *    finit en spam, quand il n'est pas simplement illégal.
 *
 * ── ET S'IL N'Y A RIEN À DIRE ────────────────────────────────────────────────
 * Une semaine sans actualité suffisante n'envoie RIEN plutôt qu'un e-mail creux. Le
 * meilleur moyen de perdre une liste est de la solliciter pour ne rien dire.
 */

type Item = { title: string; source: string; link: string; date: string; domain: string };

const MINIMUM_ARTICLES = 5;
const ARTICLES_MAX = 12;

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const CLE = process.env.RESEND_API_KEY;
  const FROM = process.env.RESEND_FROM;
  const BASE = process.env.NEXT_PUBLIC_APP_URL;
  if (!CLE || !FROM || !BASE) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY, RESEND_FROM ou NEXT_PUBLIC_APP_URL manquant" }, { status: 500 });
  }

  // ── 1. L'actualité, depuis l'agrégateur qui tourne déjà ────────────────────
  let items: Item[] = [];
  try {
    const r = await fetch(`${BASE}/api/community/news?cat=all`, { signal: AbortSignal.timeout(25000) });
    if (r.ok) items = ((await r.json()) as { items?: Item[] }).items ?? [];
  } catch { /* traité juste en dessous */ }

  // On ne garde que la semaine écoulée : un résumé hebdomadaire qui ressort les titres
  // du mois dernier se fait désabonner plus vite qu'il ne recrute.
  const ilYaUneSemaine = Date.now() - 7 * 24 * 3600 * 1000;
  const recents = items.filter((it) => {
    const t = new Date(it.date).getTime();
    return Number.isFinite(t) && t >= ilYaUneSemaine;
  });

  if (recents.length < MINIMUM_ARTICLES) {
    return NextResponse.json({
      ok: true, envoye: 0,
      raison: `seulement ${recents.length} article(s) de la semaine — on n'envoie pas un e-mail creux`,
    });
  }
  const retenus = recents.slice(0, ARTICLES_MAX);

  // ── 2. Les destinataires ───────────────────────────────────────────────────
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("newsletter_subscribers")
    .select("email")
    .eq("unsubscribed", false);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const destinataires = [...new Set((subs ?? []).map((s) => String(s.email ?? "").toLowerCase()).filter(Boolean))];
  if (!destinataires.length) return NextResponse.json({ ok: true, envoye: 0, raison: "aucun abonné" });

  // ── 3. Le corps ────────────────────────────────────────────────────────────
  const semaine = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const liste = retenus
    .map(
      (it) => `<li style="margin:0 0 1rem;line-height:1.55">
  <a href="${echapper(it.link)}" style="color:#18181b;text-decoration:none;font-weight:600">${echapper(it.title)}</a><br>
  <span style="font-size:.8rem;color:#a1a1aa">${echapper(it.source)}</span>
</li>`,
    )
    .join("");
  const listeTexte = retenus.map((it) => `• ${it.title}\n  ${it.source} — ${it.link}`).join("\n\n");

  // ── 4. L'envoi, un e-mail par personne ─────────────────────────────────────
  // PAS de `bcc` groupé ici, contrairement à la diffusion admin : chaque destinataire
  // doit recevoir SON lien de désinscription, qui dépend de son adresse. Un lot partagé
  // donnerait à tout le monde le lien du premier — et désinscrirait la mauvaise personne.
  let envoye = 0;
  for (const email of destinataires) {
    const lien = lienDesinscription(email, BASE);
    const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:36rem;margin:0 auto;padding:2rem 1.5rem;color:#18181b">
  <div style="font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#059669">Pacevo — semaine du ${semaine}</div>
  <h1 style="margin:1rem 0 .35rem;font-size:1.35rem;line-height:1.3">L'actualité running et trail</h1>
  <p style="margin:0 0 1.75rem;color:#71717a;font-size:.9rem;line-height:1.6">Les titres de la semaine. Le lien t'emmène chez l'éditeur : on ne recopie aucun article.</p>
  <ul style="margin:0;padding:0;list-style:none">${liste}</ul>
  <p style="margin:2rem 0 0;padding-top:1.25rem;border-top:1px solid #e4e4e7;font-size:.78rem;color:#a1a1aa;line-height:1.6">
    Tu reçois cet e-mail parce que tu t'es inscrit sur pacevo.<br>
    <a href="${lien}" style="color:#71717a">Se désinscrire en un clic</a>
  </p>
</div>`;
    const texte = `PACEVO — semaine du ${semaine}
L'actualité running et trail. Le lien t'emmène chez l'éditeur : on ne recopie aucun article.

${listeTexte}

—
Se désinscrire en un clic : ${lien}`;

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM, to: [email],
          subject: `Running & trail — la semaine du ${semaine}`,
          text: texte, html,
          headers: { "List-Unsubscribe": `<${lien}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) envoye++;
    } catch { /* un destinataire raté n'annule pas les autres */ }
  }

  return NextResponse.json({ ok: true, envoye, destinataires: destinataires.length, articles: retenus.length });
}
