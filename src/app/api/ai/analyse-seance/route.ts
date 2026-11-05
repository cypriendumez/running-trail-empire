export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigeAcces } from "@/lib/billing/guard";
import { COLONNES_ACCES, profilPeut } from "@/lib/billing/access";
import { generateContent, budget } from "@/lib/ai/gemini";
import { faitsDeSeance, type SeanceBrute, type ContexteSeance } from "@/lib/ai/analyseSeance";
import { inviteAnalyse } from "@/lib/ai/inviteAnalyse";
import { serieVfc, COLONNES_VFC } from "@/lib/health/vfc";
import { computeLoad } from "@/lib/dashboard/charge";
import { decaleJour } from "@/lib/streak/compute";
import { intervallesDeSeance, fluxDeSeance } from "@/lib/intervals/performance";
import { identifiantsDe, type ProfilIdentifiants } from "@/lib/intervals/identifiants";
import { getAccountLang } from "@/lib/i18n/serverLang";

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
  const [{ data: cache }, { data: profilAcces }] = await Promise.all([
    supabase.from("notifications").select("id,body,data")
      .eq("user_id", user.id).eq("type", TYPE_ANALYSE).eq("data->>workout_id", workoutId).limit(1),
    supabase.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle(),
  ]);
  const complet = profilPeut(profilAcces as Parameters<typeof profilPeut>[0], "analyse_complete");
  const memo = cache?.[0] as { id?: string; body?: string | null; data?: { complete?: boolean; longue?: boolean } | null } | undefined;
  // ⚠️ UNE ANALYSE ESSENTIELLE NE SE RESSERT PAS À PREMIUM. Qui passe à Premium et rouvre
  // une séance relue du temps de Starter doit recevoir l'analyse complète qu'il paie : on
  // la refait, une fois, à la place de l'ancienne. (`longue` : le nom d'avant le 30/10/2026,
  // quand Starter recevait lui aussi la version complète.)
  const memoComplet = memo?.data?.complete ?? memo?.data?.longue ?? false;
  const resservir = () => NextResponse.json({ ok: true, texte: memo!.body, memorise: true, complete: memoComplet });
  if (memo?.body && (memoComplet || !complet)) return resservir();

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
  const [profilRes, baseRes, compRes, prescritRes] = await Promise.all([
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
  ]);

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
  const faits = faitsDeSeance(s, { fcMax }, comparables,
    p ? { type: p.data?.sessionType ?? null, titre: p.title ?? null, detail: p.data?.subtitle ?? p.body ?? null } : null,
    intervalles, contexte, flux);

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
    data: { workout_id: workoutId, date: String(s.date).slice(0, 10), complete: complet, lang },
  };
  // L'analyse essentielle remplacée par la complète : la MÊME ligne, pas une seconde — la
  // lecture du cache n'en prend qu'une, au hasard de l'ordre de la base.
  const { error: eIns } = memo?.id
    ? await admin.from("notifications").update(ligne).eq("id", memo.id).eq("user_id", user.id)
    : await admin.from("notifications").insert({ user_id: user.id, type: TYPE_ANALYSE, ...ligne });
  if (eIns) console.error("[analyse-seance] analyse non mémorisée, elle sera repayée :", eIns.message);

  return NextResponse.json({ ok: true, texte, memorise: false, tronquee: r.tronquee === true, complete: complet });
}
