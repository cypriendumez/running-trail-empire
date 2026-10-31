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
//
//  LE BILAN DU LUNDI (Premium et essai, Cyprien, 30/10/2026 : « bilan par e-mail chaque
//  lundi »). Le même e-mail s'ouvre sur la semaine ÉCOULÉE, du lundi au dimanche : deux
//  e-mails Pacevo le même matin apprendraient à ignorer les deux. Ses chiffres sont ceux
//  de la carte du tableau de bord (`faitsDeLaSemaine`), CALCULÉS — aucun modèle n'est appelé
//  ici : le balayage du lundi ne dépense rien, ne dépasse aucun quota et n'invente rien. Le
//  texte du coach n'y figure que s'il a DÉJÀ été écrit pour ces mêmes faits (même empreinte) ;
//  sinon, un lien mène à la carte, qui le rédige à la demande. Starter reçoit à la place une
//  ligne qui dit ce que Premium y ajouterait.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "@/lib/i18n/translations";
import { coquille, carte, titreBloc, pastille, bouton, esc, VERT } from "@/lib/notify/gabarit";
import { EDITEUR } from "@/lib/brand/editeur";
import { envoyerEmail } from "@/lib/email/envoyer";
import { accesDe, peut, COLONNES_ACCES } from "@/lib/billing/access";
import { faitsDeLaSemaine, TYPE_BILAN } from "@/lib/ai/bilanDonnees";
import { lignesDuBilan, empreinteBilan, chrono, type FaitsBilan } from "@/lib/ai/bilanSemaine";
import { formatDateCivile } from "@/lib/time/fuseau";
import { decaleJour } from "@/lib/streak/compute";

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

/** Le bilan de la semaine écoulée : ses faits calculés, et le texte du coach s'il existe déjà. */
export type BilanEmail = { faits: FaitsBilan; texte: string | null };

