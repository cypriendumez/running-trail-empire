/**
 * LE DROIT DE LA CONSOMMATION AVANT LA PREMIÈRE VENTE (09/10/2026).
 *
 * Trois écarts relevés dans les CGV et le parcours d'abonnement, à combler avant d'ouvrir
 * les paiements :
 *   - aucune « fonction de rétractation » (« Renoncer au contrat ici »), obligatoire depuis
 *     le 19/06/2026 pour un contrat conclu en ligne ;
 *   - aucun médiateur de la consommation NOMMÉ, et un renvoi vers la plateforme européenne
 *     de règlement en ligne des litiges, fermée le 20/07/2025 ;
 *   - aucun rappel avant la reconduction d'un abonnement annuel (art. L215-1).
 *
 * ⚠️ LES DATES SONT DES CAS RÉELS DE 2027, l'année du lancement : un lundi de Pâques, un
 * week-end, un abonnement souscrit à 23 h 30 en UTC (déjà le lendemain à Paris). Le délai de
 * rétractation se joue au jour près ; un jour de moins prive l'abonné de son droit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mediateurConso } from "../src/lib/brand/mediateur";
import { LEGAL, phraseMediateur } from "../src/app/legalI18n";
import {
  dernierJourRetractation, fenetreRetractation, joursFeries, montantDu, montantRembourse,
} from "../src/lib/billing/retractation";
import { doitRappelerReconduction } from "../src/lib/billing/reconduction";
import { emailAccuseRetractation, emailRappelReconduction } from "../src/lib/billing/emailsAbonnement";
import { litEtatAbo, type EtatAbonnement } from "../src/lib/billing/etatAbonnement";

let ok = 0, ko = 0;
function t(nom: string, f: () => void) {
  try { f(); ok++; } catch (e) { ko++; console.error(`✗ ${nom}\n  ${(e as Error).message}`); }
}
// Le CODE seul : blocs /* */, lignes // et fins de ligne // (jamais « :// » d'une adresse).
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
const section = (lg: (typeof LANGUES)[number], numero: string) => {
  const s = LEGAL[lg].terms.sections.find((x) => x.title.startsWith(`${numero}. `));
  assert.ok(s, `${lg} : section ${numero} des CGV introuvable`);
  return [...(s.paras ?? []), ...(s.list ?? [])].join(" ");
};

// ── 1. LE MÉDIATEUR ─────────────────────────────────────────────────────────────
t("le médiateur n'est retenu que s'il est plausible (nom + adresse https)", () => {
  assert.equal(mediateurConso({}), null);
  assert.equal(mediateurConso({ MEDIATEUR_NOM: "ok", MEDIATEUR_SITE: "https://cm2c.net" }), null);
  assert.equal(mediateurConso({ MEDIATEUR_NOM: "CM2C", MEDIATEUR_SITE: "http://cm2c.net" }), null);
  assert.equal(mediateurConso({ MEDIATEUR_NOM: "CM2C", MEDIATEUR_SITE: "www.cm2c.net" }), null);
  assert.equal(mediateurConso({ MEDIATEUR_NOM: "CM2C", MEDIATEUR_SITE: "https://localhost" }), null);
  assert.deepEqual(mediateurConso({ MEDIATEUR_NOM: " CM2C ", MEDIATEUR_SITE: "https://www.cm2c.net" }),
    { nom: "CM2C", site: "https://www.cm2c.net" });
});

t("les CGV nomment le médiateur dans les cinq langues, ou disent qu'il le sera — jamais un recours vague", () => {
  const m = { nom: "Médiateur Exemple", site: "https://mediateur.example.fr" };
  for (const lg of LANGUES) {
    const avec = phraseMediateur(lg, m);
    assert.ok(avec.includes(m.nom) && avec.includes(m.site), `${lg} : le médiateur désigné n'apparaît pas`);
    const sans = phraseMediateur(lg, null);
    assert.ok(sans.length > 40 && !sans.includes("[À COMPLÉTER"), `${lg} : la phrase d'attente est absente ou brute`);
    assert.notEqual(avec, sans);
  }
});

t("la plateforme européenne de règlement des litiges (fermée le 20/07/2025) n'est plus citée", () => {
  const fermee = /plateforme européenne|online dispute resolution|Online-Streitbeilegung|resolución de litigios en línea|resolução de litígios em linha/i;
  for (const lg of LANGUES) assert.doesNotMatch(section(lg, "11"), fermee, `${lg} : la section 11 renvoie encore à une plateforme fermée`);
});

t("pas de vente sans médiateur : le paiement refuse de s'ouvrir", () => {
  const src = code("src/app/api/stripe/checkout/route.ts");
  assert.match(src, /if \(!mediateurConso\(\)\)/, "la route de paiement ne vérifie pas le médiateur");
  const avant = src.indexOf("mediateurConso()"), session = src.indexOf("checkout.sessions.create");
  assert.ok(avant > 0 && avant < session, "le contrôle du médiateur doit précéder la création de la session");
});

