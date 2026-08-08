// ─────────────────────────────────────────────────────────────────────────────
//  DIAGNOSTIC DU COMPTE — ce qui sépare un vrai support d'une FAQ.
//
//  Une FAQ répond « vérifie tes identifiants intervals.icu » à tout le monde. Un support
//  utile REGARDE le compte et répond « ta montre n'est pas connectée » ou « elle l'est,
//  ta dernière activité date d'hier — le problème est ailleurs ».
//
//  Module PUR, donc testable, et volontairement factuel : chaque constat est vérifiable
//  par l'utilisateur sur son écran. Aucune supposition, aucun conseil ici — l'assistant
//  se charge de la formulation, ce fichier ne fournit que des faits.
//
//  ⚠️ AUCUN SECRET N'ENTRE ICI. On ne reçoit qu'un booléen `hasIntervalsKey`, jamais la
//  clé : elle ne doit pas transiter dans un prompt envoyé à un service tiers.
// ─────────────────────────────────────────────────────────────────────────────

export type AccountState = {
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  onboardingCompleted: boolean;
  healthDeclared: boolean;
  /** Booléen UNIQUEMENT — la clé API elle-même ne doit jamais arriver jusqu'ici. */
  hasIntervalsKey: boolean;
  hasIntervalsAthleteId: boolean;
  lastWorkoutDate: string | null;
  workoutCount30d: number;
  upcomingSessions: number;
  lastAutoCoachAt: string | null;
  objective: { race: string; raceDate: string } | null;
  weighInCount: number;
  weightModeEnabled: boolean;
};

export type Finding = {
  /** Identifiant stable — sert aux tests et à d'éventuelles traductions. */
  code: string;
  /** `bloquant` = explique à lui seul que rien ne fonctionne. */
  severity: "bloquant" | "info";
  /** Constat FACTUEL, vérifiable par l'utilisateur. Jamais un conseil. */
  fact: string;
};

const daysSince = (iso: string | null, now: number): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((now - t) / 86400000) : null;
};

/**
 * Constats sur l'état réel du compte, du plus bloquant au plus anodin.
 *
 * L'ordre compte : l'assistant lit cette liste de haut en bas et doit citer le premier
 * élément bloquant plutôt que d'énumérer des causes possibles. « Ta montre n'est pas
 * connectée » rend inutile tout le reste du dépannage.
 */
export function diagnoseAccount(s: AccountState, now = Date.now()): Finding[] {
  const out: Finding[] = [];

  // ── Ce qui empêche l'app de fonctionner du tout ──
  if (!s.hasIntervalsKey || !s.hasIntervalsAthleteId) {
    out.push({
      code: "montre_non_connectee", severity: "bloquant",
      fact: "Sa montre n'est PAS connectée : les identifiants intervals.icu manquent dans Sync Montre. Sans eux, aucune activité n'entre et aucune séance ne part vers la montre. C'est la première chose à régler.",
    });
  }

  const dLast = daysSince(s.lastWorkoutDate, now);
  if (s.workoutCount30d === 0) {
    out.push({
      code: "aucune_activite", severity: "bloquant",
      fact: dLast == null
        ? "Aucune activité n'a jamais été importée. Sans séance, il n'y a ni VMA estimée, ni allure cible, ni analyse de charge — l'app ne peut rien calculer."
        : `Aucune activité importée sur les 30 derniers jours (la dernière remonte à ${dLast} jours). Les analyses de forme et de charge sont donc vides ou périmées.`,
    });
  } else if (dLast != null && dLast > 7) {
    out.push({
      code: "sync_en_retard", severity: "info",
      fact: `Sa dernière activité importée date de ${dLast} jours, alors que ${s.workoutCount30d} activité(s) ont été synchronisées sur 30 jours : la synchronisation semble s'être interrompue.`,
    });
  }

  // ── Profil incomplet : chaque champ manquant désactive un calcul précis ──
  const missing = [
    !s.age && "âge", !s.heightCm && "taille", !s.weightKg && "poids",
  ].filter(Boolean) as string[];
  if (missing.length) {
    out.push({
      code: "profil_incomplet", severity: "info",
      fact: `Profil incomplet : ${missing.join(", ")} manquant(s). Sans ces valeurs, le métabolisme de base, l'IMC et la dépense énergétique ne sont pas calculables (le mode Poids reste alors indisponible).`,
    });
  }
  if (!s.healthDeclared) {
    out.push({
      code: "sante_non_declaree", severity: "info",
      fact: "La section Santé du profil n'a jamais été renseignée. Le coach reste alors un cran plus prudent sur l'intensité, faute de savoir s'il y a une contre-indication.",
    });
  }

  // ── Plan ──
  if (s.upcomingSessions === 0) {
    out.push({
      code: "aucune_seance_a_venir", severity: "bloquant",
      fact: "Aucune séance n'est actuellement programmée dans son calendrier.",
    });
  }
  const dCoach = daysSince(s.lastAutoCoachAt, now);
  if (s.lastAutoCoachAt == null) {
    out.push({
      code: "coach_jamais_passe", severity: "info",
      fact: "Le coach automatique n'a encore jamais généré de plan pour ce compte.",
    });
  } else if (dCoach != null && dCoach >= 2) {
    out.push({
      code: "coach_en_retard", severity: "info",
      fact: `Le dernier plan automatique remonte à ${dCoach} jours, alors qu'il se recalcule normalement chaque nuit.`,
    });
  }

  // ── Objectif ──
  const today = new Date(now).toISOString().slice(0, 10);
  if (!s.objective) {
    out.push({
      code: "aucun_objectif", severity: "info",
      fact: "Aucun objectif de course n'est défini. Le plan reste en progression générale, sans périodisation vers une date.",
    });
  } else if (s.objective.raceDate < today) {
    out.push({
      code: "objectif_passe", severity: "info",
      fact: `Son objectif (${s.objective.race}, ${s.objective.raceDate}) est DÉPASSÉ. Tant qu'il n'est pas remplacé, la périodisation n'a plus de cap.`,
    });
  }

  // ── Mode poids ──
  if (s.weightModeEnabled && s.weighInCount < 4) {
    out.push({
      code: "pesees_insuffisantes", severity: "info",
      fact: `Objectif de perte activé mais seulement ${s.weighInCount} pesée(s) enregistrée(s). Il en faut 4 réparties sur 2 semaines pour qu'une tendance soit calculable — en dessous, aucun chiffre de progression ne s'affiche.`,
    });
  }

  return out;
}

/** Bloc prêt à insérer dans le prompt. Chaîne vide si tout va bien : ne rien dire vaut
 *  mieux que « aucun problème détecté », qui inviterait le modèle à commenter du vide. */
export function findingsBlock(findings: Finding[]): string {
  if (!findings.length) return "";
  const bloquants = findings.filter((f) => f.severity === "bloquant");
  return [
    "ÉTAT RÉEL DE SON COMPTE (constats vérifiés à l'instant — cite-les au lieu d'énumérer des causes possibles) :",
    ...findings.map((f) => `- [${f.severity}] ${f.fact}`),
    bloquants.length
      ? "⚠️ Un point BLOQUANT ci-dessus explique probablement à lui seul son problème : commence par celui-là, ne noie pas la réponse dans le reste."
      : "",
  ].filter(Boolean).join("\n");
}
