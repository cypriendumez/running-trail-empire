/**
 * MESSAGERIE ENTRE ATHLÈTES — qui a le droit d'écrire à qui.
 *
 * ⚠️ SUIVRE QUELQU'UN N'EST PAS ÊTRE SON AMI. `follows` est un lien à SENS UNIQUE, posé
 * directement en « accepted » (vérifié dans `api/social/follow`) : personne n'accepte
 * rien. Autoriser à écrire à quiconque on suit ouvrirait une boîte de réception à
 * n'importe qui — il suffirait de suivre un athlète pour lui écrire.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { amisMutuels, peutEcrire, type Lien } from "../src/lib/social/amis";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const L: Lien[] = [
  { follower_id: "moi", following_id: "alice" },
  { follower_id: "alice", following_id: "moi" },   // réciproque
  { follower_id: "moi", following_id: "bob" },     // je le suis, il ne me suit pas
  { follower_id: "charlie", following_id: "moi" }, // il me suit, je ne le suis pas
];

test("le suivi à sens unique ne donne PAS le droit d'écrire", () => {
  assert.deepEqual(amisMutuels("moi", L), ["alice"]);
  assert.equal(peutEcrire("moi", "alice", L), true, "un suivi réciproque devrait autoriser l'échange");
  // ⚠️ LES DEUX CAS QUI COMPTENT.
  assert.equal(peutEcrire("moi", "bob", L), false, "suivre quelqu'un suffirait à lui écrire");
  assert.equal(peutEcrire("moi", "charlie", L), false, "être suivi suffirait à recevoir");
});

test("on ne s'écrit pas à soi-même, ni à personne", () => {
  assert.equal(peutEcrire("moi", "moi", L), false);
  for (const vide of ["", "   "]) {
    assert.equal(peutEcrire("moi", vide, L), false, `« ${vide} » est accepté comme destinataire`);
    assert.equal(peutEcrire(vide, "alice", L), false);
  }
  assert.deepEqual(amisMutuels("", L), []);
  // ⚠️ UN LIEN VERS SOI-MÊME NE FAIT PAS UN AMI. La base porte une contrainte, mais une
  // ligne héritée ne doit pas ouvrir une conversation avec son propre reflet.
  assert.deepEqual(amisMutuels("solo", [{ follower_id: "solo", following_id: "solo" }]), []);
});

test("des liens abîmés ne créent pas d'amitié", () => {
  const sales = [
    { follower_id: "", following_id: "moi" },
    { follower_id: "moi", following_id: "" },
    null, undefined, {},
  ] as unknown as Lien[];
  assert.deepEqual(amisMutuels("moi", sales), []);
  assert.equal(peutEcrire("moi", "alice", sales), false);
});

test("le droit d'écrire est vérifié À L'ENVOI, pas seulement à l'affichage", () => {
  // ⚠️ MASQUER UN DESTINATAIRE DANS UNE LISTE N'EMPÊCHE PERSONNE d'appeler la route à la
  // main avec l'identifiant de son choix. C'est le serveur qui doit refuser.
  const src = readFileSync("src/app/api/messages/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/peutEcrire\(user\.id, destinataire,/.test(src), "la route n'applique plus la règle d'amitié");
  const i = src.indexOf("peutEcrire(user.id, destinataire,");
  assert.ok(/status: 403/.test(src.slice(i, i + 400)), "un envoi non autorisé n'est pas refusé");
  // L'ordre compte : la vérification doit précéder l'écriture.
  assert.ok(i < src.indexOf("athlete_message"), "le message est écrit avant d'être autorisé");
});

test("un refus ne révèle pas qui est inscrit", () => {
  // Répondre « athlète inconnu » d'un côté et « pas ami » de l'autre laisserait deviner
  // qui possède un compte : le même message dans les deux cas.
  // ⚠️ RETIRER LES COMMENTAIRES. Premier jet : ce test rougissait sur les mots
  // « athlète inconnu » écrits dans le COMMENTAIRE qui explique justement qu'on ne les
  // emploie pas. Un test qui lit la documentation valide la documentation.
  const src = readFileSync("src/app/api/messages/route.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
  assert.ok(/Vous ne pouvez pas écrire à cet athlète\./.test(src), "le message de refus a changé");
  assert.ok(!/athlète inconnu|introuvable/i.test(src), "un refus distingue le cas « compte inexistant »");
});

test("la liste de contacts ne transporte aucun secret de profil", () => {
  // ⚠️ UNE FUITE DE CE GENRE A DÉJÀ EU LIEU sur ce projet : la clé de montre partait au
  // client. Une liste de contacts n'a besoin que d'un nom et d'un identifiant.
  const src = readFileSync("src/app/api/social/amis/route.ts", "utf8");
  assert.ok(/stripProfileSecrets/.test(src), "les profils partent sans être nettoyés");
  assert.ok(/select\("id, full_name, avatar_url"\)/.test(src),
    "la requête demande plus que le nom et l'avatar");
  assert.ok(!/intervals|email/i.test(src), "un champ sensible est nommé dans la route");
});

test("les messages reçus alimentent la boîte ET la pastille", () => {
  const page = readFileSync("src/app/dashboard/messages/page.tsx", "utf8");
  assert.ok(/"athlete_message", "athlete_message_sent"/.test(page),
    "les messages entre athlètes n'apparaissent pas dans la boîte");
  const layout = readFileSync("src/app/dashboard/layout.tsx", "utf8");
  assert.ok(/in\("type", \["coach_message", "athlete_message"\]\)[\s\S]{0,40}read", false\)/.test(layout),
    "un message d'athlète n'allume pas la pastille : on ne le verrait pas arriver");
});

test("l'écran dit à QUI on écrit, et ne cache pas l'absence d'amis", () => {
  const src = readFileSync("src/components/messages/MessageThread.tsx", "utf8");
  // ⚠️ SANS DESTINATAIRE AFFICHÉ, on choisit un ami à gauche puis on écrit en croyant
  // s'adresser au coach — et le message part chez quelqu'un d'autre.
  assert.ok(/amis\.find\(\(a\) => a\.id === aQui\)\?\.nom/.test(src),
    "l'en-tête de rédaction n'affiche pas le destinataire choisi");
  assert.ok(/to: aQui \|\| undefined/.test(src), "le destinataire n'est pas transmis à la route");
  // Une liste vide doit EXPLIQUER pourquoi, pas laisser un blanc.
  assert.ok(/amisVides/.test(src), "aucune explication quand la liste d'amis est vide");
  for (const lg of ["fr", "en", "de", "es", "pt"]) {
    const bloc = src.slice(src.indexOf(`  ${lg}: {`), src.indexOf(`  ${lg}: {`) + 1400);
    assert.ok(/"amisVides": "[^"]{40,}"/.test(bloc), `l'explication manque ou est trop courte en ${lg}`);
  }
  // ⚠️ ET UNE PANNE DE CETTE LISTE NE DOIT PAS EMPORTER LA MESSAGERIE DU COACH.
  const i = src.indexOf("/api/social/amis");
  assert.ok(/\.catch\(/.test(src.slice(i, i + 400)),
    "un échec de la liste d'amis ferait tomber la messagerie entière");
});

console.log(`\n${passed} test(s) de messagerie passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