// ── 2. LA FONCTION DE RÉTRACTATION ──────────────────────────────────────────────
t("le délai court du lendemain : souscrit le vendredi 1er janvier 2027 → dernier jour le vendredi 15", () => {
  assert.equal(dernierJourRetractation(new Date("2027-01-01T10:00:00Z")), "2027-01-15");
});

t("un délai qui finit un dimanche est prolongé au lundi", () => {
  assert.equal(dernierJourRetractation(new Date("2027-01-03T10:00:00Z")), "2027-01-18");
});

t("l'heure de Paris décide du jour : 23 h 30 UTC le 1er janvier = le 2 à Paris", () => {
  // 2 janvier + 14 = samedi 16 → lundi 18.
  assert.equal(dernierJourRetractation(new Date("2027-01-01T23:30:00Z")), "2027-01-18");
});

t("un délai qui finit le lundi de Pâques 2027 est prolongé au mardi", () => {
  assert.ok(joursFeries(2027).has("2027-03-29"), "lundi de Pâques 2027 absent");
  assert.ok(joursFeries(2026).has("2026-04-06") && joursFeries(2026).has("2026-05-14") && joursFeries(2026).has("2026-05-25"),
    "Pâques, Ascension ou Pentecôte 2026 mal calculés");
  assert.equal(dernierJourRetractation(new Date("2027-03-15T10:00:00Z")), "2027-03-30");
});

t("le bouton reste ouvert jusqu'à 23 h 59 (heure de Paris) du dernier jour, pas une minute de plus", () => {
  const souscrit = "2027-01-01T10:00:00Z";
  assert.equal(fenetreRetractation(souscrit, new Date("2027-01-15T22:59:00Z")).ouverte, true);
  assert.equal(fenetreRetractation(souscrit, new Date("2027-01-15T23:01:00Z")).ouverte, false);
  assert.deepEqual(fenetreRetractation(null), { ouverte: false, dernierJour: null });
  assert.deepEqual(fenetreRetractation("n'importe quoi"), { ouverte: false, dernierJour: null });
});

t("l'abonné paie la part fournie, au prorata, et on lui rend le reste", () => {
  const debut = new Date("2027-01-01T00:00:00Z"), fin = new Date("2027-01-31T00:00:00Z");
  const apres3jours = new Date("2027-01-04T00:00:00Z");
  assert.equal(montantDu(999, debut, fin, apres3jours), 100); // 99,9 centimes arrondis
  assert.equal(montantRembourse(999, debut, fin, apres3jours), 899);
  assert.equal(montantRembourse(999, debut, fin, new Date("2026-12-31T00:00:00Z")), 999);
  assert.equal(montantRembourse(999, debut, fin, new Date("2027-02-15T00:00:00Z")), 0);
  assert.equal(montantRembourse(0, debut, fin, apres3jours), 0);
});

