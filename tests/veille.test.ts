/**
 * LA VEILLE PENDANT UNE COURSE — partage de position au départ, détection de choc.
 *
 * Demandé par Cyprien le 22/09/2026, après avoir retiré de l'onglet Sécurité quatre
 * fonctions qui n'existaient pas. Ce qui est construit ici EXISTE vraiment, et ce
 * fichier tient la frontière entre les deux :
 *
 *  · la détection ne couvre qu'une séance ÉCRAN ALLUMÉ, au premier plan (iOS gèle le
 *    JavaScript au verrouillage) — l'interface doit le dire ;
 *  · Pacevo n'appelle et n'écrit à personne tout seul : il prépare le message, la
 *    personne l'envoie d'un geste ;
 *  · un choc ne déclenche jamais d'alerte à lui seul : il faut une immobilité, puis un
 *    compte à rebours sans réponse.
 *
 *   npx tsx tests/veille.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyser, avancer, intensite, idPartage, lienSuivi, lienSms, messageAlerte, messageDepart, CHOC_G, IMMOBILE_MS, type EtatVeille, type Mesure } from "../src/lib/courses/veille";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log("  OK " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Une séquence de mesures à 20 Hz, à partir d'un générateur d'intensité. */
function sequence(secondes: number, g: (t: number) => number, t0 = 0): Mesure[] {
  const out: Mesure[] = [];
  for (let i = 0; i < secondes * 20; i++) { const t = t0 + i * 50; out.push({ g: g(t - t0), t }); }
  return out;
}
/** Une foulée de course : 1 g au repos, des pics à ~2 g à chaque appui. */
const foulee = (t: number) => 1 + 1.0 * Math.abs(Math.sin((t / 1000) * Math.PI * 2.8));

console.log("\n=== VEILLE PENDANT UNE COURSE ===\n");

test("courir n'alerte jamais, même pendant une heure", () => {
  // Une heure de foulée à 2,8 Hz : les pics montent à ~2 g, sous le seuil de 3,2 g.
  const etat = analyser(sequence(3600, foulee));
  assert.equal(etat.phase, "calme", "une course normale a déclenché la veille");
  // Même en tapant plus fort (descente, trail) tant qu'on reste sous le seuil.
  assert.equal(analyser(sequence(600, (t) => 1 + 2.0 * Math.abs(Math.sin(t / 300)))).phase, "calme");
});

test("un téléphone qui tombe mais qu'on ramasse ne déclenche rien", () => {
  // Choc à 6 g, puis 3 s au sol, puis on repart : l'immobilité est trop courte.
  const s = [
    ...sequence(20, foulee),
    { g: 6, t: 20_000 },
    ...sequence(3, () => 1.0, 20_050),
    ...sequence(30, foulee, 23_100),
  ];
  assert.equal(analyser(s).phase, "calme", "3 s au sol ont suffi à alerter");
});

test("un choc suivi d'une vraie immobilité passe en alerte — pas avant le délai", () => {
  const avantLeDelai = [...sequence(10, foulee), { g: 5.5, t: 10_000 }, ...sequence((IMMOBILE_MS - 1500) / 1000, () => 1.0, 10_050)];
  assert.equal(analyser(avantLeDelai).phase, "choc", "l'alerte est partie avant la fin du délai d'immobilité");
  const apres = [...avantLeDelai, ...sequence(3, () => 1.0, 10_050 + IMMOBILE_MS)];
  assert.equal(analyser(apres).phase, "alerte", `pas d'alerte après ${IMMOBILE_MS / 1000} s d'immobilité suivant un choc`);
});

test("l'état d'alerte ne se dénoue que par l'interface, jamais par un mouvement", () => {
  const enAlerte: EtatVeille = { phase: "alerte", depuis: 0, g: 6 };
  assert.deepEqual(avancer(enAlerte, { g: 2.5, t: 60_000 }), enAlerte, "bouger a annulé l'alerte toute seule");
  assert.deepEqual(avancer(enAlerte, { g: 1, t: 999_999 }), enAlerte);
});

test("le seuil de choc est franc, et l'intensité se lit en g", () => {
  assert.ok(CHOC_G >= 3 && CHOC_G <= 5, "le seuil de choc a quitté la plage raisonnable");
  // Au repos, l'accéléromètre lit la gravité : 9,81 m/s² sur un axe = 1 g.
  assert.ok(Math.abs(intensite({ x: 0, y: 0, z: 9.80665 }) - 1) < 0.001);
  assert.ok(Math.abs(intensite({ x: 0, y: 0, z: 39.2266 }) - 4) < 0.01);
  // Entrées absentes ou absurdes : on rend 1 g (le repos), jamais NaN — sinon la
  // comparaison au seuil serait toujours fausse et la veille silencieuse pour toujours.
  for (const junk of [null, undefined, {}, { x: NaN, y: 0, z: 0 }, { x: "a" as unknown as number }]) {
    const v = intensite(junk as never);
    assert.ok(Number.isFinite(v), `intensité non finie pour ${JSON.stringify(junk)}`);
  }
});

