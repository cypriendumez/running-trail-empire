// ─────────────────────────────────────────────────────────────────────────────
//  COACH AUTONOME — « l'IA qui s'occupe de tout »
//  Chaque nuit, pour CHAQUE athlète : on reconstruit son contexte complet (forme,
//  charge, sommeil, VFC, santé, objectif, périodisation) et on republie un plan
//  glissant de 7 jours dans son calendrier + sur sa montre. Aucune intervention
//  du coach n'est requise ; il consulte, il ne pilote pas.
//
//  Déterministe (pas d'appel LLM) → fiable pour un cron qui tourne sans surveillance.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAthleteContext } from "@/lib/ai/coachContext";
import { buildWeekPlan, CONFIRMED_DAYS, type PlanDay } from "@/lib/ai/autoPlan";
import { pushIntervalsWorkout, supprimerIntervalsWorkout, buildWorkoutDescription, ensureRunThresholdPace, litMontre } from "@/lib/watch/intervals";
import { profilPeut, COLONNES_ACCES, JOURS_APERCU } from "@/lib/billing/access";
import { identifiantsDePaire } from "@/lib/intervals/identifiants";

type Admin = SupabaseClient;
export type AutoResult = {
  processed: boolean; days?: number; pushed?: number; reason?: string;
  /** E-mail « ton plan est à jour » : envoyé, ou motif de non-envoi. Jamais silencieux. */
  emailed?: boolean; emailSkipped?: string;
};