export type PlanSemaineInput = {
  lang: Lang;
  firstName: string;
  /** Les sept jours, du lundi au dimanche, dans l'ordre. */
  jours: JourPlan[];
  objective: { race: string; daysToRace: number | null } | null;
  appUrl: string;
  /** Premium et essai : la semaine écoulée, en tête. */
  bilan?: BilanEmail | null;
  /** Starter : une ligne qui dit ce que Premium ajouterait à cet e-mail. */
  teaserPremium?: boolean;
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
  bilanTitre: string;
  bilanVolume: (n: number, km: string, duree: string, dplus: string) => string;
  bilanHabitude: (km: string) => string;
  bilanIntensite: (f: number, m: number, d: number) => string;
  bilanDerive: (x: string, avant: string | null) => string;
  bilanEfficacite: (x: string) => string;
  bilanSommeil: (x: number, avant: number | null) => string;
  bilanVfc: (x: number, avant: number | null) => string;
  bilanObjectif: (nom: string, j: number, vise: string, prediction: string | null) => string;
  bilanCourse: (nom: string, km: string) => string;
  bilanRecup: (course: string, date: string) => string;
  bilanLire: string;
  teaser: string;
  teaserCta: string;
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
    bilanTitre: "Ta semaine écoulée",
    bilanVolume: (n, km, duree, dplus) => `${n} séance${n > 1 ? "s" : ""} de course · ${km} km · ${duree} · D+ ${dplus} m`,
    bilanHabitude: (km) => `D'habitude : ${km} km par semaine`,
    bilanIntensite: (f, m, d) => `Intensité : facile ${f} % · modéré ${m} % · dur ${d} %`,
    bilanDerive: (x, a) => `Dérive cardiaque (sorties faciles) : ${x} %${a ? ` (avant : ${a} %)` : ""}`,
    bilanEfficacite: (x) => `Efficacité aérobie : ${x} % par semaine`,
    bilanSommeil: (x, a) => `Sommeil : ${x}/100${a != null ? ` (avant : ${a})` : ""}`,
    bilanVfc: (x, a) => `VFC : ${x} ms${a != null ? ` (avant : ${a} ms)` : ""}`,
    bilanObjectif: (nom, j, vise, pred) => `${nom} dans ${j} jour${j > 1 ? "s" : ""} : objectif ${vise}${pred ? `, prédiction actuelle ${pred}` : ""}`,
    bilanCourse: (nom, km) => `Course de la semaine : ${nom}, ${km} km`,
    bilanRecup: (c, d) => `Récupération après ${c} : pas d'intensité avant le ${d}`,
    bilanLire: "Lire le bilan du coach",
    teaser: "Avec Premium, cet e-mail s'ouvre chaque lundi sur le bilan de ta semaine écoulée : intensité, dérive cardiaque, VFC et objectif.",
    teaserCta: "Découvrir Premium",
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
    bilanTitre: "Your past week",
    bilanVolume: (n, km, duree, dplus) => `${n} run${n > 1 ? "s" : ""} · ${km} km · ${duree} · ${dplus} m climbed`,
    bilanHabitude: (km) => `Usually: ${km} km a week`,
    bilanIntensite: (f, m, d) => `Intensity: easy ${f}% · moderate ${m}% · hard ${d}%`,
    bilanDerive: (x, a) => `Cardiac drift (easy runs): ${x}%${a ? ` (before: ${a}%)` : ""}`,
    bilanEfficacite: (x) => `Aerobic efficiency: ${x}% per week`,
    bilanSommeil: (x, a) => `Sleep: ${x}/100${a != null ? ` (before: ${a})` : ""}`,
    bilanVfc: (x, a) => `HRV: ${x} ms${a != null ? ` (before: ${a} ms)` : ""}`,
    bilanObjectif: (nom, j, vise, pred) => `${nom} in ${j} day${j > 1 ? "s" : ""}: goal ${vise}${pred ? `, current prediction ${pred}` : ""}`,
    bilanCourse: (nom, km) => `This week's race: ${nom}, ${km} km`,
    bilanRecup: (c, d) => `Recovering from ${c}: no intensity before ${d}`,
    bilanLire: "Read the coach's review",
    teaser: "With Premium, this email opens every Monday with a review of your past week: intensity, cardiac drift, HRV and goal.",
    teaserCta: "Discover Premium",
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
    bilanTitre: "Deine vergangene Woche",
    bilanVolume: (n, km, duree, dplus) => `${n} ${n > 1 ? "Läufe" : "Lauf"} · ${km} km · ${duree} · ${dplus} Hm`,
    bilanHabitude: (km) => `Üblich: ${km} km pro Woche`,
    bilanIntensite: (f, m, d) => `Intensität: locker ${f} % · mittel ${m} % · hart ${d} %`,
    bilanDerive: (x, a) => `Kardiale Drift (lockere Läufe): ${x} %${a ? ` (vorher: ${a} %)` : ""}`,
    bilanEfficacite: (x) => `Aerobe Effizienz: ${x} % pro Woche`,
    bilanSommeil: (x, a) => `Schlaf: ${x}/100${a != null ? ` (vorher: ${a})` : ""}`,
    bilanVfc: (x, a) => `HRV: ${x} ms${a != null ? ` (vorher: ${a} ms)` : ""}`,
    bilanObjectif: (nom, j, vise, pred) => `${nom} in ${j} ${j > 1 ? "Tagen" : "Tag"}: Ziel ${vise}${pred ? `, aktuelle Prognose ${pred}` : ""}`,
    bilanCourse: (nom, km) => `Wettkampf der Woche: ${nom}, ${km} km`,
    bilanRecup: (c, d) => `Erholung nach ${c}: keine Intensität vor dem ${d}`,
    bilanLire: "Die Bilanz des Coachs lesen",
    teaser: "Mit Premium beginnt diese E-Mail jeden Montag mit der Bilanz deiner vergangenen Woche: Intensität, kardiale Drift, HRV und Ziel.",
    teaserCta: "Premium entdecken",
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
    bilanTitre: "Tu semana pasada",
    bilanVolume: (n, km, duree, dplus) => `${n} salida${n > 1 ? "s" : ""} · ${km} km · ${duree} · D+ ${dplus} m`,
    bilanHabitude: (km) => `Lo habitual: ${km} km por semana`,
    bilanIntensite: (f, m, d) => `Intensidad: suave ${f} % · moderada ${m} % · dura ${d} %`,
    bilanDerive: (x, a) => `Deriva cardiaca (salidas suaves): ${x} %${a ? ` (antes: ${a} %)` : ""}`,
    bilanEfficacite: (x) => `Eficiencia aeróbica: ${x} % por semana`,
    bilanSommeil: (x, a) => `Sueño: ${x}/100${a != null ? ` (antes: ${a})` : ""}`,
    bilanVfc: (x, a) => `VFC: ${x} ms${a != null ? ` (antes: ${a} ms)` : ""}`,
    bilanObjectif: (nom, j, vise, pred) => `${nom} en ${j} día${j > 1 ? "s" : ""}: objetivo ${vise}${pred ? `, predicción actual ${pred}` : ""}`,
    bilanCourse: (nom, km) => `Carrera de la semana: ${nom}, ${km} km`,
    bilanRecup: (c, d) => `Recuperación tras ${c}: sin intensidad antes del ${d}`,
    bilanLire: "Leer el balance del coach",
    teaser: "Con Premium, este correo empieza cada lunes con el balance de tu semana pasada: intensidad, deriva cardiaca, VFC y objetivo.",
    teaserCta: "Descubrir Premium",
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
    bilanTitre: "A tua semana passada",
    bilanVolume: (n, km, duree, dplus) => `${n} corrida${n > 1 ? "s" : ""} · ${km} km · ${duree} · D+ ${dplus} m`,
    bilanHabitude: (km) => `O habitual: ${km} km por semana`,
    bilanIntensite: (f, m, d) => `Intensidade: fácil ${f} % · moderada ${m} % · dura ${d} %`,
    bilanDerive: (x, a) => `Deriva cardíaca (corridas fáceis): ${x} %${a ? ` (antes: ${a} %)` : ""}`,
    bilanEfficacite: (x) => `Eficiência aeróbica: ${x} % por semana`,
    bilanSommeil: (x, a) => `Sono: ${x}/100${a != null ? ` (antes: ${a})` : ""}`,
    bilanVfc: (x, a) => `VFC: ${x} ms${a != null ? ` (antes: ${a} ms)` : ""}`,
    bilanObjectif: (nom, j, vise, pred) => `${nom} daqui a ${j} dia${j > 1 ? "s" : ""}: objetivo ${vise}${pred ? `, previsão atual ${pred}` : ""}`,
    bilanCourse: (nom, km) => `Prova da semana: ${nom}, ${km} km`,
    bilanRecup: (c, d) => `Recuperação após ${c}: sem intensidade antes de ${d}`,
    bilanLire: "Ler o balanço do treinador",
    teaser: "Com o Premium, este e-mail abre todas as segundas-feiras com o balanço da tua semana passada: intensidade, deriva cardíaca, VFC e objetivo.",
    teaserCta: "Descobrir o Premium",
  },
};

const LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };

/**
 * Les faits du bilan, une ligne chacun, dans la langue de l'athlète. Fonction PURE.
 * ⚠️ CE QUI EST INCONNU N'A PAS DE LIGNE : une dérive non mesurée ne s'affiche pas « 0 % ».
 */
export function lignesBilanEmail(f: FaitsBilan, lang: Lang): string[] {
  const t = T[lang] ?? T.fr;
  const loc = LOCALE[lang] ?? "fr-FR";
  const nf = (x: number) => new Intl.NumberFormat(loc, { maximumFractionDigits: 1 }).format(x);
  // Espaces INSÉCABLES : « 5 h » en fin de ligne et « 08 » à la suivante, vu dans le rendu réel.
  const duree = (min: number) => min >= 60 ? `${Math.floor(min / 60)}\u00a0h\u00a0${String(min % 60).padStart(2, "0")}` : `${min}\u00a0min`;
  const l: string[] = [];
  if (f.course) l.push(t.bilanCourse(f.course.nom, nf(f.course.couruKm)));
  l.push(t.bilanVolume(f.seances, nf(f.km), duree(f.minutes), nf(f.dplus)));
  if (f.kmHabitude != null) l.push(t.bilanHabitude(nf(f.kmHabitude)));
  if (f.intensite) l.push(t.bilanIntensite(f.intensite.facile, f.intensite.modere, f.intensite.dur));
  if (f.derive.semaine != null) l.push(t.bilanDerive(nf(f.derive.semaine), f.derive.avant != null ? nf(f.derive.avant) : null));
  if (f.efficaciteParSemaine != null) l.push(t.bilanEfficacite(`${f.efficaciteParSemaine > 0 ? "+" : ""}${nf(f.efficaciteParSemaine)}`));
  if (f.sommeil.semaine != null) l.push(t.bilanSommeil(f.sommeil.semaine, f.sommeil.avant));
  if (f.vfc.semaine != null) l.push(t.bilanVfc(f.vfc.semaine, f.vfc.avant));
  if (f.objectif) l.push(t.bilanObjectif(f.objectif.nom, f.objectif.joursRestants, chrono(f.objectif.viseSec), f.objectif.predictionSec != null ? chrono(f.objectif.predictionSec) : null));
  if (f.recuperation) l.push(t.bilanRecup(f.recuperation.course, formatDateCivile(f.recuperation.reprise, loc, { day: "numeric", month: "long" })));
  return l;
}

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
  const faitsBilan = i.bilan ? lignesBilanEmail(i.bilan.faits, i.lang) : [];
  const lignes: string[] = [t.hello(i.firstName), ""];
  if (i.bilan) {
    lignes.push(`${t.bilanTitre} :`, ...faitsBilan.map((f) => `- ${f}`), "");
    lignes.push(i.bilan.texte ?? `${t.bilanLire} : ${i.appUrl}/dashboard`, "");
  }
  lignes.push(t.intro(seances), "");
  if (objLine) lignes.push(objLine, "");
  lignes.push(`${t.weekTitle} :`);
  for (const j of jours) lignes.push(`  ${jourLabel(j.date)} — ${j.titre ?? t.rest}`);
  lignes.push("", `${t.cta} : ${i.appUrl}/dashboard/calendrier`, "");
  if (!i.bilan && i.teaserPremium) lignes.push(`${t.teaser} ${t.teaserCta} : ${i.appUrl}/pricing`, "");
  lignes.push("—", t.footer,
    `${t.manage} : ${i.appUrl}/dashboard/profile`);
  const text = lignes.join("\n");

  // Le texte du coach : du texte brut échappé, ses paragraphes gardés.
  const texteCoach = i.bilan?.texte
    ? `<div style="margin-top:12px;font-size:14px;line-height:1.65;color:#0f172a">${esc(i.bilan.texte).replace(/\n{2,}/g, "<br><br>").replace(/\n/g, " ")}</div>`
    : `<div style="margin-top:12px"><a href="${esc(`${i.appUrl}/dashboard`)}" style="color:${VERT};font-size:14px;font-weight:600;text-decoration:none">${esc(t.bilanLire)} →</a></div>`;
  const blocBilan = i.bilan
    ? carte(`${titreBloc(t.bilanTitre)}
         <div style="margin-top:8px;font-size:14px;line-height:1.7;color:#334155">${faitsBilan.map((f) => `<div>${esc(f)}</div>`).join("")}</div>
         ${texteCoach}`)
    : "";
  const blocTeaser = !i.bilan && i.teaserPremium
    ? `<div style="margin-top:20px;font-size:13px;line-height:1.6;color:#64748b">${esc(t.teaser)} <a href="${esc(`${i.appUrl}/pricing`)}" style="color:${VERT};font-weight:600;text-decoration:none">${esc(t.teaserCta)}</a></div>`
    : "";

  const contenu = `
      <div style="font:600 17px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a">${esc(t.hello(i.firstName))}</div>
      ${blocBilan}
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
      ${bouton(`${i.appUrl}/dashboard/calendrier`, t.cta)}
      ${blocTeaser}`;

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
  apercu?: { to: string; subject: string; jours: number; bilan: boolean };
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
    .select(`email, full_name, preferred_language, notif_coach, ${COLONNES_ACCES}`).eq("id", opts.userId).maybeSingle();
  const p = prof as { email?: string | null; full_name?: string | null; preferred_language?: string | null; notif_coach?: boolean | null; created_at?: string | null; subscription_tier?: string | null } | null;
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://pacevo.fr").replace(/\/+$/, "");
  const firstName = String(p.full_name ?? "").trim().split(/\s+/)[0] || p.email.split("@")[0];
  // ── LE BILAN DE LA SEMAINE ÉCOULÉE (Premium, essai) : du lundi au dimanche d'hier.
  //    Calculé, jamais rédigé ici ; le texte du coach seulement s'il existe DÉJÀ pour ces faits.
  const etat = accesDe(p).etat;
  let bilan: BilanEmail | null = null;
  if (peut(etat, "bilan")) {
    const faits = await faitsDeLaSemaine(admin, opts.userId, decaleJour(dates[0], -1)).catch(() => null);
    // Une semaine sans course n'a pas de bilan : un bloc « 0 séance » n'apprend rien.
    if (faits && faits.seances > 0) {
      const { data: memo } = await admin.from("notifications").select("data")
        .eq("user_id", opts.userId).eq("type", TYPE_BILAN).maybeSingle();
      const prec = memo?.data as { empreinte?: string; texte?: string } | null;
      const memeFaits = !!prec?.texte && prec.empreinte === empreinteBilan(lignesDuBilan(faits), lang);
      bilan = { faits, texte: memeFaits ? prec!.texte! : null };
    }
  }
  const mail = buildPlanSemaineEmail({ lang, firstName, jours, objective, appUrl, bilan, teaserPremium: etat === "starter" });
  if (!mail) return { sent: false, skipped: "aucune séance prescrite sur les sept jours" };

  if (opts.blanc) {
    return { sent: false, skipped: "essai à blanc", apercu: { to: p.email, subject: mail.subject, jours: jours.filter((j) => j.titre).length, bilan: !!bilan } };
  }

  // La porte unique lit la réponse et journalise tout refus dans `error_logs`.
  const r = await envoyerEmail("plan-semaine", {
        // ⚠️ ADRESSE DE RÉPONSE — l'expéditeur n'est PAS une boîte qui reçoit : sans
        // `reply_to`, l'athlète qui clique sur « Répondre » écrit dans le vide et croit
        // avoir été ignoré. Un échange effectif est aussi un signal positif pour le
        // classement du courrier. L'adresse vient de `EDITEUR`, jamais recopiée — un test
        // l'interdit.
        reply_to: EDITEUR.email,
        to: [p.email], subject: mail.subject, text: mail.text, html: mail.html,
      }, { userId: opts.userId, url: "lib/notify/planSemaine" });
  return r.ok ? { sent: true } : { sent: false, skipped: r.erreur };
}
