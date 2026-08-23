// ─────────────────────────────────────────────────────────────────────────────
//  « TON PLAN EST À JOUR » — l'e-mail qui ferme la boucle.
//
//  Depuis que le plan se republie dans les 10 minutes qui suivent une séance, il est
//  prêt bien avant que l'athlète pense à ouvrir l'application. Sans un mot, la
//  replanification instantanée ne sert à rien : elle résout un problème que personne
//  ne voit. C'est l'e-mail qui transforme « le plan est à jour » en « je sais quoi
//  faire demain ».
//
//  TROIS RÈGLES QUI ENCADRENT CET ENVOI, parce qu'un e-mail est irréversible :
//
//   1. CONSENTEMENT. Rien ne part si `profiles.notif_coach` est faux. Le réglage
//      existe déjà (Profil → Notifications) et vaut FAUX par défaut : on n'écrit pas
//      à quelqu'un qui n'a rien demandé.
//   2. RYTHME. Un intervalle minimum entre deux e-mails, mémorisé dans l'état du
//      coach — pas de nouvelle colonne en base. Deux sorties dans la même matinée ne
//      produisent pas deux e-mails.
//   3. RIEN D'INVENTÉ. Le bloc « ta dernière séance » n'apparaît que si l'analyse
//      existe vraiment. Un e-mail qui affirme quelque chose de faux sur l'entraînement
//      de quelqu'un est pire que pas d'e-mail du tout.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/i18n/translations";
// ⚠️ IMPORTÉE, jamais recopiée : `tests/chiffres.test.ts` interdit qu'un fichier
// redéclare l'identité de l'éditeur. On n'utilise QUE `nom` — `statut` porte encore
// le gabarit « [À COMPLÉTER] », qui n'a rien à faire dans la boîte d'un client.
import { EDITEUR } from "@/lib/brand/editeur";

/** Deux séances dans la même matinée ne valent pas deux e-mails. */
export const EMAIL_MIN_INTERVAL_MS = 3 * 60 * 60 * 1000;

export type PlanDayLite = {
  date: string; type: string;
  /** Titre FRANÇAIS canonique — celui qui part sur la montre. */
  title: string; detail: string;
  /** Le même jour dans les autres langues (cf. lib/ai/planI18n.ts). Sans lui, l'e-mail
   *  était traduit… sauf le nom des séances, c'est-à-dire son seul contenu utile :
   *  « Nächste Tage : Footing en endurance ». */
  i18n?: Partial<Record<Lang, { title: string }>>;
};

export type PlanReadyInput = {
  lang: Lang;
  firstName: string;
  lastSession: { date: string; label: string; shows: string[]; effect: string } | null;
  /** Jours à venir, déjà triés. Les trois premiers suffisent : au-delà, l'e-mail
   *  devient un plan complet que personne ne lit dans sa boîte de réception. */
  days: PlanDayLite[];
  objective: { race: string; daysToRace: number | null } | null;
  appUrl: string;
};

type Dict = {
  subject: (next: string) => string;
  subjectNoNext: string;
  hello: (n: string) => string;
  intro: string;
  lastSessionTitle: string;
  nextDaysTitle: string;
  cta: string;
  objective: (race: string, d: number) => string;
  today: string; tomorrow: string;
  footer: string;
  /** Libellé du lien qui mène au réglage — « Profil → Notifications » en toutes lettres
   *  oblige à chercher ; un lien y emmène en un clic. */
  manage: string;
  /** Ligne d'aperçu affichée dans la LISTE des messages, avant même l'ouverture. Sans
   *  elle, la messagerie y met le début du corps : la boîte affichait « PACEVO Salut
   *  Cyprien, T… », c'est-à-dire rien. */
  preheader: (next: string) => string;
  preheaderNoNext: string;
};

