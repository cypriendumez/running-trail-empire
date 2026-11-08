/**
 * SAUVEGARDE PRIVÉE DE TOUTE LA BASE (données des coureurs comprises), CHIFFRÉE, SUR LE MAC.
 *
 *   npm run sauvegarde:privee -- --initialiser  → crée la clé dans le Trousseau (une seule fois)
 *   npm run sauvegarde:privee                   → exporte, chiffre, écrit, puis RELIT l'archive
 *   npm run sauvegarde:privee -- --verifie      → déchiffre la dernière archive et recompte tout
 *
 * Destination : ~/Desktop/Pacevo/sauvegardes/ (ou SAUVEGARDE_PRIVEE_DIR), JAMAIS le dépôt.
 * Clé : Trousseau macOS, service « pacevo-sauvegarde », compte « cle ». Sans elle, les
 * archives sont illisibles : Cyprien en garde une copie dans son gestionnaire de mots de passe.
 *
 * ⚠️ Ce que l'archive ne contient PAS : les mots de passe des comptes (Supabase ne les
 * exporte pas). Après une restauration, les coureurs réinitialisent leur mot de passe.
 * Voir `src/lib/sauvegarde/privee.ts` pour les règles et `tests/sauvegarde-privee.test.ts`.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  chiffrer, dechiffrer, dossierAutorise, verifierArchive, nomArchive, archivesASupprimer,
  empreinte, EXTENSION, type ArchivePrivee,
} from "../src/lib/sauvegarde/privee";

const RACINE = path.resolve(__dirname, "..");
const DOSSIER = process.env.SAUVEGARDE_PRIVEE_DIR ?? path.join(os.homedir(), "Desktop", "Pacevo", "sauvegardes");
const SERVICE = "pacevo-sauvegarde";
const PAS = 1000;

function echec(message: string): never {
  console.log(`ÉCHEC : ${message}`);
  process.exit(1);
}

if (!dossierAutorise(DOSSIER, RACINE)) {
  echec(`la destination ${DOSSIER} est dans le dépôt (public) : refusé.`);
}

function lireCle(): string | null {
  try {
    return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", "cle", "-w"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return null; }
}

function initialiser(): void {
  if (lireCle()) { console.log("La clé existe déjà dans le Trousseau : rien à faire."); return; }
  const cle = crypto.randomBytes(32).toString("hex");
  execFileSync("security", ["add-generic-password", "-s", SERVICE, "-a", "cle", "-w", cle, "-U"], { stdio: "ignore" });
  if (lireCle() !== cle) echec("la clé n'a pas pu être relue dans le Trousseau.");
  console.log(`Clé créée dans le Trousseau (service « ${SERVICE} », compte « cle »). Elle n'est pas affichée.`);
}

function chargerEnv(): void {
  const f = path.join(RACINE, ".env.local");
  if (fs.existsSync(f)) {
    for (const l of fs.readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^"|"$/g, "");
    }
  }
  const manquantes = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((v) => !String(process.env[v] ?? "").trim());
  if (manquantes.length) echec(`variable(s) absente(s) : ${manquantes.join(", ")}.`);
}

/** Les tables exposées par PostgREST, avec leur clé primaire (lue dans sa description OpenAPI). */
async function listerTables(): Promise<{ nom: string; cle: string[] }[]> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(url, { headers: { apikey: k, Authorization: `Bearer ${k}`, Accept: "application/openapi+json" } });
  if (!r.ok) echec(`liste des tables illisible (HTTP ${r.status}).`);
  const doc = await r.json() as { definitions?: Record<string, { properties?: Record<string, { description?: string }> }> };
  return Object.entries(doc.definitions ?? {}).map(([nom, def]) => ({
    nom,
    cle: Object.entries(def.properties ?? {}).filter(([, p]) => String(p.description ?? "").includes("<pk/>")).map(([c]) => c),
  })).sort((a, b) => a.nom.localeCompare(b.nom));
}

