export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exigeAcces } from "@/lib/billing/guard";
import { generateContent, budget } from "@/lib/ai/gemini";
import { oneSessionPerSlot, slotKey } from "@/lib/coach/sessions";
import { sniffImage } from "@/lib/upload/sniff";
import { suiviParZone, resumeDouleurs, type Signalement } from "@/lib/health/douleurs";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

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

  const { message, zone, zoneKey, painLevel, history, photo } = await req.json() as {
    message: string;
    zone?: string | null;
    /** Clé stable du schéma corporel — voir `Signalement.cle`. Le libellé, lui, dépend de la langue. */
    zoneKey?: string | null;
    painLevel?: number | null;
    history?: Msg[];
    /** Photo envoyée pour CETTE question. Jamais stockée — voir plus bas. */
    photo?: { data?: string; mime?: string } | null;
  };

  // ── PHOTO : validée puis transmise, JAMAIS ÉCRITE NULLE PART ────────────────
  //
  // Décision assumée : l'image ne touche aucun bucket, aucune table, aucun disque. Elle
  // transite en mémoire jusqu'à Gemini et disparaît avec la requête.
  //
  // La route /api/upload existante écrit dans un bucket PUBLIC (`getPublicUrl`) : correct
  // pour une pièce jointe de messagerie, inacceptable pour une cheville gonflée ou une
  // irritation — l'URL resterait accessible à vie, sans authentification. Un bucket privé
  // aurait réglé l'accès mais pas la conservation. Ne rien garder règle les deux, et
  // supprime au passage toute question de durée de rétention sur une donnée de santé.
  //
  // Le type est déduit des OCTETS (même contrôle que /api/upload) : un `mime` déclaré par
  // le client ne prouve rien, et on ne veut pas relayer un fichier arbitraire à Gemini.
  let imagePart: { inline_data: { mime_type: string; data: string } } | null = null;
  if (photo?.data) {
    const b64 = String(photo.data).replace(/^data:[^;]+;base64,/, "");
    // ~4/3 d'expansion en base64 : 8 Mo de base64 ≈ 6 Mo d'image. Le client redimensionne
    // déjà à 1280 px (~200 Ko) ; cette borne n'attrape qu'un appel direct à l'API.
    if (b64.length > 8_000_000) {
      return NextResponse.json({ error: "Photo trop lourde (6 Mo maximum)." }, { status: 413 });
    }
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(Buffer.from(b64, "base64")); }
    catch { return NextResponse.json({ error: "Photo illisible." }, { status: 400 }); }
    const mime = sniffImage(bytes);
    if (!mime) {
      return NextResponse.json({ error: "Format non accepté. Images uniquement (JPEG, PNG, GIF, WebP)." }, { status: 415 });
    }
    imagePart = { inline_data: { mime_type: mime, data: b64 } };
  }

  const [profileRes, workoutsRes, sleepRes, hrvRes, fbRes, raceRes, coachSessRes, painRes, shoesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("workouts").select("title,date,distance_km,elevation_gain_m,duration_seconds,avg_hr,max_hr,avg_cadence_spm,ground_contact_ms,vertical_oscillation_cm,stride_length_m,type").eq("user_id", user.id).order("date", { ascending: false }).limit(40),
    supabase.from("sleep_data").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(1).single(),
    supabase.from("hrv_data").select("hrv_ms,date").eq("user_id", user.id).order("date", { ascending: false }).limit(14),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "session_feedback").order("created_at", { ascending: false }).limit(6),
    supabase.from("notifications").select("data").eq("user_id", user.id).eq("type", "planned_race").order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("title,body,data").eq("user_id", user.id).eq("type", "coach_session").order("created_at", { ascending: false }).limit(30),
    // ⚠️ L'HISTORIQUE DE DOULEUR, QUE CETTE ROUTE N'AVAIT JAMAIS RELU. Elle écrivait des
    // `pain_report` que seul le COACH relisait ; le kiné, lui, ne consultait que ceux du
    // jour, et uniquement pour éviter un doublon d'écriture. Un genou à 7/10 lundi et
    // 4/10 jeudi donnait donc deux consultations sans lien, dont aucune ne disait que ça
    // allait mieux. 60 jours : au-delà, une douleur non redéclarée n'oriente plus rien.
    supabase.from("notifications").select("data,created_at").eq("user_id", user.id).eq("type", "pain_report")
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString())
      .order("created_at", { ascending: false }).limit(120),
    // Les chaussures : un kiné demande TOUJOURS le modèle et le kilométrage. La donnée
    // existe déjà dans le garage — elle n'avait simplement jamais été transmise.
    supabase.from("shoes").select("brand,model,current_km,max_km,drop_mm,terrain").eq("user_id", user.id).eq("is_active", true).limit(6),
  ]);

  const profile = profileRes.data;
  const workouts = workoutsRes.data ?? [];
  const sleep = sleepRes.data;
  const hrv = (hrvRes.data ?? []) as { hrv_ms: number | null; date: string }[];
  const feedback = (fbRes.data ?? []) as { data: { pain?: string[]; rpe?: number; note?: string } }[];
  const now = Date.now();
  const num = (v: unknown) => Number(v ?? 0);

  // Charge & risque blessure (le ratio rampe/charge est le 1er prédicteur de blessure de surcharge).
  const kmIn = (d: number) => workouts.filter((w) => now - new Date(w.date).getTime() <= d * 86400000).reduce((s, w) => s + num(w.distance_km), 0);
  const weekKm = kmIn(7);
  const avg4wk = kmIn(28) / 4;
  const rampPct = avg4wk > 0 ? Math.round((weekKm / avg4wk - 1) * 100) : 0;
  const elevWeek = Math.round(workouts.filter((w) => now - new Date(w.date).getTime() <= 7 * 86400000).reduce((s, w) => s + num(w.elevation_gain_m), 0));
  // Forme de course (moyennes récentes) — leviers biomécaniques.
  const rec = workouts.slice(0, 12);
  const avgOf = (k: keyof typeof workouts[number]) => { const v = rec.map((w) => num(w[k])).filter((x) => x > 0); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const cadence = avgOf("avg_cadence_spm"), gct = avgOf("ground_contact_ms"), vosc = avgOf("vertical_oscillation_cm");
  const hrvVals = hrv.map((h) => h.hrv_ms).filter((v): v is number => v != null);
  const hrvLatest = hrvVals[0] ?? null;
  const hrvBase = hrvVals.length >= 3 ? Math.round(hrvVals.reduce((a, b) => a + b, 0) / hrvVals.length) : null;
  const pains = [...new Set(feedback.flatMap((f) => f.data?.pain ?? []).filter(Boolean))];

  // ── MÉMOIRE DU KINÉ : l'évolution zone par zone sur 60 jours ────────────────────
  const jourDeLAthlete = aujourdhui(FUSEAU_DEFAUT);
  const signalements: Signalement[] = ((painRes.data ?? []) as { data: { zone?: string; slot?: string; level?: number; date?: string } | null; created_at: string }[])
    .map((r) => ({
      zone: String(r.data?.zone ?? ""),
      cle: r.data?.slot ? String(r.data.slot) : null,
      level: Number(r.data?.level),
      // La date porte l'information clinique ; `created_at` ne sert que de repli.
      date: String(r.data?.date ?? r.created_at ?? "").slice(0, 10),
    }));
  const suivi = suiviParZone(signalements, jourDeLAthlete);
  const resumeSuivi = resumeDouleurs(suivi);

  // ── GARAGE : modèle et kilométrage, sans verdict inventé ────────────────────────
  // ⚠️ `current_km` peut valoir 0 parce que RIEN n'a jamais été saisi, pas parce que la
  // paire est neuve. On l'écrit alors « kilométrage non renseigné » : un modèle à qui on
  // annonce « 0 km » conclurait à une paire neuve et écarterait la piste de l'usure.
  const chaussures = ((shoesRes.data ?? []) as { brand: string | null; model: string | null; current_km: number | null; max_km: number | null; drop_mm: number | null; terrain: string | null }[])
    .map((c) => {
      const km = Number(c.current_km);
      const max = Number(c.max_km);
      const usure = km > 0 && max > 0 ? Math.round((km / max) * 100) : null;
      return `${[c.brand, c.model].filter(Boolean).join(" ") || "modèle non renseigné"}` +
        (km > 0 ? ` — ${Math.round(km)} km${max > 0 ? `/${Math.round(max)}` : ""}${usure != null ? ` (${usure} % de la durée de vie annoncée${usure >= 85 ? ", À REMPLACER" : ""})` : ""}` : " — kilométrage non renseigné")
        + (c.drop_mm != null ? ` · drop ${c.drop_mm} mm` : "") + (c.terrain ? ` · ${c.terrain}` : "");
    });
  // Course à venir : un objectif proche change la stratégie (gestion vs guérison complète).
  const todayStr = aujourdhui(FUSEAU_DEFAUT);
  const nextRace = ((raceRes.data ?? []) as { data: { date?: string; name?: string; distanceKm?: number | null } }[])
    .map((r) => r.data).filter((d) => (d?.date ?? "") >= todayStr)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] ?? null;
  // Séances prescrites par le coach humain (à venir) → l'ajustement de charge cite les VRAIES séances.
  type CoachRow = { title: string; body: string | null; data: { date?: string; subtitle?: string } };
  const upcomingSess = oneSessionPerSlot((coachSessRes.data ?? []) as CoachRow[], (r) => slotKey(r.data))
    .filter((r) => String(r.data?.date ?? "") >= todayStr)
    .sort((a, b) => String(a.data?.date ?? "").localeCompare(String(b.data?.date ?? "")))
    .slice(0, 4)
    .map((r) => `${String(r.data?.date ?? "").slice(0, 10)} : ${r.title}${r.data?.subtitle ? ` (${String(r.data.subtitle).slice(0, 60)})` : ""}`);

  const systemPrompt = `Tu es Dr. Léa Moreau, kinésithérapeute du sport de niveau INTERNATIONAL : tu as suivi des athlètes olympiques et des coureurs élite (piste, route, trail, ultra), et tu coaches aussi des amateurs et des grands débutants avec la même rigueur. Tu raisonnes comme une clinicienne de haut niveau : diagnostic différentiel structuré, médecine fondée sur les preuves, biomécanique de la course, gestion de la charge. Tu mènes une vraie consultation en français, à la première personne, chaleureuse mais experte.

DOSSIER DE L'ATHLÈTE (exploite-le finement — c'est ce qui te rend supérieure à un conseil générique ; ne le récite pas) :
- ${profile?.age ?? "?"} ans · ${profile?.gender ?? "?"} · ${num(profile?.weight_kg) || "?"} kg · ${num(profile?.height_cm) || "?"} cm
- Charge : ${weekKm.toFixed(0)} km cette semaine vs ${avg4wk.toFixed(0)} km/sem (moy. 4 sem.) → rampe ${rampPct > 0 ? "+" : ""}${rampPct}% ${rampPct > 30 ? "⚠️ PROGRESSION TROP RAPIDE = risque majeur de blessure de surcharge" : rampPct > 10 ? "(au-dessus des +10%/sem recommandés)" : "(progressive, ok)"} · ${elevWeek} m D+ /7j
- Biomécanique récente : cadence ${cadence ?? "?"} spm ${cadence && cadence < 165 ? "(basse → suroscillation/impact, lien possible avec les douleurs)" : ""} · contact sol ${gct ?? "?"} ms · oscillation verticale ${vosc ?? "?"} cm
- Récupération : ${sleep ? `sommeil ${Math.round(num(sleep.total_sleep_min) / 60)}h (score ${sleep.sleep_score ?? "?"}/100), énergie ${sleep.body_battery_end ?? "?"}/100` : "n/c"}${hrvLatest != null ? ` · VFC ${hrvLatest} ms (base ${hrvBase ?? "?"} → ${hrvBase && hrvLatest < hrvBase * 0.92 ? "BASSE = fatigue/stress, cicatrisation ralentie" : "ok"})` : ""}
${pains.length ? `- Douleurs déjà signalées récemment : ${pains.join(", ")}` : ""}
- SUIVI DES DOULEURS DÉCLARÉES (60 derniers jours) : ${resumeSuivi || "aucun antécédent enregistré — ne suppose donc AUCUN historique, et ne dis pas que c'est nouveau : tu n'en sais rien."}${resumeSuivi ? `
  → OUVRE la consultation par ce suivi quand il concerne la zone dont on te parle : « ton genou droit était à 7/10 il y a 5 jours, tu es à 4 aujourd'hui » est exactement ce qu'un kiné dit en revoyant quelqu'un. Une zone marquée EN AGGRAVATION prime sur tout le reste. Une évolution notée « une seule déclaration » n'est PAS une tendance : ne la commente pas comme telle.` : ""}
- CHAUSSURES (garage) : ${chaussures.length ? chaussures.join(" | ") : "aucune paire enregistrée — DEMANDE le modèle et le kilométrage approximatif, c'est une cause fréquente et facile à corriger."}${chaussures.length ? `
  → Une paire au-delà de ~85 % de sa durée de vie, un changement récent de modèle ou un drop très différent expliquent une part réelle des douleurs de tendon, de genou et de pied. Cite la paire par son nom. Un « kilométrage non renseigné » veut dire QU'ON NE SAIT PAS : demande-le, ne conclus pas que la paire est neuve.` : ""}${zone ? `\n- Zone pointée sur le schéma : ${zone}${painLevel ? ` — douleur ${painLevel}/10` : ""}` : ""}${nextRace ? `\n- COURSE À VENIR : ${nextRace.name}${nextRace.distanceKm ? ` (${nextRace.distanceKm} km)` : ""} le ${nextRace.date} — intègre-la à ta stratégie (gérer pour courir vs guérir d'abord, et dis-le franchement si la course est compromise)` : ""}${upcomingSess.length ? `\n- SÉANCES PRESCRITES par son coach (à venir) : ${upcomingSess.join(" | ")} — quand tu ajustes la charge, cite CES séances par leur nom/date (garder, alléger, remplacer par vélo/aqua-jogging, ou décaler) et suggère d'en parler au coach via la Messagerie` : ""}

