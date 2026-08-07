// ─────────────────────────────────────────────────────────────────────────────
//  MODE PERTE DE POIDS — traduction en consignes d'ENTRAÎNEMENT.
//
//  Sans ce fichier, le mode ne serait qu'un compteur de calories posé à côté d'un plan
//  de course inchangé. Or courir en déficit calorique n'est pas courir : la récupération
//  est plus lente, la masse musculaire est menacée, et l'impact au sol est proportionnel
//  au poids — trois raisons pour lesquelles le plan DOIT changer, pas seulement le
//  tableau de bord.
//
//  Le catalogue santé porte déjà la consigne « surpoids » (healthCatalog.ts). Elle reste
//  la règle de fond ; ce module la CHIFFRE à partir des données réelles de la personne.
// ─────────────────────────────────────────────────────────────────────────────
import type { WeightPlan } from "@/lib/weight/energy";
import { trendVerdict } from "@/lib/weight/energy";

export type WeightTrainingRules = {
  /** Progression hebdomadaire de volume maximale, en % — plus stricte que les 10 % usuels. */
  maxWeeklyProgressPct: number;
  /** true = l'alternance course/marche est la bonne porte d'entrée, pas un échec. */
  walkRunAdvised: boolean;
  /** Part du volume à faire SANS impact (vélo, elliptique, aqua-jogging), en %. */
  lowImpactSharePct: number;
  /** Séances de renforcement par semaine — non négociable en déficit. */
  strengthPerWeek: number;
  /** Séances de qualité maximales par semaine tolérées dans ce contexte. */
  maxQualityPerWeek: number;
  /** Explication courte, affichable telle quelle. */
  rationale: string;
};

/**
 * Règles d'entraînement déduites de l'IMC réel.
 *
 * POURQUOI L'IMPACT EST LE FACTEUR CENTRAL : à chaque foulée, le sol renvoie 2,5 à 3 fois
 * le poids du corps. À 110 kg, c'est ~300 kg par appui, ~700 appuis par kilomètre. Le
 * cardio d'un débutant en surpoids tient souvent bien plus longtemps que ses tendons —
 * c'est exactement le scénario de la périostite et de la fasciite plantaire à la 3ᵉ
 * semaine, celui qui fait arrêter. Le volume sans impact n'est pas un pis-aller : c'est
 * ce qui permet de faire les heures d'endurance qui, elles, font maigrir.
 */
export function weightTrainingRules(plan: WeightPlan): WeightTrainingRules {
  switch (plan.band) {
    case "obesite_3":
    case "obesite_2":
      return {
        maxWeeklyProgressPct: 5, walkRunAdvised: true, lowImpactSharePct: 60, strengthPerWeek: 2, maxQualityPerWeek: 0,
        rationale: "Priorité absolue aux articulations : l'essentiel du volume se fait en marche rapide, vélo ou elliptique, et la course arrive par touches courtes en alternance. Aucune séance de fractionné tant que la base n'est pas installée — le cardio suivrait, les tendons non.",
      };
    case "obesite_1":
      return {
        maxWeeklyProgressPct: 5, walkRunAdvised: true, lowImpactSharePct: 40, strengthPerWeek: 2, maxQualityPerWeek: 1,
        rationale: "Alternance course/marche comme format principal, complétée de volume sans impact. Une seule séance un peu soutenue par semaine, en côtes douces ou en tempo court : même bénéfice cardiaque que le fractionné, bien moins de traumatisme.",
      };
    case "surpoids":
      return {
        maxWeeklyProgressPct: 7, walkRunAdvised: false, lowImpactSharePct: 20, strengthPerWeek: 2, maxQualityPerWeek: 2,
        rationale: "Entraînement classique, avec deux réserves : progression du volume plafonnée à +7 %/semaine plutôt que +10 %, et renforcement deux fois par semaine pour protéger la masse musculaire pendant le déficit.",
      };
    default:
      return {
        maxWeeklyProgressPct: 10, walkRunAdvised: false, lowImpactSharePct: 0, strengthPerWeek: 2, maxQualityPerWeek: 3,
        rationale: "Aucune restriction liée au poids. Seule contrainte : ne pas cumuler un déficit calorique marqué et un bloc d'entraînement dense.",
      };
  }
}

/**
 * Bloc injecté dans le prompt du coach IA.
 *
 * Il est rédigé en CONSIGNES (« fais ceci », « ne dis jamais cela »), pas en constats :
 * une IA à qui l'on décrit une situation improvise ; une IA à qui l'on donne une règle
 * l'applique. Même logique que les consignes de `healthCatalog.ts`.
 */
