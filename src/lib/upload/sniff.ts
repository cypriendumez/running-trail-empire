// ─────────────────────────────────────────────────────────────────────────────
//  TYPE DE FICHIER DÉDUIT DU CONTENU — jamais de l'extension ni de l'en-tête déclaré.
//
//  Extrait de /api/upload pour être partagé (et testé). L'en-tête `Content-Type` envoyé
//  par le navigateur et l'extension du nom sont tous deux sous le contrôle de l'appelant :
//  un compte pouvait déposer un .html en le déclarant `image/png`. La signature des
//  premiers octets, elle, ne ment pas.
// ─────────────────────────────────────────────────────────────────────────────

export type SniffedType = "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

/** Type réel d'après les premiers octets. `null` = format non reconnu → à refuser. */
export function sniffType(b: Uint8Array): SniffedType | null {
  if (b.length < 12) return null;
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "%PDF") return "application/pdf";
  return null;
}

/** Sous-ensemble accepté par le kiné IA : des IMAGES uniquement, jamais de PDF. */
export function sniffImage(b: Uint8Array): SniffedType | null {
  const t = sniffType(b);
  return t && t !== "application/pdf" ? t : null;
}
