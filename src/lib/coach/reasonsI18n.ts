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
    vfcChute: (c, v, b) => `VFC en chute nette ce matin (${c} sous ta base : ${v} contre ${b} ms)`,
    chargeAigue: (a) => `charge aiguë élevée (${a})`,
    monotonie: (m) => `monotonie ${m} (charge trop uniforme)`,
    rpeDerniere: (r) => `dernière séance vécue très dure (RPE ${r}/10)`,
    rpeDuree: (m) => `ressenti élevé sur la durée (RPE moyen ${m}/10 sur ses 3 derniers retours)`,
    partRatio: (a) => `ratio aigu:chronique ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `charge récente élevée (${p}) MAIS VFC nettement au-dessus de sa base, sommeil correct et aucune douleur : la qualité est maintenue. À surveiller si la VFC redescend.`,
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
    vfcChute: (c, v, b) => `sharp HRV drop this morning (${c} below your baseline: ${v} vs ${b} ms)`,
    chargeAigue: (a) => `high acute load (${a})`,
    monotonie: (m) => `monotony ${m} (load too uniform)`,
    rpeDerniere: (r) => `last session felt very hard (RPE ${r}/10)`,
    rpeDuree: (m) => `high perceived effort over time (average RPE ${m}/10 across your last 3 reports)`,
    partRatio: (a) => `acute:chronic ratio ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `high recent load (${p}) BUT HRV clearly above baseline, decent sleep and no pain: the quality session stays. To watch if HRV comes back down.`,
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
    vfcChute: (c, v, b) => `deutlicher HRV-Einbruch heute Morgen (${c} unter deinem Ausgangswert: ${v} statt ${b} ms)`,
    chargeAigue: (a) => `hohe akute Belastung (${a})`,
    monotonie: (m) => `Monotonie ${m} (Belastung zu gleichförmig)`,
    rpeDerniere: (r) => `letzte Einheit sehr hart empfunden (RPE ${r}/10)`,
    rpeDuree: (m) => `dauerhaft hohes Anstrengungsempfinden (RPE-Mittel ${m}/10 über deine letzten 3 Rückmeldungen)`,
    partRatio: (a) => `Akut-Chronisch-Verhältnis ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `hohe jüngste Belastung (${p}), ABER HRV deutlich über dem Ausgangswert, ordentlicher Schlaf und keine Schmerzen: die Qualitätseinheit bleibt. Im Auge behalten, falls die HRV wieder fällt.`,
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
    vfcChute: (c, v, b) => `caída marcada de la VFC esta mañana (${c} por debajo de tu base: ${v} frente a ${b} ms)`,
    chargeAigue: (a) => `carga aguda elevada (${a})`,
    monotonie: (m) => `monotonía ${m} (carga demasiado uniforme)`,
    rpeDerniere: (r) => `última sesión vivida como muy dura (RPE ${r}/10)`,
    rpeDuree: (m) => `esfuerzo percibido alto de forma sostenida (RPE medio ${m}/10 en tus 3 últimos registros)`,
    partRatio: (a) => `ratio agudo:crónico ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `carga reciente elevada (${p}) PERO VFC claramente por encima de su base, sueño correcto y sin dolor: la sesión de calidad se mantiene. A vigilar si la VFC vuelve a bajar.`,
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
    vfcChute: (c, v, b) => `queda acentuada da VFC esta manhã (${c} abaixo da sua base: ${v} contra ${b} ms)`,
    chargeAigue: (a) => `carga aguda elevada (${a})`,
    monotonie: (m) => `monotonia ${m} (carga demasiado uniforme)`,
    rpeDerniere: (r) => `última sessão sentida como muito dura (RPE ${r}/10)`,
    rpeDuree: (m) => `esforço percebido alto ao longo do tempo (RPE médio ${m}/10 nos teus 3 últimos registos)`,
    partRatio: (a) => `rácio agudo:crónico ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `carga recente elevada (${p}) MAS VFC claramente acima da sua base, sono correto e sem dores: a sessão de qualidade mantém-se. A vigiar se a VFC voltar a descer.`,
  },
};
