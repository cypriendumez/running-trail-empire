// Le plan du coach peut contenir PLUSIEURS entrées pour une même date (l'auto-coach se superpose
// au plan publié → doublons). Source de vérité unique, partagée par le Calendrier, le Dashboard
// et le Ghost Runner : UNE séance par CRÉNEAU, la PLUS RÉCEMMENT décidée.
//
// ⚠️ CRÉNEAU, ET NON PLUS DATE. La déduplication portait sur la seule date. C'était juste
// tant qu'une journée ne contenait qu'une séance ; depuis les doubles séances (matin +
// soir), elle SUPPRIMAIT silencieusement la seconde — dans les six écrans qui l'appellent,
// y compris la poussée vers la montre. Le créneau est donc `date#moment`, et une journée
// sans double garde exactement le comportement d'avant (`moment` vide).
//
// `rowsNewestFirst` doit être trié par created_at DÉCROISSANT (ce que font déjà les requêtes
// `.order("created_at", { ascending: false })`). On garde donc la première vue par créneau.
export function oneSessionPerSlot<T>(rowsNewestFirst: T[], getKey: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rowsNewestFirst) {
    const k = getKey(r);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/**
 * Clé de créneau d'une séance du coach : `AAAA-MM-JJ#moment`.
 *
 * Centralisée pour que les six appelants ne puissent pas diverger : si l'un d'eux
 * oubliait le moment, il rétablirait exactement le défaut qu'on vient de corriger, et
 * seulement sur son écran — le calendrier montrerait deux séances, le tableau de bord
 * une seule, sans que rien ne le signale.
 */
export function slotKey(data: { date?: unknown; moment?: unknown } | null | undefined): string {
  const d = String((data as { date?: unknown } | null)?.date ?? "").slice(0, 10);
  if (!d) return "";
  const m = String((data as { moment?: unknown } | null)?.moment ?? "");
  return `${d}#${m}`;
}
