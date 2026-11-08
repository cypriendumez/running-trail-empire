// ─────────────────────────────────────────────────────────────────────────────
//  LES ZONES D'UN TEST DE LACTATE — la mesure passe devant les estimations.
//
//  Cyprien, 05/11/2026 : « pour l'élite : les zones issues de tests de lactate ». Jusqu'ici
//  l'allure seuil venait de la vitesse critique d'intervals.icu (ajustée sur les meilleurs
//  efforts) ou, à défaut, de 86 % de la VMA ; l'allure facile, des footings récents ou de
//  70 % de la VMA. Un test de lactate (laboratoire ou lactatemètre de terrain) MESURE les
//  deux seuils : il passe devant.
//
//  CE QUE L'ATHLÈTE SAISIT : la date, puis pour chaque seuil l'allure et, s'il l'a, la
//  fréquence cardiaque. Seuil 1 (aérobie, ~2 mmol/L) : en dessous, tout est facile. Seuil 2
//  (anaérobie, ~4 mmol/L) : l'allure seuil des séances.
//
//  ⚠️ UN TEST VIEILLIT. La forme bouge en quelques mois : au-delà de six mois, il ne pilote
//  plus rien et le coach revient à ses mesures. Il n'est jamais remplacé par un chiffre
//  inventé — sans test, rien ne change.
// ─────────────────────────────────────────────────────────────────────────────
import { ecartJours } from "@/lib/coach/recuperation";

/** Le type de la ligne `notifications` qui range un test (un par saisie, le plus récent fait foi). */
export const TYPE_TEST_LACTATE = "test_lactate";

export type SeuilLactate = { allureSec: number; fc: number | null };
export type TestLactate = { date: string; lt1: SeuilLactate; lt2: SeuilLactate };

/** Au-delà, le test ne pilote plus les allures. */
export const VALIDITE_JOURS = 180;
/** Un test plus ancien n'est pas accepté à la saisie. */
export const ANCIENNETE_MAX_JOURS = 730;
/** Bornes d'allure plausibles (s/km) : 2'30 à 10'00. */
export const ALLURE_MIN_SEC = 150, ALLURE_MAX_SEC = 600;
/** Le seuil 1 est plus lent que le seuil 2 d'au moins cet écart (s/km). */
export const ECART_SEUILS_MIN_SEC = 5;
/** L'allure facile reste au moins aussi lente que le seuil 1 plus cet écart (s/km). */
export const MARGE_FACILE_SEC = 10;

/** « 3'45 », « 3:45 », « 3’45/km » → 225 ; sinon `null`. */
export function lireAllure(s: unknown): number | null {
  const m = String(s ?? "").trim().match(/^(\d{1,2})\s*['’:]\s*(\d{2})(?:\s*\/?\s*km)?$/i);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 ? sec : null;
}

/** 225 → « 3'45 ». */
export function fmtAllure(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}`;
}

/** Ce qui ne va pas dans une saisie : un code, que l'écran traduit. */
export type ErreurLactate = "date" | "allure" | "ordre" | "fc" | "ordreFc";

/**
 * Contrôle une saisie brute (corps de requête) et rend le test, ou la première erreur.
 * `aujourdhui` est FOURNI (jour de l'athlète), jamais lu de l'horloge.
 */
export function validerTestLactate(brut: unknown, aujourdhui: string): { test: TestLactate } | { erreur: ErreurLactate } {
  const b = (brut ?? {}) as Record<string, unknown>;
  const date = String(b.date ?? "").slice(0, 10);
  const age = /^\d{4}-\d{2}-\d{2}$/.test(date) ? ecartJours(aujourdhui, date) : null;
  if (age == null || age < 0 || age > ANCIENNETE_MAX_JOURS) return { erreur: "date" };
  const seuil = (x: unknown): { allureSec: number | null; fc: number | null | "invalide" } => {
    const o = (x ?? {}) as Record<string, unknown>;
    const fcBrute = o.fc == null || o.fc === "" ? null : Number(o.fc);
    return {
      allureSec: lireAllure(o.allure),
      fc: fcBrute == null ? null : Number.isInteger(fcBrute) && fcBrute >= 80 && fcBrute <= 220 ? fcBrute : "invalide",
    };
  };
  const s1 = seuil(b.lt1), s2 = seuil(b.lt2);
  const dansLesBornes = (a: number | null): a is number => a != null && a >= ALLURE_MIN_SEC && a <= ALLURE_MAX_SEC;
  if (!dansLesBornes(s1.allureSec) || !dansLesBornes(s2.allureSec)) return { erreur: "allure" };
  if (s1.allureSec < s2.allureSec + ECART_SEUILS_MIN_SEC) return { erreur: "ordre" };
  if (s1.fc === "invalide" || s2.fc === "invalide") return { erreur: "fc" };
  if (s1.fc != null && s2.fc != null && s1.fc >= s2.fc) return { erreur: "ordreFc" };
  return { test: { date, lt1: { allureSec: s1.allureSec, fc: s1.fc }, lt2: { allureSec: s2.allureSec, fc: s2.fc } } };
}

/** Le test, s'il pilote encore les allures (six mois au plus, jamais daté du futur). */
export function testEnVigueur(test: TestLactate | null | undefined, aujourdhui: string): TestLactate | null {
  if (!test?.date || !test.lt1 || !test.lt2) return null;
  const age = ecartJours(aujourdhui, test.date);
  return age != null && age >= 0 && age <= VALIDITE_JOURS ? test : null;
}

/** L'allure facile la plus rapide permise par le test (s/km) : sous le seuil 1. */
export function allureFacileMaxSec(test: TestLactate): number {
  return test.lt1.allureSec + MARGE_FACILE_SEC;
}
