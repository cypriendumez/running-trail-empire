"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  MODE PERTE DE POIDS — écran.
//
//  Aucun calcul ici : tout vient de /api/weight, calculé serveur. Le composant ne fait
//  qu'AFFICHER, et surtout afficher ce qui manque. Trois états sont traités explicitement
//  plutôt que d'être masqués derrière un écran vide :
//    · migration 018 non exécutée → on le dit, avec le nom du fichier ;
//    · profil non éligible (IMC < 20, mineur, grossesse) → on explique pourquoi ;
//    · pas assez de pesées → « pas encore de tendance », JAMAIS « 0 kg cette semaine ».
//
//  Les hypothèses de calcul (facteur d'activité supposé, équation de population) sont
//  affichées dans l'écran, pas enterrées dans une infobulle : une cible calorique a
//  toutes les apparences d'une mesure alors qu'elle n'en est pas une.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Scale, Flame, Target, Info, AlertTriangle, TrendingDown, Loader2,
  Plus, Dumbbell, ShieldCheck, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageProvider";
import { WEIGHT_EXPLAIN, rationaleKey } from "@/components/health/weightModeI18n";

type Tr = (k: string, p?: Record<string, string | number>) => string;
function fill(s: string, p?: Record<string, string | number>) {
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s;
}