export async function autoCoachForUser(
  admin: Admin,
  opts: {
    userId: string; athleteId?: string | null; apiKey?: string | null;
    /** Prévenir l'athlète par e-mail. VRAI uniquement quand la republication est
     *  déclenchée par une séance RÉELLEMENT nouvelle. Le filet de nuit, lui, repasse
     *  à 3 h 30 sans qu'il se soit rien produit : écrire à cette heure-là pour dire
     *  « ton plan est à jour » serait du bruit, et du bruit qui réveille. */
    notify?: boolean;
  },
): Promise<AutoResult> {
  const { userId } = opts;

  // 1) Contexte complet de l'athlète → squelette de semaine personnalisé.
  // ── VERROU D'ABONNEMENT ─────────────────────────────────────────────────────
  //  Posé ICI, et pas dans les routes : `autoCoachForUser` a QUATRE appelants
  //  (la génération manuelle, le webhook intervals.icu, le cron de nuit et la chaîne
  //  de synchronisation). Garder chacun aurait laissé exactement la même occasion
  //  d'en oublier un — et un seul oubli suffit à republier gratuitement un plan.
  //
  //  Un compte en consultation garde tout ce qu'il a déjà : historique, courses,
  //  trophées, série, et le plan qui était en place. Il ne reçoit simplement plus de
  //  NOUVELLE prescription. On ne détruit rien, on cesse de produire.
  const { data: profilAcces } = await admin.from("profiles").select(COLONNES_ACCES).eq("id", userId).maybeSingle();
  const acces = profilAcces as Parameters<typeof profilPeut>[0];
  const planComplet = profilPeut(acces, "plan");
  // ⚠️ LE GRATUIT NE RECEVAIT RIEN — impasse commerciale : un compte qui ne voit jamais
  // le produit ne peut pas décider de le payer. Il reçoit désormais un APERÇU de deux
  // jours. Ce n'est PAS un plan générique : il sort des mêmes données que le plan
  // complet, parce qu'un « plan standard » qui ignore la VFC prescrirait de la VMA à
  // quelqu'un d'épuisé — l'exact contraire de ce que ce produit défend.
  const apercu = !planComplet && profilPeut(acces, "apercu");
  if (!planComplet && !apercu) {
    return { processed: false, reason: "essai_expire" };
  }

  const ctx = await buildAthleteContext(admin as unknown as Parameters<typeof buildAthleteContext>[0], userId).catch(() => null);
  if (!ctx) return { processed: false, reason: "ctx_failed" };

  // ⚠️ Tronqué APRÈS construction, jamais pendant : le squelette de semaine tient compte
  // de l'enchaînement qualité → récupération. Le raccourcir en amont donnerait deux
  // séances qui n'ont plus de sens l'une par rapport à l'autre.
  const semaineComplete = buildWeekPlan(ctx);
  const week = apercu ? semaineComplete.slice(0, JOURS_APERCU) : semaineComplete;
  const today = week[0].date;

  // ── LA SÉANCE DÉJÀ COURUE NE SE RÉÉCRIT PAS ─────────────────────────────────
  // L'effacement portait sur « date >= aujourd'hui ». Tant que le plan n'était
  // republié qu'à 3 h 30, personne ne s'en apercevait. En replanifiant JUSTE APRÈS
  // une séance, la prescription du jour est réécrite dans la seconde qui suit son
  // exécution : l'athlète qui vient de faire sa séance au seuil voit sa journée se
  // transformer en « Récupération » — parce que le verdict de fraîcheur, lui, tient
  // désormais compte de l'effort qu'il vient de fournir. On lui réécrit son passé.
  //
  // Dès qu'une séance est enregistrée aujourd'hui, le jour 0 est donc GELÉ : on ne
  // touche qu'à partir de demain. Le suivi d'adhérence (prescrit vs réalisé) en
  // dépend aussi — comparer le réalisé à une prescription réécrite après coup ne
  // mesure plus rien.
  const { data: doneToday } = await admin.from("workouts")
    .select("id").eq("user_id", userId).eq("date", today).limit(1);
  const dayZeroFrozen = (doneToday?.length ?? 0) > 0;
  const from = dayZeroFrozen ? week[1].date : today;

  // 2) Remplace le plan à venir. On n'efface QUE le futur : l'historique des séances
  //    déjà passées reste intact pour le suivi d'adhérence.
  await admin.from("notifications").delete()
    .eq("user_id", userId).eq("type", "coach_session").gte("data->>date", from);

  const rows = week.filter((d: PlanDay) => d.date >= from).map((d: PlanDay) => ({
    user_id: userId,
    type: "coach_session",
    // ⚠️ `title` et `body` restent en FRANÇAIS : ce sont les champs canoniques, ceux
    // que la montre analyse et que l'IA relit. La version lue par l'athlète est dans
    // `data.i18n`, et l'écran choisit la sienne. Voir lib/ai/planI18n.ts.
    title: d.title.slice(0, 80),
    body: d.detail.slice(0, 200),
    data: {
      from: "coach-auto",
      date: d.date,
      sessionType: d.type,
      subtitle: d.detail.slice(0, 500),
      why: d.why.slice(0, 400),
      feel: "",
      tags: d.tags.slice(0, 4),
      confirmed: d.confirmed,
      // Le même jour dans les autres langues — mêmes troncatures que le français, sinon
      // une langue afficherait une phrase coupée là où une autre la termine.
      // Le français n'y est pas : il est déjà au-dessus (une seule vérité).
      ...(d.i18n ? { i18n: Object.fromEntries(Object.entries(d.i18n).map(([lang, t]) => [lang, {
        title: t.title.slice(0, 80),
        subtitle: t.detail.slice(0, 500),
        why: t.why.slice(0, 400),
        tags: t.tags.slice(0, 4),
      }])) } : {}),
      // Créneau de la journée. SANS lui, la déduplication des écrans (qui porte sur
      // `date#moment`) confondrait les deux séances d'un jour doublé et n'en garderait
      // qu'une — celle qui a été écrite en dernier, au hasard de l'insertion.
      ...(d.moment ? { moment: d.moment } : {}),
    },
  }));
  const { error } = await admin.from("notifications").insert(rows);
  if (error) return { processed: false, reason: error.message };

  // 3) Montre : SEULEMENT les jours confirmés. Pousser du prévisionnel encombrerait
  //    Garmin de séances qui vont changer avant d'être courues.
  let pushed = 0;
  // ⚠️ AUCUN REPLI SUR LES VARIABLES D'ENVIRONNEMENT — voir `lib/intervals/identifiants`.
  // C'EST ICI que le défaut se voyait le mieux : le `|| process.env.INTERVALS_ICU_*`
  // faisait pousser le plan de CHAQUE athlète sans montre branchée dans le calendrier
  // intervals.icu de l'éditeur. Relevé le 23/08/2026 sur son compte : deux séances pour
  // le 23/08, `rte-coach-ef60cb0c-…` (la sienne) et `rte-coach-19ab4adf-…` (celle d'un
  // autre inscrit). L'`external_id` porte l'identifiant de l'athlète, donc elles ne
  // s'écrasaient pas — elles s'EMPILAIENT sur le poignet de l'éditeur, pendant que le
  // client, lui, ne recevait rien et voyait « plan poussé sur ta montre ».
  const ids = identifiantsDePaire(opts.athleteId, opts.apiKey);
  const athleteId = ids?.athleteId;
  const apiKey = ids?.apiKey;
  if (athleteId && apiKey && !apercu) {
    try {
      const { data: objRow } = await admin.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle();
      const objectiveRace = ((objRow?.data as { race?: string } | undefined)?.race) || null;
      const { data: prof } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
      const warmMin = (prof?.warmup_min as number | null | undefined) ?? null;
      const coolMin = (prof?.cooldown_min as number | null | undefined) ?? null;
      await ensureRunThresholdPace({ athleteId, apiKey, vmaKmh: ctx.vma });
      // UNE seule lecture pour toute la semaine : la montre ne change pas entre deux jours
      // du même plan, et un appel par jour ferait sept requêtes pour une seule réponse.
      const montre = await litMontre({ athleteId, apiKey });
      // Même règle que pour le calendrier : on ne pousse pas sur la montre une séance
      // pour un jour déjà couru. Elle y remplacerait, après coup, celle qui a servi.
      // ⚠️ CONFIRMED_DAYS compte des JOURS, pas des entrées. `slice(0, 5)` était juste
      // tant qu'il y avait une séance par jour ; avec un jour doublé, il aurait poussé
      // quatre jours au lieu de cinq — en silence, et seulement pour les athlètes qui
      // doublent. On sélectionne donc les dates, puis toutes leurs séances.
      const datesConfirmees = [...new Set(week.map((x) => x.date))].sort().slice(0, CONFIRMED_DAYS);
      for (const d of week.filter((x) => x.date >= from && datesConfirmees.includes(x.date))) {
        const built = buildWorkoutDescription(d.title, d.detail, `${d.type} ${d.tags.join(" ")}`, objectiveRace, ctx.vma, warmMin, coolMin, montre);
        // ⚠️ UN JOUR SANS SÉANCE COURABLE DOIT ÊTRE NETTOYÉ, PAS IGNORÉ. `continue` seul
        // laissait sur la montre la séance poussée la veille, quand ce jour portait encore
        // un footing. Résultat constaté le 31/08/2026 : plan « Repos », montre « Footing ».
        // Le coureur suit sa montre — il court un jour de récupération prescrit.
        if (!built) {
          await supprimerIntervalsWorkout({ athleteId, apiKey, userId, date: d.date });
          continue;
        }
        // Le créneau entre dans le NOM : deux séances le même jour, sur la montre, ne
        // se distinguent autrement que par leur contenu — et on ne lit pas un descriptif
        // dans une liste de séances à 6 h du matin.
        const nom = d.moment ? `${built.name} — ${d.moment === "matin" ? "matin" : "soir"}` : built.name;
        const r = await pushIntervalsWorkout({ athleteId, apiKey, userId, name: nom, date: d.date, description: built.description, sport: built.sport });
        if (r.ok) pushed++;
      }
    } catch { /* best effort : le calendrier reste publié même si Garmin est injoignable */ }
  }

  // 4) PRÉVENIR L'ATHLÈTE — sinon la replanification instantanée ne sert à rien.
  //
  // Le plan est prêt bien avant qu'il pense à ouvrir l'application : sans un mot, on a
  // résolu un problème que personne ne voit. L'envoi est encadré par trois règles
  // (consentement, rythme, rien d'inventé) : voir lib/notify/planReady.
  //
  // On lit l'état PRÉCÉDENT avant de l'écraser : c'est lui qui porte la date du dernier
  // e-mail, ce qui évite une colonne dédiée en base.
  const { data: prevState } = await admin.from("notifications").select("id, data")
    .eq("user_id", userId).eq("type", "auto_coach_state").maybeSingle();
  const lastEmailAt = (prevState?.data as { lastPlanEmailAt?: string } | null)?.lastPlanEmailAt ?? null;
  let emailed = false;
  // ⚠️ L'e-mail « ton plan est à jour » annonce SEPT jours de prescription. L'envoyer
  // pour un aperçu de deux jours promettrait un service qui n'est pas celui du palier.
  let emailSkipped: string | undefined = apercu
    ? "aperçu gratuit"
    : opts.notify ? undefined : "replanification sans séance nouvelle";
  if (opts.notify && !apercu) {
    const { sendPlanReadyEmail } = await import("@/lib/notify/planReady");
    const r = await sendPlanReadyEmail(admin, {
      userId,
      lastSession: ctx.lastSession ? { ...ctx.lastSession, shows: ctx.lastSession.shows.slice(0, 4) } : null,
      // Ce qui reste À VENIR : une séance déjà courue n'a rien à faire dans un e-mail
      // qui annonce la suite.
      // `type` et `detail` restent français (ils sont filtrés par mots-clés) ; `i18n`
      // permet à l'e-mail d'écrire le NOM des séances dans la langue de l'athlète.
      days: week.filter((d) => d.date >= from).map((d) => ({
        date: d.date, type: d.type, title: d.title, detail: d.detail,
        ...(d.i18n ? { i18n: Object.fromEntries(Object.entries(d.i18n).map(([l, t]) => [l, { title: t.title }])) } : {}),
      })),
      objective: ctx.objective ? { race: ctx.objective.race, daysToRace: ctx.daysToRace } : null,
      lastEmailAt,
    }).catch(() => ({ sent: false, skipped: "erreur inattendue" }));
    emailed = r.sent;
    emailSkipped = r.skipped;
  }

  // 5) Trace du dernier passage + POURQUOI le plan ressemble à ça.
  //
  // Défaut réel corrigé ici : un athlète venait de basculer son objectif d'un 10 km vers
  // un marathon et voyait sept footings identiques dans son calendrier. Il en a conclu que
  // le coach avait ignoré son changement. En réalité le macro-plan ÉTAIT devenu spécifique
  // marathon (Seuil + Allure mara), mais aucune qualité n'était posée cette semaine-là
  // parce que son ratio aigu:chronique était à 2,4 et son TSB à −44 — une fatigue bien
  // réelle. L'application savait tout cela et n'en disait rien nulle part.
  //
  // On sérialise donc l'explication À L'INSTANT où le plan est construit, avec le même
  // contexte : le calendrier ne peut alors plus afficher une raison qui contredit le plan.
  const stateData = {
    at: new Date().toISOString(), days: rows.length, pushed,
    readiness: ctx.readiness.level,
    reasons: ctx.readiness.reasons.slice(0, 4),
    advice: ctx.readiness.advice.slice(0, 400),
    qBudget: ctx.weekPlan.qBudget,
    // La dernière qualité n'a survécu que grâce au plancher « préparation en cours » :
    // le bandeau doit le dire, sinon l'athlète voit une séance allégée sans savoir
    // qu'elle a failli disparaître, ni pourquoi elle est raccourcie.
    qualityFloored: ctx.weekPlan.floored,
    // Sport pratiqué hors course : c'est souvent LUI qui explique un allègement, et
    // l'athlète n'avait aucun moyen de le savoir (le calendrier ne montre que la course).
    cross: ctx.cross.label ? { label: ctx.cross.label, minutes: ctx.cross.minutes, tss: ctx.cross.tss, sharePct: ctx.cross.sharePct } : null,
    // CE QUE LA DERNIÈRE SÉANCE A MONTRÉ. Depuis que le plan est republié dans la minute
    // qui suit une séance, l'athlète voit son calendrier bouger : il doit lire pourquoi,
    // sans avoir à ouvrir une page d'analyse.
    lastSession: ctx.lastSession
      ? { ...ctx.lastSession, shows: ctx.lastSession.shows.slice(0, 4) }
      : null,
    // Le jour 0 a-t-il été gelé parce qu'une séance y était déjà enregistrée ?
    dayZeroFrozen,
    // L'objectif tel qu'il a RÉELLEMENT été pris en compte : c'est ce qui permet à
    // l'athlète de vérifier que son changement a bien été enregistré.
    objective: ctx.objective ? { race: ctx.objective.race, raceDate: ctx.objective.raceDate, distanceKm: ctx.objective.distanceKm } : null,
    daysToRace: ctx.daysToRace,
    // Heure de départ saisie par l'athlète — absente du catalogue, les agrégateurs ne la
    // publient pas. On la fait suivre jusqu'au calendrier, où elle sert vraiment.
    heureDepart: ctx.objective?.heureDepart ?? null,
    phase: ctx.macroPlan[0]?.phase ?? null,
    plannedQuality: ctx.macroPlan[0]?.quality ?? [],
    nextWeekQuality: ctx.macroPlan[1]?.quality ?? [],
    targetKm: ctx.volume.targetKm,
    longRunKm: ctx.volume.longRunKm,
    // Avertissements de réalisme : ils ne vivaient que dans le prompt de l'IA, donc
    // l'athlète ne les voyait jamais sur son calendrier.
    warnings: ctx.objectiveWarnings.slice(0, 3),
    // Date du dernier e-mail RÉELLEMENT parti — c'est elle qui espace les envois. Elle
    // est reportée telle quelle quand rien n'a été envoyé : l'écraser remettrait le
    // compteur à zéro et autoriserait un e-mail toutes les dix minutes.
    lastPlanEmailAt: emailed ? new Date().toISOString() : lastEmailAt,
  };
  if (prevState?.id) await admin.from("notifications").update({ data: stateData }).eq("id", prevState.id);
  else await admin.from("notifications").insert({ user_id: userId, type: "auto_coach_state", title: "auto-coach", body: "", data: stateData });

  return { processed: true, days: rows.length, pushed, emailed, emailSkipped };
}
