// ─────────────────────────────────────────────────────────────────────────────
//  MOTIFS DE FRAÎCHEUR — les 5 langues.
//
//  Ces motifs ne restent pas dans un tableau de bord : le plan les RECOPIE dans le
//  « pourquoi » des séances (« Aujourd'hui ton corps demande de la récupération :
//  VFC sous sa base, sommeil dégradé (58/100) »). Les laisser en français, c'était
//  livrer un « pourquoi » allemand qui bascule en français au milieu de la phrase.
//
//  ⚠️ La version française reste canonique : elle part dans le prompt du modèle et
//  dans le bandeau « pourquoi ce plan ». Les autres langues ne servent qu'à l'affichage.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesMotifs = {
  douleur: (zones: string) => string;
  /** « , dont 34 % venant d'un autre sport (3 × vélo…) » — d'où vient VRAIMENT la charge. */
  origineCross: (pct: number, label: string) => string;
  ratioRisque: (acr: string, origine: string) => string;
  tsbProfond: (tsb: string, origine: string) => string;
  vfcEtNuit: string;
  vfcBasse: string;
  sommeilDegrade: (score: string) => string;
  /** Dette CUMULÉE : la nuit dernière peut être correcte et l'athlète en manque quand même. */
  detteSommeil: (manque: string, nuits: string) => string;
  /** Chute d'UN matin sous sa propre base — invisible pour une moyenne de 7 jours. */
  vfcChute: (chute: string, valeur: string, base: string) => string;
  chargeAigue: (acr: string) => string;
  monotonie: (m: string) => string;
  rpeDerniere: (rpe: string) => string;
  rpeDuree: (moyen: string) => string;
  /** Fragments du constat « charge vue mais qualité maintenue ». */
  partRatio: (acr: string) => string;
  partTsb: (tsb: string) => string;
  chargeVueMaisMaintenue: (parts: string) => string;
  /** Récupération après une course courue (`lib/coach/apresCourse`). La date est déjà
   *  mise en forme dans la langue ; le nom de la course est un nom propre, il ne se
   *  traduit pas. */
  apresCourse: (course: string, jours: string, reprise: string, volumePct: string) => string;
  /** La reprise qui suit : une séance courte au seuil par semaine jusqu'à `fin`, premier
   *  jour d'entraînement normal (date déjà mise en forme). */
  repriseApresCourse: (course: string, jours: string, fin: string, volumePct: string) => string;
  /** Reprise après un arrêt de 6 à 28 jours (`lib/coach/repriseArret`). `enCours` : aucune
   *  sortie depuis — la montre peut aussi avoir cessé de synchroniser, on le dit. */
  repriseArret: (jours: string, volumePct: string, enCours: boolean) => string;
  /** Programme marche-course en cours (`lib/coach/marcheCourse`). */
  marcheCourse: (etape: string, total: string) => string;
};

