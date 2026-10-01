/**
 * LA PROCHAINE ÉDITION D'UNE COURSE — estimée, puis vérifiée sur le site officiel (30/09/2026).
 *
 * Cyprien : « pourquoi il met "Date à venir" alors que l'édition était le week-end dernier ?
 * Trouve un moyen automatique pour qu'il mette les bonnes dates, avec une vérification. »
 * Les Foulées Lambersartoises, courues le dimanche 27/09/2026, sont passées en « Date à
 * venir » le lendemain matin : la maintenance quotidienne bascule toute course passée sur le
 * marqueur 2099, faute de connaître l'édition suivante.
 *
 * Deux étages, tout ce qui DÉCIDE est ici, pur et testé :
 *   1. ESTIMER — une course de week-end revient presque toujours au même rang du même mois
 *      (« 4e dimanche de septembre », « dernier samedi de juin »). L'édition suivante est
 *      donc proposée à cette date, marquée ESTIMÉE (≈, `date_confirmee = false`) — jamais
 *      donnée pour sûre, jamais déclarée à Google comme un fait.
 *      ⚠️ PAS EN SEMAINE : mesuré le 29/09/2026, une date estimée un lundi ou un mardi
 *      était juste 0 fois sur 28 (lendemain de course, jour férié mobile…). Une course de
 *      semaine garde « Date à venir ».
 *   2. VÉRIFIER — la page officielle est relue ; une date FUTURE qu'elle annonce sans
 *      ambiguïté remplace l'estimation et devient confirmée (`datesAnnoncees`).
 */

const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const joursDansMois = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const jourSemaine = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

/** Une date civile réelle (pas le 31 juin), entre 2000 et 2098 — 2099 est le marqueur « à venir ». */
function lire(date: unknown): { y: number; m: number; d: number } | null {
  const x = String(date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!x) return null;
  const y = Number(x[1]), m = Number(x[2]), d = Number(x[3]);
  if (y < 2000 || y > 2098 || m < 1 || m > 12 || d < 1 || d > joursDansMois(y, m)) return null;
  return { y, m, d };
}

/** Le n-ième jour `js` (0 = dimanche) du mois — le dernier quand il n'y en a pas de n-ième. */
function nieme(y: number, m: number, js: number, rang: number): string {
  const n = joursDansMois(y, m);
  let d = 1; while (jourSemaine(y, m, d) !== js) d++;
  d += 7 * (rang - 1);
  if (d > n) d -= 7;   // pas de 5e dimanche cette année-là : le dernier
  return iso(y, m, d);
}

/**
 * L'édition suivante ESTIMÉE d'une course de week-end : même rang du même jour dans le même
 * mois, la première année qui tombe APRÈS `aujourdhui`. `null` en semaine, ou date illisible.
 */
export function editionSuivanteEstimee(date: unknown, aujourdhui: string): string | null {
  const x = lire(date);
  if (!x) return null;
  const js = jourSemaine(x.y, x.m, x.d);
  if (js !== 0 && js !== 6) return null;
  const rang = Math.ceil(x.d / 7);
  for (let y = x.y + 1; y <= x.y + 30; y++) {
    const e = nieme(y, x.m, js, rang);
    if (e > aujourdhui) return e;
  }
  return null;
}

// ── Vérification : les dates qu'une page annonce ─────────────────────────────

