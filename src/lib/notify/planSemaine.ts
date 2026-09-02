// ─────────────────────────────────────────────────────────────────────────────
//  « TA SEMAINE » — le récapitulatif du lundi matin, aux couleurs de Pacevo.
//
//  ⚠️ IL REMPLACE CELUI D'INTERVALS.ICU, ET C'EST LA RAISON DE SON EXISTENCE.
//  Comme Pacevo écrit les séances dans le calendrier intervals.icu, intervals.icu
//  envoyait de son côté son propre « Plan de la semaine » : son logo, sa mise en page,
//  son adresse à Londres, et un « Bonjour running » tiré du nom de compte. L'athlète
//  recevait donc, le lundi matin, un e-mail d'un tiers à propos d'un plan écrit par
//  Pacevo — chez Cyprien, il atterrissait même dans les indésirables.
//  La notification `PLAN_FOR_WEEK` a été retirée de son compte intervals.icu le
//  24/08/2026 ; ce fichier est ce qui prend sa place.
//
//  TROIS RÈGLES, LES MÊMES QUE POUR « TON PLAN EST À JOUR » :
//   1. CONSENTEMENT — rien ne part si `profiles.notif_coach` est faux (faux par défaut).
//   2. RIEN D'INVENTÉ — une journée sans séance prescrite s'affiche « repos », elle ne
//      se remplit pas d'un footing imaginaire pour faire une belle semaine.
//   3. RIEN À DIRE, RIEN À ENVOYER — sans aucune séance sur les sept jours, on n'envoie
//      pas : un e-mail hebdomadaire vide apprend à l'athlète à ne plus les ouvrir.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/i18n/translations";
import { coquille, carte, titreBloc, pastille, bouton, esc } from "@/lib/notify/gabarit";
import { EDITEUR } from "@/lib/brand/editeur";

/**
 * Une journée du plan. `titre` est déjà dans la langue de l'athlète.
 *
 * ⚠️ `repos` EST DISTINCT DE `titre === null`. Une journée sans rien de prescrit et une
 * journée où le coach prescrit EXPRESSÉMENT du repos ne sont pas la même chose : la
 * seconde porte un titre (« Repos complet ») et doit s'afficher, parce qu'un repos
 * prescrit fait partie du plan. Mais il ne se COMPTE pas comme une séance — l'e-mail
 * annonçait « 7 séances » pour une semaine qui en contenait six plus un jour de repos.
 */
export type JourPlan = { date: string; titre: string | null; repos?: boolean };

export type PlanSemaineInput = {
  lang: Lang;
  firstName: string;
  /** Les sept jours, du lundi au dimanche, dans l'ordre. */
  jours: JourPlan[];
  objective: { race: string; daysToRace: number | null } | null;
  appUrl: string;
};

type Dict = {
  subject: (n: number) => string;
  hello: (n: string) => string;
  intro: (n: number) => string;
  preheader: (n: number, repos: number) => string;
  weekTitle: string;
  rest: string;
  cta: string;
  objective: (race: string, d: number) => string;
  footer: string;
  manage: string;
};

