export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lienDesinscription } from "@/lib/newsletter/token";
import { resumerArticles, traduireResumes, type ArticleResume } from "@/lib/newsletter/resume";
import { construireEmail, estLang, type Lang } from "@/lib/newsletter/email";

/**
 * LE RÉSUMÉ DU LUNDI MATIN.
 *
 * Première version : titre + source + lien, en français pour tout le monde. Juste sur le
 * plan du droit d'auteur, mais personne ne lit une liste de titres — et un abonné
 * allemand recevait du français.
 *
 * Cette version résume chaque article et parle la langue de l'abonné. Les deux ajouts
 * portent chacun un risque, traité explicitement :
 *
 * 1. RÉSUMER FABRIQUE DES FAITS. Le contrôle est dans `lib/newsletter/resume` : tout
 *    nombre du résumé doit exister dans le texte de l'article, sinon le résumé est jeté
 *    et l'entrée retombe sur son titre. C'est la faute exacte — « 2 300 coureurs »,
 *    « 94 % » — qui a été retirée du blog le 21/08/2026.
 * 2. TRADUIRE PEUT « ADAPTER » UN CHIFFRE. On traduit donc APRÈS le contrôle, et on
 *    revérifie la traduction contre son original.
 *
 * ── LA LANGUE ────────────────────────────────────────────────────────────────
 * Elle vient de la colonne `newsletter_subscribers.lang`. Si la colonne n'existe pas
 * encore (elle demande un ajout MANUEL, voir README de la route), la lecture échoue —
 * ⚠️ EN SILENCE avec PostgREST, `data` à null et l'erreur dans `error` — et on retombe
 * sur le français pour tout le monde. Le service ne s'arrête jamais pour ça.
 *
 * ── CE QUI N'A PAS CHANGÉ ────────────────────────────────────────────────────
 * `CRON_SECRET` obligatoire, uniquement les abonnés non désinscrits, un e-mail par
 * personne (le lien de désinscription dépend de l'adresse), en-têtes List-Unsubscribe,
 * et rien n'est envoyé si la semaine est trop pauvre.
 */

type Item = { title: string; source: string; link: string; date: string };

const MINIMUM_ARTICLES = 5;
const ARTICLES_MAX = 10;

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

  // ── 1. L'actualité de la semaine ───────────────────────────────────────────
  let items: Item[] = [];
  try {
    const r = await fetch(`${BASE}/api/community/news?cat=all`, { signal: AbortSignal.timeout(25000) });
    if (r.ok) items = ((await r.json()) as { items?: Item[] }).items ?? [];
  } catch { /* traité juste en dessous */ }

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

  // ── 2. Les destinataires, avec leur langue ─────────────────────────────────
  const admin = createAdminClient();
  let abonnes: { email: string; lang: Lang }[] = [];
  {
    const avecLangue = await admin
      .from("newsletter_subscribers")
      .select("email, lang")
      .eq("unsubscribed", false);
    if (avecLangue.error) {
      // ⚠️ La colonne `lang` n'existe pas encore : on relit SANS elle. Sans ce repli, un
      // schéma en retard couperait la lettre pour tout le monde.
      const sansLangue = await admin
        .from("newsletter_subscribers")
        .select("email")
        .eq("unsubscribed", false);
      if (sansLangue.error) return NextResponse.json({ ok: false, error: sansLangue.error.message }, { status: 500 });
      abonnes = (sansLangue.data ?? []).map((s) => ({ email: String(s.email ?? "").toLowerCase(), lang: "fr" as Lang }));
    } else {
      abonnes = (avecLangue.data ?? []).map((s) => ({
        email: String(s.email ?? "").toLowerCase(),
        lang: estLang(s.lang) ? s.lang : ("fr" as Lang),
      }));
    }
  }
  abonnes = abonnes.filter((a) => a.email);
  if (!abonnes.length) return NextResponse.json({ ok: true, envoye: 0, raison: "aucun abonné" });

  // ── 3. Les résumés, une seule fois, en français ────────────────────────────
  const { articles: base, diagnostic } = await resumerArticles(
    recents.slice(0, ARTICLES_MAX).map((it) => ({ title: it.title, source: it.source, link: it.link })),
  );

  // ── 4. Les traductions, une seule fois par langue RÉELLEMENT présente ──────
  // On ne traduit pas dans le vide : sans abonné allemand, pas d'appel allemand. Le
  // palier gratuit de Gemini se compte en dizaines de requêtes par jour pour TOUTE l'app.
  const languesPresentes = [...new Set(abonnes.map((a) => a.lang))].filter((l) => l !== "fr");
  const indexAvecResume = base.map((a, i) => ({ a, i })).filter((x) => x.a.resume);
  const parLangue = new Map<Lang, ArticleResume[]>([["fr", base]]);

  for (const lg of languesPresentes) {
    let traduits: ArticleResume[] = base.map((a) => ({ ...a, resume: null }));
    if (indexAvecResume.length) {
      const out = await traduireResumes(indexAvecResume.map((x) => x.a.resume as string), lg);
      // Traduction absente ou incohérente : cette langue reçoit les titres seuls plutôt
      // qu'un mélange de français et de sa propre langue.
      if (out) {
        const copie = base.map((a) => ({ ...a, resume: null as string | null }));
        indexAvecResume.forEach((x, n) => { copie[x.i].resume = out[n]; });
        traduits = copie;
      }
    }
    parLangue.set(lg, traduits);
  }

  // ── 5. L'envoi ─────────────────────────────────────────────────────────────
  let envoye = 0;
  const parLangueEnvoye: Record<string, number> = {};
  for (const { email, lang } of abonnes) {
    const articles = parLangue.get(lang) ?? base;
    const lien = lienDesinscription(email, BASE);
    const { objet, html, texte } = construireEmail(lang, articles, lien);
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM, to: [email], subject: objet, text: texte, html,
          headers: { "List-Unsubscribe": `<${lien}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) { envoye++; parLangueEnvoye[lang] = (parLangueEnvoye[lang] ?? 0) + 1; }
    } catch { /* un destinataire raté n'annule pas les autres */ }
  }

  return NextResponse.json({
    ok: true,
    envoye,
    destinataires: abonnes.length,
    articles: base.length,
    resumes: base.filter((a) => a.resume).length,
    // ⚠️ Sans ce champ, « resumes: 0 » ne dit pas s'il faut s'inquiéter. C'est ce
    // silence qui a laissé passer un budget de sortie trop bas pendant deux essais.
    diagnostic,
    langues: parLangueEnvoye,
  });
}