// i18n local — même convention que le reste de l'espace Santé (repli sur le français).
const W: Record<string, Record<string, string>> = {
  fr: {
    title: "Perte de poids", sub: "Alimentation et séances adaptées, calculées sur tes vraies données",
    activate: "Activer le mode", activating: "Activation…",
    intro: "Ce mode calcule ta dépense énergétique réelle à partir de tes séances, en déduit une cible calorique et des repères en protéines, et adapte tes séances à l'impact articulaire. Il ne remplace ni un médecin ni un diététicien.",
    introBullet1: "Cible calculée sur ton métabolisme de base et tes séances réelles des 28 derniers jours",
    introBullet2: "Déficit plafonné : jamais sous ton métabolisme de base, jamais plus de 0,75 %/semaine",
    introBullet3: "Séances adaptées à l'impact : alternance course/marche et volume sans impact si nécessaire",
    disabled: "Mode désactivé", disable: "Désactiver l'objectif de perte", lossTitle: "Objectif de perte de poids", lossOn: "Actif : la cible calorique ci-dessus inclut un déficit, et tes séances sont adaptées à l'impact. Le suivi du poids, lui, reste disponible quoi qu'il arrive.", lossOff: "Inactif : ci-dessus, la cible affichée est ton MAINTIEN — ce qu'il faut manger pour ne pas bouger. Active-le seulement si tu veux réellement perdre du poids.",
    notEligible: "Mode indisponible",
    migration: "Migration à exécuter",
    migrationTxt: "Le fichier supabase/migrations/018_perte_de_poids.sql n'a pas encore été exécuté sur cette base. Le mode ne peut pas enregistrer de pesée tant que c'est le cas.",
    weighIn: "Pesée du jour", weighInPlaceholder: "Poids en kg", save: "Enregistrer",
    weighInHint: "Pèse-toi le matin, à jeun, après être passé aux toilettes — toujours dans les mêmes conditions. C'est la régularité qui rend la courbe lisible, pas la précision de la balance.",
    goal: "Poids cible", goalNone: "Non défini", goalSave: "Définir",
    goalHint: "Facultatif. Sans lui, le mode fonctionne quand même — il n'affiche simplement aucune échéance.",
    bmi: "IMC", target: "Cible", protein: "Protéines", trend: "Tendance",
    perDay: "kcal/jour", perWeek: "kg/semaine", gPerDay: "g/jour",
    noTrend: "Pas encore mesurable",
    tdee: "Dépense estimée", bmr: "Métabolisme de base", sport: "Dont sport (mesuré)", sessionsOver28d: "{n} séance(s) / 28 j", fromProfile: "Poids issu de ton profil : enregistre des pesées pour que le calcul suive ton poids réel.",
    deficit: "Déficit", weeksToGoal: "Échéance estimée", weeks: "semaines",
    basisMeasured: "sur ta perte réellement mesurée", basisTheory: "au rythme théorique si la cible est tenue",
    training: "Ce que ça change à l'entraînement",
    progress: "Progression volume", quality: "Séances de qualité", strength: "Renforcement", lowImpact: "Volume sans impact",
    perWeekShort: "/semaine", none: "aucune",
    logs: "Historique des pesées", logsEmpty: "Aucune pesée enregistrée pour l'instant.",
    logsNeed: "Il faut au moins 4 pesées réparties sur 2 semaines pour calculer une tendance. Actuellement : {n}.",
    assumptions: "Ce qui est calculé, ce qui est supposé",
    caps: "Plafonds de sécurité appliqués",
    disclaimer: "Ces chiffres sont des estimations issues d'équations de population, pas des mesures. En cas de pathologie (diabète, thyroïde, trouble du comportement alimentaire), de traitement en cours ou de perte de poids importante visée, parles-en à un médecin ou à un diététicien avant de commencer.",
    saved: "Pesée enregistrée", deleted: "Pesée supprimée", err: "Erreur",
    delete: "Supprimer",
  },
  en: {
    title: "Weight loss", sub: "Nutrition and sessions adapted, computed from your real data",
    activate: "Enable mode", activating: "Enabling…",
    intro: "This mode computes your real energy expenditure from your sessions, derives a calorie target and protein guidance, and adapts your sessions to joint impact. It replaces neither a doctor nor a dietitian.",
    introBullet1: "Target computed from your basal metabolic rate and your actual sessions over the last 28 days",
    introBullet2: "Capped deficit: never below your basal metabolic rate, never more than 0.75 %/week",
    introBullet3: "Impact-aware sessions: run/walk alternation and low-impact volume when needed",
    disabled: "Mode disabled", disable: "Turn off the loss goal", lossTitle: "Weight-loss goal", lossOn: "Active: the calorie target above includes a deficit, and your sessions are impact-adapted. Weight tracking stays available either way.", lossOff: "Inactive: the target above is your MAINTENANCE — what to eat to stay put. Only turn this on if you really want to lose weight.",
    notEligible: "Mode unavailable",
    migration: "Migration required",
    migrationTxt: "The file supabase/migrations/018_perte_de_poids.sql has not been run on this database yet. No weigh-in can be saved until it is.",
    weighIn: "Today's weigh-in", weighInPlaceholder: "Weight in kg", save: "Save",
    weighInHint: "Weigh yourself in the morning, fasted, after using the bathroom — always under the same conditions. Consistency is what makes the curve readable, not the scale's precision.",
    goal: "Target weight", goalNone: "Not set", goalSave: "Set",
    goalHint: "Optional. Without it the mode still works — it simply shows no timeline.",
    bmi: "BMI", target: "Target", protein: "Protein", trend: "Trend",
    perDay: "kcal/day", perWeek: "kg/week", gPerDay: "g/day",
    noTrend: "Not measurable yet",
    tdee: "Estimated expenditure", bmr: "Basal metabolic rate", sport: "Of which training (measured)", sessionsOver28d: "{n} session(s) / 28 d", fromProfile: "Weight taken from your profile: record weigh-ins so the calculation follows your real weight.",
    deficit: "Deficit", weeksToGoal: "Estimated timeline", weeks: "weeks",
    basisMeasured: "based on your actually measured loss", basisTheory: "at the theoretical rate if the target is met",
    training: "What this changes in training",
    progress: "Volume progression", quality: "Quality sessions", strength: "Strength work", lowImpact: "Low-impact volume",
    perWeekShort: "/week", none: "none",
    logs: "Weigh-in history", logsEmpty: "No weigh-in recorded yet.",
    logsNeed: "At least 4 weigh-ins spread over 2 weeks are needed to compute a trend. Currently: {n}.",
    assumptions: "What is computed, what is assumed",
    caps: "Safety caps applied",
    disclaimer: "These figures are estimates from population equations, not measurements. If you have a medical condition (diabetes, thyroid, eating disorder), are on medication, or are targeting significant weight loss, talk to a doctor or dietitian first.",
    saved: "Weigh-in saved", deleted: "Weigh-in deleted", err: "Error",
    delete: "Delete",
  },
  de: {
    title: "Gewichtsabnahme", sub: "Ernährung und Einheiten, berechnet aus deinen echten Daten",
    activate: "Modus aktivieren", activating: "Wird aktiviert…",
    intro: "Dieser Modus berechnet deinen realen Energieverbrauch aus deinen Einheiten, leitet ein Kalorienziel und Proteinrichtwerte ab und passt die Einheiten an die Gelenkbelastung an. Er ersetzt weder Arzt noch Ernährungsberatung.",
    introBullet1: "Ziel berechnet aus Grundumsatz und deinen tatsächlichen Einheiten der letzten 28 Tage",
    introBullet2: "Begrenztes Defizit: nie unter dem Grundumsatz, nie mehr als 0,75 %/Woche",
    introBullet3: "Belastungsgerechte Einheiten: Lauf-Geh-Wechsel und gelenkschonendes Volumen bei Bedarf",
    disabled: "Modus deaktiviert", disable: "Abnehmziel ausschalten", lossTitle: "Abnehmziel", lossOn: "Aktiv: das Kalorienziel oben enthält ein Defizit, und deine Einheiten sind belastungsgerecht angepasst. Die Gewichtsverfolgung bleibt in jedem Fall verfügbar.", lossOff: "Inaktiv: das Ziel oben ist dein ERHALT — was du isst, um dein Gewicht zu halten. Aktiviere es nur, wenn du wirklich abnehmen willst.",
    notEligible: "Modus nicht verfügbar",
    migration: "Migration erforderlich",
    migrationTxt: "Die Datei supabase/migrations/018_perte_de_poids.sql wurde auf dieser Datenbank noch nicht ausgeführt. Bis dahin kann kein Wiegen gespeichert werden.",
    weighIn: "Wiegen heute", weighInPlaceholder: "Gewicht in kg", save: "Speichern",
    weighInHint: "Wiege dich morgens, nüchtern, nach dem Toilettengang — immer unter gleichen Bedingungen. Die Regelmäßigkeit macht die Kurve lesbar, nicht die Präzision der Waage.",
    goal: "Zielgewicht", goalNone: "Nicht festgelegt", goalSave: "Festlegen",
    goalHint: "Optional. Ohne Zielgewicht funktioniert der Modus trotzdem — er zeigt nur keinen Zeithorizont.",
    bmi: "BMI", target: "Ziel", protein: "Protein", trend: "Trend",
    perDay: "kcal/Tag", perWeek: "kg/Woche", gPerDay: "g/Tag",
    noTrend: "Noch nicht messbar",
    tdee: "Geschätzter Verbrauch", bmr: "Grundumsatz", sport: "Davon Sport (gemessen)", sessionsOver28d: "{n} Einheit(en) / 28 T", fromProfile: "Gewicht aus deinem Profil: erfasse Wiegungen, damit die Berechnung deinem realen Gewicht folgt.",
    deficit: "Defizit", weeksToGoal: "Geschätzter Zeitraum", weeks: "Wochen",
    basisMeasured: "auf Basis deiner real gemessenen Abnahme", basisTheory: "im theoretischen Tempo bei eingehaltenem Ziel",
    training: "Was sich im Training ändert",
    progress: "Umfangssteigerung", quality: "Qualitätseinheiten", strength: "Krafttraining", lowImpact: "Gelenkschonendes Volumen",
    perWeekShort: "/Woche", none: "keine",
    logs: "Wiege-Verlauf", logsEmpty: "Noch kein Wiegen erfasst.",
    logsNeed: "Für einen Trend braucht es mindestens 4 Messungen über 2 Wochen. Aktuell: {n}.",
    assumptions: "Was berechnet, was angenommen wird",
    caps: "Angewandte Sicherheitsgrenzen",
    disclaimer: "Diese Zahlen sind Schätzungen aus Populationsgleichungen, keine Messungen. Bei Erkrankungen (Diabetes, Schilddrüse, Essstörung), laufender Medikation oder angestrebtem starkem Gewichtsverlust sprich vorher mit Arzt oder Ernährungsberatung.",
    saved: "Wiegen gespeichert", deleted: "Wiegen gelöscht", err: "Fehler",
    delete: "Löschen",
  },
  es: {
    title: "Pérdida de peso", sub: "Alimentación y sesiones adaptadas, calculadas con tus datos reales",
    activate: "Activar el modo", activating: "Activando…",
    intro: "Este modo calcula tu gasto energético real a partir de tus sesiones, deduce un objetivo calórico y referencias de proteínas, y adapta tus sesiones al impacto articular. No sustituye ni a un médico ni a un dietista.",
    introBullet1: "Objetivo calculado con tu metabolismo basal y tus sesiones reales de los últimos 28 días",
    introBullet2: "Déficit limitado: nunca por debajo de tu metabolismo basal, nunca más del 0,75 %/semana",
    introBullet3: "Sesiones adaptadas al impacto: alternancia carrera/marcha y volumen sin impacto si hace falta",
    disabled: "Modo desactivado", disable: "Desactivar el objetivo de pérdida", lossTitle: "Objetivo de pérdida de peso", lossOn: "Activo: el objetivo calórico de arriba incluye un déficit, y tus sesiones están adaptadas al impacto. El seguimiento del peso sigue disponible en todo caso.", lossOff: "Inactivo: el objetivo de arriba es tu MANTENIMIENTO — lo que hay que comer para no moverte. Actívalo solo si realmente quieres perder peso.",
    notEligible: "Modo no disponible",
    migration: "Migración pendiente",
    migrationTxt: "El archivo supabase/migrations/018_perte_de_poids.sql aún no se ha ejecutado en esta base. Hasta entonces no se puede guardar ningún pesaje.",
    weighIn: "Pesaje de hoy", weighInPlaceholder: "Peso en kg", save: "Guardar",
    weighInHint: "Pésate por la mañana, en ayunas, después de ir al baño — siempre en las mismas condiciones. Lo que hace legible la curva es la regularidad, no la precisión de la báscula.",
    goal: "Peso objetivo", goalNone: "Sin definir", goalSave: "Definir",
    goalHint: "Opcional. Sin él el modo funciona igual — simplemente no muestra ningún plazo.",
    bmi: "IMC", target: "Objetivo", protein: "Proteínas", trend: "Tendencia",
    perDay: "kcal/día", perWeek: "kg/semana", gPerDay: "g/día",
    noTrend: "Aún no medible",
    tdee: "Gasto estimado", bmr: "Metabolismo basal", sport: "De ello deporte (medido)", sessionsOver28d: "{n} sesión(es) / 28 d", fromProfile: "Peso tomado de tu perfil: registra pesajes para que el cálculo siga tu peso real.",
    deficit: "Déficit", weeksToGoal: "Plazo estimado", weeks: "semanas",
    basisMeasured: "según tu pérdida realmente medida", basisTheory: "al ritmo teórico si se cumple el objetivo",
    training: "Lo que cambia en el entrenamiento",
    progress: "Progresión de volumen", quality: "Sesiones de calidad", strength: "Fuerza", lowImpact: "Volumen sin impacto",
    perWeekShort: "/semana", none: "ninguna",
    logs: "Historial de pesajes", logsEmpty: "Aún no hay ningún pesaje registrado.",
    logsNeed: "Hacen falta al menos 4 pesajes repartidos en 2 semanas para calcular una tendencia. Actualmente: {n}.",
    assumptions: "Lo que se calcula y lo que se supone",
    caps: "Límites de seguridad aplicados",
    disclaimer: "Estas cifras son estimaciones de ecuaciones poblacionales, no mediciones. Si tienes una patología (diabetes, tiroides, trastorno de la conducta alimentaria), sigues un tratamiento o buscas una pérdida importante, consulta antes a un médico o dietista.",
    saved: "Pesaje guardado", deleted: "Pesaje eliminado", err: "Error",
    delete: "Eliminar",
  },
  pt: {
    title: "Perda de peso", sub: "Alimentação e sessões adaptadas, calculadas com os teus dados reais",
    activate: "Ativar o modo", activating: "A ativar…",
    intro: "Este modo calcula o teu gasto energético real a partir das tuas sessões, deduz um objetivo calórico e referências de proteína, e adapta as sessões ao impacto articular. Não substitui médico nem nutricionista.",
    introBullet1: "Objetivo calculado com o teu metabolismo basal e as sessões reais dos últimos 28 dias",
    introBullet2: "Défice limitado: nunca abaixo do metabolismo basal, nunca mais de 0,75 %/semana",
    introBullet3: "Sessões adaptadas ao impacto: alternância corrida/marcha e volume sem impacto se necessário",
    disabled: "Modo desativado", disable: "Desativar o objetivo de perda", lossTitle: "Objetivo de perda de peso", lossOn: "Ativo: o objetivo calórico acima inclui um défice, e as tuas sessões estão adaptadas ao impacto. O acompanhamento do peso mantém-se disponível de qualquer forma.", lossOff: "Inativo: o objetivo acima é a tua MANUTENÇÃO — o que comer para te manteres. Ativa-o apenas se quiseres mesmo perder peso.",
    notEligible: "Modo indisponível",
    migration: "Migração pendente",
    migrationTxt: "O ficheiro supabase/migrations/018_perte_de_poids.sql ainda não foi executado nesta base. Até lá nenhuma pesagem pode ser guardada.",
    weighIn: "Pesagem de hoje", weighInPlaceholder: "Peso em kg", save: "Guardar",
    weighInHint: "Pesa-te de manhã, em jejum, depois de ir à casa de banho — sempre nas mesmas condições. É a regularidade que torna a curva legível, não a precisão da balança.",
    goal: "Peso alvo", goalNone: "Não definido", goalSave: "Definir",
    goalHint: "Opcional. Sem ele o modo funciona na mesma — apenas não mostra prazo.",
    bmi: "IMC", target: "Objetivo", protein: "Proteína", trend: "Tendência",
    perDay: "kcal/dia", perWeek: "kg/semana", gPerDay: "g/dia",
    noTrend: "Ainda não mensurável",
    tdee: "Gasto estimado", bmr: "Metabolismo basal", sport: "Dos quais desporto (medido)", sessionsOver28d: "{n} sessão(ões) / 28 d", fromProfile: "Peso vindo do teu perfil: regista pesagens para que o cálculo siga o teu peso real.",
    deficit: "Défice", weeksToGoal: "Prazo estimado", weeks: "semanas",
    basisMeasured: "com base na perda realmente medida", basisTheory: "ao ritmo teórico se o objetivo for cumprido",
    training: "O que muda no treino",
    progress: "Progressão de volume", quality: "Sessões de qualidade", strength: "Reforço muscular", lowImpact: "Volume sem impacto",
    perWeekShort: "/semana", none: "nenhuma",
    logs: "Histórico de pesagens", logsEmpty: "Ainda não há pesagens registadas.",
    logsNeed: "São precisas pelo menos 4 pesagens distribuídas por 2 semanas para calcular uma tendência. Atualmente: {n}.",
    assumptions: "O que é calculado e o que é suposto",
    caps: "Limites de segurança aplicados",
    disclaimer: "Estes valores são estimativas de equações populacionais, não medições. Em caso de patologia (diabetes, tiroide, perturbação alimentar), medicação em curso ou perda de peso significativa pretendida, fala primeiro com um médico ou nutricionista.",
    saved: "Pesagem guardada", deleted: "Pesagem eliminada", err: "Erro",
    delete: "Eliminar",
  },
};

