export const dynamic = "force-dynamic";
export const maxDuration = 300; // le coach accepte d'attendre une analyse profonde
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAthleteContext, classifyRun, type AthleteContext } from "@/lib/ai/coachContext";
import { HEALTH_CONDITIONS, INJURY_ZONES, healthCoachLines } from "@/data/healthCatalog";
import { terrainCoachBlock } from "@/data/terrainCatalog";
import { estAdmin } from "@/lib/admin/acces";
import { identifiantsDe } from "@/lib/intervals/identifiants";

const BASE = "https://intervals.icu/api/v1";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const gUrl = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

const n = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const pace = (mps: number | null) => (mps && mps > 0.3 ? `${Math.floor(1000 / 60 / mps)}'${String(Math.round(((1000 / 60 / mps) % 1) * 60)).padStart(2, "0")}` : "?");
const ZL = ["Z1", "Z2", "Z3", "Z4", "Z5", "Z6", "Z7"];

// ── FILET DE SÉCURITÉ : garantit que le plan contient le bon NOMBRE de séances de qualité ──
// Même si l'IA sous-dose (ex. semaine quasi 100 % EF), on réinjecte les séances manquantes du
// squelette déterministe, sur des jours faciles NON adjacents (jamais 2 séances dures d'affilée).
const isQ = (t?: string) => /vma|seuil|tempo|sp[ée]ci|specif|fractionn|interval|c[ôo]te|allure|objectif/i.test(t || "");
const normQType = (t?: string) => { const s = (t || "").toLowerCase(); if (/sp[ée]ci|specif|allure|objectif/.test(s)) return "Spécifique"; if (/seuil|tempo/.test(s)) return "Seuil"; return "VMA"; };
function enforceQuality(week: Record<string, unknown>[], wp: AthleteContext["weekPlan"] | undefined): Record<string, unknown>[] {
  if (!wp || wp.qBudget <= 0 || !Array.isArray(week) || week.length < 3) return week;
  const w = week.map((d) => ({ ...d }));
  const count = () => w.filter((d) => isQ(String(d.type))).length;
  if (count() >= wp.qBudget) return w;
  const present = new Set<string>(w.filter((d) => isQ(String(d.type))).map((d) => normQType(String(d.type))));
  const missing = wp.quality.filter((q) => !present.has(q.type));
  const hard = (i: number) => i >= 0 && i < w.length && isQ(String(w[i].type));
  let mi = 0;
  // 2 passes : d'abord en respectant l'espacement (48 h), puis en relâchant si vraiment nécessaire.
  for (let pass = 0; pass < 2 && count() < wp.qBudget && mi < missing.length; pass++) {
    for (let i = 0; i < w.length && count() < wp.qBudget && mi < missing.length; i++) {
      const t = String(w[i].type || "").toLowerCase();
      if (/repos|renfo|long/.test(t) || isQ(t)) continue;       // on préserve repos, renfo, sortie longue
      if (pass === 0 && (hard(i - 1) || hard(i + 1))) continue;  // 1re passe : pas collé à une qualité
      const q = missing[mi++];
      w[i] = { ...w[i], type: q.type, desc: q.desc.slice(0, 140) };
    }
  }
  return w;
}

