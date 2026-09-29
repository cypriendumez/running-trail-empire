/**
 * GARDE-FOUS DES ÉCRITURES SANS SURVEILLANCE (rafraîchissement hebdomadaire, 29/09/2026).
 *
 * Le soir, les scripts d'écriture tournent seuls dans GitHub Actions. Si une source change
 * la forme de ses pages, une lecture de travers peut « retirer » des centaines de courses,
 * renvoyer des milliers de dates en « Date à venir » ou insérer du bruit. Au-delà d'un
 * seuil, RIEN n'est écrit : le script s'arrête (code 2), et l'exécution rougit dans
 * /admin → Automatisation. Mieux vaut une semaine sans mise à jour qu'un catalogue abîmé.
 */

/** La valeur de `--nom N` dans les arguments, ou `defaut` (absente, vide ou illisible). */
export function seuil(argv: string[], nom: string, defaut: number): number {
  const i = argv.indexOf(nom);
  if (i < 0) return defaut;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) && v >= 0 ? v : defaut;
}

export type Compte = { quoi: string; n: number; max: number };

/** Le message d'arrêt si un compte DÉPASSE son seuil (égal : on écrit), sinon `null`. */
export function depassement(comptes: Compte[]): string | null {
  const trop = comptes.filter((c) => c.n > c.max);
  if (!trop.length) return null;
  return `ARRÊT : ${trop.map((c) => `${c.n} ${c.quoi} (seuil ${c.max})`).join(" ; ")}. Rien n'est écrit — la source a peut-être changé de forme : relire le plan à blanc.`;
}

/** S'arrête (code 2) sans rien écrire si un seuil est dépassé. */
export function arreterSiDepasse(comptes: Compte[]): void {
  const m = depassement(comptes);
  if (m) { console.error(m); process.exit(2); }
}