const T: Record<Lang, Dict> = {
  fr: {
    subject: (n) => `Ta semaine — ${n} séance${n > 1 ? "s" : ""} au programme`,
    hello: (n) => `Salut ${n},`,
    intro: (n) => `Voici tes sept prochains jours. ${n} séance${n > 1 ? "s" : ""} prescrite${n > 1 ? "s" : ""} — le plan se recalcule après chacune, donc ce tableau bougera si ta forme bouge.`,
    preheader: (n, r) => `${n} séance${n > 1 ? "s" : ""} et ${r} jour${r > 1 ? "s" : ""} de repos`,
    weekTitle: "Ta semaine",
    rest: "Repos",
    cta: "Voir mon calendrier",
    objective: (race, d) => `Objectif : ${race} · J−${d}`,
    footer: "Tu reçois cet e-mail parce que les notifications du coach sont activées.",
    manage: "Gérer mes notifications",
  },
  en: {
    subject: (n) => `Your week — ${n} session${n > 1 ? "s" : ""} planned`,
    hello: (n) => `Hi ${n},`,
    intro: (n) => `Here are your next seven days. ${n} session${n > 1 ? "s" : ""} prescribed — the plan recalculates after each one, so this table will move if your form does.`,
    preheader: (n, r) => `${n} session${n > 1 ? "s" : ""} and ${r} rest day${r > 1 ? "s" : ""}`,
    weekTitle: "Your week",
    rest: "Rest",
    cta: "Open my calendar",
    objective: (race, d) => `Goal: ${race} · ${d} days to go`,
    footer: "You receive this email because coach notifications are on.",
    manage: "Manage my notifications",
  },
  de: {
    subject: (n) => `Deine Woche — ${n} Einheit${n > 1 ? "en" : ""} geplant`,
    hello: (n) => `Hallo ${n},`,
    intro: (n) => `Hier sind deine nächsten sieben Tage. ${n} Einheit${n > 1 ? "en" : ""} verordnet — der Plan wird nach jeder neu berechnet, diese Tabelle ändert sich also mit deiner Form.`,
    preheader: (n, r) => `${n} Einheit${n > 1 ? "en" : ""} und ${r} Ruhetag${r > 1 ? "e" : ""}`,
    weekTitle: "Deine Woche",
    rest: "Ruhe",
    cta: "Kalender öffnen",
    objective: (race, d) => `Ziel: ${race} · noch ${d} Tage`,
    footer: "Du erhältst diese E-Mail, weil Coach-Benachrichtigungen aktiviert sind.",
    manage: "Benachrichtigungen verwalten",
  },
  es: {
    subject: (n) => `Tu semana — ${n} sesión${n > 1 ? "es" : ""} prevista${n > 1 ? "s" : ""}`,
    hello: (n) => `Hola ${n}:`,
    intro: (n) => `Estos son tus próximos siete días. ${n} sesión${n > 1 ? "es" : ""} prescrita${n > 1 ? "s" : ""} — el plan se recalcula tras cada una, así que esta tabla cambiará si cambia tu forma.`,
    preheader: (n, r) => `${n} sesión${n > 1 ? "es" : ""} y ${r} día${r > 1 ? "s" : ""} de descanso`,
    weekTitle: "Tu semana",
    rest: "Descanso",
    cta: "Ver mi calendario",
    objective: (race, d) => `Objetivo: ${race} · faltan ${d} días`,
    footer: "Recibes este correo porque las notificaciones del entrenador están activadas.",
    manage: "Gestionar mis notificaciones",
  },
  pt: {
    subject: (n) => `A tua semana — ${n} treino${n > 1 ? "s" : ""} previsto${n > 1 ? "s" : ""}`,
    hello: (n) => `Olá ${n},`,
    intro: (n) => `Estes são os teus próximos sete dias. ${n} treino${n > 1 ? "s" : ""} prescrito${n > 1 ? "s" : ""} — o plano recalcula-se após cada um, por isso esta tabela mudará se a tua forma mudar.`,
    preheader: (n, r) => `${n} treino${n > 1 ? "s" : ""} e ${r} dia${r > 1 ? "s" : ""} de descanso`,
    weekTitle: "A tua semana",
    rest: "Descanso",
    cta: "Ver o meu calendário",
    objective: (race, d) => `Objetivo: ${race} · faltam ${d} dias`,
    footer: "Recebes este e-mail porque as notificações do treinador estão ativas.",
    manage: "Gerir as minhas notificações",
  },
};

const LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };

/**
 * Construit l'e-mail. Fonction PURE — aucune requête, aucun envoi.
 *
 * Rend `null` quand la semaine ne contient AUCUNE séance : mieux vaut ne rien envoyer
 * qu'un récapitulatif de sept lignes « repos », qui apprend à ne plus ouvrir les suivants.
 */
export function buildPlanSemaineEmail(i: PlanSemaineInput): { subject: string; text: string; html: string } | null {
  const t = T[i.lang] ?? T.fr;
  const loc = LOCALE[i.lang] ?? "fr-FR";
  const jours = i.jours.slice(0, 7);
  const seances = jours.filter((j) => j.titre && !j.repos).length;
  if (!seances) return null;
  const repos = jours.length - seances;

  const jourLabel = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" });

  const subject = t.subject(seances);
  const objLine = i.objective && i.objective.daysToRace != null && i.objective.daysToRace >= 0
    ? t.objective(i.objective.race, i.objective.daysToRace) : null;

  // ── Version texte : elle doit se suffire à elle-même (délivrabilité, lecteurs sans HTML).
  const lignes: string[] = [t.hello(i.firstName), "", t.intro(seances), ""];
  if (objLine) lignes.push(objLine, "");
  lignes.push(`${t.weekTitle} :`);
  for (const j of jours) lignes.push(`  ${jourLabel(j.date)} — ${j.titre ?? t.rest}`);
  lignes.push("", `${t.cta} : ${i.appUrl}/dashboard/calendrier`, "", "—", t.footer,
    `${t.manage} : ${i.appUrl}/dashboard/profile`);
  const text = lignes.join("\n");

  const contenu = `
      <div style="font:600 17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">${esc(t.hello(i.firstName))}</div>
      <div style="margin-top:8px;font-size:15px;line-height:1.65;color:#334155">${esc(t.intro(seances))}</div>
      ${objLine ? pastille(objLine) : ""}
      ${carte(
        `${titreBloc(t.weekTitle)}
         <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px">
         ${jours.map((j) => `<tr>
            <td style="padding:7px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top;width:42%">${esc(jourLabel(j.date))}</td>
            <td style="padding:7px 0 7px 12px;font-size:14px;font-weight:${j.titre && !j.repos ? 600 : 400};color:${j.titre && !j.repos ? "#0f172a" : "#94a3b8"}">${esc(j.titre ?? t.rest)}</td>
          </tr>`).join("")}
         </table>`,
      )}
      ${bouton(`${i.appUrl}/dashboard/calendrier`, t.cta)}`;

  return {
    subject,
    text,
    html: coquille({
      lang: i.lang, sujet: subject, apercu: t.preheader(seances, repos), contenu,
      appUrl: i.appUrl, piedTexte: t.footer, piedLien: t.manage,
    }),
  };
}