async function gem(model: string, parts: string[], cfg: Record<string, unknown>): Promise<string> {
  const r = await fetch(gUrl(model), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: parts.map((text) => ({ role: "user", parts: [{ text }] })), generationConfig: cfg }),
    signal: AbortSignal.timeout(240000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`);
  const j = await r.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !estAdmin(user?.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { user_id, date, distance_km } = await req.json() as { user_id: string; date: string; distance_km?: number };
  if (!user_id || !date) return NextResponse.json({ error: "user_id et date requis" }, { status: 400 });

  const admin = createAdminClient();
  // select("*") volontaire : les colonnes de contexte (running_years, main_terrain,
  // elevation_pref) sont optionnelles — les nommer ferait échouer la requête tant que
  // la migration 007 n'est pas passée. Rien ne quitte le serveur (pas de clé exposée).
  const { data: p } = await admin.from("profiles").select("*").eq("id", user_id).single();
  // ⚠️ AUCUN REPLI SUR LES VARIABLES D'ENVIRONNEMENT — voir `lib/intervals/identifiants`.
  // Le `|| process.env.INTERVALS_ICU_*` qui était ici donnait le compte de l'ÉDITEUR à
  // tout athlète qui n'a pas branché sa montre : ses séances partaient sur le poignet
  // de l'éditeur, et il lisait les sorties de l'éditeur comme les siennes.
  const ids = identifiantsDe(p);
  const ATH = ids?.athleteId;
  const KEY = ids?.apiKey;
  const prenom = (p?.full_name as string | undefined)?.split(" ")[0] || "l'athlète";
  if (!ATH || !KEY) return NextResponse.json({ error: "Intervals.icu non configuré" }, { status: 503 });
  if (!GEMINI_API_KEY) return NextResponse.json({ error: "IA non configurée" }, { status: 503 });

  const day = date.slice(0, 10);
  const auth = { Authorization: "Basic " + Buffer.from(`API_KEY:${KEY}`).toString("base64") };

  try {
    const listRes = await fetch(`${BASE}/athlete/${ATH}/activities?oldest=${day}&newest=${day}`, { headers: auth, signal: AbortSignal.timeout(20000) });
    if (!listRes.ok) return NextResponse.json({ error: `Intervals.icu HTTP ${listRes.status}` }, { status: 502 });
    const list = await listRes.json();
    if (!Array.isArray(list) || !list.length) return NextResponse.json({ error: "Activité introuvable" }, { status: 404 });
    let act = list[0];
    if (distance_km != null && list.length > 1) {
      act = list.reduce((b: Record<string, number>, x: Record<string, number>) => Math.abs((x.distance ?? 0) / 1000 - distance_km) < Math.abs((b.distance ?? 0) / 1000 - distance_km) ? x : b, list[0]);
    }
    const id = act.id as string;

    const [fullRes, lapsRes, streamRes, baseRes, recentRes, hrvRes, sleepRes, planRes, objRes] = await Promise.all([
      fetch(`${BASE}/activity/${id}`, { headers: auth, signal: AbortSignal.timeout(20000) }).catch(() => null),
      fetch(`${BASE}/activity/${id}/intervals`, { headers: auth, signal: AbortSignal.timeout(20000) }).catch(() => null),
      fetch(`${BASE}/activity/${id}/streams?types=time,heartrate,velocity_smooth,watts`, { headers: auth, signal: AbortSignal.timeout(25000) }).catch(() => null),
      admin.from("performance_baselines").select("vma_kmh,max_hr,resting_hr").eq("user_id", user_id).order("tested_at", { ascending: false }).limit(1).single(),
      admin.from("workouts").select("date,title,type,distance_km,duration_seconds,tss,avg_hr,max_hr").eq("user_id", user_id).order("date", { ascending: false }).limit(20),
      admin.from("hrv_data").select("hrv_ms,physiological_state").eq("user_id", user_id).order("date", { ascending: false }).limit(1).single(),
      admin.from("sleep_data").select("sleep_score,total_sleep_min").eq("user_id", user_id).order("date", { ascending: false }).limit(1).single(),
      admin.from("training_plans").select("goal,race_date").eq("user_id", user_id).eq("is_active", true).single(),
      admin.from("notifications").select("data").eq("user_id", user_id).eq("type", "race_objective").maybeSingle(),
    ]);
    const a: Record<string, unknown> = fullRes && fullRes.ok ? await fullRes.json() : act;
    const baseline = baseRes.data;
    const hrv = hrvRes.data, sleep = sleepRes.data, plan = planRes.data;
    const recent = (recentRes.data ?? []).filter((w) => new Date(w.date).getTime() > Date.now() - 14 * 86400000);
    const weekKm = recent.filter((w) => new Date(w.date).getTime() > Date.now() - 7 * 86400000).reduce((s, w) => s + (w.distance_km ?? 0), 0);
    const tss14 = recent.reduce((s, w) => s + (w.tss ?? 0), 0);

    // Objectif de course (saisi par le client) + jours de repos → l'IA en tient compte.
    const objective = objRes.data?.data as { race?: string; distanceKm?: number; raceDate?: string; targetTime?: string; targetPace?: string } | null;
    const objDays = objective?.raceDate ? Math.ceil((new Date(objective.raceDate + "T00:00:00").getTime() - Date.now()) / 86400000) : null;
    const objLine = objective
      ? `${objective.race} — ${objective.distanceKm} km le ${objective.raceDate} (J-${objDays}), temps visé ${objective.targetTime}, allure cible ${objective.targetPace}${objDays != null && objDays <= 21 ? " → AFFÛTAGE (baisse le volume, garde la fraîcheur)" : objDays != null ? " → construis vers cet objectif (allure spécifique progressive)" : ""}`
      : (plan?.goal ? `${plan.goal}${plan?.race_date ? ` · course le ${plan.race_date}` : ""}` : "aucune course visée → PROGRESSION GLOBALE selon profil, dernières séances et récupération (base aérobie, VMA/seuil progressifs, 80/20)");
    const daysSinceLast = recent[0]?.date ? Math.floor((Date.now() - new Date(recent[0].date).getTime()) / 86400000) : null;
    const restDays7 = Math.max(0, 7 - new Set(recent.filter((w) => Date.now() - new Date(w.date).getTime() <= 7 * 86400000).map((w) => String(w.date).slice(0, 10))).size);

    // Puissance + décrochage cardiaque CALCULÉ depuis les streams (intervals ne le fournit pas pour la FR165).
    let pAvg: number | null = null, pMax: number | null = null, decoupling: number | null = null;
    if (streamRes && streamRes.ok) {
      const st = await streamRes.json();
      const S: Record<string, (number | null)[]> = {};
      if (Array.isArray(st)) for (const s of st) if (s?.type && Array.isArray(s.data)) S[s.type] = s.data;
      const w = (S.watts ?? []).filter((v): v is number => typeof v === "number" && isFinite(v));
      if (w.length > 10) { pAvg = Math.round(w.reduce((x, y) => x + y, 0) / w.length); pMax = Math.round(w.reduce((m, v) => v > m ? v : m, 0)); }
      const hr = S.heartrate ?? [], vel = S.velocity_smooth ?? [];
      const pairs: [number, number][] = [];
      const len = Math.min(hr.length, vel.length);
      for (let i = 0; i < len; i++) { const h = hr[i], v = vel[i]; if (typeof h === "number" && h > 60 && typeof v === "number" && v > 0.6) pairs.push([v, h]); }
      if (pairs.length > 60) {
        const half = Math.floor(pairs.length / 2);
        const eff = (arr: [number, number][]) => { const v = arr.reduce((s, x) => s + x[0], 0) / arr.length; const h = arr.reduce((s, x) => s + x[1], 0) / arr.length; return h > 0 ? v / h : null; };
        const e1 = eff(pairs.slice(0, half)), e2 = eff(pairs.slice(half));
        if (e1 && e2) decoupling = Math.round(((e1 - e2) / e1) * 1000) / 10;
      }
    }

    // Zones
    let zoneStr = "";
    if (Array.isArray(a.icu_hr_zone_times)) {
      const z = a.icu_hr_zone_times as number[]; const tot = z.reduce((x, y) => x + (y || 0), 0);
      if (tot) zoneStr = z.map((s, i) => s > 0 ? `${ZL[i]} ${Math.round((s / tot) * 100)}% (${Math.round(s / 60)}min)` : null).filter(Boolean).join(" · ");
    }
    // Tours détaillés
    let lapsStr = "";
    if (lapsRes && lapsRes.ok) {
      const lj = await lapsRes.json();
      const raw = Array.isArray(lj) ? lj : (lj.icu_intervals || lj.intervals || []);
      if (Array.isArray(raw) && raw.length) lapsStr = raw.slice(0, 40).map((l: Record<string, number>, i: number) =>
        `#${i + 1} ${(l.distance / 1000).toFixed(2)}km @${pace(l.average_speed)}/km (GAP ${pace(l.gap)}) FC ${l.average_heartrate ?? "?"}/${l.max_heartrate ?? "?"} cad ${l.average_cadence ? Math.round(l.average_cadence * 2) : "?"} Z${l.zone ?? "?"}`).join("\n  ");
    }
    // Historique RECLASSÉ par allure/FC (les imports arrivent tous en « easy ») → débrief juste.
    const histMax = Math.max(0, ...(recentRes.data ?? []).map((w) => (w.max_hr as number | null) ?? 0));
    const histFcMax = (baseline?.max_hr as number | null) ?? (histMax > 150 ? histMax : null);
    const histTxt = recent.map((w) => `${w.date} ${classifyRun(w, histFcMax)} ${w.distance_km ?? "?"}km FC ${w.avg_hr ?? "?"} charge ${w.tss ?? "?"}`).join("\n  ") || "aucune";
    const sp = n(a.average_speed);

    // Passif / terrain / dénivelé — l'analyse de la séance en tient compte elle aussi
    // (une allure sur sable ou en montagne ne se lit pas comme une allure sur route).
    const ry = typeof p?.running_years === "number" ? p.running_years : null;
    const profExp = ry == null ? "ancienneté non renseignée"
      : ry < 1 ? "moins d'un an de course à pied (débutant : tendons encore jeunes)"
      : `${ry} an${ry > 1 ? "s" : ""} de course à pied`;
    const terrBlock = terrainCoachBlock(p?.main_terrains, p?.main_terrain);
    const profTerrain = terrBlock.labels.length ? terrBlock.labels.join(" + ") : "non renseigné";
    const ELEVL: Record<string, string> = { evite: "évite le dénivelé", modere: "dénivelé modéré", aime: "aime le dénivelé", specialiste: "spécialiste du dénivelé" };
    const profElev = ELEVL[String(p?.elevation_pref ?? "")] ?? "";
    // Santé : l'analyse d'une séance se lit différemment selon les antécédents (une FC haute
    // chez un athlète anémié ou sous bêtabloquants ne veut pas dire la même chose).
    const condL = healthCoachLines(p?.health_conditions, HEALTH_CONDITIONS).labels;
    const injL = healthCoachLines(p?.injury_zones, INJURY_ZONES).labels;
    const healthNote = typeof p?.health_notes === "string" ? p.health_notes.trim().slice(0, 300) : "";
    const profHealth = [
      condL.length ? `pathologies : ${condL.join(", ")}` : null,
      injL.length ? `zones fragiles : ${injL.join(", ")}` : null,
      healthNote ? `note de l'athlète : « ${healthNote} »` : null,
    ].filter(Boolean).join(" · ") || "rien de déclaré";

    const summary = `SÉANCE du ${day} — ${a.name ?? "Course à pied"} (athlète : ${prenom})
Distance ${n(a.distance) != null ? (n(a.distance)! / 1000).toFixed(2) : "?"} km · D+ ${n(a.total_elevation_gain) != null ? Math.round(n(a.total_elevation_gain)!) : "?"} m / D- ${n(a.total_elevation_loss) != null ? Math.round(n(a.total_elevation_loss)!) : "?"} m · durée ${n(a.moving_time) != null ? Math.round(n(a.moving_time)! / 60) : "?"} min
Allure moy ${pace(sp)}/km · GAP ${pace(n(a.gap))}/km · vitesse max ${n(a.max_speed) ? (n(a.max_speed)! * 3.6).toFixed(1) : "?"} km/h
Charge TSS ${n(a.icu_training_load) ?? "?"} · intensité ${n(a.icu_intensity) != null ? Math.round(n(a.icu_intensity)!) : "?"}% · TRIMP ${n(a.trimp) != null ? Math.round(n(a.trimp)!) : "?"} · indice polarisation ${n(a.polarization_index) ?? "?"}
FC moy ${n(a.average_heartrate) ?? "?"} / max ${n(a.max_heartrate) ?? "?"} · FC repos ${n(a.icu_resting_hr) ?? "?"} · LTHR ${n(a.lthr) ?? "?"}
Décrochage cardiaque (calculé Pa:HR 1re/2e moitié) : ${decoupling != null ? decoupling + "%" : "n/d"}  [<5% = bonne endurance, >5% = dérive/fatigue]
Puissance moy ${pAvg ?? "?"} W / max ${pMax ?? "?"} W
Cadence ${n(a.average_cadence) != null ? Math.round(n(a.average_cadence)! * 2) : "?"} spm · foulée ${n(a.average_stride) != null ? (Math.round(n(a.average_stride)! * 100) / 100) : "?"} m · température ${n(a.average_temp) != null ? Math.round(n(a.average_temp)!) : "?"}°C
Forme CTL ${n(a.icu_ctl) != null ? Math.round(n(a.icu_ctl)!) : "?"} · Fatigue ATL ${n(a.icu_atl) != null ? Math.round(n(a.icu_atl)!) : "?"}
Répartition zones FC : ${zoneStr || "n/d"}
TOURS (un par un) :
  ${lapsStr || "n/d"}
CONTEXTE ATHLÈTE : VMA ${baseline?.vma_kmh ?? "?"} km/h · FC max ${baseline?.max_hr ?? "?"} · FC repos ${baseline?.resting_hr ?? "?"} · volume 7j ${weekKm.toFixed(0)} km · charge 14j ${tss14.toFixed(0)} TSS
PROFIL : ${p?.age ?? "?"} ans · ${p?.gender === "female" ? "femme" : p?.gender === "male" ? "homme" : "sexe ?"} · ${profExp} · terrain ${profTerrain}${profElev ? ` · ${profElev}` : ""}${terrBlock.paceMeaningless ? "  ⚠️ il court sur une surface où l'allure /km n'est PAS comparable au bitume (sable : +45 s à 1 min 30/km ; montagne ; neige) : juge l'effort à la FC, pas à l'allure." : ""}
SANTÉ (à prendre en compte dans la lecture de la séance) : ${profHealth}
RÉCUPÉRATION (dernier relevé) : VFC ${hrv?.hrv_ms ?? "?"} ms${hrv?.physiological_state ? ` · état ${hrv.physiological_state}` : ""} · sommeil ${sleep?.sleep_score ?? "?"}/100${sleep?.total_sleep_min ? ` (${Math.round(sleep.total_sleep_min / 60)}h)` : ""}
OBJECTIF DE COURSE : ${objLine}
REPOS : dernière séance il y a ${daysSinceLast ?? "?"} j · ${restDays7} j sans courir sur 7${daysSinceLast != null && daysSinceLast >= 3 ? " ⚠️ reprise après coupure : redémarre progressivement" : ""}
HISTORIQUE 14 DERNIERS JOURS :
  ${histTxt}`;

    const analysisSystem = `Tu es un entraîneur de course à pied et de trail de niveau ÉLITE, 20 ans d'expérience. Tu débriefes CETTE séance en profondeur, comme entre coachs. Tu examines CHAQUE donnée : charge, intensité, zones, tours un par un, dérive cardiaque, puissance, allures, cadence, et tu croises avec le contexte (VMA, charge récente).

STYLE :
- Français, ton de coach expert, humain et nuancé, jamais robotique.
- 3 sections séparées par une ligne vide. Titres en MAJUSCULES précédés d'un emoji (PAS de dièses markdown). Tu peux mettre **un mot-clé** en gras (astérisques), avec parcimonie.
- CONCRET : cite des numéros de tours précis, des allures, des FC, des %.
- N'invente JAMAIS un chiffre. Si une donnée manque, dis-le clairement.

SECTIONS :
🔎 LECTURE DE LA SÉANCE — le type réel de séance, ce qu'elle développe, la qualité d'exécution (régularité des tours, dérive cardiaque, placement des zones, contraste effort/récup).
⚠️ POINTS DE VIGILANCE — exécution, fatigue, intensité mal placée, décrochage, FC max, récupérations.
📈 CE QUE ÇA NOUS APPREND — état de forme du moment, ce qu'il faut consolider ou corriger ensuite.`;

    const planSystem = `Tu es le coach personnel de ${prenom} — entraîneur course à pied/trail de très haut niveau (méthodes Daniels & Canova, modèle polarisé 80/20, prévention des blessures). Tu prescris des séances DE PRO, précises et 100% personnalisées. À partir de cette séance, de son historique, de sa récupération et de son objectif : écris (1) LA prochaine séance, et (2) un plan sur 7 jours.

RÈGLES DE COACHING NON NÉGOCIABLES :
- ⚡ LE « VERDICT DE FRAÎCHEUR DU JOUR » DU CONTEXTE S'IMPOSE À TOI. Il est calculé à partir de sa VFC, de son sommeil de cette nuit, de sa charge et de son ressenti. Feu ROUGE = AUCUNE intensité aujourd'hui, quelles que soient l'échéance et l'envie. Feu VERT = ne sous-dose pas « par prudence », ce serait du potentiel perdu. Ne ré-arbitre pas ce verdict, applique-le et explique-le à ${prenom} avec des mots simples.
- 🩺 LA SANTÉ PRIME SUR LA PERFORMANCE. Applique littéralement chaque consigne du bloc « SANTÉ & ANTÉCÉDENTS » : pathologies déclarées, zones de blessure récurrentes, notes écrites par l'athlète. Une contre-indication n'est JAMAIS contournée pour tenir un objectif ; si l'objectif devient incompatible avec sa santé, dis-le franchement plutôt que de prescrire quand même.
- ⏳ ÂGE & RÉCUPÉRATION : respecte l'espacement minimum entre deux séances dures indiqué dans le contexte (il est calculé sur SON âge, il ne vaut pas 48 h pour tout le monde). Après 35 ans, c'est la récupération — pas la capacité — qui limite : mieux vaut 2 séances de qualité bien digérées que 3 subies.
- 🌡️ CONDITIONS RÉELLES : tiens compte de la météo récente indiquée. Au-dessus de 25 °C, n'exige pas les allures habituelles (compte 15 à 45 s/km de plus selon la chaleur) et juge l'effort à la FC. Par temps glacial, rallonge l'échauffement et évite le fractionné court à froid.
- 🗺️ SURFACE : sur SABLE ou en MONTAGNE, une allure au km n'a pas de sens — prescris en DURÉE et en FRÉQUENCE CARDIAQUE, et place les séances chiffrées sur surface dure (route/piste).
- STRUCTURE DE CHAQUE SÉANCE (capital) : TOUTE séance de course se décompose en 3 temps — (1) ÉCHAUFFEMENT : AU MOINS 15 min de footing progressif Z1→Z2 (montée en température douce) ; (2) CORPS de séance ; (3) RETOUR AU CALME : AU MOINS 10 min de footing très facile Z1. Même une séance facile/endurance : on démarre tranquille et on finit tranquille — JAMAIS un seul bloc brut. Ex endurance : « 15 min échauffement progressif Z1→Z2 + 30 min Z2 (~X:XX/km), fin un peu plus soutenue + 10 min retour au calme Z1 ». Ex récup : « 10 min échauffement très doux + 20 min Z1 + 5 min retour au calme ». Échauffement et retour au calme se font EN COURANT (jamais en marchant). ⚠️ Échauffement et retour au calme = pilotés à la FRÉQUENCE CARDIAQUE (zones FC, ex « FC Z1→Z2 »), PAS à l'allure — n'y mets jamais d'allure /km ; seul le CORPS de séance porte une allure cible.
- Pour les séances de QUALITÉ (VMA, seuil/tempo, fractionné, côtes, allure spécifique course) : après l'échauffement, ajoute 3-5 lignes droites de 80-100 m, puis le corps CHIFFRÉ, récup trottinée ENTRE répétitions, puis le retour au calme. L'échauffement y est plus long (15-20 min).
- Séances de qualité chiffrées (allures min/km depuis la VMA : endurance 65-75 %, seuil 85-90 %, VMA 100-105 %) : fractionné court (10×400 m, 30/30), VMA longue (5-6×1000 m), seuil (2-3×10-15 min), côtes. Récup ENTRE répétitions = trottinée. Là, et seulement là, on découpe échauffement / corps / retour au calme.
- PERSONNALISE : niveau/VMA, charge récente (progressivité, +10 %/sem max), SOMMEIL et VFC/état (fatigué ou sommeil bas → allège, plus de récup), objectif. Si ${prenom} est fatigué aujourd'hui, la prochaine séance est facile.
- POLARISÉ 80/20 = en VOLUME (temps total), PAS en nombre de séances : 2 séances de qualité COURTES dans la semaine restent ~80 % facile. Ne tombe JAMAIS dans le piège « presque tout en footing + renfo » → ça SOUS-ENTRAÎNE un coureur qui vise un chrono. Un objectif chrono EXIGE de la qualité spécifique CHAQUE semaine. Simplement : jamais 2 grosses séances consécutives (≥ 48 h entre deux).
- REPRISE après coupure : 3–8 jours sans courir ne déconditionnent PAS (c'est du repos, pas du désentraînement). UN footing de remise en route suffit, PUIS on enchaîne la qualité normalement. Ne transforme pas 4 jours de repos en semaine molle entière. (Vraie reprise prudente = seulement après ≥ 2 semaines d'arrêt, une blessure, ou si VFC/sommeil sont dégradés AUJOURD'HUI.)
- SUIS LA « STRUCTURE CIBLE DE LA SEMAINE » du contexte : ton plan 7 jours DOIT contenir le nombre de séances de qualité qu'elle indique, avec ses types/allures (que tu peux adapter). Si un chrono est visé, place AU MOINS une séance à l'allure spécifique de l'objectif. N'édulcore pas « par prudence » sans signal de fatigue réel.
- OBJECTIF : S'IL Y A une course cible → fais converger la progression (allure spécifique, distance, terrain) et AFFÛTAGE si ≤ 3 semaines (volume −40 %, on GARDE l'intensité). SINON (aucun objectif) → PROGRESSION GLOBALE : développe la base aérobie ET la VMA/le seuil progressivement (jamais 100 % facile) selon son profil/niveau, ses dernières séances et sa récupération.

TON : tu écris DIRECTEMENT à ${prenom} (« tu »), comme un vrai coach humain — chaleureux, motivant, COURT, jamais un pavé. Explique POURQUOI et COMMENT te sentir.

Réponds UNIQUEMENT en JSON valide :
{"nextSession":{"title":"nom court et parlant","workout":"le détail STRUCTURÉ en 3 temps : ÉCHAUFFEMENT (≥15 min footing progressif à la FC Z1→Z2, SANS allure /km) puis CORPS (durée + allure cible /km ; ou format chiffré + lignes droites + récup entre reps si QUALITÉ) puis RETOUR AU CALME (≥10 min footing très facile à la FC Z1, SANS allure). L'allure /km ne concerne QUE le corps de séance ; l'échauffement et le retour au calme sont en FC.","why":"1-2 phrases chaleureuses : pourquoi cette séance aujourd'hui (liée à sa dernière séance ET sa récup)","feel":"1 phrase : sensations à viser","tags":["3 tags courts ex VMA, 12 km, Z5"]},"week":[{"label":"jour ex Mer","type":"Repos|Récup|Endurance|Sortie longue|Tempo|Seuil|VMA|Spécifique|Renfo","desc":"séance STRUCTURÉE et précise, séparée par ' → ' : Échauffement (≥15 min footing à la FC Z1→Z2) → Corps (allure /km ; format chiffré pour la qualité, ex 6×1000 m à 3'05/km récup 1'30) → Retour au calme (≥10 min FC Z1). L'allure /km ne va QUE sur le corps. Pour Repos = 'Repos complet' ; pour Renfo = exercices clés (pas d'échauffement course)"}]}

Le plan "week" couvre 7 jours (la séance d'AUJOURD'HUI = nextSession est le 1er jour). Il DOIT contenir le NOMBRE de séances de QUALITÉ (VMA/Seuil/Tempo/Spécifique) indiqué par la STRUCTURE CIBLE DE LA SEMAINE du contexte — soit ≥ 2 quand un chrono est visé et que l'athlète est frais. Il inclut aussi ≥ 1 jour Repos et 1 séance Renfo, et respecte le 80/20 EN VOLUME (pas en nombre de séances). N'aboutis JAMAIS à une semaine avec une seule séance de qualité si la structure cible en demande 2-3.`;

    // Cerveau coach complet (tendances aérobies/VFC, monotonie, forme de course, sommeil
    // détaillé, cycle, terrain, + PALETTE de séances) → prescription de très haut niveau.
    const ctx = await buildAthleteContext(admin as unknown as Parameters<typeof buildAthleteContext>[0], user_id).catch(() => null);
    const planInput = summary + (ctx ? `\n\n═══ CONTEXTE APPROFONDI DE L'ATHLÈTE ═══\n${ctx.text}` : "");

    const settled = await Promise.allSettled([
      gem("gemini-2.5-flash", [analysisSystem, summary], { temperature: 0.55, maxOutputTokens: 6000, thinkingConfig: { thinkingBudget: 3000 } }),
      gem("gemini-2.5-flash", [planSystem, planInput], { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }),
    ]);

    const analysis = settled[0].status === "fulfilled" ? settled[0].value.trim() : null;
    if (!analysis) return NextResponse.json({ error: `IA indisponible: ${settled[0].status === "rejected" ? (settled[0].reason as Error).message : "vide"}` }, { status: 502 });

    let nextSession: Record<string, unknown> | null = null;
    let week: Record<string, unknown>[] = [];
    if (settled[1].status === "fulfilled") {
      const m = settled[1].value.match(/\{[\s\S]*\}/);
      if (m) try {
        const plan = JSON.parse(m[0]);
        if (plan.nextSession) nextSession = {
          title: String(plan.nextSession.title ?? "").slice(0, 70),
          workout: String(plan.nextSession.workout ?? "").slice(0, 400),
          why: String(plan.nextSession.why ?? "").slice(0, 300),
          feel: String(plan.nextSession.feel ?? "").slice(0, 200),
          tags: Array.isArray(plan.nextSession.tags) ? plan.nextSession.tags.slice(0, 3).map((t: unknown) => String(t).slice(0, 16)) : [],
        };
        if (Array.isArray(plan.week)) week = plan.week.slice(0, 7).map((d: Record<string, unknown>) => ({
          label: String(d.label ?? "").slice(0, 24), type: String(d.type ?? "").slice(0, 20), desc: String(d.desc ?? "").slice(0, 140),
        }));
      } catch { /* plan optionnel */ }
    }

    // FILET DE SÉCURITÉ : garantit le nombre de séances de qualité du squelette (anti « trop d'EF »).
    week = enforceQuality(week, ctx?.weekPlan);

    try {
      await admin.from("notifications").insert({
        user_id, type: "session_ai_analysis", title: `Analyse séance ${day}`,
        body: analysis.slice(0, 300), data: { date: day, summary, analysis, nextSession, week },
      });
    } catch { /* table optionnelle */ }

    return NextResponse.json({ analysis, nextSession, week, macroPlan: ctx?.macroPlan ?? [], objective: objective ? { ...objective, daysToRace: objDays } : null, rest: { daysSinceLast, restDays7 }, readiness: ctx?.readiness ?? null });
  } catch (e) {
    return NextResponse.json({ error: `Erreur: ${(e as Error).message}` }, { status: 502 });
  }
}
