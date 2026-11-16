/**
 * LE TEMPS — une seule façon de savoir quel jour on est, et de l'écrire.
 *
 * ⚠️ CE N'EST PAS UN CONFORT : C'EST UN DÉFAUT MESURÉ EN PRODUCTION. Le journal
 * d'erreurs contenait 23 fois l'erreur React #418 (« le texte rendu par le serveur
 * diffère de celui du navigateur ») entre le 23/06 et le 01/09/2026, sur /dashboard,
 * /dashboard/races et /dashboard/calendrier. 22 de ces 23 erreurs — 96 % — tombent
 * entre 22 h et 4 h UTC, une fenêtre qui ne représente que 25 % de la journée.
 *
 * La raison : les fonctions serveur s'exécutent à iad1 (États-Unis) et les coureurs
 * sont en France. `new Date("2026-09-03T00:00:00")` sans fuseau, `new Date()`, et
 * `toLocaleDateString()` sans `timeZone` prennent tous le fuseau du MOTEUR. Le
 * 4 septembre à 00 h 30 à Paris, le serveur écrivait encore « jeudi 3 septembre ».
 *
 * ══ LA DISTINCTION QUE LE CODE CONFONDAIT ══
 *
 * • Une DATE CIVILE (« 2026-09-03 ») est un jour du calendrier : une course a lieu le
 *   3 septembre à Paris comme à Saint-Denis de La Réunion. Elle ne se convertit PAS.
 *   `formatDateCivile` ne prend donc AUCUN fuseau — c'est volontaire : on ne peut pas
 *   se tromper avec un paramètre qui n'existe pas.
 *
 * • Un INSTANT (« maintenant », l'heure de départ d'une séance) tombe un jour
 *   différent selon l'endroit d'où on regarde. `formatInstant` et `jourCivil` EXIGENT
 *   donc un fuseau : l'oublier ne compile pas.
 *
 * ⚠️ POURQUOI PAS « Europe/Paris » EN DUR : le site se vend partout en France, DOM-TOM
 * compris. La Réunion est à +4 h, la Guadeloupe à −4 h, la Nouvelle-Calédonie à +11 h.
 * Un coureur guadeloupéen aurait vu sa séance du jour changer à 20 h.
 */

/** Le repli quand on ne sait pas encore où se trouve l'athlète. */
export const FUSEAU_DEFAUT = "Europe/Paris";

/**
 * Le fuseau est-il connu de ce moteur ?
 *
 * ⚠️ IL ARRIVE D'UN COOKIE, DONC DE L'EXTÉRIEUR. Une valeur fantaisiste ferait lever
 * `RangeError` à `Intl.DateTimeFormat` — au milieu du rendu d'une page, ce qui la ferait
 * tomber entièrement. On valide une fois, on retombe sur le défaut sinon.
 */
export function fuseauValide(tz: unknown): boolean {
  const s = String(tz ?? "");
  // ⚠️ CE QUI PROTÈGE, C'EST LE `catch` — pas la borne de longueur. `Intl` refuse
  // lui-même tout fuseau inconnu, y compris « Mars/Olympus » ou une injection. La borne
  // n'est là que pour ne pas faire travailler `Intl` sur une chaîne absurde à chaque
  // rendu ; AUCUNE mutation ne la fait tomber, et c'est écrit ici pour qu'on ne la
  // prenne pas un jour pour la sécurité qu'elle n'est pas.
  if (!s || s.length > 64) return false;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: s }); return true; }
  catch { return false; }
}

/** Le fuseau retenu : celui de l'athlète s'il est exploitable, le défaut sinon. */
export function fuseauOuDefaut(tz: unknown): string {
  return fuseauValide(tz) ? String(tz) : FUSEAU_DEFAUT;
}

/**
 * Le jour du calendrier d'un instant, VU DEPUIS un fuseau — « 2026-09-04 ».
 *
 * Remplace `new Date().toISOString().slice(0, 10)`, qui donne le jour UTC : à Paris,
 * entre minuit et 2 h, ce jour est encore celui de la veille.
 */
export function jourCivil(instant: Date | number | string, tz: string): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "";
  // `en-CA` produit « AAAA-MM-JJ » : c'est le seul format court que l'ICU rende trié.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseauOuDefaut(tz), year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** Le jour d'aujourd'hui pour l'athlète. `maintenant` est injectable pour les tests. */
export function aujourdhui(tz: string, maintenant: Date = new Date()): string {
  return jourCivil(maintenant, tz);
}

