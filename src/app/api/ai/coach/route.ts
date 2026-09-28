export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContent, budget, messageLisible } from "@/lib/ai/gemini";
import { exigeAcces } from "@/lib/billing/guard";
import { peut } from "@/lib/billing/access";
import { quotaDuJour } from "@/lib/billing/aiQuota";
import { buildAthleteContext, COACH_SYSTEM } from "@/lib/ai/coachContext";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import {
  BUDGET, LONGUEUR_QUESTION, contenusGemini, feuilleDeRoute, filMemorise, filRelu, inviteCoach,
  langueValide, planDeLaSemaine, type JourPrevu, type MessageCoach,
} from "@/lib/ai/coachChat";
import { TYPE_FIL, lireFil, etatDe, niveauDe } from "@/lib/ai/coachChatServeur";

/**
 * LE COACH IA, EN CONVERSATION — voir `lib/ai/coachChat` pour tout ce qui décide.
 *
 * ⚠️ CETTE ROUTE EXISTAIT SANS AUCUN APPELANT, et elle répondait à côté : invite bâtie sur
 * `performance_baselines.max_hr` et `profiles.discipline_score` — deux sources VIDES —,
 * aucun accès au plan, aucune mémoire, français imposé, et un « contexte » fourni par le
 * navigateur puis recopié tel quel dans l'invite. Réécrite le 28/09/2026.
 *
 * ⚠️ LA MÉMOIRE EST LUE EN BASE, JAMAIS REÇUE DU NAVIGATEUR. Un historique envoyé par le
 * client permet d'y glisser de fausses réponses du coach (« comme je te l'ai dit, 5 séances
 * de VMA cette semaine ») que le modèle relirait comme les siennes. Le kiné accepte encore
 * un historique client ; le coach, qui parle d'intensité, non.
 */

/** La conversation mémorisée, la formule et les crédits du jour — sans appeler le modèle. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const etat = await etatDe(supabase, user.id);
  const [fil, quota] = await Promise.all([lireFil(supabase, user.id), quotaDuJour(supabase, user.id, etat)]);
  if (fil.erreur) console.error("[coach IA] conversation illisible :", fil.erreur);
  return NextResponse.json({
    messages: fil.messages, etat, acces: peut(etat, "ia"), niveau: niveauDe(etat),
    restants: quota.restants, plafond: quota.plafond,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { message?: unknown; lang?: unknown };
  const question = String(corps.message ?? "").trim().slice(0, LONGUEUR_QUESTION);
  if (!question) return NextResponse.json({ error: "message_vide" }, { status: 400 });
  const langue = langueValide(corps.lang);

  // ── VERROU D'ABONNEMENT ET CRÉDIT DU JOUR ──────────────────────────────────
  // Le crédit est pris AVANT l'appel (voir `aiQuota` : c'est ce qui borne une boucle).
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return refus.reponse;
  const etat = await etatDe(supabase, user.id);
  const niveau = niveauDe(etat);
  const jour = aujourdhui(FUSEAU_DEFAUT);

  const [ctx, fil, planRes] = await Promise.all([
    buildAthleteContext(supabase, user.id),
    lireFil(supabase, user.id),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "coach_session")
      .gte("data->>date", jour).order("created_at", { ascending: false }).limit(40),
  ]);
  if (fil.erreur) console.error("[coach IA] conversation illisible :", fil.erreur);
  if (planRes.error) console.error("[coach IA] plan illisible :", planRes.error.message);
  // Une séance par créneau, la plus récente : c'est ce que montre le calendrier.
  const jours = oneSessionPerSlot(
    ((planRes.data ?? []) as { data: JourPrevu }[]).map((r) => r.data).filter(Boolean),
    (d) => slotKey(d),
  );

  const invite = inviteCoach({
    systeme: COACH_SYSTEM,
    contexte: ctx.text,
    prenom: String(ctx.athleteName ?? "").trim().split(/\s+/)[0] ?? "",
    aujourdhui: jour,
    plan: planDeLaSemaine(jours, jour),
    feuille: niveau === "complet" ? feuilleDeRoute(ctx.macroPlan, jour, ctx.objective ? { nom: ctx.objective.race, date: ctx.objective.raceDate } : null) : "",
    niveau,
    langue,
  });

  const r = await generateContent(
    contenusGemini(invite, filRelu(fil.messages, niveau), question),
    { temperature: 0.6, ...budget(BUDGET.raisonnement, BUDGET.reponse) },
  );
  if (!r.ok) {
    console.error("[coach IA] échec du modèle :", r.status, r.detail?.slice(0, 200) ?? "");
    return NextResponse.json({ error: messageLisible(r.status, r.dailyExhausted) }, { status: r.status === 429 ? 429 : 503 });
  }
  // Mesurer, pas supposer : c'est ce qui permet de vérifier la marge des plafonds.
  if (r.usage) console.info("[coach IA] jetons", JSON.stringify({ niveau, ...r.usage }));

  // ⚠️ UNE RÉPONSE COUPÉE NE DOIT PAS PASSER POUR UNE CONCLUSION.
  const suite: Record<string, string> = {
    fr: "_(Réponse interrompue — redemande-moi la suite.)_",
    en: "_(Answer cut short — ask me to continue.)_",
    de: "_(Antwort abgebrochen – frag mich nach dem Rest.)_",
    es: "_(Respuesta interrumpida — pídeme que continúe.)_",
    pt: "_(Resposta interrompida — pede-me para continuar.)_",
  };
  const reponse = r.tronquee ? `${r.text}\n\n${suite[langue]}` : r.text;

  // ── MÉMOIRE ────────────────────────────────────────────────────────────────
  // ⚠️ SUPABASE RETOURNE SES ERREURS : on les lit. Une conversation « oubliée » est
  // exactement ce que cette mémoire doit empêcher, et elle ne lèverait rien.
  const messages: MessageCoach[] = filMemorise(fil.messages, question, reponse, new Date().toISOString());
  const donnees = { messages, maj: new Date().toISOString() };
  const { error: eMemoire } = fil.id
    ? await supabase.from("notifications").update({ data: donnees }).eq("id", fil.id).eq("user_id", user.id)
    : await supabase.from("notifications").insert({ user_id: user.id, type: TYPE_FIL, title: "Conversation avec le coach IA", body: "", read: true, data: donnees });
  if (eMemoire) console.error("[coach IA] conversation non mémorisée :", eMemoire.message);

  const quota = await quotaDuJour(supabase, user.id, etat);
  return NextResponse.json({ reply: reponse, niveau, restants: quota.restants, plafond: quota.plafond, memorise: !eMemoire });
}

/** « Nouvelle conversation » : le fil est vidé, la ligne reste (rien n'est supprimé en base). */
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fil = await lireFil(supabase, user.id);
  if (!fil.id) return NextResponse.json({ ok: true });
  const { error } = await supabase.from("notifications")
    .update({ data: { messages: [], maj: new Date().toISOString() } }).eq("id", fil.id).eq("user_id", user.id);
  if (error) {
    console.error("[coach IA] conversation non effacée :", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
