/**
 * SAUVEGARDE PRIVÉE — les données des coureurs, chiffrées, hors du dépôt public.
 *
 * Au 08/11/2026, Supabase était sur l'offre gratuite (aucune sauvegarde automatique) et
 * la seule sauvegarde existante ne couvrait que les tables publiques. Ces tests figent les
 * trois règles de `src/lib/sauvegarde/privee.ts` : jamais dans le dépôt, toujours chiffrée,
 * toujours relisible.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  chiffrer, dechiffrer, dossierAutorise, verifierArchive, nomArchive, archivesASupprimer,
  empreinte, MAGIE, RETENTION, type ArchivePrivee,
} from "../src/lib/sauvegarde/privee";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

const CLE = crypto.randomBytes(32).toString("hex");
const AUTRE_CLE = crypto.randomBytes(32).toString("hex");

function archive(): ArchivePrivee {
  const tables: Record<string, unknown[]> = {
    profiles: [{ id: "a", full_name: "Coureuse Test", vma: 15.2 }, { id: "b", full_name: "Coureur Test", vma: null }],
    workouts: [{ id: 1, distance_km: 10.4 }],
  };
  const lignes: Record<string, number> = {}; const empreintes: Record<string, string> = {};
  for (const [t, l] of Object.entries(tables)) { lignes[t] = l.length; empreintes[t] = empreinte(JSON.stringify(l)); }
  return { manifeste: { faite: "2026-11-08T12:00:00.000Z", lignes, empreintes }, tables };
}

console.log("\nSAUVEGARDE PRIVÉE");

test("l'archive chiffrée ne contient aucune donnée lisible", () => {
  const f = chiffrer(archive(), CLE);
  assert.ok(f.subarray(0, MAGIE.length).equals(MAGIE), "en-tête absent");
  const brut = f.toString("latin1");
  for (const mot of ["Coureuse", "full_name", "profiles", "vma"]) {
    assert.ok(!brut.includes(mot), `« ${mot} » apparaît en clair dans l'archive`);
  }
});

test("chiffrer puis déchiffrer rend exactement l'archive", () => {
  assert.deepEqual(dechiffrer(chiffrer(archive(), CLE), CLE), archive());
});

test("deux exports identiques ne produisent pas le même fichier (iv aléatoire)", () => {
  assert.ok(!chiffrer(archive(), CLE).equals(chiffrer(archive(), CLE)));
});

test("une mauvaise clé est refusée, pas déchiffrée en charabia", () => {
  assert.throws(() => dechiffrer(chiffrer(archive(), CLE), AUTRE_CLE));
});

test("un seul octet modifié rend l'archive illisible (intégrité GCM)", () => {
  const f = chiffrer(archive(), CLE);
  f[f.length - 1] ^= 0x01;
  assert.throws(() => dechiffrer(f, CLE));
});

test("une clé mal formée est refusée avant tout chiffrement", () => {
  assert.throws(() => chiffrer(archive(), "abc"));
  assert.throws(() => chiffrer(archive(), ""));
});

test("un fichier qui n'est pas une archive Pacevo est refusé", () => {
  assert.throws(() => dechiffrer(Buffer.from("{\"tables\":{}}"), CLE), /pas une archive/);
});

test("JAMAIS dans le dépôt : toute destination sous la racine est refusée", () => {
  const depot = "/Users/x/Desktop/running-trail-empire";
  assert.equal(dossierAutorise(depot, depot), false);
  assert.equal(dossierAutorise(path.join(depot, ".sauvegardes"), depot), false);
  assert.equal(dossierAutorise(path.join(depot, "ops", "compta"), depot), false);
  assert.equal(dossierAutorise(`${depot}/a/../b`, depot), false);
  assert.equal(dossierAutorise("/Users/x/Desktop/Pacevo/sauvegardes", depot), true);
  // Un dossier voisin dont le nom COMMENCE comme le dépôt n'est pas le dépôt.
  assert.equal(dossierAutorise(`${depot}-sauvegardes`, depot), true);
});

test("la destination par défaut du script est hors du dépôt", () => {
  const src = readFileSync("scripts/sauvegarde-privee.ts", "utf8");
  assert.ok(src.includes(`path.join(os.homedir(), "Desktop", "Pacevo", "sauvegardes")`), "destination par défaut modifiée");
  assert.ok(dossierAutorise(path.join(os.homedir(), "Desktop", "Pacevo", "sauvegardes"), process.cwd()));
  assert.ok(/if \(!dossierAutorise\(DOSSIER, RACINE\)\)/.test(src), "le script ne contrôle plus sa destination");
});

test("le script relit et vérifie l'archive qu'il vient d'écrire", () => {
  const src = readFileSync("scripts/sauvegarde-privee.ts", "utf8");
  assert.ok(/verifierArchive\(dechiffrer\(fs\.readFileSync\(cible\)/.test(src), "plus de relecture après écriture");
});

test("une archive complète est validée", () => {
  assert.deepEqual(verifierArchive(archive()), { ok: true, problemes: [] });
});

test("une table amputée est détectée", () => {
  const a = archive(); a.tables.profiles = a.tables.profiles.slice(0, 1);
  const r = verifierArchive(a);
  assert.equal(r.ok, false);
  assert.ok(r.problemes.some((p) => p.startsWith("profiles")), r.problemes.join(" ; "));
});

test("sans empreinte, le seul compte de lignes suffit à détecter l'amputation", () => {
  // Une archive d'un ancien format, ou dont l'empreinte manque : le compte reste le garde-fou.
  const a = archive(); a.manifeste.empreintes = {}; a.tables.profiles = a.tables.profiles.slice(0, 1);
  assert.equal(verifierArchive(a).ok, false);
});

test("une table modifiée à nombre de lignes égal est détectée (empreinte)", () => {
  const a = archive(); a.tables.workouts = [{ id: 1, distance_km: 99 }];
  assert.equal(verifierArchive(a).ok, false);
});

test("une table annoncée mais absente est détectée", () => {
  const a = archive(); delete a.tables.workouts;
  assert.equal(verifierArchive(a).ok, false);
});

test("une archive vide n'est jamais déclarée valide", () => {
  assert.equal(verifierArchive(null).ok, false);
  assert.equal(verifierArchive({ manifeste: { faite: "2026-11-08", lignes: {}, empreintes: {} }, tables: {} }).ok, false);
});

test(`on garde les ${RETENTION} archives les plus récentes, et seulement des archives`, () => {
  const noms = Array.from({ length: 11 }, (_, i) => nomArchive(new Date(Date.UTC(2026, 10, 1 + i * 7))));
  const aSupprimer = archivesASupprimer([...noms, "notes.txt", "pacevo-2026-11-01.pacevo-sauvegarde.partiel"]);
  assert.deepEqual(aSupprimer, noms.slice(0, 3));
  assert.deepEqual(archivesASupprimer(noms.slice(0, 5)), []);
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