/** Les sept dates à partir du lundi de la semaine qui commence. */
export function septJours(depuis: Date): string[] {
  const out: string[] = [];
  for (let k = 0; k < 7; k++) {
    const d = new Date(depuis.getTime() + k * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export type EnvoiSemaine = {
  sent: boolean;
  skipped?: string;
  /** Ce qui AURAIT été envoyé, en essai à blanc. Absent en envoi réel. */
  apercu?: { to: string; subject: string; jours: number };
};

/**
 * Envoie le récapitulatif, si et seulement si les règles de l'en-tête sont réunies.
 * Ne lève JAMAIS : un e-mail qui échoue ne doit pas interrompre le balayage des athlètes.
 */
export async function sendPlanSemaineEmail(
  admin: SupabaseClient,
  /**
   * ⚠️ `blanc` PARCOURT TOUT LE CHEMIN SANS ENVOYER. Le workflow hebdomadaire a échoué
   * le 31/08/2026 sur l'étape « plan de la semaine », et il n'y avait aucune façon de
   * reproduire la panne : appeler la route en vrai expédie un courriel à l'athlète, et
   * les journaux d'exécution ne sont pas lisibles sans jeton. Un diagnostic qui oblige à
   * envoyer un vrai message à un vrai destinataire n'est pas un diagnostic utilisable —
   * on ne le fait qu'une fois, à contrecœur, et jamais quand il faudrait.
   */
  opts: { userId: string; lundi?: string; blanc?: boolean },
): Promise<EnvoiSemaine> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skipped: "RESEND_API_KEY absente" };

  const { data: prof } = await admin.from("profiles")
    .select("email, full_name, preferred_language, notif_coach").eq("id", opts.userId).maybeSingle();
  const p = prof as { email?: string | null; full_name?: string | null; preferred_language?: string | null; notif_coach?: boolean | null } | null;
  if (!p?.notif_coach) return { sent: false, skipped: "notifications du coach désactivées dans le profil" };
  if (!p.email) return { sent: false, skipped: "aucune adresse e-mail au profil" };

  const lang = (["fr", "en", "de", "es", "pt"] as const).includes((p.preferred_language ?? "") as Lang)
    ? (p.preferred_language as Lang) : "fr";
  const dates = septJours(opts.lundi ? new Date(`${opts.lundi}T00:00:00Z`) : new Date());

  const { data: rows } = await admin.from("notifications")
    .select("title, data").eq("user_id", opts.userId).eq("type", "coach_session")
    .gte("data->>date", dates[0]).lte("data->>date", dates[6]);

  // ⚠️ UNE SEULE SÉANCE PAR DATE. Le plan est republié plusieurs fois par jour : sans
  // déduplication, un même mardi apparaîtrait trois fois dans le tableau.
  const parDate = new Map<string, { titre: string; repos: boolean }>();
  for (const r of (rows ?? []) as { title?: string | null; data?: { date?: string; sessionType?: string; i18n?: Record<string, { title?: string }> } | null }[]) {
    const d = r.data?.date;
    if (!d || parDate.has(d)) continue;
    const traduit = r.data?.i18n?.[lang]?.title;
    // ⚠️ LE REPOS SE LIT SUR `sessionType`, JAMAIS SUR LE TITRE. Le titre est traduit et
    // varie (« Repos complet », « Repos »), le type est la valeur canonique du plan.
    // Chercher le mot « repos » dans un titre allemand n'aurait rien trouvé.
    if (r.title) parDate.set(d, { titre: traduit || r.title, repos: r.data?.sessionType === "Repos" });
  }
  const jours: JourPlan[] = dates.map((d) => {
    const e = parDate.get(d);
    return { date: d, titre: e?.titre ?? null, repos: e?.repos ?? false };
  });

  const { data: objRow } = await admin.from("notifications").select("data")
    .eq("user_id", opts.userId).eq("type", "race_objective").maybeSingle();
  const o = objRow?.data as { race?: string; raceDate?: string } | undefined;
  const jRestants = o?.raceDate
    ? Math.round((Date.parse(`${o.raceDate}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86_400_000)
    : null;
  const objective = o?.race ? { race: o.race, daysToRace: jRestants } : null;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://running-trail-empire-woad.vercel.app").replace(/\/+$/, "");
  const firstName = String(p.full_name ?? "").trim().split(/\s+/)[0] || p.email.split("@")[0];
  const mail = buildPlanSemaineEmail({ lang, firstName, jours, objective, appUrl });
  if (!mail) return { sent: false, skipped: "aucune séance prescrite sur les sept jours" };

  if (opts.blanc) {
    return { sent: false, skipped: "essai à blanc", apercu: { to: p.email, subject: mail.subject, jours: jours.filter((j) => j.titre).length } };
  }

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
        to: [p.email], subject: mail.subject, text: mail.text, html: mail.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { sent: false, skipped: `Resend HTTP ${r.status}` };
    return { sent: true };
  } catch {
    return { sent: false, skipped: "envoi impossible (réseau ou délai dépassé)" };
  }
}
