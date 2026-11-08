/**
 * LE DROIT DE RÉTRACTATION — le délai et ce que l'abonné paie s'il renonce.
 *
 * ⚠️ OBLIGATION EN VIGUEUR DEPUIS LE 19/06/2026 : tout contrat conclu en ligne doit offrir
 * une « fonction de rétractation » libellée « Renoncer au contrat ici », accessible
 * pendant tout le délai, suivie d'une confirmation et d'un accusé de réception sur un
 * support durable (ordonnance n° 2026-2 et décret n° 2026-3 du 5 janvier 2026, art.
 * L221-21 du code de la consommation). Le bouton vit dans Profil → Abonnement, la route
 * dans `/api/stripe/retractation`.
 *
 * ⚠️ FONCTIONS PURES, et c'est volontaire : l'écran (client) et la route (serveur) doivent
 * calculer la MÊME date limite. Un bouton qui disparaît la veille de ce que la route
 * accepte prive l'abonné de son droit ; l'inverse lui promet un droit que la route refuse.
 * Aucune lecture d'environnement ici : ce module part dans le navigateur.
 */

/** Le délai légal, en jours (art. L221-18). */
export const DELAI_RETRACTATION_JOURS = 14;

/** Type de la ligne `notifications` qui garde la trace de chaque rétractation. */
export const TYPE_RETRACTATION = "retractation";

const PARIS = new Intl.DateTimeFormat("fr-CA", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
});

/** La date civile à Paris (AAAA-MM-JJ) d'un instant. */
export function jourParis(d: Date): string {
  return PARIS.format(d);
}

/** Décale une date civile AAAA-MM-JJ de `n` jours (calcul en UTC, sans heure d'été). */
function plusJours(jour: string, n: number): string {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dimanche de Pâques (algorithme de Meeus), en AAAA-MM-JJ. */
function paques(annee: number): string {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/** Les onze jours fériés de France métropolitaine d'une année. */
export function joursFeries(annee: number): Set<string> {
  const p = paques(annee);
  return new Set([
    `${annee}-01-01`, `${annee}-05-01`, `${annee}-05-08`, `${annee}-07-14`,
    `${annee}-08-15`, `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`,
    plusJours(p, 1),  // lundi de Pâques
    plusJours(p, 39), // Ascension
    plusJours(p, 50), // lundi de Pentecôte
  ]);
}

function ouvrable(jour: string): boolean {
  const semaine = new Date(`${jour}T00:00:00Z`).getUTCDay();
  return semaine !== 0 && semaine !== 6 && !joursFeries(Number(jour.slice(0, 4))).has(jour);
}

/**
 * Le DERNIER JOUR (date civile à Paris) pour renoncer à un abonnement souscrit à l'instant
 * donné.
 *
 * ⚠️ LE JOUR DE LA SOUSCRIPTION NE COMPTE PAS : le délai court à partir du lendemain et
 * expire le quatorzième jour à minuit. S'il tombe un samedi, un dimanche ou un jour férié,
 * il est prolongé jusqu'au premier jour ouvrable suivant (art. L221-19). Compter le jour
 * même retirerait un jour à l'abonné.
 */
export function dernierJourRetractation(souscription: Date): string {
  let jour = plusJours(jourParis(souscription), DELAI_RETRACTATION_JOURS);
  while (!ouvrable(jour)) jour = plusJours(jour, 1);
  return jour;
}

/** Le délai est-il encore ouvert à l'instant `maintenant` ? */
export function fenetreRetractation(
  souscritLe: string | null | undefined,
  maintenant: Date = new Date(),
): { ouverte: boolean; dernierJour: string | null } {
  if (!souscritLe) return { ouverte: false, dernierJour: null };
  const debut = new Date(souscritLe);
  if (Number.isNaN(debut.getTime())) return { ouverte: false, dernierJour: null };
  const dernierJour = dernierJourRetractation(debut);
  return { ouverte: jourParis(maintenant) <= dernierJour, dernierJour };
}

/**
 * Ce que l'abonné DOIT pour le service déjà fourni, en centimes.
 *
 * ⚠️ IL A DEMANDÉ UN ACCÈS IMMÉDIAT (case cochée au paiement) : s'il renonce dans le délai,
 * il paie la part du service fournie jusqu'à sa demande, au prorata du prix (art.
 * L221-25), et on lui rembourse le reste. Lui rembourser tout reviendrait à offrir
 * l'accès ; ne rien lui rembourser le priverait de son droit.
 */
export function montantDu(
  payeCentimes: number,
  debutPeriode: Date,
  finPeriode: Date,
  demande: Date,
): number {
  const total = finPeriode.getTime() - debutPeriode.getTime();
  if (!(payeCentimes > 0) || !(total > 0)) return 0;
  const ecoule = Math.min(Math.max(demande.getTime() - debutPeriode.getTime(), 0), total);
  return Math.round((payeCentimes * ecoule) / total);
}

/** Ce qu'on rembourse : le payé moins le dû, jamais négatif. */
export function montantRembourse(
  payeCentimes: number,
  debutPeriode: Date,
  finPeriode: Date,
  demande: Date,
): number {
  return Math.max(0, payeCentimes - montantDu(payeCentimes, debutPeriode, finPeriode, demande));
}