RÉFÉRENTIEL CLINIQUE EXPRESS (médecine fondée sur les preuves — adapte chaque dosage au cas) :
• Tendinopathie d'ACHILLE — signature : raideur matinale, douleur qui « chauffe » à l'effort puis revient à froid. Corps du tendon : isométriques mollet (5 × 45 s) en phase irritable → excentriques type Alfredson (3 × 15, 2×/j, lent, charge progressive, ~12 sem). Insertionnelle : ÉVITER étirements et dorsiflexion complète (compression), talonnette temporaire. Reprise : sauts unipodaux indolores + raideur matinale < 5 min.
• Tendinopathie PATELLAIRE — douleur pointe de rotule, descentes, escaliers. Isométriques quadriceps (wall-sit / extension 5 × 45 s ≈ 70 % effort, effet antalgique immédiat) → excentriques squat décliné 25° (3 × 15) → charge lourde lente. Le repos complet AGGRAVE (déconditionnement du tendon).
• Syndrome de l'ESSUIE-GLACE (bandelette IT) — douleur LATÉRALE du genou, surgit à kilométrage fixe, pire en descente. Causes types : rampe de charge + moyen fessier faible + cadence basse. Renfo hanche (side-plank + abductions, single-leg squat contrôlé), cadence +5-10 %, réduire les descentes. Étirer agressivement l'IT band = inutile (structure quasi inextensible).
• PÉRIOSTITE (MTSS) vs FRACTURE DE STRESS tibiale — MTSS : douleur DIFFUSE bord interne (> 5 cm), s'estompe à l'échauffement. Fracture de stress : point exquis FOCAL, douleur au saut unipodal (hop test), CROISSANTE pendant l'effort, parfois nocturne → STOP course + médecin/IRM sans délai. MTSS : volume −30-50 %, surfaces souples, renfo mollets + tibial postérieur.
• FASCIOPATHIE PLANTAIRE — douleur talon aux PREMIERS PAS du matin. Renfo mollet charge lourde lente avec orteils en extension (serviette roulée sous les orteils, 3 × 12), automassage balle, patience : 3-12 mois — la charge progressive guérit, pas le repos.
• Syndrome FÉMORO-PATELLAIRE — douleur antérieure diffuse, « signe du cinéma » (assis prolongé), escaliers. Renfo quadriceps en amplitudes indolores + hanche (abducteurs/rotateurs externes), cadence +7,5 %, limiter au début descentes et squats profonds chargés.
• LÉSION MUSCULAIRE mollet/ischio — « coup de fouet » brutal = lésion, stop immédiat. Charge précoce progressive (isométriques doux dès J2-J5, jamais d'étirement agressif précoce), reprise course quand marche rapide 30 min + sautillements indolores ; le sprint se réintroduit en DERNIER. Prévention ischios : Nordic hamstring.
• PUBALGIE / adducteurs — douleur d'aine, pire aux changements de direction. Renfo Copenhagen progressif + gainage, charge maintenue à douleur ≤ 3/10.
• Syndrome du PIRIFORME / fessier profond — douleur fesse ± irradiation, assise prolongée pénible. Renfo fessiers en charge progressive ; éviter les étirements agressifs si irritation nerveuse.
PRINCIPES TRANSVERSAUX : douleur ≤ 3-4/10 pendant/après SANS aggravation le lendemain matin = charge adaptée acceptable (modèle de quantification du stress mécanique) · le repos TOTAL est rarement la réponse (sauf os / drapeaux rouges) : on MODULE la charge · cross-training sans impact (vélo, aqua-jogging, natation) pour préserver le cardio pendant la réhab · sommeil ≥ 7-8 h + protéines ~1,6-2 g/kg/j = accélérateurs de cicatrisation · chaque exercice prescrit = nom + séries × reps + tempo + fréquence/sem + critère de progression.

MÉTHODE DE CONSULTATION (fluide, n'affiche pas les numéros) :
1. ACCUEIL EMPATHIQUE : reformule ce que ressent la personne ("Si je comprends bien…").
2. ANAMNÈSE CIBLÉE : si une info clé manque, pose 1 à 2 questions MAX (depuis quand ? apparition brutale/progressive ? douleur à l'effort/au repos/à la marche/au réveil ? augmente ou se dissipe en courant ? localisation précise, point exquis ?). Ne noie jamais sous les questions.
3. DIAGNOSTIC DIFFÉRENTIEL : propose 1 à 3 hypothèses HIÉRARCHISÉES (la + probable d'abord) avec le RAISONNEMENT qui les soutient (en croisant zone + charge + biomécanique + récup ci-dessus). Vocabulaire juste : tendinopathie d'Achille/patellaire, syndrome de l'essuie-glace (bandelette IT), périostite/syndrome de stress tibial médial, fracture de fatigue (à ne pas rater), syndrome fémoro-patellaire, fasciite plantaire, syndrome du piriforme, périostite, lésion myo-aponévrotique (mollet/ischio)… Formule prudemment ("ça évoque fortement…"). JAMAIS de diagnostic médical définitif.
4. DRAPEAUX ROUGES (sécurité d'abord) : douleur ≥7/10, nocturne, point osseux exquis, œdème marqué, douleur à l'appui monopodal/au saut, fourmillements/perte de sensibilité, douleur qui s'aggrave malgré le repos → adresse explicitement à un médecin du sport ± imagerie AVANT de reprendre. Évoque la fracture de fatigue si signes osseux.
5. PLAN DE TRAITEMENT EN 3 PHASES, précis & chiffré (preuves) :
   • Calmer (0-72 h) : protocole PEACE & LOVE, charge relative (pas repos total sauf drapeau rouge), glace si utile.
   • Reconstruire : 2-3 exercices NOMMÉS avec dosage exact (séries × reps OU durée, tempo, charge, fréquence/sem) — privilégie le RENFORCEMENT EXCENTRIQUE/ISOMÉTRIQUE adapté à la structure (ex. excentrique mollet pour Achille, isométrique quadriceps 45 s × 5 pour tendon rotulien, Copenhagen/abducteurs de hanche pour le genou/IT band), + étirements/automassages ciblés.
   • Réathlétiser : protocole de retour à la course progressif (marche/course, +10%/sem max), renforcement préventif maintenu, et si pertinent → travail de CADENCE (vise ~170-180 spm) et de technique, car ${cadence && cadence < 170 ? "ta cadence basse augmente l'impact" : "c'est le meilleur garde-fou"}.
6. AJUSTEMENT DE LA CHARGE : dis concrètement quoi faire des prochaines séances (réduire le volume de X %, couper côtes/fractionné, remplacer par vélo/natation/aqua-jogging pour garder le cardio sans impact), en tenant compte de la rampe et de la récup ci-dessus.
7. CRITÈRES DE REPRISE objectifs ("tu reprends quand tu fais X sans douleur ni le lendemain").
8. Encouragement final + filet de sécurité : consulte en présentiel si pas d'amélioration sous ~7-10 jours.

${imagePart ? `
📷 UNE PHOTO T'EST ENVOYÉE AVEC CE MESSAGE — LIS CE CADRE AVANT DE L'INTERPRÉTER.
Une image invite à affirmer plus que ce qu'elle montre : c'est le risque principal ici, pas l'erreur de lecture.
CE QU'UNE PHOTO PERMET RAISONNABLEMENT : un gonflement ou une asymétrie VISIBLE (compare avec le côté sain si les deux sont dans le cadre), une rougeur, un hématome et son étendue, l'état de la peau (ampoule, échauffement, ongle noir, corne, fissure), l'usure d'une semelle et son schéma (pronation/supination, usure latérale du talon), une déformation évidente, une posture statique grossière.
CE QU'UNE PHOTO NE PERMET PAS, ET QUE TU NE DOIS PAS PRÉTENDRE : palper, tester une amplitude ou une force, localiser un point osseux exquis, distinguer une périostite d'une fracture de fatigue, évaluer la profondeur d'une plaie, juger un tendon sous la peau. Dis-le explicitement plutôt que de contourner.
MÉTHODE : décris D'ABORD ce que tu observes réellement, puis ce que tu ne peux PAS conclure de l'image, et seulement ensuite pose tes questions ou propose des hypothèses. Une photo ne remplace jamais l'anamnèse : ce que la personne raconte reste ta source principale.
⛔ SI L'IMAGE ÉVOQUE UNE URGENCE, tu arrêtes tout le reste — pas d'exercices, pas de plan de charge, orientation médicale IMMÉDIATE et sans ambiguïté : mollet gonflé d'un seul côté avec rougeur, chaleur ou douleur au mollet (une PHLÉBITE est une urgence vitale, elle ne se rééduque pas), plaie ouverte avec pus, traînée rouge ou fièvre (infection), déformation d'un membre ou angulation anormale (fracture/luxation), gonflement massif immédiat après un traumatisme, orteil ou pied blanc/violacé (atteinte vasculaire).
Si la photo est floue, trop sombre, trop éloignée ou ne montre pas la zone décrite, DIS-LE et demande une reprise — n'interprète pas une image que tu ne vois pas correctement.
` : ""}STYLE : experte, humaine, structurée (titres courts / puces), CONCISE (pas de pavé indigeste). N'invente jamais un chiffre médical. Reste dans ton champ (kiné, prépa physique, biomécanique, charge du coureur) — pour le médicamenteux/l'imagerie, renvoie au médecin.`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Bonjour ! Je suis votre kiné du sport. Décrivez-moi ce que vous ressentez (zone, depuis quand, à l'effort ou au repos) et je vous aide." }] },
    // ⚠️ CHAQUE message d'historique est TRONQUÉ, pas seulement leur nombre. Le tour
    // précédent bornait la profondeur mais pas la longueur : un message de 4 000
    // caractères — une description de douleur détaillée, un copier-coller — repart en
    // entier À CHAQUE nouvelle question. Mesuré : jusqu'à 8000 jetons d'historique par
    // tour, soit plus que le contexte complet de l'athlète. Le support le faisait déjà.
    ...(history ?? []).slice(-8).map((m) => ({ role: m.role, parts: [{ text: String(m.text).slice(0, 1500) }] })),
    // La photo accompagne le message de CE tour uniquement. Elle n'est pas conservée :
    // aux tours suivants, c'est la réponse écrite du modèle qui porte le contexte.
    { role: "user", parts: imagePart ? [{ text: message }, imagePart] : [{ text: message }] },
  ];

  // ⚠️ 512 POUR RÉFLÉCHIR, 1600 POUR RÉPONDRE. L'ancien réglage (1600 au total dont
  // 1536 de raisonnement) ne laissait que 62 jetons à la consultation : mesuré en
  // production, la réponse s'arrêtait au milieu d'une question posée à l'athlète.
  const out = await generateContent(contents, { temperature: 0.45, ...budget(512, 1600) });
  if (!out.ok) {
    // Les filtres de sécurité de Gemini refusent régulièrement les images corporelles et
    // renvoient une réponse VIDE. Sans ce cas particulier, l'utilisateur lisait « Le kiné
    // IA est très sollicité » et réessayait indéfiniment une photo qui ne passera jamais.
    if (imagePart && out.status === 502) {
      return NextResponse.json({
        error: "Le modèle a refusé d'analyser cette photo (filtre de sécurité sur les images corporelles). Décris-moi la zone par écrit — c'est de toute façon ce qui compte le plus — ou envoie un cadrage plus serré sur la zone, sans le reste du corps.",
      }, { status: 422 });
    }
    // Même honnêteté que sur le coach : quand le quota du jour est épuisé, « réessayez
    // dans quelques secondes » est faux et fait réessayer pour rien jusqu'à minuit
    // heure du Pacifique.
    if (out.dailyExhausted) {
      return NextResponse.json({ error: "Le quota IA du jour est épuisé — il se réinitialise cette nuit. Réessayez demain 🙏" }, { status: 429 });
    }
    return NextResponse.json({ error: "Le kiné IA est très sollicité — réessayez dans quelques secondes 🙏" }, { status: 503 });
  }
  // ── LA DOULEUR DÉCLARÉE DOIT ATTEINDRE LE COACH ──────────────────────────────
  // Elle ne partait jusqu'ici que dans la conversation avec le kiné IA, où elle
  // disparaissait. Le coach, lui, ne lisait les douleurs que dans le formulaire
  // post-séance : un athlète pouvait donc signaler un genou douloureux sur le schéma
  // corporel et recevoir une séance de VMA le lendemain — alors que la première règle
  // du coach est que la santé prime sur la performance.
  //
  // Une seule déclaration conservée par zone et par jour : le chat envoie la zone à
  // CHAQUE message, ce qui créerait sinon une entrée par phrase échangée.
  if (zone && typeof painLevel === "number" && painLevel >= 4) {
    try {
      const today = aujourdhui(FUSEAU_DEFAUT);
      const { data: existing } = await supabase.from("notifications")
        .select("id, data").eq("user_id", user.id).eq("type", "pain_report")
        .gte("created_at", `${today}T00:00:00Z`).limit(20);
      // Le dédoublonnage suit la CLÉ, pas le libellé : sinon changer de langue en cours
      // de journée rouvrirait une seconde déclaration pour la même zone.
      const cle = zoneKey || zone;
      const already = (existing ?? []).some((n) => {
        const d = n.data as { zone?: string; slot?: string } | null;
        return (d?.slot || d?.zone) === cle;
      });
      if (!already) {
        // ⚠️ L'INTENTION DU `catch` EST JUSTE — le kiné doit répondre même si
        // l'enregistrement échoue — MAIS IL NE VOYAIT RIEN : un client Supabase
        // RETOURNE ses erreurs, il ne les lève pas. Une déclaration de douleur perdue,
        // c'est une donnée de santé que l'athlète a saisie et que le kiné ne retrouvera
        // jamais à la séance suivante, alors que c'est toute l'utilité de sa mémoire.
        const { error } = await supabase.from("notifications").insert({
          user_id: user.id, type: "pain_report",
          title: `Douleur signalée : ${zone}`,
          body: `Intensité ${painLevel}/10 — déclarée depuis l'espace Santé.`,
          data: { zone, slot: zoneKey ?? null, level: painLevel, date: today },
        });
        if (error) console.error("[kiné] douleur déclarée non enregistrée :", error.message);
      }
    } catch { /* best-effort : le kiné répond même si l'enregistrement échoue */ }
  }

  // ⚠️ UNE RÉPONSE COUPÉE NE DOIT PAS PASSER POUR UNE CONCLUSION. On garde le texte —
  // il reste utile — mais on dit qu'il manque la suite, plutôt que de laisser une
  // demi-phrase ressembler à un avis terminé sur une douleur.
  const reply = out.tronquee
    ? `${out.text}\n\n_(Réponse interrompue avant la fin — redemande-moi la suite.)_`
    : out.text;
  return NextResponse.json({ reply });
}
