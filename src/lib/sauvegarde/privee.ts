/**
 * SAUVEGARDE PRIVÉE : LES DONNÉES DES COUREURS, CHIFFRÉES, HORS DU DÉPÔT.
 *
 * ⚠️ POURQUOI (08/11/2026). Le projet Supabase est sur l'offre gratuite : AUCUNE
 * sauvegarde automatique. La sauvegarde hebdomadaire existante (`tables.ts`) ne couvre
 * que les tables PUBLIQUES, parce qu'elle part chez GitHub et que le dépôt est public.
 * Profils, séances, journal, santé, messages : rien n'était sauvegardé nulle part.
 *
 * ⚠️ TROIS RÈGLES, CHACUNE TENUE PAR UN TEST (`tests/sauvegarde-privee.test.ts`) :
 *  1. L'archive n'est JAMAIS écrite dans le dépôt (`dossierAutorise`) : un `git add -A`
 *     distrait la publierait.
 *  2. Elle est CHIFFRÉE (AES-256-GCM, clé de 32 octets rangée dans le Trousseau du Mac) :
 *     le Bureau est synchronisé par iCloud, l'archive y part donc aussi.
 *  3. Une archive qu'on ne sait pas relire n'est pas une sauvegarde : le déchiffrement
 *     vérifie l'intégrité (étiquette GCM), puis chaque table est recomptée contre le
 *     manifeste (`verifierArchive`).
 */
import crypto from "node:crypto";
import path from "node:path";
import zlib from "node:zlib";

/** En-tête du fichier : reconnaître une archive (et sa version de format) avant de la déchiffrer. */
export const MAGIE = Buffer.from("PCVS1");
export const EXTENSION = ".pacevo-sauvegarde";
/** Nombre d'archives gardées : 8 semaines. */
export const RETENTION = 8;

export type ArchivePrivee = {
  manifeste: {
    faite: string;
    /** Par table : lignes RÉELLEMENT écrites. */
    lignes: Record<string, number>;
    /** Empreinte du contenu de chaque table, pour détecter une archive amputée. */
    empreintes: Record<string, string>;
  };
  tables: Record<string, unknown[]>;
};

export const empreinte = (contenu: string) =>
  crypto.createHash("sha256").update(contenu).digest("hex").slice(0, 32);

function cleValide(cleHex: string): Buffer {
  const cle = Buffer.from(String(cleHex ?? "").trim(), "hex");
  if (cle.length !== 32) throw new Error("clé de chiffrement invalide (64 caractères hexadécimaux attendus)");
  return cle;
}

/** Compresse puis chiffre. Format : MAGIE | iv (12) | étiquette (16) | données chiffrées. */
export function chiffrer(archive: ArchivePrivee, cleHex: string): Buffer {
  const cle = cleValide(cleHex);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cle, iv);
  const clair = zlib.gzipSync(Buffer.from(JSON.stringify(archive)));
  const chiffre = Buffer.concat([c.update(clair), c.final()]);
  return Buffer.concat([MAGIE, iv, c.getAuthTag(), chiffre]);
}

/**
 * Déchiffre et décompresse. Lève une erreur si le fichier n'est pas une archive Pacevo,
 * si la clé est fausse ou si un seul octet a été modifié (l'étiquette GCM le refuse).
 */
export function dechiffrer(fichier: Buffer, cleHex: string): ArchivePrivee {
  const cle = cleValide(cleHex);
  if (fichier.length < MAGIE.length + 28 || !fichier.subarray(0, MAGIE.length).equals(MAGIE)) {
    throw new Error("ce fichier n'est pas une archive Pacevo");
  }
  const iv = fichier.subarray(MAGIE.length, MAGIE.length + 12);
  const tag = fichier.subarray(MAGIE.length + 12, MAGIE.length + 28);
  const d = crypto.createDecipheriv("aes-256-gcm", cle, iv);
  d.setAuthTag(tag);
  const clair = Buffer.concat([d.update(fichier.subarray(MAGIE.length + 28)), d.final()]);
  return JSON.parse(zlib.gunzipSync(clair).toString("utf8")) as ArchivePrivee;
}

/**
 * Le dossier de destination est-il hors du dépôt ?
 * ⚠️ Comparaison sur des chemins RÉSOLUS : `./.sauvegardes`, `../repo/x` ou un chemin
 * relatif lancé depuis le dépôt doivent tous être refusés.
 */
export function dossierAutorise(dossier: string, racineDepot: string): boolean {
  const d = path.resolve(dossier);
  const r = path.resolve(racineDepot);
  return d !== r && !d.startsWith(r + path.sep);
}

/** Recompte chaque table de l'archive contre son manifeste. */
export function verifierArchive(a: Partial<ArchivePrivee> | null): { ok: boolean; problemes: string[] } {
  const problemes: string[] = [];
  if (!a || typeof a !== "object" || !a.manifeste || !a.tables) {
    return { ok: false, problemes: ["archive vide ou illisible"] };
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(a.manifeste.faite ?? ""))) problemes.push("date d'export absente");
  const annoncees = Object.keys(a.manifeste.lignes ?? {});
  if (annoncees.length === 0) problemes.push("aucune table annoncée");
  for (const t of annoncees) {
    const lignes = a.tables[t];
    if (!Array.isArray(lignes)) { problemes.push(`${t} : absente de l'archive`); continue; }
    if (lignes.length !== a.manifeste.lignes[t]) {
      problemes.push(`${t} : ${lignes.length} ligne(s) pour ${a.manifeste.lignes[t]} annoncée(s)`);
    }
    const attendue = a.manifeste.empreintes?.[t];
    if (attendue && attendue !== empreinte(JSON.stringify(lignes))) {
      problemes.push(`${t} : contenu différent de l'empreinte`);
    }
  }
  return { ok: problemes.length === 0, problemes };
}

/** Nom de l'archive du jour : trié par ordre alphabétique = trié par date. */
export function nomArchive(date: Date): string {
  return `pacevo-${date.toISOString().slice(0, 10)}${EXTENSION}`;
}

/** Les archives à supprimer pour n'en garder que `garder`, les plus récentes. */
export function archivesASupprimer(noms: string[], garder = RETENTION): string[] {
  const archives = noms.filter((n) => /^pacevo-\d{4}-\d{2}-\d{2}/.test(n) && n.endsWith(EXTENSION)).sort();
  return archives.slice(0, Math.max(0, archives.length - garder));
}
