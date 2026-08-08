export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContent } from "@/lib/ai/gemini";
import { HELP_PAGES, HELP_FACTS, HELP_PROBLEMS, HEALTH_TABS } from "@/data/helpKb";
import { diagnoseAccount, findingsBlock, type AccountState } from "@/lib/support/diagnose";
import { T, normLang } from "@/lib/i18n/translations";

// ─────────────────────────────────────────────────────────────────────────────
//  ASSISTANT DE SUPPORT — répond aux questions sur l'app, dans la langue de l'athlète.
//
//  DEUX EXIGENCES QUI S'OPPOSENT, ET COMMENT ELLES SONT TENUES :
//
//  1. NE RIEN INVENTER. Un modèle à qui l'on demande « où change-t-on la langue ? »
//     produit un chemin plausible même s'il n'existe pas. L'utilisateur cherche, ne
//     trouve pas, conclut que l'app est cassée — et rien n'a levé d'erreur. L'assistant
//     ne cite donc QUE les pages de `helpKb.ts`, et dit qu'il ne sait pas sinon.
//
//  2. RÉPONDRE VITE. `thinkingBudget: 0` et une réponse courte : sur une question de
//     support, deux secondes de réflexion supplémentaires n'améliorent rien et se
//     paient en abandon.
//
//  Il lit aussi l'ÉTAT RÉEL du compte (diagnose.ts) : « ta montre n'est pas connectée »
//  vaut mieux que « vérifie tes identifiants », que l'on serve à tout le monde.
// ─────────────────────────────────────────────────────────────────────────────

type Msg = { role: "user" | "model"; text: string };