type Plan = {
  bmi: number; band: string; currentKg: number; currentSource: "pesees" | "profil";
  goalKg: number | null; toLoseKg: number | null;
  bmr: number; tdee: number; training: { kcalPerDay: number; counted: number; skipped: number };
  targetKcal: number; deficitKcal: number; plannedRatePerWeek: number;
  measured: { smoothedKg: number; ratePerWeek: number; spanDays: number; points: number } | null;
  proteinG: number; weeksToGoal: number | null; weeksToGoalBasis: "mesure" | "theorique" | null;
  caps: string[]; assumptions: string[];
  capCodes: { code: string; params?: Record<string, string | number> }[];
  assumptionCodes: { code: string; params?: Record<string, string | number> }[];
};
type Rules = {
  maxWeeklyProgressPct: number; walkRunAdvised: boolean; lowImpactSharePct: number;
  strengthPerWeek: number; maxQualityPerWeek: number; rationale: string;
};
type ApiState = {
  migrated: boolean; enabled: boolean; goalKg: number | null; bmi?: number | null;
  eligibility: { ok: true } | { ok: false; reason: string; detail: string; params?: Record<string, string | number> };
  plan: Plan | null; applyDeficit?: boolean;
  verdict?: { status: string; message: string; params?: Record<string, string | number> }; rules?: Rules | null;
  logs: { date: string; weight_kg: number; note?: string | null }[];
};