/** Contexte qui disqualifie une date : publication, mise à jour, clôture des inscriptions… */
const CONTEXTE_ECARTE = /(publi[ée]e?s?|mis[e]? [àa] jour|post[ée]e?|modifi[ée]e?|actualis[ée]e?|cl[ôo]tur\w*|ouverture|ouvertes?|inscriptions?|jusqu'?au|avant le|retrait|remise|limite|date limite|[ée]dit[ée]e? le)\W{0,12}(le\W{0,3})?$/i;

/** `contextes` : le texte autour de chaque mention (±150 caractères), pour savoir DE QUOI la date parle. */
export type DateLue = { date: string; jourNomme: boolean; contextes?: string[] };

/**
 * Les dates d'une page, lues en français : « dimanche 26 septembre 2027 », « 26 septembre
 * 2027 », « dimanche 26 septembre » (l'année déduite du JOUR NOMMÉ — celle, à un an près,
 * où le 26 septembre est bien un dimanche). Les dates de publication, de mise à jour ou de
 * clôture des inscriptions sont écartées par leur contexte immédiat.
 */
export function datesAnnoncees(html: string, aujourdhui: string): DateLue[] {
  const texte = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").slice(0, 400_000);
  const anneeRef = Number(aujourdhui.slice(0, 4));
  const re = /(?:\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+)?\b(1er|[0-3]?\d)\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+(20\d{2}))?\b/gi;
  const vues = new Map<string, DateLue>();
  for (let m; (m = re.exec(texte));) {
    const avant = texte.slice(Math.max(0, m.index - 40), m.index);
    if (CONTEXTE_ECARTE.test(avant)) continue;
    // ⚠️ LA FIN D'UNE PLAGE N'EST PAS LE JOUR DE LA COURSE (30/09/2026) : « 23 > 27 juin
    // 2027 » (Ultra Marin), « les 10 et 11 octobre » (Urban Trail Chaumont) faisaient
    // retenir le DERNIER jour d'un événement de plusieurs jours. On n'en tire rien.
    if (/\d{1,2}(?:er)?\s*(?:et|au|à|>|&gt;|-|–|—|&amp;|&)\s*$/i.test(avant)) continue;
    const jourNom = m[1]?.toLowerCase() ?? null;
    const d = m[2].toLowerCase() === "1er" ? 1 : Number(m[2]);
    const mois = MOIS[m[3].toLowerCase()] ?? MOIS[m[3].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    if (!mois) continue;
    let y: number | null = m[4] ? Number(m[4]) : null;
    if (y == null) {
      if (!jourNom) continue;   // « 26 septembre » sans jour ni année : quelle année ?
      const js = JOURS.indexOf(jourNom);
      // Le jour de la semaine glisse d'un ou deux crans par an : sur trois années
      // consécutives, au plus UNE fait tomber ce jour-là sur ce nom de jour.
      const possible = [anneeRef - 1, anneeRef, anneeRef + 1].find((a) => d <= joursDansMois(a, mois) && jourSemaine(a, mois, d) === js);
      if (possible == null) continue;
      y = possible;
    }
    if (d < 1 || d > joursDansMois(y, mois)) continue;
    // Un jour nommé qui CONTREDIT la date (« samedi 26 septembre 2027 », un dimanche) : coquille, on n'en tire rien.
    if (jourNom && JOURS.indexOf(jourNom) !== jourSemaine(y, mois, d)) continue;
    const date = iso(y, mois, d);
    const deja = vues.get(date);
    const contexte = texte.slice(Math.max(0, m.index - 150), m.index + m[0].length + 150);
    vues.set(date, { date, jourNomme: Boolean(jourNom) || Boolean(deja?.jourNomme), contextes: [...(deja?.contextes ?? []), contexte].slice(0, 4) });
  }
  return [...vues.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const ecartJours = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 864e5;
const estWeekEnd = (date: string) => { const x = lire(date)!; const js = jourSemaine(x.y, x.m, x.d); return js === 0 || js === 6; };

/**
 * Ce que la page officielle permet d'écrire pour une course, ou `null` (on ne touche à rien) :
 *   - `confirmee` : une date FUTURE (≤ 400 j) annoncée sans ambiguïté — la seule à ±45 j
 *     de l'estimation quand il y en a une ; sinon la seule date future de week-end de la page ;
 *   - `estimee` : la course est « à venir » (2099), la page ne dit rien du futur mais raconte
 *     une édition RÉCENTE (≤ 120 j, un week-end, jour nommé) → l'édition suivante estimée.
 */
export function dateDepuisPage(
  dates: DateLue[], course: { date: string | null; date_confirmee?: boolean | null }, aujourdhui: string,
): { date: string; confirmee: boolean; preuve: string } | null {
  const futures = dates.filter((x) => x.date > aujourdhui && ecartJours(x.date, aujourdhui) <= 400);
  const actuelle = String(course.date ?? "");
  const aVenir = actuelle.startsWith("2099") || !lire(actuelle);
  if (!aVenir && course.date_confirmee !== false) return null;   // une date confirmée ne se discute pas ici
  if (!aVenir) {
    const proches = futures.filter((x) => ecartJours(x.date, actuelle) <= 45);
    if (proches.length === 1) return { date: proches[0].date, confirmee: true, preuve: proches[0].date };
    return null;
  }
  const weekEnds = futures.filter((x) => estWeekEnd(x.date));
  if (weekEnds.length === 1) return { date: weekEnds[0].date, confirmee: true, preuve: weekEnds[0].date };
  if (futures.length) return null;   // plusieurs dates futures : on ne choisit pas
  const recentes = dates.filter((x) => x.date <= aujourdhui && ecartJours(x.date, aujourdhui) <= 120 && x.jourNomme && estWeekEnd(x.date));
  const derniere = recentes.at(-1);
  if (!derniere) return null;
  const estimee = editionSuivanteEstimee(derniere.date, aujourdhui);
  return estimee ? { date: estimee, confirmee: false, preuve: derniere.date } : null;
}
