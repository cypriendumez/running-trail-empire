export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lienDesinscription } from "@/lib/newsletter/token";
import { resumerArticles, traduireTextes, RESUMES_MAX, type ArticleResume } from "@/lib/newsletter/resume";
import { construireEmail, estLang, type Lang, type Section, type Course } from "@/lib/newsletter/email";
import { RUBRIQUES_LETTRE } from "@/lib/news/rubriques";

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

type Item = { title: string; source: string; link: string; date: string; texte?: string; langue?: "fr" | "en" };

const MINIMUM_ARTICLES = 5;
// Le plafond n'appartient pas à cette route : c'est celui du résumeur. Un plafond local
// aurait pu le dépasser sans erreur — et les articles en trop disparaissaient du rendu.

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

  // ── 1. L'actualité, PAR RUBRIQUE ───────────────────────────────────────────
  // Une seule liste à plat mélangeait un test de chaussure et un résultat d'ultra. Les
  // rubriques existent déjà dans l'agrégateur du fil Communauté : on les réutilise plutôt
  // que d'inventer un classement, qui serait forcément approximatif.
  const ilYaUneSemaine = Date.now() - 7 * 24 * 3600 * 1000;
  const recentsDe = async (cat: string): Promise<Item[]> => {
    try {
      const r = await fetch(`${BASE}/api/community/news?cat=${cat}&avecTexte=1`, { signal: AbortSignal.timeout(25000) });
      if (!r.ok) return [];
      const items = ((await r.json()) as { items?: Item[] }).items ?? [];
      return items.filter((it) => {
        const t = new Date(it.date).getTime();
        return Number.isFinite(t) && t >= ilYaUneSemaine;
      });
    } catch { return []; }
  };

  // Le sommaire vit dans `lib/news/rubriques` : la lettre ne nomme plus ses rubriques
  // à la main, elle parcourt la liste. Une rubrique inexistante y serait refusée par le
  // typage, plus seulement silencieusement remplacée par l'actualité générale.
  const parRubrique = await Promise.all(RUBRIQUES_LETTRE.map((r) => recentsDe(r.cat)));
  const recents = parRubrique[0];

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

  // ── 3. Le plan des rubriques, ÉTABLI AVANT LE RÉSUMÉ ──────────────────────
  // ⚠️ L'ordre comptait, et il était faux : on résumait les 10 premiers articles de
  // « all », puis on remplissait les rubriques dans ce vivier-là. Une rubrique dont les
  // articles ne figuraient pas dans ce top 10 ressortait VIDE — ce qui restait invisible
  // tant qu'il n'y avait que « Trail » et « Matériel », deux rubriques larges bien
  // représentées dans « all ». Nutrition et Élites ne l'auraient jamais été.
  // On choisit donc d'abord, on résume ensuite ce qui a été choisi.
  // Un même article peut appartenir à plusieurs rubriques : la première servie le garde.
  const pris = new Set<string>();
  const plan: { cle: Section["cle"]; liens: string[] }[] = [];
  const vivier: Item[] = [];
  for (const [n, { cle, max }] of RUBRIQUES_LETTRE.entries()) {
    const liens: string[] = [];
    for (const it of parRubrique[n]) {
      if (!it.link || pris.has(it.link) || vivier.length >= RESUMES_MAX) continue;
      pris.add(it.link);
      liens.push(it.link);
      vivier.push(it);
      if (liens.length >= max) break;
    }
    plan.push({ cle, liens });
  }

  // ── 3 bis. Les résumés, une seule fois, en français ────────────────────────
  const { articles: base, diagnostic, lisibles } = await resumerArticles(
    vivier.map((it) => ({ title: it.title, source: it.source, link: it.link, texte: it.texte })),
  );

  // ── 3 bis. Les courses à venir, depuis la BASE ─────────────────────────────
  // La seule rubrique qui ne passe par aucun modèle : nom, date, ville et distance sont
  // des faits stockés. On dédoublonne par nom+ville — une même épreuve existe en base
  // autant de fois qu'elle propose de distances, et lister « Le Bélier » quatre fois
  // remplirait la rubrique sans rien apprendre.
  let courses: Course[] = [];
  try {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const { data } = await admin
      .from("races")
      .select("name, date, city, distance_km, registration_url")
      .gte("date", aujourdhui)
      .order("date", { ascending: true })
      .limit(60);
    const vues = new Set<string>();
    for (const r of data ?? []) {
      const nom = String(r.name ?? "").trim();
      if (!nom) continue;
      const cle = `${nom.toLowerCase()}::${String(r.city ?? "").toLowerCase()}`;
      if (vues.has(cle)) continue;
      vues.add(cle);
      courses.push({
        nom,
        date: String(r.date),
        ville: r.city ? String(r.city) : null,
        distance: typeof r.distance_km === "number" ? r.distance_km : null,
        url: r.registration_url ? String(r.registration_url) : null,
      });
      if (courses.length >= 6) break;
    }
  } catch { courses = []; }

  // ── 4. La lettre dans LA LANGUE DE CHACUN ─────────────────────────────────
  // ⚠️ LE FRANÇAIS N'ÉTAIT PAS TRAITÉ, et c'est lui qui allait le plus mal. Cette carte
  // partait de `["fr", base]` : un abonné français recevait les articles TELS QUELS,
  // c'est-à-dire les titres anglais de LetsRun, iRunFar ou Marathon Handbook. Les
  // résumés, eux, étaient bien traduits — d'où une lettre moitié française moitié
  // anglaise. Huit des quatorze sources écrivent en anglais, et ce sont celles qui
  // alimentent « Élites » et « Nutrition ».
  //
  // Désormais : le titre de chaque article est traduit vers la langue de l'abonné dès
  // que la source n'écrit pas déjà dans cette langue.
  const langueDe = new Map(vivier.map((it) => [it.link, it.langue ?? "fr"]));
  const languesPresentes = [...new Set(abonnes.map((a) => a.lang))];
  const indexAvecResume = base.map((a, i) => ({ a, i })).filter((x) => x.a.resume);
  const parLangue = new Map<Lang, ArticleResume[]>();

  for (const lg of languesPresentes) {
    const copie = base.map((a) => ({ ...a }));

    // 4a. Les titres — pour TOUTE langue, y compris le français.
    const titresATraduire = base.map((a, i) => ({ a, i })).filter((x) => langueDe.get(x.a.link) !== lg);
    if (titresATraduire.length) {
      const out = await traduireTextes(titresATraduire.map((x) => x.a.title), lg);
      // Un titre non traduit reste dans sa langue d'origine : c'est moins bon, mais
      // c'est le titre exact de l'éditeur, et le lien mène chez lui.
      if (out) titresATraduire.forEach((x, n) => { if (out[n]) copie[x.i].title = out[n] as string; });
    }

    // 4b. Les résumés — écrits en français, à traduire pour les autres langues.
    if (lg !== "fr") {
      for (const c of copie) c.resume = null;
      if (indexAvecResume.length) {
        const out = await traduireTextes(indexAvecResume.map((x) => x.a.resume as string), lg);
        // `null` seulement si AUCUN lot n'a abouti : cette langue reçoit alors les titres
        // seuls, plutôt qu'un mélange de français et de sa propre langue. Sinon, chaque
        // résumé non traduit vaut `null` et son article part avec son titre — une phrase
        // perdue, plus la lettre entière.
        if (out) indexAvecResume.forEach((x, n) => { copie[x.i].resume = out[n]; });
      }
    }

    parLangue.set(lg, copie);
  }

  // ── 4 bis. Rendre les rubriques telles qu'elles ont été planifiées ────────
  // Le choix est déjà fait (étape 3) : ici on ne fait que retrouver chaque article avec
  // son résumé dans la langue voulue. Une rubrique dont aucun article n'a survécu au
  // contrôle sort vide, et le gabarit ne l'affiche pas.
  const rubriquesDe = (articles: ArticleResume[]): Section[] => {
    const parLien = new Map(articles.map((a) => [a.link, a]));
    return plan.map(({ cle, liens }) => ({
      cle,
      articles: liens.map((l) => parLien.get(l)).filter((a): a is ArticleResume => Boolean(a)),
    }));
  };

  // ── 5. L'envoi ─────────────────────────────────────────────────────────────
  let envoye = 0;
  const parLangueEnvoye: Record<string, number> = {};
  for (const { email, lang } of abonnes) {
    const articles = parLangue.get(lang) ?? base;
    const lien = lienDesinscription(email, BASE);
    const { objet, html, texte } = construireEmail(lang, rubriquesDe(articles), courses, lien, BASE);
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
    // Combien de pages ont pu être téléchargées : distingue un blocage éditeur
    // (l'hébergeur est refusé là où un navigateur passe) d'un rejet du contrôle.
    lisibles,
    langues: parLangueEnvoye,
  });
}
