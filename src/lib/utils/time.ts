// Horodatage relatif localisé : « à l'instant », « il y a 5 min », « hier »… (défaut : fr)
const REL: Record<string, { now: string; min: string; h: string; d: string; yesterday: string }> = {
  fr: { now: "à l'instant", min: "il y a {n} min", h: "il y a {n} h", d: "il y a {n} j", yesterday: "hier" },
  en: { now: "just now", min: "{n} min ago", h: "{n} h ago", d: "{n} d ago", yesterday: "yesterday" },
  de: { now: "gerade eben", min: "vor {n} Min.", h: "vor {n} Std.", d: "vor {n} Tg.", yesterday: "gestern" },
  es: { now: "ahora mismo", min: "hace {n} min", h: "hace {n} h", d: "hace {n} d", yesterday: "ayer" },
  pt: { now: "agora mesmo", min: "há {n} min", h: "há {n} h", d: "há {n} d", yesterday: "ontem" },
};

/**
 * SEULE implémentation de l'horodatage relatif de l'app.
 *
 * Il en existait TROIS : celle-ci, une copie française sans traduction dans
 * `lib/social/feed.ts`, et une troisième écrite à la main dans la barre du haut. Les
 * deux autres ne parlaient que français — un athlète allemand lisait « il y a 3 j » sous
 * chaque publication du Club et chaque notification. Les deux copies ont été supprimées.
 *
 * `now` est INJECTABLE parce que les tests de `feed.ts` figent l'horloge : sans ce
 * paramètre, fusionner les implémentations aurait rendu ces assertions intestables.
 */
export function timeAgo(ts: string, lang = "fr", now: Date = new Date()): string {
  if (!ts) return "";
  const t = new Date(ts).getTime();
  if (isNaN(t)) return "";
  const r = REL[lang] ?? REL.fr;
  const s = Math.floor((now.getTime() - t) / 1000);
  if (s < 0) return r.now;
  if (s < 45) return r.now;
  if (s < 90) return r.min.replace("{n}", "1");
  const m = Math.floor(s / 60);
  if (m < 60) return r.min.replace("{n}", String(m));
  const h = Math.floor(m / 60);
  if (h < 24) return r.h.replace("{n}", String(h));
  const d = Math.floor(h / 24);
  if (d === 1) return r.yesterday;
  if (d < 7) return r.d.replace("{n}", String(d));
  return new Date(ts).toLocaleDateString(lang, { day: "numeric", month: "short" });
}

// Date complète (pour les info-bulles / en-têtes).
export function fmtFull(ts: string, lang = "fr"): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(lang, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}
