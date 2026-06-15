// Le plan du coach peut contenir PLUSIEURS entrées pour une même date (l'auto-coach se superpose
// au plan publié → doublons). Source de vérité unique, partagée par le Calendrier, le Dashboard
// et le Ghost Runner : UNE séance par date, la PLUS RÉCEMMENT décidée.
//
// `rowsNewestFirst` doit être trié par created_at DÉCROISSANT (ce que font déjà les requêtes
// `.order("created_at", { ascending: false })`). On garde donc la première vue par date.
export function oneSessionPerDate<T>(rowsNewestFirst: T[], getDate: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rowsNewestFirst) {
    const d = getDate(r);
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push(r);
  }
  return out;
}
