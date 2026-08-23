/**
 * LES PIÈCES JUSTIFICATIVES — règles pures, testables sans réseau.
 *
 * ⚠️ CES FICHIERS SONT DES FACTURES : nom du client, adresse, montant. Le projet possède
 * déjà deux seaux de stockage — `avatars` et `message-attachments` — et LES DEUX SONT
 * PUBLICS : n'importe qui connaissant l'adresse y lit le contenu. Y déposer des factures
 * publierait les données personnelles de clients payants.
 *
 * D'où un seau dédié, PRIVÉ, et une vérification à l'exécution : si le seau devient
 * public un jour, on REFUSE d'écrire dedans plutôt que de continuer en silence.
 */

export const BUCKET = "justificatifs";
export const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo — une facture, pas une vidéo.

/** Une facture est un PDF ou une photo. Rien d'exécutable, jamais. */
export const TYPES_OK: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Motifs de refus. Vide = le fichier est acceptable. */
export function validerFichier(type: string, taille: number): string[] {
  const err: string[] = [];
  if (!TYPES_OK[type]) err.push(`Format non accepté (${type || "inconnu"}) : PDF ou photo uniquement.`);
  if (!Number.isFinite(taille) || taille <= 0) err.push("Fichier vide.");
  else if (taille > TAILLE_MAX) err.push(`Fichier trop lourd (${Math.round(taille / 1024 / 1024)} Mo, maximum ${TAILLE_MAX / 1024 / 1024} Mo).`);
  return err;
}

/**
 * Le chemin de rangement.
 *
 * ⚠️ LE NOM D'ORIGINE N'EST JAMAIS REPRIS. « ../../avatars/moi.png » remonterait d'un
 * dossier, et « facture client.pdf » suffirait à écraser la pièce d'une autre écriture
 * portant le même nom. On range sous un identifiant tiré au sort, avec la seule
 * extension déduite du TYPE DÉCLARÉ — pas du nom du fichier, qui ment facilement.
 */
export function cheminDe(editeurId: string, type: string, alea: string): string {
  const ext = TYPES_OK[type] ?? "bin";
  const an = new Date().getUTCFullYear();
  return `${editeurId}/${an}/${alea.replace(/[^a-zA-Z0-9-]/g, "")}.${ext}`;
}

/**
 * ⚠️ Un chemin reçu du navigateur ne se croit pas. Sans ce contrôle, un appelant
 * authentifié pourrait demander une URL signée pour n'importe quel objet du seau en
 * fabriquant le chemin — et `..` permettrait d'en sortir.
 */
export function cheminAppartientA(chemin: string, editeurId: string): boolean {
  if (!chemin || chemin.includes("..") || chemin.startsWith("/")) return false;
  return chemin.startsWith(`${editeurId}/`);
}