export function weightCoachBlock(plan: WeightPlan): string {
  const rules = weightTrainingRules(plan);
  const v = trendVerdict(plan);
  const lines: string[] = [];

  lines.push("⚖️ MODE PERTE DE POIDS ACTIVÉ PAR L'ATHLÈTE — il fait partie du cadre de l'entraînement, tu ne peux pas l'ignorer.");
  lines.push(`État : ${plan.currentKg} kg pour un IMC de ${plan.bmi}${plan.goalKg ? `, objectif ${plan.goalKg} kg (${plan.toLoseKg} kg à perdre)` : ", aucun poids cible fixé"}. Poids issu ${plan.currentSource === "pesees" ? "de ses pesées lissées" : "de son profil (aucune pesée enregistrée — ce chiffre peut dater)"}.`);
  lines.push(`Énergie : métabolisme de base ${plan.bmr} kcal, dépense totale estimée ${plan.tdee} kcal/jour (dont ${plan.training.kcalPerDay} kcal/jour de sport RÉEL sur 28 j), cible ${plan.targetKcal} kcal/jour, protéines ${plan.proteinG} g/jour.`);
  lines.push(`Tendance mesurée : ${v.message}`);

  lines.push(`ENTRAÎNEMENT — ${rules.rationale}`);
  lines.push(`Contraintes chiffrées à RESPECTER : progression du volume ≤ +${rules.maxWeeklyProgressPct} %/semaine, ${rules.maxQualityPerWeek === 0 ? "AUCUNE séance de qualité pour l'instant" : `${rules.maxQualityPerWeek} séance(s) de qualité maximum/semaine`}, ${rules.strengthPerWeek} séance(s) de renforcement/semaine (NON NÉGOCIABLE)${rules.lowImpactSharePct > 0 ? `, ~${rules.lowImpactSharePct} % du volume sans impact (vélo, elliptique, marche rapide, aqua-jogging)` : ""}.`);

  if (rules.walkRunAdvised) {
    lines.push("FORMAT D'ENTRÉE : alterne course et marche (par exemple 1 min de course / 2 min de marche, répété). Présente-le comme la MÉTHODE des coureurs qui durent, jamais comme une version dégradée de la course. Allonger les blocs courus vient tout seul, semaine après semaine.");
  }

  // Le piège n°1 du coureur en déficit : sous-alimenter la séance de qualité.
  lines.push("NUTRITION AUTOUR DES SÉANCES : le déficit se prend sur les jours faciles et les jours de repos, JAMAIS autour d'une séance de qualité ni d'une sortie longue. Une séance dure abordée à jeun et en restriction ne brûle pas plus de graisse : elle dégrade la séance, attaque le muscle et prépare une blessure. Glucides avant, protéines dans l'heure après.");
  lines.push("PROTÉINES : c'est le levier principal contre la fonte musculaire en déficit — réparties sur la journée, pas concentrées le soir. Un coureur qui perd du poids sans protéines suffisantes perd de la performance en même temps que des kilos.");
  lines.push("SIGNAUX D'ALERTE À SURVEILLER (déficit trop agressif ou trop long) : FC de repos qui monte, VFC qui s'effondre, sommeil dégradé, allures qui se dégradent à FC constante, arrêt des règles. Si tu en vois, dis-lui de REMONTER l'apport — la performance passe avant la perte de poids dès qu'un de ces signaux apparaît.");

  // Cadre du discours. Reprend et durcit la consigne « surpoids » du catalogue santé.
  lines.push("TON : parle santé, régularité, énergie et plaisir — JAMAIS esthétique, JAMAIS culpabilisation, JAMAIS le poids présenté comme une cause de contre-performance. Ne compare pas son poids à celui d'autres coureurs. Une semaine sans perte n'est pas un échec et se dit comme tel.");
  lines.push("⚠️ TU N'ES PAS DIÉTÉTICIEN : tu donnes des repères (cible calorique, protéines, timing autour des séances), pas un régime, pas de menu prescriptif, aucun aliment interdit. Toute pathologie (diabète, thyroïde, trouble du comportement alimentaire) ou tout objectif de perte importante relève d'un professionnel de santé — dis-le explicitement.");

  return lines.join("\n");
}

/**
 * Résumé court pour les surfaces où la place manque (bandeau du tableau de bord,
 * notification). Volontairement sans chiffre de progression quand la tendance n'est pas
 * mesurable : mieux vaut « pèse-toi » qu'un « 0 kg cette semaine » qui n'existe pas.
 */
export function weightShortSummary(plan: WeightPlan): string {
  const v = trendVerdict(plan);
  if (v.status === "insuffisant") return `Cible ${plan.targetKcal} kcal/j · ${plan.proteinG} g de protéines. Pèse-toi régulièrement pour débloquer le suivi de tendance.`;
  const rate = plan.measured!.ratePerWeek;
  const sign = rate < 0 ? "" : "+";
  return `${sign}${rate} kg/semaine mesuré · cible ${plan.targetKcal} kcal/j · ${plan.proteinG} g de protéines.`;
}