const T: Record<Lang, Dict> = {
  fr: {
    subject: (n) => `Ton plan est à jour — prochaine séance : ${n}`,
    subjectNoNext: "Ton plan d'entraînement est à jour",
    hello: (n) => `Salut ${n},`,
    intro: "Ta séance vient d'être analysée et ton plan a été recalculé. Il est déjà sur ta montre.",
    lastSessionTitle: "Ta dernière séance",
    nextDaysTitle: "Ce qui t'attend",
    cta: "Voir mon calendrier",
    objective: (race, d) => `Objectif : ${race} · J−${d}`,
    today: "Aujourd'hui", tomorrow: "Demain",
    footer: "Tu reçois cet e-mail parce que les notifications du coach sont activées.",
    manage: "Gérer mes notifications",
    preheader: (n) => `Prochaine séance : ${n}`,
    preheaderNoNext: "Ton plan des 7 prochains jours vient d'être recalculé.",
  },
  en: {
    subject: (n) => `Your plan is updated — next session: ${n}`,
    subjectNoNext: "Your training plan is updated",
    hello: (n) => `Hi ${n},`,
    intro: "Your session has just been analysed and your plan recalculated. It is already on your watch.",
    lastSessionTitle: "Your last session",
    nextDaysTitle: "What's coming up",
    cta: "Open my calendar",
    objective: (race, d) => `Goal: ${race} · ${d} days to go`,
    today: "Today", tomorrow: "Tomorrow",
    footer: "You receive this email because coach notifications are on.",
    manage: "Manage my notifications",
    preheader: (n) => `Next session: ${n}`,
    preheaderNoNext: "Your plan for the next 7 days has just been recalculated.",
  },
  de: {
    subject: (n) => `Dein Plan ist aktualisiert — nächste Einheit: ${n}`,
    subjectNoNext: "Dein Trainingsplan ist aktualisiert",
    hello: (n) => `Hallo ${n},`,
    intro: "Deine Einheit wurde soeben ausgewertet und dein Plan neu berechnet. Er ist bereits auf deiner Uhr.",
    lastSessionTitle: "Deine letzte Einheit",
    nextDaysTitle: "Das kommt als Nächstes",
    cta: "Kalender öffnen",
    objective: (race, d) => `Ziel: ${race} · noch ${d} Tage`,
    today: "Heute", tomorrow: "Morgen",
    footer: "Du erhältst diese E-Mail, weil Coach-Benachrichtigungen aktiviert sind.",
    manage: "Benachrichtigungen verwalten",
    preheader: (n) => `Nächste Einheit: ${n}`,
    preheaderNoNext: "Dein Plan für die nächsten 7 Tage wurde soeben neu berechnet.",
  },
  es: {
    subject: (n) => `Tu plan está actualizado — próxima sesión: ${n}`,
    subjectNoNext: "Tu plan de entrenamiento está actualizado",
    hello: (n) => `Hola ${n}:`,
    intro: "Tu sesión acaba de analizarse y tu plan se ha recalculado. Ya está en tu reloj.",
    lastSessionTitle: "Tu última sesión",
    nextDaysTitle: "Lo que viene",
    cta: "Ver mi calendario",
    objective: (race, d) => `Objetivo: ${race} · faltan ${d} días`,
    today: "Hoy", tomorrow: "Mañana",
    footer: "Recibes este correo porque las notificaciones del entrenador están activadas.",
    manage: "Gestionar mis notificaciones",
    preheader: (n) => `Próxima sesión: ${n}`,
    preheaderNoNext: "Tu plan de los próximos 7 días acaba de recalcularse.",
  },
  pt: {
    subject: (n) => `O teu plano está atualizado — próxima sessão: ${n}`,
    subjectNoNext: "O teu plano de treino está atualizado",
    hello: (n) => `Olá ${n},`,
    intro: "A tua sessão acabou de ser analisada e o teu plano foi recalculado. Já está no teu relógio.",
    lastSessionTitle: "A tua última sessão",
    nextDaysTitle: "O que aí vem",
    cta: "Ver o meu calendário",
    objective: (race, d) => `Objetivo: ${race} · faltam ${d} dias`,
    today: "Hoje", tomorrow: "Amanhã",
    footer: "Recebes este e-mail porque as notificações do treinador estão ativas.",
    manage: "Gerir as minhas notificações",
    preheader: (n) => `Próxima sessão: ${n}`,
    preheaderNoNext: "O teu plano dos próximos 7 dias acabou de ser recalculado.",
  },
};

const LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };

/** Échappement HTML — le nom de l'athlète et les titres de séance viennent de la base
 *  et d'intervals.icu (donc du nom que Garmin a donné à la sortie). Un titre contenant
 *  un chevron casserait la mise en page, et pire, pourrait injecter du balisage. */
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Construit l'e-mail. Fonction PURE : aucune requête, aucun envoi — c'est ce qui la
 * rend testable, et c'est là que vivent toutes les règles de contenu.
 */
export function buildPlanReadyEmail(i: PlanReadyInput): { subject: string; text: string; html: string } {
  const t = T[i.lang] ?? T.fr;
  const loc = LOCALE[i.lang] ?? "fr-FR";
  const days = i.days.slice(0, 3);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const dayLabel = (d: string) =>
    d === today ? t.today
    : d === tomorrow ? t.tomorrow
    : new Date(`${d}T00:00:00`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });

  // Le sujet annonce la PROCHAINE séance qui n'est ni du repos ni aujourd'hui : c'est
  // la seule information que l'athlète lit vraiment dans sa liste d'e-mails.
  const next = days.find((d) => d.date !== today && !/repos|rest/i.test(d.type)) ?? days[0] ?? null;
  // Le TYPE reste français (c'est lui qu'on filtre) ; le TITRE, lui, est ce que l'athlète lit.
  const titre = (d: PlanDayLite) => d.i18n?.[i.lang]?.title ?? d.title;
  const subject = next ? t.subject(`${dayLabel(next.date)} · ${titre(next)}`) : t.subjectNoNext;

  const objLine = i.objective && i.objective.daysToRace != null && i.objective.daysToRace >= 0
    ? t.objective(i.objective.race, i.objective.daysToRace)
    : null;

  // ── Version texte : c'est elle qui compte pour la délivrabilité et les lecteurs
  //    qui refusent le HTML. Elle doit se suffire à elle-même.
  const lines: string[] = [t.hello(i.firstName), "", t.intro, ""];
  if (objLine) lines.push(objLine, "");
  if (i.lastSession) {
    lines.push(`${t.lastSessionTitle} — ${i.lastSession.label}`);
    for (const s of i.lastSession.shows) lines.push(`  · ${s}`);
    lines.push(`  ${i.lastSession.effect}`, "");
  }
  if (days.length) {
    lines.push(`${t.nextDaysTitle} :`);
    for (const d of days) lines.push(`  ${dayLabel(d.date)} — ${titre(d)}`);
    lines.push("");
  }
  // ⚠️ La version texte doit rester AUTOSUFFISANTE. `t.footer` ne dit plus où couper les
  // e-mails — c'est devenu un lien dans le HTML — donc on écrit l'adresse en clair ici,
  // sinon un lecteur en texte seul n'a plus aucun moyen de se désabonner.
  lines.push(
    `${t.cta} : ${i.appUrl}/dashboard/calendrier`, "", "—",
    t.footer,
    `${t.manage} : ${i.appUrl}/dashboard/profile`,
    `Pacevo · ${EDITEUR.nom} · ${i.appUrl}`,
  );
  const text = lines.join("\n");

  // ── Version HTML ────────────────────────────────────────────────────────────
  //
  //  ⚠️ REFAIT LE 23/08/2026. Le gabarit précédent était un `<div>` nu sur fond blanc,
  //  sans en-tête ni pied de page : il ressemblait à une notification de service, pas au
  //  produit qu'on vend. Quatre défauts, tous visibles dans une vraie boîte de réception.
  //
  //   1. AUCUNE LIGNE D'APERÇU. La messagerie prend alors le début du corps : la liste
  //      affichait « PACEVO Salut Cyprien, T… » — l'athlète devait ouvrir pour savoir de
  //      quoi il s'agissait. Le `preheader` ci-dessous, masqué dans le message, occupe
  //      cette place et annonce la prochaine séance.
  //   2. MISE EN PAGE EN `div`. Outlook (Windows) ignore `max-width` sur un bloc : le
  //      message s'étalait sur toute la largeur de la fenêtre. On repasse en TABLEAUX,
  //      seule structure que toutes les messageries respectent encore.
  //   3. PAS DE LOGO. Demandé par Cyprien. L'image est distante — les messageries les
  //      bloquent par défaut — donc le nom PACEVO reste écrit à côté, en texte : image
  //      bloquée, l'en-tête tient quand même.
  //   4. PIED DE PAGE MUET. « Pour les désactiver : Profil → Notifications » obligeait à
  //      chercher. C'est un LIEN maintenant, et l'éditeur est nommé.
  //
  //  Contraintes qui ne changent pas : styles EN LIGNE (aucune feuille externe n'est
  //  chargée), une seule colonne, et la version texte reste autosuffisante.
  const B = "#059669";                 // émeraude de la marque
  // ⚠️ LE MÊME FICHIER QUE LES AUTRES E-MAILS PACEVO (`/icon.png`, déjà utilisé par
  // l'accusé d'inscription et la lettre du lundi). J'avais d'abord fabriqué un
  // `email-logo.png` dédié, plus léger — mais deux logos finissent par diverger, et rien
  // ne le signalerait : un client verrait deux marques différentes selon le message reçu.
  const logo = `${i.appUrl}/icon.png`;
  const preheader = next ? t.preheader(`${dayLabel(next.date)} · ${titre(next)}`) : t.preheaderNoNext;

  const card = (inner: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:18px 0">
       <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px">${inner}</td></tr>
     </table>`;
  const titreBloc = (txt: string) =>
    `<div style="font:600 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;text-transform:uppercase;letter-spacing:.09em;color:#64748b">${esc(txt)}</div>`;

  const html = `<!doctype html>
<html lang="${i.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<!-- Ligne d'aperçu : lue par la liste des messages, invisible une fois ouvert. Les
     espaces insécables qui suivent empêchent la messagerie d'y accoler le corps. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}${"&#8199;&#65279;&nbsp;".repeat(60)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f6">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px">

    <!-- En-tête : logo + nom. Si l'image est bloquée, le nom reste. -->
    <tr><td style="padding:0 4px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:10px;vertical-align:middle">
          <img src="${esc(logo)}" width="34" height="34" alt="Pacevo"
               style="display:block;width:34px;height:34px;border:0;border-radius:9px">
        </td>
        <td style="vertical-align:middle;font:800 19px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:${B}">PACEVO</td>
      </tr></table>
    </td></tr>

    <!-- Corps -->
    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:28px 26px">
      <div style="font:600 17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">${esc(t.hello(i.firstName))}</div>
      <div style="margin-top:8px;font-size:15px;line-height:1.65;color:#334155">${esc(t.intro)}</div>
      ${objLine ? `<div style="margin-top:14px"><span style="display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:#047857">${esc(objLine)}</span></div>` : ""}

      ${i.lastSession ? card(
        `${titreBloc(t.lastSessionTitle)}
         <div style="margin-top:8px;font-size:15px;font-weight:700;color:#0f172a">${esc(i.lastSession.label)}</div>
         ${i.lastSession.shows.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">${i.lastSession.shows.map((x) => `<tr><td style="padding:3px 8px 3px 0;color:${B};font-size:14px;line-height:1.5;vertical-align:top">&bull;</td><td style="padding:3px 0;color:#334155;font-size:14px;line-height:1.5">${esc(x)}</td></tr>`).join("")}</table>` : ""}
         <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#0f172a">${esc(i.lastSession.effect)}</div>`,
      ) : ""}

      ${days.length ? card(
        `${titreBloc(t.nextDaysTitle)}
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px">
         ${days.map((d) => `<tr>
            <td style="padding:7px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top;width:38%">${esc(dayLabel(d.date))}</td>
            <td style="padding:7px 0 7px 12px;font-size:14px;font-weight:600;color:#0f172a">${esc(titre(d))}</td>
          </tr>`).join("")}
         </table>`,
      ) : ""}

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px">
        <tr><td style="background:${B};border-radius:11px">
          <a href="${esc(i.appUrl)}/dashboard/calendrier"
             style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${esc(t.cta)}</a>
        </td></tr>
      </table>
    </td></tr>

    <!-- Pied de page : pourquoi ce message, comment l'arrêter, et qui l'envoie. -->
    <tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#94a3b8">
      ${esc(t.footer)}
      <a href="${esc(i.appUrl)}/dashboard/profile" style="color:#64748b;text-decoration:underline">${esc(t.manage)}</a>
      <div style="margin-top:8px">Pacevo &middot; ${esc(EDITEUR.nom)} &middot; <a href="${esc(i.appUrl)}/mentions-legales" style="color:#94a3b8;text-decoration:underline">${esc(i.appUrl.replace(/^https?:\/\//, ""))}</a></div>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;

  return { subject, text, html };
}

export type EmailOutcome = { sent: boolean; skipped?: string };

/**
 * Envoie l'e-mail si — et seulement si — les trois règles de l'en-tête sont réunies.
 * Ne lève JAMAIS : un e-mail qui échoue ne doit pas empêcher un plan d'être publié.
 */
export async function sendPlanReadyEmail(
  admin: SupabaseClient,
  opts: {
    userId: string;
    lastSession: PlanReadyInput["lastSession"];
    days: PlanDayLite[];
    objective: PlanReadyInput["objective"];
    /** Dernier envoi connu, lu dans l'état du coach (pas de colonne dédiée). */
    lastEmailAt?: string | null;
    now?: number;
  },
): Promise<EmailOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skipped: "RESEND_API_KEY absente" };

  const now = opts.now ?? Date.now();
  if (opts.lastEmailAt && now - new Date(opts.lastEmailAt).getTime() < EMAIL_MIN_INTERVAL_MS) {
    return { sent: false, skipped: "e-mail déjà envoyé il y a moins de 3 h" };
  }

  const { data: prof } = await admin.from("profiles")
    .select("email, full_name, preferred_language, notif_coach").eq("id", opts.userId).maybeSingle();
  const p = prof as { email?: string | null; full_name?: string | null; preferred_language?: string | null; notif_coach?: boolean | null } | null;

  // Consentement d'abord : c'est la seule règle qui ne souffre aucune exception.
  if (!p?.notif_coach) return { sent: false, skipped: "notifications du coach désactivées dans le profil" };
  if (!p.email) return { sent: false, skipped: "aucune adresse e-mail au profil" };

  const lang = (["fr", "en", "de", "es", "pt"] as const).includes((p.preferred_language ?? "") as Lang)
    ? (p.preferred_language as Lang) : "fr";
  const firstName = String(p.full_name ?? "").trim().split(/\s+/)[0] || p.email.split("@")[0];
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://running-trail-empire-woad.vercel.app").replace(/\/+$/, "");

  const mail = buildPlanReadyEmail({ lang, firstName, lastSession: opts.lastSession, days: opts.days, objective: opts.objective, appUrl });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Pacevo <onboarding@resend.dev>",
        to: [p.email],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    // Le corps de la réponse peut contenir un message d'erreur du fournisseur : on le
    // résume sans jamais y remettre la clé.
    if (!r.ok) return { sent: false, skipped: `Resend HTTP ${r.status}` };
    return { sent: true };
  } catch {
    return { sent: false, skipped: "envoi impossible (réseau ou délai dépassé)" };
  }
}
