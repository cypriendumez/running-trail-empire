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
import { coquille, carte, titreBloc, pastille, bouton, esc, VERT } from "@/lib/notify/gabarit";
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
  //  ⚠️ L'HABILLAGE VIT DANS `lib/notify/gabarit`, IL N'EST PLUS ÉCRIT ICI. Il l'était
  //  jusqu'au 24/08/2026 ; en écrivant le deuxième e-mail de plan, le recopier aurait
  //  produit exactement le défaut qu'on venait de corriger sur les logos — deux
  //  habillages écrits séparément divergent, et le client reçoit deux marques selon le
  //  message. Le raisonnement derrière chaque détail (ligne d'aperçu, tableaux pour
  //  Outlook, texte de remplacement du logo) est documenté là-bas.
  const preheader = next ? t.preheader(`${dayLabel(next.date)} · ${titre(next)}`) : t.preheaderNoNext;

  const contenu = `
      <div style="font:600 17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">${esc(t.hello(i.firstName))}</div>
      <div style="margin-top:8px;font-size:15px;line-height:1.65;color:#334155">${esc(t.intro)}</div>
      ${objLine ? pastille(objLine) : ""}

      ${i.lastSession ? carte(
        `${titreBloc(t.lastSessionTitle)}
         <div style="margin-top:8px;font-size:15px;font-weight:700;color:#0f172a">${esc(i.lastSession.label)}</div>
         ${i.lastSession.shows.length ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px">${i.lastSession.shows.map((x) => `<tr><td style="padding:3px 8px 3px 0;color:${VERT};font-size:14px;line-height:1.5;vertical-align:top">&bull;</td><td style="padding:3px 0;color:#334155;font-size:14px;line-height:1.5">${esc(x)}</td></tr>`).join("")}</table>` : ""}
         <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:14px;font-weight:600;color:#0f172a">${esc(i.lastSession.effect)}</div>`,
      ) : ""}

      ${days.length ? carte(
        `${titreBloc(t.nextDaysTitle)}
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px">
         ${days.map((d) => `<tr>
            <td style="padding:7px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top;width:38%">${esc(dayLabel(d.date))}</td>
            <td style="padding:7px 0 7px 12px;font-size:14px;font-weight:600;color:#0f172a">${esc(titre(d))}</td>
          </tr>`).join("")}
         </table>`,
      ) : ""}

      ${bouton(`${i.appUrl}/dashboard/calendrier`, t.cta)}`;

  const html = coquille({
    lang: i.lang, sujet: subject, apercu: preheader, contenu,
    appUrl: i.appUrl, piedTexte: t.footer, piedLien: t.manage,
  });

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
        // ⚠️ ADRESSE DE RÉPONSE — l'expéditeur n'est PAS une boîte qui reçoit.
        // `RESEND_FROM` pointe aujourd'hui sur un domaine de test partagé ; répondre à ce
        // message n'atteindrait personne. Sans `reply_to`, l'athlète qui clique sur
        // « Répondre » écrit dans le vide et croit avoir été ignoré.
        // Bénéfice secondaire, réel mais secondaire : un échange effectif est un signal
        // positif pour le classement du courrier (Prioritaire plutôt qu'Autre).
        // L'adresse vient de `EDITEUR`, jamais recopiée — un test l'interdit.
        reply_to: EDITEUR.email,
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