t("l'écran affiche « Renoncer au contrat ici » et appelle la route ; les CGV disent le même libellé", () => {
  const ecran = readFileSync("src/components/profile/ProfileSettings.tsx", "utf8");
  const libelles = [...ecran.matchAll(/"retr\.cta": "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(libelles.length, 5, "le libellé du bouton manque dans une langue");
  assert.equal(libelles[0], "Renoncer au contrat ici", "le libellé français imposé par le décret a changé");
  LANGUES.forEach((lg, i) => assert.ok(section(lg, "6").includes(libelles[i]),
    `${lg} : les CGV ne nomment pas le bouton tel que l'écran l'affiche (« ${libelles[i]} »)`));
  const src = code("src/components/profile/ProfileSettings.tsx");
  assert.match(src, /fetch\("\/api\/stripe\/retractation"/, "aucun écran n'appelle la route de rétractation");
  assert.match(src, /tr\("retr\.cta"\)/, "le bouton n'est pas rendu");
});

t("la route enregistre la demande AVANT Stripe, ne rembourse qu'une fois, et envoie l'accusé quoi qu'il arrive", () => {
  const src = code("src/app/api/stripe/retractation/route.ts");
  const trace = src.indexOf("type: TYPE_RETRACTATION"), rembourse = src.indexOf("refunds.create"), accuse = src.indexOf('envoyerEmail("retractation"');
  assert.ok(trace > 0 && rembourse > trace, "la trace doit être écrite avant le remboursement");
  assert.ok(accuse > rembourse, "l'accusé doit partir après la tentative Stripe, pas à sa place");
  assert.match(src, /idempotencyKey: `retractation-\$\{subId\}`/, "un second clic pourrait rembourser deux fois");
  assert.match(src, /confirmation !== true/, "l'étape de confirmation n'est pas exigée");
  assert.match(src, /fenetreRetractation\(/, "la route ne vérifie pas le délai avec la même fonction que l'écran");
});

t("l'accusé de réception dit la date, le contrat, le remboursement, et n'injecte pas le nom saisi", () => {
  const m = emailAccuseRetractation({
    lang: "fr", nom: "<script>alert(1)</script>", email: "a@b.fr",
    recueLe: new Date("2027-01-05T09:30:00Z"), souscritLe: new Date("2027-01-01T10:00:00Z"),
    formule: "starter", rembourseCentimes: 899,
  });
  assert.match(m.texte, /5 janvier 2027/);
  assert.match(m.texte, /Starter/);
  assert.match(m.texte, /8,99\s€/u);
  assert.doesNotMatch(m.html, /<script>/, "le nom saisi est écrit tel quel dans le HTML");
  assert.match(emailAccuseRetractation({ lang: "en", nom: "Al", email: "a@b.fr", recueLe: new Date(), souscritLe: null, formule: "premium", rembourseCentimes: 0 }).texte,
    /nothing to refund/);
});

// ── 3. LE RAPPEL AVANT RECONDUCTION ─────────────────────────────────────────────
t("seul un abonnement ANNUEL actif est annoncé, entre J-60 et J-35", () => {
  const annuel = (periodeFin: string, autre: Partial<EtatAbonnement> = {}): EtatAbonnement =>
    ({ statut: "active", periodeFin, annuleALaFin: false, echecPaiement: false, intervalle: "an", souscritLe: null, ...autre });
  const ajd = "2027-11-01";
  assert.equal(doitRappelerReconduction(annuel("2027-12-31"), ajd), true);  // J-60
  assert.equal(doitRappelerReconduction(annuel("2028-01-01"), ajd), false); // J-61 : trop tôt
  assert.equal(doitRappelerReconduction(annuel("2027-12-06"), ajd), true);  // J-35
  assert.equal(doitRappelerReconduction(annuel("2027-12-05"), ajd), false); // J-34 : trop tard
  assert.equal(doitRappelerReconduction(annuel("2027-12-15", { intervalle: "mois" }), ajd), false);
  assert.equal(doitRappelerReconduction(annuel("2027-12-15", { annuleALaFin: true }), ajd), false);
  assert.equal(doitRappelerReconduction(annuel("2027-12-15", { statut: "trialing" }), ajd), false);
  assert.equal(doitRappelerReconduction(null, ajd), false);
});

t("le rappel dit la date, le prix plein, le lien pour résilier et l'article de loi", () => {
  const m = emailRappelReconduction({ lang: "fr", formule: "premium", montantCentimes: 14990, echeance: "2028-01-01", lien: "https://pacevo.fr/dashboard/profile?onglet=abonnement" });
  assert.match(m.objet, /1 janvier 2028|1er janvier 2028/);
  assert.match(m.texte, /149,90\s€/u);
  assert.match(m.texte, /onglet=abonnement/);
  assert.match(m.texte, /L215-1/);
});

t("le rappel part de la tâche quotidienne, et l'état d'abonnement garde la souscription et la périodicité", () => {
  assert.match(code("src/app/api/cron/sync-all/route.ts"), /envoyerRappelsReconduction\(admin\)/, "aucune tâche n'envoie le rappel");
  const hook = code("src/app/api/stripe/webhook/route.ts");
  assert.match(hook, /souscritLe: souscriptionDe\(sub\)/, "le webhook ne mémorise pas la date de souscription");
  assert.match(hook, /intervalle: intervalleDe\(sub\)/, "le webhook ne mémorise pas la périodicité");
  const lu = litEtatAbo({ statut: "active", periodeFin: "2028-01-01", souscritLe: "2027-01-01T10:00:00.000Z", intervalle: "an" });
  assert.equal(lu?.souscritLe, "2027-01-01T10:00:00.000Z");
  assert.equal(lu?.intervalle, "an");
  const douteux = litEtatAbo({ statut: "active", souscritLe: "hier", intervalle: "semaine" });
  assert.equal(douteux?.souscritLe, null);
  assert.equal(douteux?.intervalle, null);
});

t("les CGV annoncent le rappel annuel et préservent la garantie légale de conformité", () => {
  assert.match(section("fr", "5"), /entre un et trois mois avant l'échéance/);
  assert.match(section("fr", "9"), /garantie légale de conformité/);
  for (const lg of LANGUES) assert.ok(section(lg, "6").length > 600, `${lg} : la section 6 n'a pas le formulaire type de rétractation`);
});

console.log(`consommation : ${ok} réussi(s), ${ko} échec(s)`);
if (ko) process.exit(1);
