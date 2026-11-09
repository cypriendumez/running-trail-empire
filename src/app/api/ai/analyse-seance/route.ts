export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigeAcces } from "@/lib/billing/guard";
import { COLONNES_ACCES, profilPeut } from "@/lib/billing/access";
import { generateContent, budget } from "@/lib/ai/gemini";
import { faitsDeSeance, courseDuJour, TYPE_COURSE, type SeanceBrute, type ContexteSeance, type ObjectifAvecPrecedente } from "@/lib/ai/analyseSeance";
import { inviteAnalyse } from "@/lib/ai/inviteAnalyse";
import { serieVfc, COLONNES_VFC } from "@/lib/health/vfc";
import { computeLoad } from "@/lib/dashboard/charge";
import { decaleJour } from "@/lib/streak/compute";
import { intervallesDeSeance, fluxDeSeance } from "@/lib/intervals/performance";
import { identifiantsDe, type ProfilIdentifiants } from "@/lib/intervals/identifiants";
import { getAccountLang } from "@/lib/i18n/serverLang";
import { journaliserEchec } from "@/lib/journal/echecServeur";
import { pausesDeTrace, pointsStockes, vitesseEnMouvement } from "@/lib/activities/pauses";

/**
 * L'ANALYSE D'UNE SÉANCE — passée ou tout juste arrivée.
 *
 * Le coach PROPOSAIT la séance du jour (`/api/ai/session`) et ne relisait jamais celles
 * déjà courues : l'athlète voyait ses chiffres bruts et devait les interpréter seul,
 * c'est-à-dire faire lui-même le travail qu'il paie.
 *
 * ⚠️ TROIS RÈGLES GOUVERNENT CETTE ROUTE, et chacune répond à un piège déjà rencontré
 * ailleurs dans ce projet :
 *
 * 1. ELLE EST VERROUILLÉE CÔTÉ SERVEUR. Faire parler un modèle est exactement ce que les
 *    formules facturent — c'est la seule partie du produit dont le coût grandit avec le
 *    nombre d'athlètes. Masquer le bouton ne protège rien : la route resterait appelable
 *    à la main, et c'est l'appel qui coûte.
 *
 * 2. ELLE EST MÉMORISÉE POUR TOUJOURS. Une séance passée ne change plus : la réanalyser
 *    à chaque ouverture ferait payer plusieurs fois le même texte. La clé est
 *    l'identifiant de la séance, pas le jour.
 *
 * 3. LE MODÈLE N'A PAS LE DROIT D'INVENTER UN CHIFFRE. Il reçoit des faits calculés
 *    (`lib/ai/analyseSeance`) et la liste explicite de ce qu'ON NE SAIT PAS. Un modèle à
 *    qui on tend des données brutes en fabrique toujours un récit cohérent et faux.
 */
export const TYPE_ANALYSE = "seance_analyse";

/** Séances comparables remontées pour situer celle-ci. Au-delà, on paie des lignes qui
 *  ne changeront pas le rang. */
const COMPARABLES_MAX = 120;

