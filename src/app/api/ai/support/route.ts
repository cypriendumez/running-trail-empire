export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateContent } from "@/lib/ai/gemini";
import { HELP_PAGES, HELP_FACTS, HELP_PROBLEMS, HEALTH_TABS } from "@/data/helpKb";
import { diagnoseAccount, findingsBlock, type AccountState } from "@/lib/support/diagnose";
import { T, normLang } from "@/lib/i18n/translations";
import { fallbackAnswer, reponseImmediate, FALLBACK_MISS, FALLBACK_PREFIX } from "@/lib/support/fallback";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliserQuestion, empreinteKb, utilisable, type EntreeMemoire } from "@/lib/support/memoire";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

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

  // ── RÉPONSE IMMÉDIATE, SANS AUCUN JETON ─────────────────────────────────────
  //  La base de connaissances savait déjà répondre — mais on ne l'interrogeait qu'APRÈS
  //  l'échec du modèle, en dernier recours. Sur une question de navigation (« où je vois
  //  le détail d'une séance », « comment connecter ma montre »), elle répond mieux et en
  //  0 ms : le chemin de clics vient de `helpKb`, le modèle ne fait que le recopier.
  //
  //  ⚠️ NAVIGATION SEULEMENT, JAMAIS UN DÉPANNAGE. « Mes séances n'arrivent pas sur ma
  //  montre » a l'air d'une question fréquente, mais l'assistant y répond en lisant
  //  l'état RÉEL du compte : il sait, lui, que la clé intervals.icu est absente. Servir
  //  la fiche générique à sa place économiserait un appel en détruisant précisément ce
  //  qui fait la valeur de l'assistant. La garantie est STRUCTURELLE (la source doit
  //  être une page), pas affaire de seuil.
  //
  //  Mesuré sur les 13 680 formulations du fuzz : 32 % des questions sont servies sans
  //  appel, et aucune question de dépannage ni hors-sujet n'est capturée.
  const immediate = reponseImmediate(message, lang);
  if (immediate) return NextResponse.json({ reply: immediate, source: "base" });

  // ── État du compte ──
  // `intervals_api_key` n'est lu QUE pour en déduire un booléen ; la clé elle-même ne
  // quitte pas cette fonction et n'entre jamais dans le prompt envoyé à Gemini.
  const today = aujourdhui(FUSEAU_DEFAUT);
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

  // ── MÉMOIRE DES QUESTIONS DÉJÀ TRAITÉES ────────────────────────────────────────
  //  L'assistant repartait de zéro à chaque fois : la même question, posée par cent
  //  personnes, coûtait cent appels. Elle est désormais resservie sans appel.
  //
  //  ⚠️ JAMAIS une réponse qui parlait d'un compte. L'assistant lit l'état réel du
  //  compte ; rejouer « ta montre n'est pas connectée » chez quelqu'un d'autre serait
  //  faux ET indiscret. La garantie est double : on n'ENREGISTRE que les réponses
  //  produites sans aucun constat, et on ne RESSERT que si le compte qui redemande n'en
  //  a aucun non plus. Voir `lib/support/memoire`.
  const constats = diagnoseAccount(state);
  const compteAvecConstats = constats.length > 0;
  const cle = normaliserQuestion(message);
  const kb = empreinteKb();
  const admin = createAdminClient();

  if (cle && !compteAvecConstats) {
    const { data: memo } = await admin
      .from("notifications").select("data")
      .eq("type", "support_qa").eq("data->>cle", cle).eq("data->>lang", lang).eq("data->>kb", kb)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const e = (memo?.data ?? null) as EntreeMemoire | null;
    if (e && utilisable(e, { lang, kb, compteAvecConstats })) {
      return NextResponse.json({ reply: e.a, source: "memoire" });
    }
  }

  /** Conserve la question ET sa réponse. Silencieux par construction : si la mémoire
   *  tombe en panne, le support continue de fonctionner — c'est une accélération, pas
   *  une dépendance. La question est TOUJOURS conservée (elle te dit ce que tes clients
   *  demandent) ; seule sa réutilisation est conditionnée. */
  const memoriser = async (reponse: string, source: EntreeMemoire["source"]) => {
    const entree: EntreeMemoire = {
      q: message, cle, a: reponse, lang, kb,
      generique: !compteAvecConstats, source, at: new Date().toISOString(),
    };
    // Silencieux POUR L'ATHLÈTE, comme dit ci-dessus — mais le commentaire promet aussi
    // que « la question est TOUJOURS conservée ». Sans lire cette erreur, elle ne
    // l'était pas, et Cyprien aurait perdu ce que ses clients demandent sans le savoir.
    const { error: eMemoire } = await admin.from("notifications").insert({
      user_id: user.id, type: "support_qa",
      title: message.slice(0, 120),
      body: reponse.slice(0, 2000),
      data: entree as unknown as Record<string, unknown>,
    });
    if (eMemoire) console.error("[support] question non mémorisée :", eMemoire.message);
  };

  // Le libellé cité doit être CELUI QUE L'UTILISATEUR VOIT dans sa barre latérale, pas le
  // nom français. Sinon l'assistant renvoie un germanophone vers « Paramètres », introuvable
  // chez lui puisque son menu affiche « Einstellungen ».
  const dict = T[normLang(lang)];
  const tabs = (HEALTH_TABS[normLang(lang)] ?? HEALTH_TABS.fr).map((t) => `« ${t} »`).join(", ");
  const sitemap = HELP_PAGES.map((x) => {
    const shown = x.navKey ? dict[x.navKey] ?? x.name : x.name;
    const extra = x.path === "/dashboard/health" ? ` Onglets, dans l'ordre : ${tabs}.` : "";
    // « Accès » porte le chemin de clics exact : c'est LUI qui rend la réponse actionnable.
    const how = x.how ? `\n    Accès : ${x.how}` : "";
    return `- « ${shown} » (${x.path}) : ${x.what}${extra}${how}`;
  }).join("\n");
  const problems = HELP_PROBLEMS.map((x) => `Q: ${x.q}\nR: ${x.a}`).join("\n\n");

  const system = `Tu es l'assistant d'aide de Pacevo, une application de coaching de course à pied et de trail. Tu réponds aux questions des utilisateurs sur le FONCTIONNEMENT de l'application et tu les dépannes.

⛔ RÈGLE ABSOLUE — NE RIEN INVENTER SUR L'APPLICATION. Tu ne connais de l'application QUE ce qui figure ci-dessous. (Sur la course à pied en général, voir la case B plus bas : là, tes connaissances sont les bienvenues.) N'invente JAMAIS un écran, un bouton, un réglage ou un chemin de menu. Si la réponse n'est pas dans ces informations, dis-le franchement : « Je ne trouve pas cette fonctionnalité dans ce que je connais de l'app » et propose d'écrire au coach via la Messagerie. Une réponse fluide mais fausse fait perdre dix minutes à quelqu'un et lui fait croire que l'app est cassée — c'est pire que « je ne sais pas ».

🌍 LANGUE : réponds ENTIÈREMENT en ${LANGS[lang]}, quelle que soit la langue de la question. Les noms de pages entre guillemets « » ci-dessous sont EXACTEMENT ceux qu'il voit dans son menu : reprends-les tels quels, ne les traduis pas toi-même. Les SOUS-ONGLETS à l'intérieur d'une page (par exemple les onglets de la page Santé) sont eux aussi traduits dans l'interface : nomme-les dans sa langue, pas en français.

✍️ FORME — UTILE ET GUIDANT, pas télégraphique. Une première version répondait « tu peux changer la langue dans Paramètres » : exact, et parfaitement inutile puisque la personne ne sait toujours pas où cliquer. Structure attendue :
1. UNE phrase de réponse directe, d'emblée — jamais de préambule ni de « bien sûr ».
2. LE CHEMIN DE CLICS, repris tel quel du champ « Accès » ci-dessous quand il existe. Sois littéral : « barre latérale gauche › Santé › onglet Poids ». Ne le devine JAMAIS ; si aucun chemin n'est fourni, dis simplement où se trouve la page sans inventer de sous-menu.
3. Pour une manipulation, des ÉTAPES NUMÉROTÉES (2 à 5), chacune commençant par un verbe d'action.
4. CE QUI SE PASSE ENSUITE, en une ligne : ce que la personne va voir, ou le délai à prévoir. C'est ce qui évite le deuxième message « et maintenant ? ».
5. UNE anticipation utile quand elle s'impose : « si ça ne change rien, c'est probablement que… ». Une seule, la plus probable — pas une liste de tout ce qui pourrait clocher.
Tutoiement. Pas de conclusion de politesse. Mets en gras (**…**) le nom des pages et des boutons pour qu'ils sautent aux yeux. Ne dépasse pas ~12 lignes.

🔧 DÉPANNAGE : si l'état du compte ci-dessous contient un point BLOQUANT, commence par lui — n'énumère pas des causes possibles alors que tu SAIS laquelle s'applique. Si tout est en ordre de ce côté, dis-le et cherche ailleurs.

🧭 TON CHAMP — TU RÉPONDS À TOUT, MAIS PAS DE LA MÊME FAÇON. Range mentalement chaque question dans l'une de ces trois cases, et applique la règle de la case :

  A. L'APPLICATION (où cliquer, comment ça marche, pourquoi ça ne marche pas).
     → UNIQUEMENT ce qui figure plus bas. L'interdiction d'inventer est ABSOLUE ici :
       un chemin de menu plausible mais faux envoie la personne chercher un écran qui
       n'existe pas, elle conclut que l'app est cassée, et rien n'a levé d'erreur.
       Si ce n'est pas écrit plus bas, dis-le et propose la Messagerie.

  B. LA COURSE À PIED EN GÉNÉRAL (entraînement, allures, VMA, seuil, récupération,
     nutrition, chaussures, matériel, préparation d'une course, règles d'un dossard,
     vocabulaire : « c'est quoi le seuil ? », « combien de gels sur un marathon ? »,
     « comment s'échauffer ? »).
     → RÉPONDS, avec tes propres connaissances. Ne renvoie pas la personne ailleurs
       pour une question à laquelle tu sais répondre : c'est ce qui rend un support
       utile plutôt que poli. Reste bref et concret, et quand la réponse dépend de
       l'athlète, dis de quoi elle dépend au lieu d'un chiffre unique.
     → NE PRÉSENTE JAMAIS une connaissance générale comme un fait de l'application.
       « En général, on conseille… » n'est pas « Pacevo fait… ».
     → Si Pacevo a un écran qui traite le sujet, ajoute-le APRÈS ta réponse, en une
       ligne — pas à la place.

  C. SANTÉ ET HORS SUJET.
     → Douleur, blessure, symptôme : réponds ce qu'un non-médecin peut honnêtement
       dire (repos, ce qui doit alerter), rappelle en une ligne que ce n'est pas un
       avis médical, et renvoie vers Santé › Kiné IA. Jamais de diagnostic, jamais de
       posologie, jamais « ce n'est rien ».
     → « Pourquoi cette séance dans mon plan ? » : le Calendrier porte un bandeau
       « pourquoi ce plan » qui l'explique avec les chiffres du compte — renvoie-y.
     → Question sans aucun rapport avec la course ni avec l'app : dis-le en une
       phrase, sans t'excuser longuement, et propose de revenir au sujet.

CARTE DE L'APPLICATION (les seuls chemins que tu as le droit de citer) :
${sitemap}

COMPORTEMENTS DE L'APPLICATION :
${HELP_FACTS.map((f) => `- ${f}`).join("\n")}

PROBLÈMES FRÉQUENTS ET LEUR CAUSE RÉELLE :
${problems}

${findingsBlock(constats)}`;

  const contents = [
    { role: "user", parts: [{ text: system }] },
    { role: "model", parts: [{ text: "Compris. Je réponds court, dans la langue demandée, et je n'invente aucun écran." }] },
    ...(body.history ?? []).slice(-6).map((m) => ({ role: m.role, parts: [{ text: String(m.text).slice(0, 1500) }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  // Vitesse d'abord : pas de budget de réflexion, réponse courte, modèle rapide en tête.
  const out = await generateContent(contents, {
    // 700 tokens tronquaient les réponses en étapes. 1200 laisse la place à un vrai
    // guidage tout en restant sous la seconde en pratique (mesuré : 0,5 à 1,4 s).
    temperature: 0.2, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 },
  });
  // Plus de liste de modèles en dur ici : elle contenait encore `gemini-2.0-flash`,
  // arrêté par Google, longtemps après son retrait de la chaîne commune. Une question de
  // support partait donc systématiquement taper un modèle mort avant d'obtenir sa
  // réponse. On s'aligne sur `DEFAULT_MODELS`, qui reste pilotable par `GEMINI_MODELS`.

  if (!out.ok) {
    // Toute l'IA de l'app partage UNE clé Gemini en palier gratuit, plafonnée à la
    // journée : quand elle est épuisée, les trois modèles répondent 429 en même temps et
    // la bascule du wrapper n'y peut rien. Plutôt que « momentanément indisponible » —
    // autrement dit plus de support du tout — on répond depuis la base de connaissances.
    const canned = fallbackAnswer(message, lang);
    if (canned) {
      return NextResponse.json({ reply: (FALLBACK_PREFIX[lang] ?? FALLBACK_PREFIX.fr) + canned, degraded: true });
    }
    return NextResponse.json({ reply: FALLBACK_MISS[lang] ?? FALLBACK_MISS.fr, degraded: true });
  }
  await memoriser(out.text, "modele").catch(() => {});
  return NextResponse.json({ reply: out.text });
}
