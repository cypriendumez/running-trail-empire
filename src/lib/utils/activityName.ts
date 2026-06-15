// Nettoie le nom d'une activité importée : retire le préfixe marketing
// « 🏃 Prépa <objectif> — » que l'app injecte sur la séance poussée à la montre
// (cf. buildWorkoutDescription). Quand l'athlète réalise la séance, Garmin nomme
// l'ACTIVITÉ d'après la séance → le préfixe revient dans l'historique. On le retire
// à l'AFFICHAGE uniquement (la base garde le nom d'origine → pas de doublon de dédup).
//   « Lambersart - 🏃 Prépa Marathon de Paris 2027 — Sortie longue » → « Lambersart - Sortie longue »
//   « 🏃 Prépa Marathon de Paris 2027 — Footing » → « Footing »
export function cleanActivityName(name?: string | null): string {
  if (!name) return "";
  let s = String(name);
  // Cas normal : « … Prépa <objectif> — <séance> » → on garde <séance> (et un éventuel préfixe de lieu).
  s = s.replace(/🏃?\s*Prépa\s.+?\s[—–-]\s/u, "");
  // Repli (pas de séparateur) : « … Prépa <objectif> » en fin → on coupe tout le segment Prépa.
  s = s.replace(/\s*[-–—]?\s*🏃?\s*Prépa\s.+$/u, "");
  // Nettoie un séparateur orphelin en fin (« Lambersart - »).
  s = s.replace(/\s*[-–—]\s*$/u, "").trim();
  return s || String(name);
}
