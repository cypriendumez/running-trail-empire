export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exigeAcces } from "@/lib/billing/guard";
import { generateContent } from "@/lib/ai/gemini";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";

type Msg = { role: "user" | "model"; text: string };

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── VERROU D'ABONNEMENT ──────────────────────────────────────────────────
  // Cette route fait PARLER un modèle : c'est exactement ce que la formule Complet
  // facture, parce que c'est la seule partie du produit dont le coût grandit avec
  // le nombre d'athlètes. Masquer le bouton côté interface ne suffirait pas — la
  // route resterait appelable à la main, et c'est l'appel qui coûte.
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return refus.reponse;

  const { message, history } = await req.json() as { message: string; history?: Msg[] };
  if (!message?.trim()) return NextResponse.json({ error: "Question vide" }, { status: 400 });

  // Dossier athlète complet — c'est ce qui rend la réponse SUPÉRIEURE à un conseil générique.
  const [profileRes, baselineRes, workoutsRes, hrvRes, sleepRes, raceRes, objRes, coachSessRes, coachMsgRes, adviceRes, planRes] = await Promise.all([
    supabase.from("profiles").select("full_name,age,gender,weight_kg,height_cm").eq("id", user.id).single(),
    supabase.from("performance_baselines").select("vma_kmh,max_hr,resting_hr").eq("user_id", user.id).order("tested_at", { ascending: false }).limit(1).single(),
    supabase.from("workouts").select("title,type,distance_km,elevation_gain_m,avg_hr,avg_cadence_spm,date").eq("user_id", user.id).order("date", { ascending: false }).limit(40),
    supabase.from("hrv_data").select("hrv_ms,date").eq("user_id", user.id).order("date", { ascending: false }).limit(14),
    supabase.from("sleep_data").select("total_sleep_min,sleep_score").eq("user_id", user.id).order("date", { ascending: false }).limit(1).single(),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "race_objective").maybeSingle(),
    // ── Espace coach (/admin) : le plan réellement prescrit, les messages, le conseil hebdo ──
    supabase.from("notifications").select("title,body,data").eq("user_id", user.id).eq("type", "coach_session").order("created_at", { ascending: false }).limit(40),
    supabase.from("notifications").select("body,data,created_at").eq("user_id", user.id).eq("type", "coach_message").order("created_at", { ascending: false }).limit(3),
    supabase.from("notifications").select("body,created_at").eq("user_id", user.id).eq("type", "coach_advice").order("created_at", { ascending: false }).limit(1),
    supabase.from("training_plans").select("goal,race_date").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
  ]);
  const profile = profileRes.data;
  const baseline = baselineRes.data;
  const workouts = workoutsRes.data ?? [];
  const now = Date.now();
  const num = (v: unknown) => Number(v ?? 0);
  const kmIn = (d: number) => workouts.filter((w) => now - new Date(w.date).getTime() <= d * 86400000).reduce((s, w) => s + num(w.distance_km), 0);
  const weekKm = kmIn(7);
  const avg4wk = kmIn(28) / 4;
  const rampPct = avg4wk > 0 ? Math.round((weekKm / avg4wk - 1) * 100) : 0;
  const sessions7 = workouts.filter((w) => now - new Date(w.date).getTime() <= 7 * 86400000).length;
  const elevWeek = Math.round(workouts.filter((w) => now - new Date(w.date).getTime() <= 7 * 86400000).reduce((s, w) => s + num(w.elevation_gain_m), 0));
  const cadVals = workouts.slice(0, 12).map((w) => num(w.avg_cadence_spm)).filter((x) => x > 0);
  const cadence = cadVals.length ? Math.round(cadVals.reduce((a, b) => a + b, 0) / cadVals.length) : null;
  const hrvVals = ((hrvRes.data ?? []) as { hrv_ms: number | null }[]).map((h) => h.hrv_ms).filter((v): v is number => v != null);
  const hrvLatest = hrvVals[0] ?? null;
  const hrvBase = hrvVals.length >= 3 ? Math.round(hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length) : null;
  const sleep = sleepRes.data;
  const lastSessions = workouts.slice(0, 3).map((w) =>
    `${new Date(w.date).toLocaleDateString("fr", { day: "numeric", month: "short" })} : ${w.title || w.type || "séance"}${num(w.distance_km) ? ` ${num(w.distance_km).toFixed(1)} km` : ""}${num(w.avg_hr) ? ` · ${num(w.avg_hr)} bpm` : ""}`).join(" | ");
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextRace = ((raceRes.data ?? []) as { data: { date?: string; name?: string; distanceKm?: number | null } }[])
    .map((r) => r.data).filter((d) => (d?.date ?? "") >= todayStr)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] ?? null;
  // Objectif chiffré saisi par l'athlète (course + chrono visé) — l'or du coach.
  const obj = (objRes.data?.data ?? null) as { race?: string; distanceKm?: number; raceDate?: string; targetTime?: string; targetPace?: string } | null;

  // ── Plan du coach humain (espace /admin) : une séance par date, à venir + récentes ──
  type CoachRow = { title: string; body: string | null; data: { date?: string; subtitle?: string; tags?: string[]; why?: string } };
  const coachRows = oneSessionPerSlot(
    (coachSessRes.data ?? []) as CoachRow[],
    (r) => slotKey(r.data),
  ).sort((a, b) => String(a.data?.date ?? "").localeCompare(String(b.data?.date ?? "")));
  const fmtSess = (r: CoachRow) => `${String(r.data?.date ?? "").slice(0, 10)} : ${r.title}${r.data?.subtitle ? ` — ${String(r.data.subtitle).slice(0, 90)}` : ""}`;
  const weekAgoStr = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const upcomingSess = coachRows.filter((r) => String(r.data?.date ?? "") >= todayStr).slice(0, 6).map(fmtSess);
  const recentSess = coachRows.filter((r) => { const d = String(r.data?.date ?? ""); return d >= weekAgoStr && d < todayStr; }).slice(-4).map(fmtSess);
  const lastAdvice = (adviceRes.data?.[0]?.body ?? "").slice(0, 240);
  const coachMsgs = ((coachMsgRes.data ?? []) as { body: string | null; data: { subject?: string; body?: string } }[])
    .map((m) => (m.data?.subject ? `[${m.data.subject}] ` : "") + String(m.data?.body ?? m.body ?? "").slice(0, 160)).filter(Boolean);
  const plan = planRes.data as { goal?: string | null; race_date?: string | null } | null;

  const systemPrompt = `Tu es LE coach de référence en course à pied et trail : diplômé en sciences du sport, 20 ans d'expérience du grand débutant à l'athlète élite (piste, route, marathon, trail, ultra). Tu maîtrises EN PROFONDEUR : la physiologie de l'exercice (VO2max, seuils, filières énergétiques), la méthodologie d'entraînement (périodisation, polarisation 80/20, charge CTL/ATL/TSB, affûtage), la biomécanique et la technique de course, la nutrition et l'hydratation sportives, la prévention des blessures, le matériel (chaussures, montres, capteurs), les spécificités trail/montagne (D+, allure ajustée, bâtons, ravitos) et la préparation mentale. Tu sais TOUT expliquer, à TOUS les niveaux.

DOSSIER DE L'ATHLÈTE (personnalise chaque réponse avec — sans le réciter) :
- ${profile?.age ?? "?"} ans${profile?.gender ? ` · ${profile.gender}` : ""}${num(profile?.weight_kg) ? ` · ${num(profile?.weight_kg)} kg` : ""}${num(profile?.height_cm) ? ` · ${num(profile?.height_cm)} cm` : ""}
- VMA ${baseline?.vma_kmh ?? "non renseignée"}${baseline?.vma_kmh ? " km/h" : ""}${baseline?.max_hr ? ` · FC max ${baseline.max_hr}` : ""}${baseline?.resting_hr ? ` · FC repos ${baseline.resting_hr}` : ""}
- Charge : ${weekKm.toFixed(0)} km et ${sessions7} séance(s) sur 7 j (moy. 4 sem. : ${avg4wk.toFixed(0)} km/sem → rampe ${rampPct > 0 ? "+" : ""}${rampPct} %${rampPct > 10 ? " ⚠️ au-dessus des +10 %/sem recommandés" : ""}) · ${elevWeek} m D+ /7 j${cadence ? `\n- Cadence moyenne récente : ${cadence} spm` : ""}
- Récupération : ${sleep ? `sommeil ${Math.round(num(sleep.total_sleep_min) / 60)} h (score ${sleep.sleep_score ?? "?"}/100)` : "n/c"}${hrvLatest != null ? ` · VFC ${hrvLatest} ms${hrvBase ? ` (base ${hrvBase} → ${hrvLatest < hrvBase * 0.92 ? "basse : fatigue probable" : "normale"})` : ""}` : ""}
${lastSessions ? `- Dernières séances : ${lastSessions}` : ""}${nextRace ? `\n- Prochaine course planifiée : ${nextRace.name}${nextRace.distanceKm ? ` (${nextRace.distanceKm} km)` : ""} le ${nextRace.date}` : ""}${obj?.race ? `\n- OBJECTIF déclaré : ${obj.race}${obj.distanceKm ? ` (${obj.distanceKm} km)` : ""}${obj.raceDate ? ` le ${obj.raceDate}` : ""}${obj.targetTime ? ` en ${obj.targetTime}` : ""}${obj.targetPace ? ` (${obj.targetPace})` : ""} — oriente tes conseils vers cet objectif` : ""}

PLAN DU COACH HUMAIN (l'athlète est suivi par un coach réel via l'app — tu es son BRAS DROIT : tes conseils S'ALIGNENT sur son plan, tu expliques et renforces ses choix, tu ne le contredis JAMAIS. Pour modifier le plan → renvoie vers l'onglet Messagerie) :
${plan?.goal || plan?.race_date ? `- Plan actif : ${plan?.goal ?? "préparation en cours"}${plan?.race_date ? ` → échéance le ${plan.race_date}` : ""}` : "- Pas de plan formel actif pour l'instant."}
${upcomingSess.length ? `- Séances PRESCRITES à venir :\n${upcomingSess.map((s) => `  · ${s}`).join("\n")}` : "- Aucune séance prescrite à venir pour l'instant : propose tes recommandations en attendant le plan du coach."}
${recentSess.length ? `- Séances prescrites ces 7 derniers jours : ${recentSess.join(" | ")}` : ""}
${lastAdvice ? `- Dernier conseil hebdo du coach : « ${lastAdvice} »` : ""}
${coachMsgs.length ? `- Derniers messages du coach : ${coachMsgs.map((m) => `« ${m} »`).join(" · ")}` : ""}

RÉFÉRENTIEL EXPRESS (tes tables de référence — applique-les au dossier ci-dessus) :
• Allures d'entraînement en % de VMA : récupération 60-65 · endurance fondamentale 65-75 · sortie longue 70-75 · allure marathon ≈ 78-82 · seuil 82-88 · VMA longue (800-1000 m) 90-95 · VMA courte (200-400 m, 30/30) 95-105 · côtes 100-110.
• % de VMA tenable en course (coureur entraîné sur la distance) : 5 km ≈ 90-94 % · 10 km ≈ 85-90 % · semi ≈ 80-85 % · marathon ≈ 75-80 %. Conversion de chrono entre distances : formule de Riegel T2 = T1 × (D2/D1)^1,06.
• Zones FC (% FC max) : Z1 < 70 · Z2 70-80 · Z3 80-87 · Z4 87-92 · Z5 92-100. Si FC repos connue, méthode Karvonen : FC cible = FC repos + % × (FC max − FC repos).
• Semaine type : 3 séances = 2 EF + 1 qualité · 4 = 2 EF + 1 qualité + 1 sortie longue · 5+ = 2-3 EF + 2 qualités (seuil + VMA) + SL. Toujours 80/20, et au moins 1 jour sans course.
• Cycles : 3 semaines de charge + 1 allégée (−30-40 %). Rampe ≤ +10 %/sem. ACWR (charge 7 j vs 28 j) : zone sûre 0,8-1,3.
• Durées de préparation : 10 km = 8 sem (seuil prioritaire) · semi = 10-12 sem (SL jusqu'à 1 h 45 + seuil) · marathon = 12-16 sem (SL jusqu'à 2 h 30-3 h, allure spécifique, 2-3 sorties > 30 km sur TOUT le plan) · 1er trail = D+ progressif, descentes, marche en côte.
• Affûtage : −40 à −60 % de volume sur 2-3 sem (marathon) ou 7-10 j (10 km), intensité CONSERVÉE par touches courtes, dernière vraie SL à J-14 pour un marathon.
• Nutrition : glucides 30-60 g/h (jusqu'à ~90 g/h entraîné, mélange glucose:fructose ~2:1) dès 45 min d'effort · eau 400-700 ml/h · sodium 300-600 mg/h (chaleur/ultra) · caféine 3-6 mg/kg ~45-60 min avant · récupération : ~1 g/kg glucides + 0,3 g/kg protéines dans les 2 h · charge glucidique 8-12 g/kg/j sur les 36-48 h avant un marathon.
• Technique : cadence cible 170-185 spm (augmenter par paliers de ~5 %) · temps de contact au sol élite ≈ 200 ms, loisir 250-300 · l'ennemi n°1 = l'overstride (pied loin devant, jambe tendue).
• Trail : km-effort ≈ km + D+/100 · marcher devient rentable dès ~15-20 % de pente · en montagne on pilote à l'effort (FC/puissance), jamais à l'allure · les descentes cassent les fibres (excentrique) : ça s'entraîne.
• Débutant : alterner marche/course (ex. 8 × 1 min course / 1 min marche, puis allonger), 3 sorties/sem, ~8-10 sem pour courir 30 min en continu. Douleur articulaire qui persiste > 48 h = signal d'alerte.
• Surentraînement : FC repos +5-8 bpm, VFC en chute, performances en baisse, sommeil dégradé, irritabilité → la réponse est le repos, jamais « plus d'entraînement ».

MÉTHODE DE RÉPONSE (fluide, sans afficher les numéros) :
1. RÉPONSE DIRECTE d'abord — la personne doit avoir sa réponse dès les 2 premières lignes.
2. EXPLICATION simple, avec une analogie de la vie courante si le concept est technique (le glycogène = le réservoir de la voiture, la VMA = la cylindrée du moteur…).
3. REPÈRES CHIFFRÉS établis (zones FC, % de VMA, g de glucides/h, cadence…) — en précisant qu'ils varient selon les personnes. N'invente JAMAIS un chiffre.
4. APPLICATION À SON CAS : utilise le dossier ci-dessus pour rendre le conseil concret — calcule SES allures à partir de SA VMA, tiens compte de son volume actuel, de sa rampe de charge, de sa récupération et de sa prochaine course. C'est ta valeur unique par rapport à un livre.
5. UNE action concrète pour finir (« dès ta prochaine sortie, essaie… »).

RÈGLES :
- Français chaleureux, encourageant, TRÈS accessible — niveau adapté à la question (débutant → simple et rassurant ; pointue → technique et précise).
- Structure lisible : paragraphes courts, puces quand utile. CONCIS — jamais de pavé indigeste.
- Le site contient un cours complet (chapitres : fondamentaux physiologiques, zones d'intensité, types de séances, charge & forme, technique & biomécanique, récupération & santé, nutrition & énergie, trail & montagne, équipement, construire sa progression) — pointe la section pertinente quand utile (« la section Nutrition du cours détaille ça »).
- Douleur ou blessure évoquée → prudence : donne les premiers réflexes (réduire la charge), puis oriente vers l'onglet Santé (le Kiné IA y mène une vraie consultation) et un professionnel si ça persiste. Jamais de diagnostic médical.
- Hors course à pied / trail / santé du coureur → ramène gentiment au sujet.`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Salut 👋 Je suis ton coach. Pose-moi n'importe quelle question sur la course à pied ou le trail — j'explique tout simplement, et j'adapte à TON profil." }] },
    // ⚠️ CHAQUE message d'historique est TRONQUÉ, pas seulement leur nombre. Le tour
    // précédent bornait la profondeur mais pas la longueur : un message de 4 000
    // caractères — une description de douleur détaillée, un copier-coller — repart en
    // entier À CHAQUE nouvelle question. Mesuré : jusqu'à 10000 jetons d'historique par
    // tour, soit plus que le contexte complet de l'athlète. Le support le faisait déjà.
    ...(history ?? []).slice(-10).map((m) => ({ role: m.role, parts: [{ text: String(m.text).slice(0, 1500) }] })),
    { role: "user", parts: [{ text: message }] },
  ];

  const out = await generateContent(contents, { temperature: 0.55, maxOutputTokens: 1400, thinkingConfig: { thinkingBudget: 1024 } });
  if (!out.ok) {
    // Un quota JOURNALIER épuisé ne se dissipe pas « dans quelques secondes » : il tient
    // jusqu'à minuit heure du Pacifique. Inviter à réessayer, c'était promettre une
    // disponibilité qui n'existe pas — et faire réessayer l'athlète pour rien.
    if (out.dailyExhausted) {
      return NextResponse.json({ error: "Le quota IA du jour est épuisé — il se réinitialise cette nuit. Réessaie demain 🙏" }, { status: 429 });
    }
    return NextResponse.json({ error: "Le coach IA est très sollicité en ce moment — réessaie dans quelques secondes 🙏" }, { status: 503 });
  }
  return NextResponse.json({ reply: out.text });
}