const LANGS: Record<string, string> = {
  fr: "français", en: "anglais (English)", de: "allemand (Deutsch)",
  es: "espagnol (Español)", pt: "portugais (Português)",
};

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { message?: string; lang?: string; history?: Msg[] };
  const message = String(body.message ?? "").trim().slice(0, 1000);
  if (!message) return NextResponse.json({ error: "Question vide" }, { status: 400 });
  const lang = LANGS[String(body.lang ?? "fr")] ? String(body.lang) : "fr";

  // ── État du compte ──
  // `intervals_api_key` n'est lu QUE pour en déduire un booléen ; la clé elle-même ne
  // quitte pas cette fonction et n'entre jamais dans le prompt envoyé à Gemini.
  const today = new Date().toISOString().slice(0, 10);
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [profRes, woRes, lastWoRes, csRes, stateRes, objRes, wlRes] = await Promise.all([
    sb.from("profiles").select("age, height_cm, weight_kg, onboarding_completed, health_declared, intervals_athlete_id, intervals_api_key, weight_mode_enabled").eq("id", user.id).maybeSingle(),
    sb.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("date", since30),
    sb.from("workouts").select("date").eq("user_id", user.id).order("date", { ascending: false }).limit(1).maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "coach_session").order("created_at", { ascending: false }).limit(40),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "auto_coach_state").maybeSingle(),
    sb.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    sb.from("weight_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const p = profRes.data as Record<string, unknown> | null;
  const obj = (objRes.data?.data ?? null) as { race?: string; raceDate?: string } | null;
  const upcoming = new Set(
    ((csRes.data ?? []) as { data: { date?: string } }[])
      .map((r) => String(r.data?.date ?? "").slice(0, 10))
      .filter((d) => d >= today),
  ).size;

  const state: AccountState = {
    age: (p?.age as number) ?? null,
    heightCm: (p?.height_cm as number) ?? null,
    weightKg: p?.weight_kg != null ? Number(p.weight_kg) : null,
    onboardingCompleted: Boolean(p?.onboarding_completed),
    healthDeclared: Boolean(p?.health_declared),
    hasIntervalsKey: Boolean(p?.intervals_api_key),
    hasIntervalsAthleteId: Boolean(p?.intervals_athlete_id),
    lastWorkoutDate: (lastWoRes.data?.date as string) ?? null,
    workoutCount30d: woRes.count ?? 0,
    upcomingSessions: upcoming,
    lastAutoCoachAt: ((stateRes.data?.data ?? null) as { at?: string } | null)?.at ?? null,
    objective: obj?.race && obj?.raceDate ? { race: obj.race, raceDate: obj.raceDate } : null,
    weighInCount: wlRes.count ?? 0,
    weightModeEnabled: Boolean(p?.weight_mode_enabled),
  };

  // Le libellé cité doit être CELUI QUE L'UTILISATEUR VOIT dans sa barre latérale, pas le
  // nom français. Sinon l'assistant renvoie un germanophone vers « Paramètres », introuvable
  // chez lui puisque son menu affiche « Einstellungen ».
  const dict = T[normLang(lang)];
  const tabs = (HEALTH_TABS[normLang(lang)] ?? HEALTH_TABS.fr).map((t) => `« ${t} »`).join(", ");
  const sitemap = HELP_PAGES.map((x) => {
    const shown = x.navKey ? dict[x.navKey] ?? x.name : x.name;
    const extra = x.path === "/dashboard/health" ? ` Onglets, dans l'ordre : ${tabs}.` : "";
    return `- « ${shown} » (${x.path}) : ${x.what}${extra}`;
  }).join("\n");
  const problems = HELP_PROBLEMS.map((x) => `Q: ${x.q}\nR: ${x.a}`).join("\n\n");

  const system = `Tu es l'assistant d'aide de Pacevo, une application de coaching de course à pied et de trail. Tu réponds aux questions des utilisateurs sur le FONCTIONNEMENT de l'application et tu les dépannes.

⛔ RÈGLE ABSOLUE — NE RIEN INVENTER. Tu ne connais de l'application QUE ce qui figure ci-dessous. N'invente JAMAIS un écran, un bouton, un réglage ou un chemin de menu. Si la réponse n'est pas dans ces informations, dis-le franchement : « Je ne trouve pas cette fonctionnalité dans ce que je connais de l'app » et propose d'écrire au coach via la Messagerie. Une réponse fluide mais fausse fait perdre dix minutes à quelqu'un et lui fait croire que l'app est cassée — c'est pire que « je ne sais pas ».

🌍 LANGUE : réponds ENTIÈREMENT en ${LANGS[lang]}, quelle que soit la langue de la question. Les noms de pages entre guillemets « » ci-dessous sont EXACTEMENT ceux qu'il voit dans son menu : reprends-les tels quels, ne les traduis pas toi-même. Les SOUS-ONGLETS à l'intérieur d'une page (par exemple les onglets de la page Santé) sont eux aussi traduits dans l'interface : nomme-les dans sa langue, pas en français.

✍️ FORME : va DROIT AU BUT. Deux à cinq phrases, ou une courte liste d'étapes numérotées quand il s'agit d'une manipulation. Pas de préambule, pas de « bien sûr, je vais vous expliquer », pas de conclusion de politesse. Nomme précisément la page et l'onglet. Tutoiement.

🔧 DÉPANNAGE : si l'état du compte ci-dessous contient un point BLOQUANT, commence par lui — n'énumère pas des causes possibles alors que tu SAIS laquelle s'applique. Si tout est en ordre de ce côté, dis-le et cherche ailleurs.

🩺 HORS SUJET : pour une douleur ou une blessure, renvoie vers Santé › Kiné IA. Pour l'entraînement lui-même (« pourquoi cette séance ? »), renvoie vers le Calendrier et son bandeau « pourquoi ce plan ». Tu expliques l'APPLICATION, tu ne fais ni coaching ni médecine.

CARTE DE L'APPLICATION (les seuls chemins que tu as le droit de citer) :
${sitemap}

COMPORTEMENTS DE L'APPLICATION :
${HELP_FACTS.map((f) => `- ${f}`).join("\n")}

PROBLÈMES FRÉQUENTS ET LEUR CAUSE RÉELLE :
${problems}

${findingsBlock(diagnoseAccount(state))}`;

  const contents = [
    { role: "user", parts: [{ text: system }] },
    { role: "model", parts: [{ text: "Compris. Je réponds court, dans la langue demandée, et je n'invente aucun écran." }] },
    ...(body.history ?? []).slice(-6).map((m) => ({ role: m.role, parts: [{ text: String(m.text).slice(0, 1500) }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  // Vitesse d'abord : pas de budget de réflexion, réponse courte, modèle rapide en tête.
  const out = await generateContent(contents, {
    temperature: 0.2, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 },
  }, { models: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"] });

  if (!out.ok) {
    return NextResponse.json({ error: "L'assistant est momentanément indisponible. Réessaie dans quelques secondes, ou écris au coach depuis la Messagerie." }, { status: 503 });
  }
  return NextResponse.json({ reply: out.text });
}