test("l'identifiant de partage est imprévisible et ne dit rien de l'athlète", () => {
  const vus = new Set<string>();
  for (let i = 0; i < 500; i++) vus.add(idPartage());
  assert.equal(vus.size, 500, "deux identifiants de partage identiques en 500 tirages");
  for (const id of [...vus].slice(0, 20)) assert.match(id, /^[a-z0-9]{9}$/, `identifiant mal formé : ${id}`);
  // Sans crypto (vieux navigateur), on tire quand même quelque chose d'aléatoire.
  assert.match(idPartage(null), /^[a-z0-9]{9}$/);
  assert.notEqual(idPartage(null), idPartage(null));
});

test("les messages disent qui, où, et quoi faire — et ne dépassent pas un SMS raisonnable", () => {
  const T = { alerte: "{nom} n'a pas répondu après un choc détecté pendant sa course.", position: "Position :", suivi: "Suivi :", secours: "Si tu n'arrives pas à le joindre, appelle le 112." };
  const m = messageAlerte("Cyprien", "https://pacevo.fr/suivre/abc123xyz", { lat: 48.8566, lng: 2.3522 }, T);
  assert.match(m, /Cyprien/);
  assert.match(m, /maps\?q=48\.85660,2\.35220/, "la position n'est pas exploitable par le proche");
  assert.match(m, /112/, "le message n'indique pas les secours");
  assert.match(m, /suivre\/abc123xyz/);
  // Sans position ni lien : le message reste utile, sans ligne vide ni « undefined ».
  const nu = messageAlerte(null, null, null, T);
  assert.ok(!/undefined|null/.test(nu), `« ${nu} »`);
  // ⚠️ NI LIGNE VIDE : `[a, null, b].join("\n")` rend « a\n\nb ». Le proche reçoit un
  // message troué, qui a l'air cassé — et un SMS cassé, on le croit moins.
  assert.ok(!nu.split("\n").some((l) => l.trim() === ""), `ligne vide dans le message : ${JSON.stringify(nu)}`);
  assert.match(nu, /112/);
  const dep = messageDepart("Cyprien", "https://pacevo.fr/suivre/abc123xyz", { depart: "{nom} part courir.", suivi: "Suivi :" });
  assert.match(dep, /Cyprien part courir/);
  assert.ok(dep.length < 300, "le message de départ est trop long pour un SMS");
});

test("le lien SMS est correctement échappé, et le numéro nettoyé", () => {
  const l = lienSms("+33 6 12 34 56 78", "Ligne 1\nLigne 2 & suite");
  assert.match(l, /^sms:\+33612345678\?&body=/, `numéro non nettoyé : ${l.slice(0, 40)}`);
  assert.ok(!/\n/.test(l), "le corps du SMS contient un saut de ligne brut");
  assert.match(l, /%0A/, "le saut de ligne n'est pas encodé");
  assert.match(l, /%26/, "l'esperluette n'est pas encodée : le corps serait tronqué");
  // Un corps démesuré est coupé — certains téléphones refusent les liens trop longs.
  assert.ok(lienSms("0612345678", "x".repeat(5000)).length < 2000);
  assert.equal(lienSuivi("https://pacevo.fr/", "abc"), "https://pacevo.fr/suivre/abc");
});

test("l'écran « Enregistrer » partage la position au départ et surveille les chocs", () => {
  const src = codeNu("src/components/ghost-runner/GhostRunner.tsx");
  // Le partage utilise le MÊME protocole que la Carte : canal `run-<id>`, événement `pos`.
  assert.match(src, /\.channel\(`run-\$\{id\}`/, "le partage en direct n'utilise plus le canal `run-<id>` que la page de suivi écoute");
  assert.match(src, /event: "pos"/, "la position n'est plus diffusée aux proches");
  assert.match(src, /idPartage\(\)/, "l'identifiant de partage n'est plus tiré au hasard");
  // La détection de choc : permission demandée, écoute `devicemotion`, compte à rebours.
  assert.match(src, /requestPermission/, "la permission des capteurs n'est plus demandée (obligatoire sur iPhone)");
  assert.match(src, /addEventListener\("devicemotion"/, "l'accéléromètre n'est plus écouté");
  assert.match(src, /avancer\(/, "la machine d'état de la veille n'est plus utilisée");
  assert.match(src, /compteARebours|rebours/, "le compte à rebours « tu vas bien ? » a disparu");
  // L'écoute s'arrête avec la séance : un capteur laissé actif vide la batterie.
  assert.match(src, /removeEventListener\("devicemotion"/, "l'écoute de l'accéléromètre n'est jamais arrêtée");
  // Et l'honnêteté : l'écran dit ce que la veille NE couvre PAS.
  assert.match(src, /veille\.limite/, "l'écran ne dit plus que la veille s'arrête quand l'écran s'éteint");
});

test("les libellés de la veille existent dans les cinq langues", () => {
  const src = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
  for (const k of ["veille.titre", "veille.limite", "veille.active", "veille.choc", "veille.jeVaisBien", "veille.prevenir",
    "veille.partage", "veille.partageOk", "veille.partageCopie", "veille.sansContact", "veille.alerte", "veille.position",
    "veille.suivi", "veille.secours", "veille.depart", "veille.indispo"]) {
    const n = [...src.matchAll(new RegExp(`"${k.replace(/\./g, "\\.")}":`, "g"))].length;
    assert.equal(n, 5, `« ${k} » présent ${n} fois, attendu 5`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) process.exit(1);
