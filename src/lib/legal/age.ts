// ─────────────────────────────────────────────────────────────────────────────
//  PACEVO EST RÉSERVÉ AUX PERSONNES MAJEURES (décision de Cyprien, 09/11/2026).
//
//  Les conditions de l'API Gemini (aistudio.google.com/docs/terms, « Age Requirements ») et
//  celles de Vertex AI (cloud.google.com/terms/service-terms) interdisent d'utiliser le modèle
//  dans une application « directed towards or likely to be accessed by individuals under the
//  age of 18 ». La clause vise l'APPLICATION entière : couper seulement l'IA pour les mineurs
//  ne suffirait pas. Aucun compte n'avait moins de 18 ans au 09/11/2026 (base de production).
//  Les CGU (« 2. Compte ») et la politique de confidentialité (« 10. Mineurs ») le disent.
// ─────────────────────────────────────────────────────────────────────────────

export const AGE_MINIMUM = 18;

/**
 * L'âge saisi, en ENTIER STRICT (1 à 3 chiffres), ou `null`. C'est CETTE valeur qui est contrôlée
 * ET enregistrée (relecture du 09/11/2026) : `Number("1e2")` valait 100 pour le contrôle, quand
 * `parseInt("1e2")` écrivait 1 en base ; « 18.9 » passait et 18 s'écrivait.
 */
export function ageEntier(age: unknown): number | null {
  if (typeof age === "number") return Number.isInteger(age) && age >= 0 && age < 1000 ? age : null;
  if (typeof age !== "string" || !/^\s*\d{1,3}\s*$/.test(age)) return null;
  return Number(age.trim());
}

/** L'âge saisi est-il celui d'une personne majeure ? Une valeur absente ou illisible : non. */
export function estMajeur(age: unknown): boolean {
  const n = ageEntier(age);
  return n != null && n >= AGE_MINIMUM && n < 120;
}
