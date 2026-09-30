/**
 * « TES RÉSULTATS SONT EN LIGNE » — l'e-mail envoyé quelques jours après la course visée.
 *
 * Demandé par Cyprien le 30/09/2026 : « quand une personne a mis un objectif de course, et
 * donc qu'elle fait la course, envoie-lui un mail avec le lien qui envoie directement aux
 * résultats — quelques jours juste après la course ».
 *
 * Les règles, dans l'ordre où elles s'appliquent :
 *   1. CONSENTEMENT : rien ne part si `profiles.notif_coach` est faux (faux par défaut) —
 *      la même règle que les autres e-mails à l'athlète, vérifiée AVANT toute construction.
 *   2. FENÊTRE : de J+2 à J+10 après la date de l'objectif. Avant, les chronométreurs n'ont
 *      souvent rien publié ; après, l'e-mail ne veut plus rien dire.
 *   3. LE LIEN : le classement de CETTE édition (année de la course) quand on le connaît —
 *      c'est tout l'intérêt. Sans lui, on attend ; à partir de J+6, on envoie une recherche
 *      NOMMÉE comme telle (« Chercher le classement »), jamais un faux lien direct.
 *   4. UNE SEULE FOIS par course : l'envoi est mémorisé (`resultats_course_envoye`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/i18n/translations";
import { coquille, carte, bouton, esc } from "@/lib/notify/gabarit";
import { envoyerEmail } from "@/lib/email/envoyer";
import { nomCanonique } from "@/lib/races/groupes";

export const TYPE_ENVOI = "resultats_course_envoye";
export const JOURS_MIN = 2, JOURS_MAX = 10, JOURS_RECHERCHE = 6;

export type Objectif = { race?: unknown; raceDate?: unknown; distanceKm?: unknown } | null | undefined;
export type LigneCourse = { name: string; date: string; distance_km: number | null; resultats_url?: string | null; resultats_annee?: number | null; city?: string | null };
export type Lien = { url: string; direct: boolean };

const jours = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

/** La course visée, si elle a eu lieu il y a entre `JOURS_MIN` et `JOURS_MAX` jours ; sinon `null`. */
export function courseTerminee(o: Objectif, aujourdhui: string): { nom: string; date: string; distanceKm: number | null; ilYa: number } | null {
  const nom = String(o?.race ?? "").trim(), date = String(o?.raceDate ?? "").slice(0, 10);
  if (!nom || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ilYa = jours(aujourdhui, date);
  if (ilYa < JOURS_MIN || ilYa > JOURS_MAX) return null;
  const km = Number(o?.distanceKm);
  return { nom, date, distanceKm: Number.isFinite(km) && km > 0 ? km : null, ilYa };
}

/**
 * La ligne du catalogue qui EST cette course : même nom (à l'article et à la typographie
 * près), même date à un jour près, puis la distance la plus proche. Jamais un autre nom.
 */
export function ligneDeLaCourse(lignes: readonly LigneCourse[], c: { nom: string; date: string; distanceKm: number | null }): LigneCourse | null {
  const nom = nomCanonique(c.nom);
  const candidates = lignes.filter((l) => nomCanonique(l.name) === nom && Math.abs(jours(String(l.date).slice(0, 10), c.date)) <= 1);
  if (!candidates.length) return null;
  const ecart = (l: LigneCourse) => (c.distanceKm && l.distance_km ? Math.abs(Number(l.distance_km) - c.distanceKm) : 0);
  // À distance égale, celle qui A un classement : c'est elle qu'on veut envoyer.
  return [...candidates].sort((a, b) => ecart(a) - ecart(b) || Number(!!b.resultats_url) - Number(!!a.resultats_url))[0];
}

/**
 * Le lien à envoyer, ou `null` pour attendre : le classement de l'édition courue (l'année de
 * la course) ; à défaut, dès `JOURS_RECHERCHE` jours, une recherche nommée comme telle.
 */
export function lienAEnvoyer(l: LigneCourse | null, c: { nom: string; date: string; ilYa: number }): Lien | null {
  const annee = Number(c.date.slice(0, 4));
  if (l?.resultats_url && /^https?:\/\//.test(l.resultats_url) && l.resultats_annee === annee) return { url: l.resultats_url, direct: true };
  if (c.ilYa < JOURS_RECHERCHE) return null;
  const q = `classement ${c.nom}${l?.city ? ` ${l.city}` : ""} ${annee}`;
  return { url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, direct: false };
}

const T: Record<Lang, {
  sujet: (n: string) => string; apercu: string; titre: (n: string) => string; intro: (d: string) => string;
  direct: string; recherche: string; noteRecherche: string; ressenti: string; cta2: string; footer: string; manage: string;
}> = {
  fr: {
    sujet: (n) => `Tes résultats : ${n}`, apercu: "Le classement de ta course est en ligne.",
    titre: (n) => `Bravo pour ${n} !`, intro: (d) => `Ta course du ${d} est derrière toi — voici le classement.`,
    direct: "Voir mon classement", recherche: "Chercher le classement",
    noteRecherche: "L'organisateur n'a pas encore publié de lien que nous connaissons : ce bouton lance une recherche.",
    ressenti: "Et dis à ton coach comment ça s'est passé : il ajuste la suite de ton plan.", cta2: "Ouvrir Pacevo",
    footer: "Tu reçois cet e-mail parce que les notifications du coach sont activées.", manage: "Gérer mes notifications",
  },
  en: {
    sujet: (n) => `Your results: ${n}`, apercu: "Your race results are online.",
    titre: (n) => `Well done on ${n}!`, intro: (d) => `Your race on ${d} is behind you — here are the results.`,
    direct: "See my results", recherche: "Search for the results",
    noteRecherche: "The organiser hasn't published a link we know of yet: this button runs a search.",
    ressenti: "And tell your coach how it went: they adjust the rest of your plan.", cta2: "Open Pacevo",
    footer: "You receive this email because coach notifications are on.", manage: "Manage my notifications",
  },
  de: {
    sujet: (n) => `Deine Ergebnisse: ${n}`, apercu: "Die Ergebnisse deines Rennens sind online.",
    titre: (n) => `Glückwunsch zu ${n}!`, intro: (d) => `Dein Rennen am ${d} liegt hinter dir — hier sind die Ergebnisse.`,
    direct: "Meine Ergebnisse ansehen", recherche: "Ergebnisse suchen",
    noteRecherche: "Der Veranstalter hat noch keinen uns bekannten Link veröffentlicht: Dieser Button startet eine Suche.",
    ressenti: "Und sag deinem Coach, wie es lief: Er passt den weiteren Plan an.", cta2: "Pacevo öffnen",
    footer: "Du erhältst diese E-Mail, weil die Coach-Benachrichtigungen aktiviert sind.", manage: "Benachrichtigungen verwalten",
  },
  es: {
    sujet: (n) => `Tus resultados: ${n}`, apercu: "La clasificación de tu carrera ya está en línea.",
    titre: (n) => `¡Enhorabuena por ${n}!`, intro: (d) => `Tu carrera del ${d} ya pasó — aquí está la clasificación.`,
    direct: "Ver mi clasificación", recherche: "Buscar la clasificación",
    noteRecherche: "El organizador aún no ha publicado un enlace que conozcamos: este botón lanza una búsqueda.",
    ressenti: "Y cuéntale a tu coach cómo te fue: ajusta el resto de tu plan.", cta2: "Abrir Pacevo",
    footer: "Recibes este correo porque las notificaciones del coach están activadas.", manage: "Gestionar mis notificaciones",
  },
  pt: {
    sujet: (n) => `Os teus resultados: ${n}`, apercu: "A classificação da tua prova está online.",
    titre: (n) => `Parabéns pela ${n}!`, intro: (d) => `A tua prova de ${d} já passou — eis a classificação.`,
    direct: "Ver a minha classificação", recherche: "Procurar a classificação",
    noteRecherche: "O organizador ainda não publicou uma ligação que conheçamos: este botão faz uma pesquisa.",
    ressenti: "E diz ao teu coach como correu: ele ajusta o resto do plano.", cta2: "Abrir o Pacevo",
    footer: "Recebes este email porque as notificações do coach estão ativadas.", manage: "Gerir as minhas notificações",
  },
};

export function construireEmail(i: { lang: Lang; nom: string; date: string; lien: Lien; appUrl: string }) {
  const t = T[i.lang] ?? T.fr;
  const dateLisible = new Date(`${i.date}T12:00:00Z`).toLocaleDateString(i.lang, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const subject = t.sujet(i.nom);
  const contenu = carte(`
      <h1 style="margin:0 0 6px;font-size:22px;line-height:1.3;color:#0f172a;font-weight:800">${esc(t.titre(i.nom))}</h1>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#475569">${esc(t.intro(dateLisible))}</p>
      ${bouton(i.lien.url, i.lien.direct ? t.direct : t.recherche)}
      ${i.lien.direct ? "" : `<p style="margin:10px 0 0;font-size:12px;color:#94a3b8">${esc(t.noteRecherche)}</p>`}
      <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#475569">${esc(t.ressenti)}</p>
      ${bouton(`${i.appUrl}/dashboard`, t.cta2)}`);
  const text = [t.titre(i.nom), "", t.intro(dateLisible), "", `${i.lien.direct ? t.direct : t.recherche} : ${i.lien.url}`,
    i.lien.direct ? "" : t.noteRecherche, "", t.ressenti, `${i.appUrl}/dashboard`, "", t.footer].filter((x, k, a) => x !== "" || a[k - 1] !== "").join("\n");
  return { subject, text, html: coquille({ lang: i.lang, sujet: subject, apercu: t.apercu, contenu, appUrl: i.appUrl, piedTexte: t.footer, piedLien: t.manage }) };
}

export type EnvoiResultats = { sent: boolean; skipped?: string; apercu?: { to: string; subject: string; lien: Lien } };

/**
 * Envoie l'e-mail des résultats à un athlète, si et seulement si les règles de l'en-tête
 * sont réunies. Ne lève jamais : un échec ne doit pas interrompre le balayage.
 */
export async function envoyerResultatsCourse(admin: SupabaseClient, opts: { userId: string; aujourdhui: string; blanc?: boolean }): Promise<EnvoiResultats> {
  if (!process.env.RESEND_API_KEY && !opts.blanc) return { sent: false, skipped: "RESEND_API_KEY absente" };
  // 1. Consentement — AVANT tout le reste.
  const { data: prof, error: ep } = await admin.from("profiles").select("email, preferred_language, notif_coach").eq("id", opts.userId).maybeSingle();
  if (ep) return { sent: false, skipped: `profil illisible : ${ep.message}` };
  const p = prof as { email?: string | null; preferred_language?: string | null; notif_coach?: boolean | null } | null;
  if (!p?.notif_coach) return { sent: false, skipped: "notifications du coach désactivées dans le profil" };
  if (!p.email) return { sent: false, skipped: "aucune adresse e-mail au profil" };

  // 2. La course visée, dans la fenêtre.
  const { data: obj, error: eo } = await admin.from("notifications").select("data").eq("user_id", opts.userId).eq("type", "race_objective").maybeSingle();
  if (eo) return { sent: false, skipped: `objectif illisible : ${eo.message}` };
  const c = courseTerminee((obj as { data?: Objectif } | null)?.data, opts.aujourdhui);
  if (!c) return { sent: false, skipped: "pas de course terminée dans la fenêtre d'envoi" };

  // 4. Une seule fois par course (vérifié avant de chercher le lien).
  const cle = `${c.date}|${nomCanonique(c.nom)}`;
  const { data: deja, error: ed } = await admin.from("notifications").select("id").eq("user_id", opts.userId).eq("type", TYPE_ENVOI).eq("data->>cle", cle).limit(1);
  if (ed) return { sent: false, skipped: `envois illisibles : ${ed.message}` };
  if (deja?.length) return { sent: false, skipped: "déjà envoyé pour cette course" };

  // 3. Le lien : la ligne du catalogue qui est cette course.
  const veille = new Date(Date.parse(`${c.date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const lendemain = new Date(Date.parse(`${c.date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const { data: lignes, error: el } = await admin.from("races").select("name, date, distance_km, city, resultats_url, resultats_annee").gte("date", veille).lte("date", lendemain).limit(1000);
  if (el) return { sent: false, skipped: `catalogue illisible : ${el.message}` };
  const lien = lienAEnvoyer(ligneDeLaCourse((lignes ?? []) as LigneCourse[], c), c);
  if (!lien) return { sent: false, skipped: "classement pas encore publié — nouvel essai demain" };

  const lang = (["fr", "en", "de", "es", "pt"] as const).includes((p.preferred_language ?? "") as Lang) ? (p.preferred_language as Lang) : "fr";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://pacevo.fr").replace(/\/+$/, "");
  const mail = construireEmail({ lang, nom: c.nom, date: c.date, lien, appUrl });
  if (opts.blanc) return { sent: false, skipped: "essai à blanc", apercu: { to: p.email, subject: mail.subject, lien } };

  const r = await envoyerEmail("resultats-course", { to: [p.email], subject: mail.subject, text: mail.text, html: mail.html }, { userId: opts.userId, url: "/api/cron/resultats-course" });
  if (!r.ok) return { sent: false, skipped: `envoi refusé : ${r.erreur}` };
  // Mémorisé APRÈS l'envoi réussi : un échec d'envoi sera retenté demain.
  const { error: ei } = await admin.from("notifications").insert({
    user_id: opts.userId, type: TYPE_ENVOI, title: "Résultats envoyés", body: c.nom.slice(0, 120), read: true,
    data: { cle, course: c.nom, date: c.date, lien: lien.url, direct: lien.direct, ts: new Date().toISOString() },
  });
  if (ei) console.error("[résultats] envoi non mémorisé — risque de double envoi demain :", ei.message);
  return { sent: true };
}