// Libellé de la classe d'IMC. Traduit ici plutôt que renvoyé par l'API : c'est la seule
// chaîne générée qui s'affiche en gros sur la carte, juste sous le chiffre.
const BAND_LABEL: Record<string, Record<string, string>> = {
  insuffisant: { fr: "Insuffisant", en: "Underweight", de: "Untergewicht", es: "Bajo peso", pt: "Baixo peso" },
  normal: { fr: "Normal", en: "Normal", de: "Normal", es: "Normal", pt: "Normal" },
  surpoids: { fr: "Surpoids", en: "Overweight", de: "Übergewicht", es: "Sobrepeso", pt: "Excesso de peso" },
  obesite_1: { fr: "Obésité I", en: "Obesity I", de: "Adipositas I", es: "Obesidad I", pt: "Obesidade I" },
  obesite_2: { fr: "Obésité II", en: "Obesity II", de: "Adipositas II", es: "Obesidad II", pt: "Obesidade II" },
  obesite_3: { fr: "Obésité III", en: "Obesity III", de: "Adipositas III", es: "Obesidad III", pt: "Obesidade III" },
};

export function WeightMode() {
  const { lang } = useT();
  // Les clés d'habillage viennent de W, les phrases CALCULÉES de WEIGHT_EXPLAIN.
  const tr: Tr = (k, p) => fill(W[lang]?.[k] ?? WEIGHT_EXPLAIN[lang]?.[k] ?? W.fr[k] ?? WEIGHT_EXPLAIN.fr[k] ?? k, p);

  // Les décimales suivent la langue affichée : « 34,1 » en français, « 34.1 » en anglais.
  // Sans ça, un écran entièrement traduit laissait passer des nombres à l'anglaise.
  const dec = (n: number, d = 1) => n.toLocaleString(lang, { minimumFractionDigits: 0, maximumFractionDigits: d });

  const [state, setState] = useState<ApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [weighIn, setWeighIn] = useState("");
  const [goalInput, setGoalInput] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/weight");
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? tr("err")); return; }
      setState(json as ApiState);
      setGoalInput(json.goalKg != null ? String(json.goalKg) : "");
    } catch { toast.error(tr("err")); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>, okMsg?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/weight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? tr("err")); return false; }
      if (okMsg) toast.success(okMsg);
      await load();
      return true;
    } catch { toast.error(tr("err")); return false; }
    finally { setBusy(false); }
  };

  if (loading) {
    return <div className="bento-card flex items-center justify-center py-16 text-zinc-400"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  if (!state) return null;

  const { plan, rules, verdict } = state;
  // La perte est-elle réellement en cours ? Le suivi (pesée, dépense, protéines) ne dépend
  // PAS de ce drapeau — c'est tout l'objet de la séparation.
  const deficitOn = state.applyDeficit === true;

  // Les nombres sont mis en forme ICI, dans la locale affichée, avant d'entrer dans les
  // phrases traduites : sinon chaque traduction devrait connaître la convention décimale
  // de sa langue, et « −0,4 » ressortirait en « -0.4 » au milieu d'un texte français.
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${dec(Math.abs(n))}`;
  const verdictParams = (p?: Record<string, string | number>) => p && ({
    ...p,
    actual: signed(Number(p.actual ?? 0)),
    planned: signed(Number(p.planned ?? 0)),
    tdee: Number(p.tdee ?? 0).toLocaleString(lang),
  });
  const elParams = state.eligibility.ok ? undefined : (() => {
    const p = state.eligibility.params;
    return p ? { ...p, bmi: dec(Number(p.bmi ?? 0)) } : undefined;
  })();

  return (
    <motion.div key="poids" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }} className="space-y-4">

      {/* Migration non exécutée — dit explicitement, jamais un écran vide. */}
      {!state.migrated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-4 w-4" /> {tr("migration")}</div>
          <p className="mt-1.5 text-sm text-amber-800">{tr("migrationTxt")}</p>
        </div>
      )}

      {/* Profil non éligible : IMC < 20, mineur, grossesse, données manquantes. */}
      {!state.eligibility.ok && (
        <div className="bento-card">
          <div className="flex items-center gap-2 font-semibold text-zinc-900"><ShieldCheck className="h-4 w-4 text-emerald-600" /> {tr("notEligible")}</div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">{tr(`e.${state.eligibility.reason}`, elParams)}</p>
        </div>
      )}

      {plan && (
        <>
          {/* ── Chiffres clés ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<Scale className="h-5 w-5 text-zinc-500" />} label={tr("bmi")} value={dec(plan.bmi)} hint={BAND_LABEL[plan.band]?.[lang] ?? BAND_LABEL[plan.band]?.fr ?? ""} />
            <StatCard icon={<Flame className="h-5 w-5 text-orange-500" />} label={tr("target")} value={plan.targetKcal.toLocaleString(lang)} hint={tr("perDay")} accent="orange" />
            <StatCard icon={<Dumbbell className="h-5 w-5 text-violet-500" />} label={tr("protein")} value={String(plan.proteinG)} hint={tr("gPerDay")} accent="violet" />
            <StatCard icon={<TrendingDown className="h-5 w-5 text-emerald-500" />} label={tr("trend")}
              value={plan.measured ? `${plan.measured.ratePerWeek > 0 ? "+" : plan.measured.ratePerWeek < 0 ? "−" : ""}${dec(Math.abs(plan.measured.ratePerWeek))}` : "—"}
              hint={plan.measured ? tr("perWeek") : tr("noTrend")} accent="emerald" />
          </div>

          {/* ── Verdict : le mesuré face au prévu ── */}
          {verdict && (
            <div className={`rounded-2xl border p-4 ${verdict.status === "conforme" ? "border-emerald-200 bg-emerald-50" : verdict.status === "insuffisant" ? "border-zinc-200 bg-zinc-50" : "border-amber-200 bg-amber-50"}`}>
              <p className="text-sm leading-relaxed text-zinc-700">{tr(`v.${verdict.status}`, verdictParams(verdict.params))}</p>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {/* ── Pesée + objectif ── */}
            <div className="bento-card">
              <h3 className="mb-3 font-semibold text-zinc-900">{tr("weighIn")}</h3>
              <div className="flex gap-2">
                <input type="number" step="0.1" min="30" max="299" value={weighIn} onChange={(e) => setWeighIn(e.target.value)}
                  placeholder={tr("weighInPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400" />
                <button onClick={async () => { if (await post({ weightKg: Number(weighIn) }, tr("saved"))) setWeighIn(""); }}
                  disabled={busy || !weighIn}
                  className="flex-shrink-0 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-40">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tr("weighInHint")}</p>

              {deficitOn && <div className="mt-5 border-t border-zinc-100 pt-4">
                <h4 className="mb-2 text-sm font-semibold text-zinc-900">{tr("goal")}</h4>
                <div className="flex gap-2">
                  <input type="number" step="0.5" min="30" max="299" value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
                    placeholder={tr("goalNone")}
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-400" />
                  <button onClick={() => post({ goalKg: goalInput === "" ? null : Number(goalInput) })} disabled={busy}
                    className="flex-shrink-0 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40">
                    {tr("goalSave")}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{tr("goalHint")}</p>
                {plan.weeksToGoal != null && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-zinc-700">
                    <Target className="h-4 w-4 text-emerald-600" />
                    <span><strong>{plan.weeksToGoal}</strong> {tr("weeks")} — <span className="text-zinc-500">{plan.weeksToGoalBasis === "mesure" ? tr("basisMeasured") : tr("basisTheory")}</span></span>
                  </p>
                )}
              </div>}
            </div>

            {/* ── Décomposition énergétique ── */}
            <div className="bento-card">
              <h3 className="mb-3 font-semibold text-zinc-900">{tr("tdee")}</h3>
              <div className="space-y-2.5 text-sm">
                <Row label={tr("bmr")} value={`${plan.bmr.toLocaleString(lang)} kcal`} />
                <Row label={tr("sport")} value={`${plan.training.kcalPerDay.toLocaleString(lang)} kcal`} sub={tr("sessionsOver28d", { n: plan.training.counted })} />
                <Row label={tr("tdee")} value={`${plan.tdee.toLocaleString(lang)} kcal`} strong />
                {deficitOn && plan.deficitKcal > 0 && <Row label={tr("deficit")} value={`−${plan.deficitKcal.toLocaleString(lang)} kcal`} />}
                <Row label={tr("target")} value={`${plan.targetKcal.toLocaleString(lang)} kcal`} strong accent />
              </div>
              {plan.caps.length > 0 && (
                <div className="mt-4 rounded-xl bg-emerald-50 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> {tr("caps")}</div>
                  <ul className="space-y-1 text-xs leading-relaxed text-emerald-900">
                    {plan.capCodes.map((c, i) => <li key={i}>· {tr(`c.${c.code}`, c.params && { ...c.params, bmi: c.params.bmi != null ? dec(Number(c.params.bmi)) : "" })}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* ── Ce que ça change à l'entraînement ── */}
          {deficitOn && rules && (
            <div className="bento-card">
              <h3 className="mb-3 font-semibold text-zinc-900">{tr("training")}</h3>
              <p className="text-sm leading-relaxed text-zinc-600">{tr(rationaleKey(plan.band))}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MiniStat label={tr("progress")} value={`+${rules.maxWeeklyProgressPct} %`} />
                <MiniStat label={tr("quality")} value={rules.maxQualityPerWeek === 0 ? tr("none") : `${rules.maxQualityPerWeek}${tr("perWeekShort")}`} />
                <MiniStat label={tr("strength")} value={`${rules.strengthPerWeek}${tr("perWeekShort")}`} />
                <MiniStat label={tr("lowImpact")} value={`${rules.lowImpactSharePct} %`} />
              </div>
            </div>
          )}

          {/* ── Historique ── */}
          <div className="bento-card">
            <h3 className="mb-3 font-semibold text-zinc-900">{tr("logs")}</h3>
            {state.logs.length === 0 ? (
              <p className="text-sm text-zinc-500">{tr("logsEmpty")}</p>
            ) : (
              <>
                {!plan.measured && <p className="mb-3 text-sm text-zinc-500">{tr("logsNeed", { n: state.logs.length })}</p>}
                <ul className="divide-y divide-zinc-100">
                  {state.logs.slice(0, 12).map((l) => (
                    <li key={l.date} className="group flex items-center justify-between py-2 text-sm">
                      <span className="text-zinc-500">{new Date(l.date + "T00:00:00").toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold tabular-nums text-zinc-900">{dec(Number(l.weight_kg), 2)} kg</span>
                        <button title={tr("delete")} aria-label={tr("delete")} disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await fetch(`/api/weight?date=${l.date}`, { method: "DELETE" });
                              const j = await res.json();
                              if (!res.ok) toast.error(j.error ?? tr("err")); else { toast.success(tr("deleted")); await load(); }
                            } finally { setBusy(false); }
                          }}
                          className="text-zinc-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* ── Ce qui est supposé : affiché, pas caché ── */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"><Info className="h-3.5 w-3.5" /> {tr("assumptions")}</div>
            <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-600">
              {plan.assumptionCodes.map((a, i) => <li key={i}>· {tr(`a.${a.code}`, a.params && { ...a.params, factor: dec(Number(a.params.factor ?? 0)) })}</li>)}
              {plan.currentSource === "profil" && <li>· {tr("fromProfile")}</li>}
            </ul>
          </div>

          <p className="px-1 text-xs leading-relaxed text-zinc-400">{tr("disclaimer")}</p>

          {/* ── Objectif de perte : réglage SÉPARÉ du suivi ci-dessus ── */}
          {state.eligibility.ok ? (
            <div className="bento-card">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Scale className="h-[18px] w-[18px]" /></span>
                <h3 className="font-semibold text-zinc-900">{tr("lossTitle")}</h3>
              </div>
              {deficitOn ? (
                <>
                  <p className="text-sm leading-relaxed text-zinc-600">{tr("lossOn")}</p>
                  <button onClick={() => post({ enabled: false })} disabled={busy}
                    className="mt-4 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                    {tr("disable")}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-zinc-600">{tr("lossOff")}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-zinc-600">
                    {["introBullet1", "introBullet2", "introBullet3"].map((k) => (
                      <li key={k} className="flex gap-2"><span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-500" />{tr(k)}</li>
                    ))}
                  </ul>
                  <button onClick={() => post({ enabled: true })} disabled={busy}
                    className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
                    {busy ? tr("activating") : tr("activate")}
                  </button>
                </>
              )}
            </div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}

function StatCard({ icon, label, value, hint, accent }: { icon: React.ReactNode; label: string; value: string; hint: string; accent?: "orange" | "violet" | "emerald" }) {
  const tone = accent === "orange" ? "text-orange-600" : accent === "violet" ? "text-violet-600" : accent === "emerald" ? "text-emerald-600" : "text-zinc-900";
  return (
    <div className="bento-card !p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">{label}</span>{icon}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}

function Row({ label, value, sub, strong, accent }: { label: string; value: string; sub?: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={`${strong ? "font-semibold text-zinc-900" : "text-zinc-600"}`}>
        {label}{sub && <span className="ml-1.5 text-xs text-zinc-400">{sub}</span>}
      </span>
      <span className={`tabular-nums ${accent ? "font-bold text-emerald-600" : strong ? "font-semibold text-zinc-900" : "text-zinc-700"}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 text-base font-bold text-zinc-900">{value}</div>
    </div>
  );
}