/**
 * Un INSTANT dont le jour LOCAL (getters `getDate`, `getDay`… du fuseau de la machine) est le jour
 * civil `jour` (« AAAA-MM-JJ »), quel que soit ce fuseau : midi local de ce jour.
 *
 * Sert au jour 0 du plan (16/11/2026) : `construireSemaine` raisonne en jours LOCAUX. Lui passer
 * `new Date()` sur un serveur en UTC faisait commencer le plan la veille, entre minuit et 1 h (2 h
 * l'été) heure de Paris. Midi laisse douze heures de marge de part et d'autre : aucun changement
 * d'heure ne fait basculer de jour.
 */
export function instantDuJour(jour: string): Date {
  return new Date(`${String(jour).slice(0, 10)}T12:00:00`);
}

/**
 * L'INSTANT DE RÉFÉRENCE des fenêtres sur des DATES CIVILES vues le jour `jour` (« AAAA-MM-JJ ») : le
 * dernier instant qui est encore `jour` À LA FOIS en UTC et dans le fuseau du coureur (à Paris :
 * 23 h 59 min 59,999 s, soit 22:59:59.999Z l'hiver et 21:59:59.999Z l'été). NaN si `jour` est illisible.
 *
 * Les dates de séance, de nuit, de VFC sont stockées « AAAA-MM-JJ » et lues à minuit UTC. Une fenêtre
 * « de N jours » écrite `maintenant - date <= N × 24 h` retient aujourd'hui et les N-1 jours d'avant
 * tant que `maintenant` tombe le même jour UTC que le coureur. Sur un serveur en UTC, entre minuit et
 * 1 h (2 h l'été) à Paris, ce n'est plus vrai : chaque fenêtre gardait un jour de trop, et le volume
 * visé, la charge ou le niveau de forme changeaient pour le même jour du coureur (16/11/2026).
 * Comptée depuis cet instant-ci, une fenêtre retient le même ensemble de jours à toute heure : celui
 * que donnait le calcul en journée. Une fenêtre ancrée à MIDI (`T12:00:00Z`), qui basculait à midi
 * UTC, retient désormais toute la journée ce qu'elle retenait l'après-midi.
 *
 * ⚠️ LES DEUX JOURS À LA FOIS, pas la fin du jour UTC : 23:59:59.999Z est déjà le lendemain à Paris,
 * et les fonctions qui relisent le jour du coureur depuis l'instant (`jourLocal`, volume en semaines
 * de calendrier) comptaient alors depuis demain (relecture du 16/11/2026).
 * ⚠️ POUR DES DATES SEULEMENT. Un horodatage (`created_at`, point de courbe) se compare à l'instant réel.
 */
export function finDuJourCoureur(jour: string, tz: string = FUSEAU_DEFAUT): number {
  const j = String(jour ?? "").slice(0, 10);
  let t = Date.parse(`${j}T23:59:59.999Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(j) || !Number.isFinite(t)) return Number.NaN;
  // D'heure en heure vers le passé jusqu'à retomber sur `jour` chez le coureur : aucun fuseau n'est
  // à plus de 14 h de l'UTC. À l'ouest de l'UTC, la fin du jour UTC est déjà son jour : rien à reculer.
  for (let i = 0; i <= 14 && jourCivil(t, tz) !== j; i++) t -= 3600000;
  return jourCivil(t, tz) === j ? t : Number.NaN;
}

/**
 * Écrit une DATE CIVILE stockée (« 2026-09-03 »).
 *
 * ⚠️ AUCUN FUSEAU, ET C'EST LE POINT. On ancre à midi UTC puis on met en forme EN UTC :
 * le même texte sort du serveur américain et du navigateur français. Ancrer à minuit
 * (ce que faisait `new Date(iso + "T00:00:00")`) suffit à basculer d'un jour dès que le
 * moteur est à l'ouest de Greenwich.
 */
export function formatDateCivile(
  iso: string, lang: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  const jour = String(iso ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return "";
  const d = new Date(`${jour}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ""; // « 2026-13-45 » a la bonne forme, pas la bonne valeur
  return new Intl.DateTimeFormat(lang || "fr", { ...options, timeZone: "UTC" }).format(d);
}

/** Écrit un INSTANT tel que l'athlète le vit. Le fuseau est obligatoire. */
export function formatInstant(
  instant: Date | number | string, lang: string, tz: string, options: Intl.DateTimeFormatOptions,
): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang || "fr", { ...options, timeZone: fuseauOuDefaut(tz) }).format(d);
}

/**
 * ⚠️ PAS DE `decalerJour` NI D'`ecartJours` ICI. Ils existent depuis longtemps dans
 * `lib/streak/compute`, avec la même idée (ancrage à MIDI UTC) et un contrat déjà
 * éprouvé — notamment qu'une entrée invalide y rend la date d'origine, et non une
 * chaîne vide. En écrire une seconde version le jour où on crée ce module aurait
 * donné deux vérités à corriger séparément, et une seule des deux réparée le jour où
 * l'une se trompe. On importe les leurs.
 */
