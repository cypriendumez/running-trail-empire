export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigeAcces } from "@/lib/billing/guard";
import { COLONNES_ACCES, profilPeut } from "@/lib/billing/access";
import { generateContent, budget } from "@/lib/ai/gemini";
import { faitsDeSeance, allureTexte, dateLisible, type SeanceBrute, type FaitsSeance } from "@/lib/ai/analyseSeance";
import { getAccountLang } from "@/lib/i18n/serverLang";
import type { Lang } from "@/lib/i18n/translations";

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

const COLS = "id,date,title,sport,distance_km,duration_seconds,avg_pace_min_km,gap_min_km,avg_hr,max_hr,elevation_gain_m,hr_zone_seconds,avg_cadence_spm,weather_temp_c";

/**
 * Les faits transmis au modèle.
 *
 * ⚠️ C'EST ICI QUE SE JOUE L'ÉCART STARTER / PREMIUM, et il ne peut pas être une simple
 * longueur de texte. Une analyse « plus longue » sur les mêmes données, c'est du
 * remplissage : le client à 14,99 € paierait des phrases, pas du service.
 *
 * Starter reçoit la lecture ESSENTIELLE — ce qui s'est passé, à quelle intensité réelle,
 * et ce qui était prescrit. Premium reçoit en plus le CONTEXTE COMPARATIF : le rang parmi
 * les séances semblables, le détail zone par zone, la cadence, la température. Ce sont
 * des dimensions d'analyse en plus, pas des mots en plus.
 *
 * Et c'est le bon sens économique : les jetons d'ENTRÉE coûtent huit fois moins que ceux
 * de sortie. Donner plus de contexte à Premium coûte presque rien ; le laisser écrire
 * beaucoup plus, si.
 */
