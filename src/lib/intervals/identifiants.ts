/**
 * LES IDENTIFIANTS intervals.icu D'UN ATHLÈTE — ET DE LUI SEUL.
 *
 * ── LE DÉFAUT RÉEL, CONSTATÉ EN PRODUCTION LE 23/08/2026 ────────────────────
 * Quatorze endroits du code lisaient les identifiants ainsi :
 *
 *     const ATHLETE_ID = profile?.intervals_athlete_id || process.env.INTERVALS_ICU_ATHLETE_ID;
 *     const API_KEY    = profile?.intervals_api_key    || process.env.INTERVALS_ICU_API_KEY;
 *
 * Le repli paraissait anodin — il datait de l'époque où l'application n'avait qu'un seul
 * utilisateur, son auteur. Il ne l'est pas : les variables d'environnement contiennent le
 * compte intervals.icu DE L'ÉDITEUR. Tout inscrit qui n'a pas branché sa propre montre
 * héritait donc, en silence, du compte de quelqu'un d'autre.
 *
 * Ce n'est pas une hypothèse. Relevé sur la base et sur l'API le 23/08/2026 :
 *  · le second compte de la base (aucun identifiant intervals.icu enregistré) portait
 *    TROIS séances dans sa table `workouts` — `i178186948`, `i178009874`, `i177841573`,
 *    exactement les identifiants d'activité des sorties de l'éditeur ;
 *  · le calendrier intervals.icu de l'éditeur portait, pour le 23/08/2026, DEUX séances
 *    « coach » : la sienne (`rte-coach-ef60cb0c-…`) et celle du second compte
 *    (`rte-coach-19ab4adf-…`), poussée là faute d'un compte à lui.
 *
 * Conséquences, dans les deux sens :
 *  · LECTURE — le client voit les sorties d'un inconnu comme les siennes. Sa VMA, sa
 *    charge, sa fraîcheur, son plan et ses analyses sont calculés sur le corps d'un autre.
 *    Les traces GPS importées avec ces séances partent du domicile de l'éditeur.
 *  · ÉCRITURE — le plan du client atterrit sur la montre de l'éditeur, qui reçoit chaque
 *    matin des séances qui ne le concernent pas, tandis que le client n'en reçoit aucune.
 *
 * Rien de tout cela ne lève d'erreur : l'application répond « connecté », la pastille est
 * verte, la synchronisation « réussit ». C'est le pire des défauts silencieux — il
 * ressemble en tous points au bon fonctionnement.
 *
 * ── LA RÈGLE ────────────────────────────────────────────────────────────────
 * Les identifiants d'un athlète viennent de SON profil, ou n'existent pas. Il n'y a pas
 * de repli. Un athlète sans identifiants n'est pas synchronisé : l'application le dit
 * (« connecte ta montre »), elle ne fabrique pas des données à sa place.
 *
 * Cette fonction est la SEULE porte d'entrée. `tests/synchro.crash.test.ts` vérifie
 * qu'aucun fichier de `src/` ne lit `process.env.INTERVALS_ICU_*` en dehors d'ici.
 */

/** Le profil tel que les routes le lisent. Volontairement permissif : chaque appelant en
 *  sélectionne un sous-ensemble différent, et `unknown` évite dix types quasi identiques. */
export type ProfilIdentifiants = {
  intervals_athlete_id?: unknown;
  intervals_api_key?: unknown;
} | null | undefined;

export type IdentifiantsIntervals = { athleteId: string; apiKey: string };

/**
 * Les identifiants du profil, ou `null` si l'athlète n'en a pas.
 *
 * ⚠️ Les deux vont ENSEMBLE. Un identifiant d'athlète sans clé (ou l'inverse) ne permet
 * aucun appel : rendre un objet à moitié rempli laisserait les appelants construire une
 * requête vouée au 401, et lire ce 401 comme « intervals.icu est en panne ».
 *
 * ⚠️ On rogne les espaces avant de juger. Une clé collée depuis le site d'intervals.icu
 * arrive régulièrement avec un retour à la ligne : `" "` est vrai en JavaScript, et
 * l'en-tête d'authentification partait alors avec un blanc en fin de clé.
 */
export function identifiantsDe(profil: ProfilIdentifiants): IdentifiantsIntervals | null {
  const athleteId = typeof profil?.intervals_athlete_id === "string" ? profil.intervals_athlete_id.trim() : "";
  const apiKey = typeof profil?.intervals_api_key === "string" ? profil.intervals_api_key.trim() : "";
  if (!athleteId || !apiKey) return null;
  return { athleteId, apiKey };
}

/**
 * Variante pour les appelants qui portent déjà les deux valeurs séparément (le coach
 * automatique les reçoit en paramètres, pas sous forme de profil).
 */
export function identifiantsDePaire(athleteId: unknown, apiKey: unknown): IdentifiantsIntervals | null {
  return identifiantsDe({ intervals_athlete_id: athleteId, intervals_api_key: apiKey });
}