async function exporter(): Promise<void> {
  const cle = lireCle();
  if (!cle) echec(`aucune clé dans le Trousseau (service « ${SERVICE} »). Lancer d'abord : npm run sauvegarde:privee -- --initialiser`);
  chargerEnv();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const archive: ArchivePrivee = { manifeste: { faite: new Date().toISOString(), lignes: {}, empreintes: {} }, tables: {} };
  const ignorees: string[] = [];

  for (const t of await listerTables()) {
    const { count, error: eCompte } = await sb.from(t.nom).select("*", { count: "exact", head: true });
    if (eCompte) echec(`${t.nom} : ${eCompte.message}`);
    // ⚠️ PAGINER SANS ORDRE STABLE SAUTE OU DOUBLE DES LIGNES. Sans clé primaire, on ne
    // prend la table que si elle tient en une page ; sinon on le DIT (vue volumineuse).
    if (!t.cle.length && (count ?? 0) > PAS) { ignorees.push(`${t.nom} (${count} lignes, pas de clé primaire : vue ?)`); continue; }
    const lignes: unknown[] = [];
    for (let debut = 0; debut < 1_000_000; debut += PAS) {
      let q = sb.from(t.nom).select("*");
      for (const c of t.cle) q = q.order(c, { ascending: true });
      const { data, error } = await q.range(debut, debut + PAS - 1);
      if (error) echec(`${t.nom} : ${error.message}`);
      lignes.push(...(data ?? []));
      if ((data ?? []).length < PAS) break;
    }
    // ⚠️ ON COMPARE AU COMPTE RÉEL : le plafond de 1 000 lignes de PostgREST coupe sans erreur.
    if (count != null && lignes.length !== count) echec(`${t.nom} : ${lignes.length} ligne(s) exportée(s) pour ${count} en base.`);
    archive.tables[t.nom] = lignes;
  }

  // Les comptes (adresses, dates, métadonnées). Les mots de passe ne sont pas exportables.
  const comptes: unknown[] = [];
  for (let page = 1; page < 1000; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PAS });
    if (error) echec(`comptes : ${error.message}`);
    comptes.push(...data.users);
    if (data.users.length < PAS) break;
  }
  archive.tables["auth.users"] = comptes;

  for (const [nom, lignes] of Object.entries(archive.tables)) {
    archive.manifeste.lignes[nom] = lignes.length;
    archive.manifeste.empreintes[nom] = empreinte(JSON.stringify(lignes));
  }

  fs.mkdirSync(DOSSIER, { recursive: true });
  const cible = path.join(DOSSIER, nomArchive(new Date()));
  const temp = `${cible}.partiel`;
  fs.writeFileSync(temp, chiffrer(archive, cle), { mode: 0o600 });
  fs.renameSync(temp, cible);

  // ⚠️ UNE SAUVEGARDE QU'ON NE SAIT PAS RELIRE N'EN EST PAS UNE : on relit le fichier écrit.
  const relue = verifierArchive(dechiffrer(fs.readFileSync(cible), cle));
  if (!relue.ok) echec(`archive écrite mais inexploitable : ${relue.problemes.join(" ; ")}`);

  for (const vieille of archivesASupprimer(fs.readdirSync(DOSSIER))) fs.rmSync(path.join(DOSSIER, vieille));

  const total = Object.values(archive.manifeste.lignes).reduce((a, b) => a + b, 0);
  console.log(`archive VALIDE : ${path.basename(cible)} · ${Object.keys(archive.tables).length} tables · ${total} lignes · ${(fs.statSync(cible).size / 1024 / 1024).toFixed(1)} Mo chiffrés`);
  console.log(`comptes : ${comptes.length} · dossier : ${DOSSIER}`);
  if (ignorees.length) console.log(`non sauvegardées : ${ignorees.join(", ")}`);
}

function verifier(): void {
  const cle = lireCle();
  if (!cle) echec(`aucune clé dans le Trousseau (service « ${SERVICE} »).`);
  const archives = fs.existsSync(DOSSIER) ? fs.readdirSync(DOSSIER).filter((n) => n.endsWith(EXTENSION)).sort() : [];
  if (!archives.length) echec(`aucune archive dans ${DOSSIER}.`);
  const derniere = archives[archives.length - 1];
  const a = dechiffrer(fs.readFileSync(path.join(DOSSIER, derniere)), cle);
  const { ok, problemes } = verifierArchive(a);
  if (!ok) echec(`${derniere} inexploitable : ${problemes.join(" ; ")}`);
  const total = Object.values(a.manifeste.lignes).reduce((x, y) => x + y, 0);
  console.log(`${derniere} VALIDE : ${Object.keys(a.tables).length} tables, ${total} lignes, export du ${a.manifeste.faite.slice(0, 16)} · ${archives.length} archive(s) gardée(s)`);
}

if (process.argv.includes("--initialiser")) initialiser();
else if (process.argv.includes("--verifie")) verifier();
else exporter().catch((e) => echec(e instanceof Error ? e.message : String(e)));