function lignesDeFaits(f: FaitsSeance, lang: Lang, complet: boolean): string {
  const l: string[] = [];
  // ⚠️ Une date en toutes lettres, pas « 2026-08-24 » : le modèle RECOPIE ce qu'on lui
  // donne, et il servait la date brute à l'athlète — un entraîneur ne parle pas ainsi.
  l.push(`Date : ${dateLisible(f.date, lang)} — ${f.sport}`);
  if (f.distanceKm != null && f.dureeMin != null) l.push(`Distance ${f.distanceKm} km en ${f.dureeMin} min`);
  const a = allureTexte(f.allure), ac = allureTexte(f.allureCorrigee);
  if (a) l.push(`Allure ${a}/km${ac && ac !== a ? ` (corrigée du dénivelé : ${ac}/km)` : ""}`);
  if (f.fcMoy != null) l.push(`FC moyenne ${f.fcMoy}${f.fcMax != null ? `, max ${f.fcMax}` : ""}${f.partFcMax != null ? ` — ${f.partFcMax} % de sa FC max` : ""}`);
  if (f.intensite) l.push(`Intensité RÉELLE, jugée à la fréquence cardiaque : ${f.intensite === "dure" ? "séance dure" : f.intensite === "moderee" ? "modérée" : "footing facile"}`);
  if (f.dplus != null) l.push(`Dénivelé positif ${f.dplus} m`);
  // ── Réservé à la formule haute : les dimensions d'analyse supplémentaires. ──
  if (complet) {
    if (f.zonesMin) l.push(`Temps en zones (minutes, mesuré par la montre) : ${f.zonesMin.map((m, i) => `Z${i + 1} ${m}`).join(" · ")}`);
    if (f.cadence != null) l.push(`Cadence ${f.cadence} pas/min`);
    if (f.tempC != null) l.push(`Température ${f.tempC} °C`);
    if (f.rang) l.push(`Parmi ses séances de distance comparable : ${f.rang.place}ᵉ sur ${f.rang.total}`);
  }
  if (f.prescrit) l.push(`Ce qui était PRESCRIT ce jour-là : ${f.prescrit.type}${f.prescrit.titre ? ` — ${f.prescrit.titre}` : ""}`);
  if (f.manques.length) l.push(`CE QU'ON NE SAIT PAS (à dire, jamais à combler) : ${f.manques.join(" ; ")}`);
  return l.join("\n");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const workoutId = String((body as { workoutId?: unknown })?.workoutId ?? "").trim();
  if (!workoutId) return NextResponse.json({ error: "workoutId manquant" }, { status: 400 });

  // ── 1. La réponse mémorisée d'abord : elle évite l'appel ET le verrou n'a pas à
  //       repayer un texte déjà produit pour cet athlète.
  const { data: cache } = await supabase.from("notifications").select("body,data")
    .eq("user_id", user.id).eq("type", TYPE_ANALYSE).eq("data->>workout_id", workoutId).limit(1);
  const memo = cache?.[0];
  if (memo?.body) return NextResponse.json({ ok: true, texte: memo.body, memorise: true });

  // ── 2. Verrou d'abonnement — APRÈS le cache, AVANT le modèle.
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return refus.reponse;

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
  const [profilRes, baseRes, compRes, prescritRes, accesRes] = await Promise.all([
    supabase.from("profiles").select("age").eq("id", user.id).maybeSingle(),
    supabase.from("performance_baselines").select("max_hr").eq("user_id", user.id)
      .order("tested_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("workouts").select("date,distance_km,avg_pace_min_km,gap_min_km,max_hr")
      .eq("user_id", user.id).eq("sport", s.sport ?? "run").neq("id", workoutId)
      .order("date", { ascending: false }).limit(COMPARABLES_MAX),
    supabase.from("notifications").select("title,data").eq("user_id", user.id)
      .eq("type", "coach_session").eq("data->>date", String(s.date).slice(0, 10)).limit(1),
    supabase.from("profiles").select(COLONNES_ACCES).eq("id", user.id).maybeSingle(),
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

  const p = prescritRes.data?.[0] as { title?: string; data?: { sessionType?: string } } | undefined;
  const faits = faitsDeSeance(s, { fcMax }, comparables,
    p ? { type: p.data?.sessionType ?? null, titre: p.title ?? null } : null);

  // ── 5. Le modèle. Il rédige, il ne calcule pas.
  const longue = profilPeut(accesRes.data as Parameters<typeof profilPeut>[0], "analyse_longue");
  // ⚠️ LA LANGUE DU COMPTE, PAS LE FRANÇAIS EN DUR. L'invite imposait « en français » :
  // un client allemand voyait le bouton traduit et recevait une analyse française.
  const lang = await getAccountLang(supabase, user.id);
  const LANGUE: Record<Lang, string> = {
    fr: "en français, en tutoyant", en: "in English, addressing the athlete as “you”",
    de: "auf Deutsch, mit Du-Anrede", es: "en español, tuteando",
    pt: "em português, tratando o atleta por tu",
  };
  const invite = [
    "Tu es l'entraîneur de cet athlète et tu relis UNE de ses séances.",
    "",
    "RÈGLES ABSOLUES :",
    "- N'écris AUCUN chiffre qui ne figure pas ci-dessous. Aucune estimation, aucun ordre de grandeur.",
    "- Ce qui est listé comme inconnu doit être DIT inconnu, jamais comblé.",
    ...(faits.exploitable ? [] : [
      "- ⚠️ CETTE SÉANCE N'EST PAS INTERPRÉTABLE (voir ce qu'on ne sait pas). Dis-le en une",
      "  ou deux phrases, explique ce qui manque, et N'EN TIRE AUCUNE CONCLUSION sur sa forme.",
      "  Ne commente ni la chaleur, ni la gestion de l'effort, ni quoi que ce soit d'autre.",
    ]),
    "- Juge l'intensité sur la fréquence cardiaque fournie, jamais sur le titre de la séance.",
    "- Pas de diagnostic médical, pas de « tu es apte ».",
    `- ${longue ? "Six à huit phrases" : "Trois à quatre phrases"}, ${LANGUE[lang]}.`,
    "- Commence directement par le fond : pas de salutation, pas de « je viens de relire ». Chaque mot est facturé.",
    "",
    longue
      ? "STRUCTURE : ce qui s'est passé · la répartition de l'effort et ce qu'elle révèle · comment cette séance se situe par rapport à ses semblables · ce que ça dit de sa forme · une chose à retenir."
      : "STRUCTURE : ce qui s'est passé · ce que ça dit de sa forme · une seule chose à retenir pour la suite.",
    "",
    "LES FAITS :",
    lignesDeFaits(faits, lang, longue),
  ].join("\n");

  const r = await generateContent(
    [{ role: "user", parts: [{ text: invite }] }],
    // Le raisonnement se paie SUR le budget de sortie : sans réserve dédiée, la réponse
    // sortait coupée en pleine phrase tout en étant servie comme un succès.
    { ...budget(300, longue ? 520 : 320), temperature: 0.6 },
  );
  if (!r.ok || !r.text?.trim()) {
    return NextResponse.json({ error: r.ok ? "Réponse vide du modèle." : r.error }, { status: r.ok ? 502 : (r.status ?? 502) });
  }
  const texte = r.text.trim();

  // ── 6. Mémorisation. Une séance passée ne change plus : on ne la repaiera jamais.
  //      ⚠️ L'ERREUR EST LUE. Supabase RETOURNE ses erreurs sans lever : un `try/catch`
  //      autour d'une écriture ne rattrape rien, et une mémorisation muette ferait
  //      repayer l'appel à chaque ouverture sans que personne ne le voie.
  const admin = createAdminClient();
  const { error: eIns } = await admin.from("notifications").insert({
    user_id: user.id, type: TYPE_ANALYSE,
    title: `Analyse — ${String(s.date).slice(0, 10)}`,
    body: texte,
    data: { workout_id: workoutId, date: String(s.date).slice(0, 10), longue, lang },
  });
  if (eIns) console.error("[analyse-seance] analyse non mémorisée, elle sera repayée :", eIns.message);

  return NextResponse.json({ ok: true, texte, memorise: false, tronquee: r.tronquee === true });
}