const COLS = "id,date,title,sport,distance_km,duration_seconds,avg_pace_min_km,gap_min_km,avg_hr,max_hr,elevation_gain_m,hr_zone_seconds,avg_cadence_spm,weather_temp_c,cardiac_decoupling,avg_power_watts,ground_contact_ms,vertical_oscillation_cm,stride_length_m,external_id";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workoutId = String((body as { workoutId?: unknown })?.workoutId ?? "").trim();
  if (!workoutId) return NextResponse.json({ error: "workoutId manquant" }, { status: 400 });

  // ── 1. La réponse mémorisée d'abord : elle évite l'appel ET le verrou n'a pas à
  //       repayer un texte déjà produit pour cet athlète.
  const [{ data: cache, error: eCache }, { data: profilAcces, error: eAcces }] = await Promise.all([
    supabase.from("notifications").select("id,body,data")
      .eq("user_id", user.id).eq("type", TYPE_ANALYSE).eq("data->>workout_id", workoutId).limit(1),
    supabase.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle(),
  ]);
  // ⚠️ UNE LECTURE RATÉE N'EST NI « PAS D'ANALYSE EN MÉMOIRE » NI « PAS PREMIUM » (08/11/2026) :
  // la première refaisait payer une analyse déjà écrite, la seconde servait l'analyse
  // essentielle à un abonné Premium. Réessayer peut réussir : 503.
  if (eCache || eAcces) {
    console.error("[analyse-seance] mémoire ou accès illisible :", (eCache ?? eAcces)!.message);
    return NextResponse.json({ error: "Analyse momentanément indisponible, réessaie dans un moment." }, { status: 503 });
  }
  const complet = profilPeut(profilAcces as Parameters<typeof profilPeut>[0], "analyse_complete");
  const memo = cache?.[0] as { id?: string; body?: string | null; data?: { complete?: boolean; longue?: boolean } | null } | undefined;
  // ⚠️ UNE ANALYSE ESSENTIELLE NE SE RESSERT PAS À PREMIUM. Qui passe à Premium et rouvre
  // une séance relue du temps de Starter doit recevoir l'analyse complète qu'il paie : on
  // la refait, une fois, à la place de l'ancienne. (`longue` : le nom d'avant le 30/10/2026,
  // quand Starter recevait lui aussi la version complète.)
  const memoComplet = memo?.data?.complete ?? memo?.data?.longue ?? false;
  const resservir = () => NextResponse.json({ ok: true, texte: memo!.body, memorise: true, complete: memoComplet });
  // ⚠️ UNE ANALYSE DU JOUR DE COURSE ÉCRITE SANS LE SAVOIR SE REFAIT, UNE FOIS (09/11/2026). Le
  // marathon de Lille avait été jugé contre la « Récupération » publiée ce jour-là. Les analyses
  // mémorisées avant la reconnaissance du jour de course n'ont pas `data.course` : si la séance
  // était la course, on la relit à la place de l'ancienne (même ligne, voir plus bas).
  const memoCourse = (memo?.data as { course?: boolean } | null | undefined)?.course === true;
  if (memo?.body && (memoComplet || !complet) && (memoCourse || !(await estJourDeCourse(supabase, user.id, workoutId)))) return resservir();

  // ── 2. Verrou d'abonnement — APRÈS le cache, AVANT le modèle.
  //       Plafond du jour atteint pendant une mise à niveau : l'analyse déjà écrite reste lisible.
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return memo?.body ? resservir() : refus.reponse;

  // ── 3. La séance, et elle doit appartenir à l'appelant.
  const { data: seance, error: eSeance } = await supabase.from("workouts").select(COLS)
    .eq("id", workoutId).eq("user_id", user.id).maybeSingle();
  if (eSeance) {
    console.error("[analyse-seance] séance illisible :", eSeance.message);
    return NextResponse.json({ error: "Séance illisible." }, { status: 500 });
  }
  if (!seance) return NextResponse.json({ error: "Séance introuvable." }, { status: 404 });
  const s = seance as unknown as SeanceBrute;

  // ── 4. Le contexte qui rend l'analyse utile : repères, comparables, prescrit.
  const [profilRes, baseRes, compRes, prescritRes, objRes] = await Promise.all([
    // Les identifiants intervals.icu servent à relire les intervalles (analyse complète) ;
    // ils restent ici, côté serveur, et ne repartent jamais vers le navigateur.
    supabase.from("profiles").select("age, intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle(),
    supabase.from("performance_baselines").select("max_hr").eq("user_id", user.id)
      .order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("workouts").select("date,distance_km,duration_seconds,avg_pace_min_km,gap_min_km,avg_hr,max_hr")
      .eq("user_id", user.id).eq("sport", s.sport ?? "run").neq("id", workoutId)
      .order("date", { ascending: false }).limit(COMPARABLES_MAX),
    supabase.from("notifications").select("title,body,data").eq("user_id", user.id)
      .eq("type", "coach_session").eq("data->>date", String(s.date).slice(0, 10)).limit(1),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
  ]);

  // ⚠️ DES REPÈRES ILLISIBLES NE SONT PAS DES REPÈRES ABSENTS (08/11/2026). Sans la FC max de
  // référence ni les comparables, `fcMax` devenait le pic de CETTE seule sortie (dès 150 bpm)
  // et le verdict d'intensité partait faux, sans signe de dégradation ; sans le prescrit,
  // la séance était jugée comme si rien n'était prévu. On n'analyse pas à l'aveugle : 503.
  const eRepere = profilRes.error ?? baseRes.error ?? compRes.error ?? prescritRes.error ?? objRes.error;
  if (eRepere) {
    console.error("[analyse-seance] repères illisibles :", eRepere.message);
    return NextResponse.json({ error: "Analyse momentanément indisponible, réessaie dans un moment." }, { status: 503 });
  }
  const comparables = (compRes.data ?? []) as unknown as SeanceBrute[];
  // ⚠️ MÊME SOURCE DE FC MAX QUE LE COACH : mesure de référence, sinon le maximum
  // réellement observé, sinon la formule d'âge. Deux sources divergentes donneraient deux
  // verdicts d'intensité pour la même séance selon l'écran.
  const obsMax = Math.max(0, ...comparables.map((w) => Number(w.max_hr) || 0), Number(s.max_hr) || 0);
  const age = Number((profilRes.data as { age?: number | null } | null)?.age);
  const fcMax = Number((baseRes.data as { max_hr?: number | null } | null)?.max_hr)
    || (obsMax > 150 ? obsMax : 0)
    || (Number.isFinite(age) && age > 0 ? 220 - age : 0)
    || null;

  const p = prescritRes.data?.[0] as { title?: string; body?: string; data?: { sessionType?: string; subtitle?: string } } | undefined;
  // ── Les intervalles, pour l'analyse COMPLÈTE seulement : un appel à intervals.icu de plus,
  //    que Starter n'a pas à attendre. Sans identifiant d'activité ni clé, on ne peut pas les
  //    lire — « illisible », pour que l'analyse le dise au lieu de juger un fractionné à l'aveugle.
  const creds = identifiantsDe(profilRes.data as ProfilIdentifiants);
  const intervalles = complet
    ? (s.external_id && creds ? await intervallesDeSeance(String(s.external_id), creds.apiKey) : "illisible" as const)
    : undefined;
  // ── Le contexte du jour, pour l'analyse COMPLÈTE : ressenti de CETTE séance, nuit, VFC du
  //    matin, fraîcheur de la veille. Chaque lecture ratée devient « non mesuré », jamais 0.
  const jourSeance = String(s.date).slice(0, 10);
  const contexte: ContexteSeance | undefined = complet ? await (async () => {
    const [fbRes, nuitRes, vfcRes, chargeRes] = await Promise.all([
      supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "session_feedback")
        .eq("data->>date", jourSeance).order("created_at", { ascending: false }).limit(5),
      supabase.from("sleep_data").select("sleep_score,total_sleep_min").eq("user_id", user.id).eq("date", jourSeance).limit(1).maybeSingle(),
      supabase.from("hrv_data").select(COLONNES_VFC).eq("user_id", user.id).gte("date", decaleJour(jourSeance, -7)).lte("date", jourSeance),
      supabase.from("workouts").select("date,type,tss,duration_seconds").eq("user_id", user.id)
        .gte("date", decaleJour(jourSeance, -180)).lt("date", jourSeance),
    ]);
    // Le ressenti de CETTE séance : celui qui la nomme, sinon le seul déclaré ce jour-là.
    const fbs = ((fbRes.data ?? []) as { data?: { rpe?: unknown; workout_id?: string } | null }[]).map((x) => x.data ?? {});
    const fb = fbs.find((d) => d.workout_id === workoutId) ?? (fbs.length === 1 && !fbs[0].workout_id ? fbs[0] : null);
    const rpe = Number(fb?.rpe);
    const nuit = nuitRes.data as { sleep_score?: number | null; total_sleep_min?: number | null } | null;
    const vfc = serieVfc((vfcRes.data ?? []) as { date: string; rmssd: number | null; sdnn: number | null }[]).lignes;
    const matin = vfc.find((x) => x.date === jourSeance)?.hrv_ms ?? null;
    const avant = vfc.filter((x) => x.date < jourSeance && x.hrv_ms != null).map((x) => x.hrv_ms as number);
    const charge = (chargeRes.data ?? []) as { date: string; type?: string | null; tss?: number | null; duration_seconds?: number | null }[];
    const forme = charge.length >= 5 ? computeLoad(charge, decaleJour(jourSeance, -1)) : null;
    return {
      ressenti: Number.isFinite(rpe) && rpe >= 0 && rpe <= 10 ? { rpe: Math.round(rpe) } : null,
      nuit: nuit && (nuit.sleep_score != null || nuit.total_sleep_min != null)
        ? { score: nuit.sleep_score ?? null, minutes: nuit.total_sleep_min != null ? Math.round(nuit.total_sleep_min) : null } : null,
      vfc: matin != null ? { matin: Math.round(matin), base: avant.length >= 3 ? Math.round(avant.reduce((a, b) => a + b, 0) / avant.length) : null } : null,
      forme: forme ? { tsb: Math.round(forme.tsb), ctl: Math.round(forme.ctl), atl: Math.round(forme.atl) } : null,
    };
  })() : undefined;
  // ── Les flux, pour une séance de TRAIL seulement (analyse complète) : au moins 150 m de D+
  //    et 15 m par km, ou une séance de côtes ou de trail prévue. Un appel de plus à
  //    intervals.icu, qu'une sortie sur le plat n'a pas à payer.
  const dplus = Number(s.elevation_gain_m) || 0, km = Number(s.distance_km) || 0;
  const trailLike = complet && dplus >= 150 && (km > 0 && dplus / km >= 15 || /trail|côte/i.test(p?.data?.sessionType ?? ""));
  const flux = trailLike
    ? (s.external_id && creds ? await fluxDeSeance(String(s.external_id), creds.apiKey) : "illisible" as const)
    : undefined;
  // Le jour de la course visée, le « prescrit » EST la course : la séance du coach publiée ce
  // jour-là (une « Récupération » le 25/10, jour du marathon de Lille) ne sert pas de référence.
  // ── Les arrêts, relus sur la trace déjà enregistrée (aucun appel à intervals.icu) : la base
  //    ne garde que le temps en mouvement. Sans trace lisible, `null` : l'analyse dit qu'elle
  //    ne sait pas, elle ne conclut jamais « aucun arrêt ».
  const { data: trace, error: eTrace } = await supabase.from("activity_tracks").select("points").eq("workout_id", workoutId).maybeSingle();
  if (eTrace) {
    console.error("[analyse-seance] trace illisible, arrêts inconnus :", eTrace.message);
    await journaliserEchec(null, { source: "analyse-seance", userId: user.id, url: "/api/ai/analyse-seance", message: `Trace illisible, arrêts inconnus dans l'analyse : ${eTrace.code ?? "?"} ${eTrace.message}` });
  }
  const arrets = eTrace || !trace ? null
    : pausesDeTrace(pointsStockes((trace as { points?: unknown }).points), vitesseEnMouvement(s.distance_km, s.duration_seconds));
  const course = courseDuJour((objRes.data as { data?: ObjectifAvecPrecedente } | null)?.data, String(s.date).slice(0, 10), Number(s.distance_km));
  const faits = faitsDeSeance(s, { fcMax }, comparables,
    course ? { type: TYPE_COURSE, titre: course.nom || null, detail: null }
      : p ? { type: p.data?.sessionType ?? null, titre: p.title ?? null, detail: p.data?.subtitle ?? p.body ?? null } : null,
    intervalles, contexte, flux, arrets);

  // ── 5. Le modèle. Il rédige, il ne calcule pas.
  // ⚠️ LA LANGUE DU COMPTE, PAS LE FRANÇAIS EN DUR. L'invite imposait « en français » :
  // un client allemand voyait le bouton traduit et recevait une analyse française.
  const lang = await getAccountLang(supabase, user.id);
  const invite = inviteAnalyse(faits, lang, complet);

  const r = await generateContent(
    [{ role: "user", parts: [{ text: invite }] }],
    // Le raisonnement se paie SUR le budget de sortie : sans réserve dédiée, la réponse
    // sortait coupée en pleine phrase tout en étant servie comme un succès.
    { ...budget(300, complet ? 560 : 320), temperature: 0.6 },
  );
  if (!r.ok || !r.text?.trim()) {
    // La version complète n'a pas pu s'écrire : l'essentielle déjà mémorisée vaut mieux qu'une erreur.
    if (memo?.body) return resservir();
    return NextResponse.json({ error: r.ok ? "Réponse vide du modèle." : r.error }, { status: r.ok ? 502 : (r.status ?? 502) });
  }
  const texte = r.text.trim();

  // ── 6. Mémorisation. Une séance passée ne change plus : on ne la repaiera jamais.
  //      ⚠️ L'ERREUR EST LUE. Supabase RETOURNE ses erreurs sans lever : un `try/catch`
  //      autour d'une écriture ne rattrape rien, et une mémorisation muette ferait
  //      repayer l'appel à chaque ouverture sans que personne ne le voie.
  const admin = createAdminClient();
  const ligne = {
    title: `Analyse — ${String(s.date).slice(0, 10)}`,
    body: texte,
    data: { workout_id: workoutId, date: String(s.date).slice(0, 10), complete: complet, lang, course: course != null },
  };
  // L'analyse essentielle remplacée par la complète : la MÊME ligne, pas une seconde — la
  // lecture du cache n'en prend qu'une, au hasard de l'ordre de la base.
  const { error: eIns } = memo?.id
    ? await admin.from("notifications").update(ligne).eq("id", memo.id).eq("user_id", user.id)
    : await admin.from("notifications").insert({ user_id: user.id, type: TYPE_ANALYSE, ...ligne });
  // La réponse est `ok` : sans journal, ce coût caché (quota Gemini repayé) n'existait pour personne.
  if (eIns) {
    console.error("[analyse-seance] analyse non mémorisée, elle sera repayée :", eIns.message);
    await journaliserEchec(null, { source: "analyse-seance", userId: user.id, url: "/api/ai/analyse-seance", message: `Analyse non mémorisée, quota repayé à la réouverture : ${eIns.code ?? "?"} ${eIns.message}` });
  }

  return NextResponse.json({ ok: true, texte, memorise: false, tronquee: r.tronquee === true, complete: complet });
}

/**
 * La séance était-elle la course visée ? Lu seulement pour décider si une analyse MÉMORISÉE sans
 * le savoir doit être refaite. Une lecture ratée ne déclenche rien : on ressert l'ancienne
 * plutôt que de repayer une analyse sur un doute.
 */
async function estJourDeCourse(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, workoutId: string): Promise<boolean> {
  const [{ data: w, error: eW }, { data: o, error: eO }] = await Promise.all([
    supabase.from("workouts").select("date,distance_km").eq("id", workoutId).eq("user_id", userId).maybeSingle(),
    supabase.from("notifications").select("data").eq("user_id", userId).eq("type", "race_objective").maybeSingle(),
  ]);
  if (eW || eO || !w) return false;
  const seance = w as { date?: string | null; distance_km?: number | null };
  return courseDuJour((o as { data?: ObjectifAvecPrecedente } | null)?.data, String(seance.date ?? "").slice(0, 10), Number(seance.distance_km)) != null;
}