export const MOTIF_T: Record<Lang, TextesMotifs> = {
  fr: {
    douleur: (z) => `douleur en cours (${z})`,
    origineCross: (p, l) => `, dont ${p} % venant d'un autre sport (${l})`,
    ratioRisque: (a, o) => `ratio aigu:chronique ${a} (zone de risque de blessure)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (fatigue profonde)${o}`,
    vfcEtNuit: "VFC en baisse ET nuit dégradée (double signal)",
    vfcBasse: "VFC sous sa base",
    sommeilDegrade: (s) => `sommeil dégradé (${s}/100)`,
    detteSommeil: (m, n) => `dette de sommeil : ${m} de retard sur ${n} nuits`,
    vfcChute: (c, v, b) => `VFC en chute nette (${c} sous ta base : ${v} contre ${b} ms)`,
    chargeAigue: (a) => `charge aiguë élevée (${a})`,
    monotonie: (m) => `monotonie ${m} (charge trop uniforme)`,
    rpeDerniere: (r) => `dernière séance vécue très dure (RPE ${r}/10)`,
    rpeDuree: (m) => `ressenti élevé sur la durée (RPE moyen ${m}/10 sur ses 3 derniers retours)`,
    partRatio: (a) => `ratio aigu:chronique ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `charge récente élevée (${p}) MAIS VFC nettement au-dessus de sa base, sommeil correct et aucune douleur : la qualité est maintenue. À surveiller si la VFC redescend.`,
    apresCourse: (c, j, r, v) => `récupération après ${c} (J+${j}) : pas d'intensité avant le ${r}, footings seulement d'ici là, et ${v} % de ton volume habituel cette semaine — un jour facile par tranche de 3 km courus`,
    repriseApresCourse: (c, j, f, v) => `reprise après ${c} (J+${j}) : une seule séance de qualité par semaine, courte et au seuil, et ${v} % de ton volume habituel cette semaine ; entraînement normal à partir du ${f} — ni VMA ni course avant un jour par mile couru`,
    repriseArret: (j, v, enCours) => enCours
      ? `aucune course enregistrée depuis ${j} jours : on repart à ${v} % de ton volume habituel cette semaine (règle de Daniels). Si tu as couru, ta montre ne synchronise plus : vérifie sa connexion`
      : `reprise après ${j} jours sans courir : ${v} % de ton volume habituel cette semaine — la reprise dure autant que l'arrêt (règle de Daniels)`,
    marcheCourse: (e, t) => `programme marche-course, étape ${e}/${t} : ni séance de qualité ni test VMA tant que tu ne cours pas 30 minutes d'affilée — la course s'allonge à chaque étape`,
  },
  en: {
    douleur: (z) => `ongoing pain (${z})`,
    origineCross: (p, l) => `, ${p} % of it coming from another sport (${l})`,
    ratioRisque: (a, o) => `acute:chronic ratio ${a} (injury risk zone)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (deep fatigue)${o}`,
    vfcEtNuit: "HRV falling AND a poor night (double signal)",
    vfcBasse: "HRV below its baseline",
    sommeilDegrade: (s) => `degraded sleep (${s}/100)`,
    detteSommeil: (m, n) => `sleep debt: ${m} short over ${n} nights`,
    vfcChute: (c, v, b) => `sharp HRV drop (${c} below your baseline: ${v} vs ${b} ms)`,
    chargeAigue: (a) => `high acute load (${a})`,
    monotonie: (m) => `monotony ${m} (load too uniform)`,
    rpeDerniere: (r) => `last session felt very hard (RPE ${r}/10)`,
    rpeDuree: (m) => `high perceived effort over time (average RPE ${m}/10 across your last 3 reports)`,
    partRatio: (a) => `acute:chronic ratio ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `high recent load (${p}) BUT HRV clearly above baseline, decent sleep and no pain: the quality session stays. To watch if HRV comes back down.`,
    apresCourse: (c, j, r, v) => `recovering from ${c} (day ${j} after): no hard sessions before ${r}, easy runs only until then, and ${v}% of your usual volume this week — one easy day per 3 km raced`,
    repriseApresCourse: (c, j, f, v) => `easing back after ${c} (day ${j} after): one short threshold session a week at most, and ${v}% of your usual volume this week; normal training from ${f} — no VO2max work or racing before one day per mile raced`,
    repriseArret: (j, v, enCours) => enCours
      ? `no run recorded for ${j} days: we restart at ${v}% of your usual volume this week (Daniels' rule). If you did run, your watch is no longer syncing: check its connection`
      : `back after ${j} days without running: ${v}% of your usual volume this week — the comeback lasts as long as the break (Daniels' rule)`,
    marcheCourse: (e, t) => `walk/run programme, stage ${e}/${t}: no hard sessions and no VO2max test until you can run 30 minutes non-stop — the running gets longer at every stage`,
  },
  de: {
    douleur: (z) => `bestehende Schmerzen (${z})`,
    origineCross: (p, l) => `, davon ${p} % aus einer anderen Sportart (${l})`,
    ratioRisque: (a, o) => `Akut-Chronisch-Verhältnis ${a} (Verletzungsrisiko-Bereich)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (tiefe Ermüdung)${o}`,
    vfcEtNuit: "HRV fallend UND schlechte Nacht (Doppelsignal)",
    vfcBasse: "HRV unter ihrem Ausgangswert",
    sommeilDegrade: (s) => `verschlechterter Schlaf (${s}/100)`,
    detteSommeil: (m, n) => `Schlafdefizit: ${m} Rückstand über ${n} Nächte`,
    vfcChute: (c, v, b) => `deutlicher HRV-Einbruch (${c} unter deinem Ausgangswert: ${v} statt ${b} ms)`,
    chargeAigue: (a) => `hohe akute Belastung (${a})`,
    monotonie: (m) => `Monotonie ${m} (Belastung zu gleichförmig)`,
    rpeDerniere: (r) => `letzte Einheit sehr hart empfunden (RPE ${r}/10)`,
    rpeDuree: (m) => `dauerhaft hohes Anstrengungsempfinden (RPE-Mittel ${m}/10 über deine letzten 3 Rückmeldungen)`,
    partRatio: (a) => `Akut-Chronisch-Verhältnis ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `hohe jüngste Belastung (${p}), ABER HRV deutlich über dem Ausgangswert, ordentlicher Schlaf und keine Schmerzen: die Qualitätseinheit bleibt. Im Auge behalten, falls die HRV wieder fällt.`,
    apresCourse: (c, j, r, v) => `Erholung nach ${c} (Tag ${j} danach): keine intensiven Einheiten vor dem ${r}, bis dahin nur lockere Läufe, und ${v} % deines üblichen Umfangs diese Woche — ein lockerer Tag pro 3 gelaufene Kilometer`,
    repriseApresCourse: (c, j, f, v) => `Wiedereinstieg nach ${c} (Tag ${j} danach): höchstens eine kurze Schwelleneinheit pro Woche und ${v} % deines üblichen Umfangs diese Woche; normales Training ab dem ${f} — kein VO2max-Training und kein Wettkampf vor einem Tag pro gelaufener Meile`,
    repriseArret: (j, v, enCours) => enCours
      ? `seit ${j} Tagen kein Lauf aufgezeichnet: Diese Woche starten wir mit ${v} % deines üblichen Umfangs neu (Daniels-Regel). Falls du gelaufen bist, synchronisiert deine Uhr nicht mehr: Prüfe ihre Verbindung`
      : `Wiedereinstieg nach ${j} Tagen ohne Laufen: ${v} % deines üblichen Umfangs diese Woche — der Wiedereinstieg dauert so lange wie die Pause (Daniels-Regel)`,
    marcheCourse: (e, t) => `Geh-Lauf-Programm, Stufe ${e}/${t}: keine intensiven Einheiten und kein VMA-Test, bis du 30 Minuten am Stück laufen kannst — das Laufen wird mit jeder Stufe länger`,
  },
  es: {
    douleur: (z) => `dolor en curso (${z})`,
    origineCross: (p, l) => `, de los cuales un ${p} % viene de otro deporte (${l})`,
    ratioRisque: (a, o) => `ratio agudo:crónico ${a} (zona de riesgo de lesión)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (fatiga profunda)${o}`,
    vfcEtNuit: "VFC a la baja Y noche degradada (doble señal)",
    vfcBasse: "VFC por debajo de su base",
    sommeilDegrade: (s) => `sueño degradado (${s}/100)`,
    detteSommeil: (m, n) => `deuda de sueño: ${m} de retraso en ${n} noches`,
    vfcChute: (c, v, b) => `caída marcada de la VFC (${c} por debajo de tu base: ${v} frente a ${b} ms)`,
    chargeAigue: (a) => `carga aguda elevada (${a})`,
    monotonie: (m) => `monotonía ${m} (carga demasiado uniforme)`,
    rpeDerniere: (r) => `última sesión vivida como muy dura (RPE ${r}/10)`,
    rpeDuree: (m) => `esfuerzo percibido alto de forma sostenida (RPE medio ${m}/10 en tus 3 últimos registros)`,
    partRatio: (a) => `ratio agudo:crónico ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `carga reciente elevada (${p}) PERO VFC claramente por encima de su base, sueño correcto y sin dolor: la sesión de calidad se mantiene. A vigilar si la VFC vuelve a bajar.`,
    apresCourse: (c, j, r, v) => `recuperación tras ${c} (día ${j} después): sin intensidad antes del ${r}, solo rodajes suaves hasta entonces, y un ${v} % de tu volumen habitual esta semana — un día suave por cada 3 km corridos`,
    repriseApresCourse: (c, j, f, v) => `vuelta tras ${c} (día ${j} después): como máximo una sesión corta de umbral por semana y un ${v} % de tu volumen habitual esta semana; entrenamiento normal a partir del ${f} — ni VMA ni carreras antes de un día por cada milla corrida`,
    repriseArret: (j, v, enCours) => enCours
      ? `ninguna carrera registrada desde hace ${j} días: esta semana retomamos al ${v} % de tu volumen habitual (regla de Daniels). Si has corrido, tu reloj ya no sincroniza: revisa su conexión`
      : `vuelta tras ${j} días sin correr: un ${v} % de tu volumen habitual esta semana; la vuelta dura tanto como la pausa (regla de Daniels)`,
    marcheCourse: (e, t) => `programa de caminar y correr, etapa ${e}/${t}: ni sesiones de calidad ni test de VMA hasta que corras 30 minutos seguidos; la carrera se alarga en cada etapa`,
  },
  pt: {
    douleur: (z) => `dor em curso (${z})`,
    origineCross: (p, l) => `, dos quais ${p} % vêm de outro desporto (${l})`,
    ratioRisque: (a, o) => `rácio agudo:crónico ${a} (zona de risco de lesão)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (fadiga profunda)${o}`,
    vfcEtNuit: "VFC em queda E noite degradada (sinal duplo)",
    vfcBasse: "VFC abaixo da sua base",
    sommeilDegrade: (s) => `sono degradado (${s}/100)`,
    detteSommeil: (m, n) => `dívida de sono: ${m} de atraso em ${n} noites`,
    vfcChute: (c, v, b) => `queda acentuada da VFC (${c} abaixo da sua base: ${v} contra ${b} ms)`,
    chargeAigue: (a) => `carga aguda elevada (${a})`,
    monotonie: (m) => `monotonia ${m} (carga demasiado uniforme)`,
    rpeDerniere: (r) => `última sessão sentida como muito dura (RPE ${r}/10)`,
    rpeDuree: (m) => `esforço percebido alto ao longo do tempo (RPE médio ${m}/10 nos teus 3 últimos registos)`,
    partRatio: (a) => `rácio agudo:crónico ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `carga recente elevada (${p}) MAS VFC claramente acima da sua base, sono correto e sem dores: a sessão de qualidade mantém-se. A vigiar se a VFC voltar a descer.`,
    apresCourse: (c, j, r, v) => `recuperação após ${c} (dia ${j} depois): sem intensidade antes de ${r}, só corridas fáceis até lá, e ${v} % do teu volume habitual esta semana — um dia fácil por cada 3 km corridos`,
    repriseApresCourse: (c, j, f, v) => `retoma após ${c} (dia ${j} depois): no máximo uma sessão curta de limiar por semana e ${v} % do teu volume habitual esta semana; treino normal a partir de ${f} — nem VMA nem provas antes de um dia por cada milha corrida`,
    repriseArret: (j, v, enCours) => enCours
      ? `nenhuma corrida registada há ${j} dias: esta semana retomamos a ${v} % do teu volume habitual (regra de Daniels). Se correste, o teu relógio deixou de sincronizar: verifica a ligação`
      : `retoma após ${j} dias sem correr: ${v} % do teu volume habitual esta semana; a retoma dura tanto quanto a pausa (regra de Daniels)`,
    marcheCourse: (e, t) => `programa de caminhada e corrida, etapa ${e}/${t}: nem sessões de qualidade nem teste de VMA até conseguires correr 30 minutos seguidos; a corrida aumenta a cada etapa`,
  },
};
