/**
 * LE PLAN DANS LE CALENDRIER DU COUREUR (27/11/2026) — format iCalendar (RFC 5545).
 *
 * Le coureur abonne Apple Calendrier, Google Agenda ou Outlook à son adresse secrète
 * (`/api/calendrier/flux/<jeton>.ics`). À chaque relecture, son application reçoit le plan
 * TEL QU'IL EST : une séance replanifiée se déplace, elle ne se duplique pas (UID stable par
 * jour et par créneau).
 *
 * ⚠️ MIDI, HEURE LOCALE DU COUREUR — en heure « FLOTTANTE » (sans `Z` ni `TZID`). Une heure
 * flottante se lit dans le fuseau de celui qui regarde : 12:00 à Paris, 12:00 à Montréal en
 * voyage, et aucun fuseau à connaître côté serveur (le serveur d'Apple ou de Google qui relit
 * le flux n'envoie pas celui du coureur). D'où, aussi, AUCUN `X-WR-TIMEZONE` : Google s'en
 * servirait pour réinterpréter ces heures, et midi deviendrait midi à Paris pour tout le monde.
 *
 * Jour à deux séances (lib/coach/doubleSessions) : celle du matin à 12:00, celle du soir à
 * 18:00. Deux événements superposés à midi seraient illisibles.
 *
 * ⚠️ LISTE BLANCHE : AUCUN TEXTE DU PLAN NE PART CHEZ APPLE OU GOOGLE. Un événement porte le
 * LIBELLÉ DU TYPE de séance (« Pacevo · Footing »), sa durée, et le lien vers le plan — rien
 * d'autre. Relecture du 27/11/2026 : un filtre à la liste noire (couper au premier « ⚠️ ») laissait
 * passer au moins cinq textes de santé, sans aucun « ⚠️ » :
 *   - le titre « Footing encadré par ton kiné » et « Consigne de ton kiné : aucun saut » dans le
 *     détail du renfo (lib/coach/consignesPlan) ;
 *   - « Douleur dans la poitrine, malaise… : arrête-toi » d'une course à effort contrôlé
 *     (`courseDetailControle`, cadre de santé des exemptés : antécédent cardiaque, grossesse…) ;
 *   - les suffixes de titre « (reprise) » et « (allégée) » ;
 *   - et les allures, calculées depuis la VMA.
 * Le plan s'écrit en prose, et toute phrase nouvelle peut en ajouter un sixième : seul ce qui est
 * construit ICI, à partir du type canonique, part chez un tiers. Le « pourquoi » du coach n'est
 * même pas lu. Ni nom, ni e-mail, ni identifiant du compte (les UID n'en portent qu'une empreinte).
 *
 * Les jours de repos ne sont pas exportés : un agenda n'a pas à porter « Repos » sept fois.
 */
import { createHash } from "node:crypto";
import { durationForType, parsePaceSec } from "@/lib/watch/intervals";
import type { Lang } from "@/lib/i18n/base";

/**
 * Une séance du plan, telle que la table `notifications` (type `coach_session`) la garde — en
 * FRANÇAIS, le texte canonique. `titre`, `texte` et `tags` servent au calcul (repos, durée) et ne
 * sont JAMAIS écrits dans le calendrier.
 */
export type SeanceFlux = {
  date: string;            // AAAA-MM-JJ
  moment: string | null;   // « matin » | « soir » | null
  type: string;            // sessionType canonique : Endurance, Sortie longue, Repos, Renfo, Test…
  titre: string;
  /**
   * Le détail FRANÇAIS. ⚠️ Relecture du 27/11/2026 : la durée se lisait d'abord sur le détail
   * TRADUIT, alors que l'analyse cherche « corps : », « récup », « retour au calme » — du
   * français. En anglais, « Warm-up 15 min → Main set: 6×1000 m … → Cool-down 10 min » donnait
   * 30 min au lieu de 60. Comme pour la montre, la durée se lit sur le français.
   */
  texte: string;
  tags: string[];
};

/** L'heure de début, heure locale du coureur : midi, ou 18:00 pour la séance du soir d'un jour doublé. */
export function heureDebut(moment: string | null): { h: number; m: number } {
  return moment === "soir" ? { h: 18, m: 0 } : { h: 12, m: 0 };
}

/** Un jour de repos ne part pas dans l'agenda. */
export function seanceExportee(s: Pick<SeanceFlux, "type" | "titre">): boolean {
  if (/^repos/i.test((s.type || "").trim())) return false;
  // Une ligne sans type : le titre français « Repos… » reste le seul indice.
  if (!s.type && /^repos/i.test((s.titre || "").trim())) return false;
  return true;
}

const minutesDe = (h: string | undefined, m: string | undefined) => (h ? parseInt(h, 10) * 60 : 0) + (m ? parseInt(m, 10) : 0);

/** La première durée d'un morceau de texte : « 1 h 02 », « 1h30 », « 40 min », « 45' ». */
/** « 15 à 20 min » → « 20 min » : d'une fourchette, la borne haute. */
const sansFourchette = (txt: string) => txt.replace(/\d+\s*(?:h\s*\d{0,2}|min)?\s*(?:à|-)\s*(?=\d)/g, " ");

function premiereDuree(txt: string): number | null {
  txt = sansFourchette(txt);
  const h = txt.match(/(\d+)\s*h\s*(\d{1,2})?(?:\s*min)?(?![a-zà-ÿ])/);
  const m = txt.match(/(\d+)\s*(?:min|['’](?!\s*[\d/]))/);
  if (h && (!m || (h.index ?? 0) <= (m.index ?? 0))) return minutesDe(h[1], h[2]);
  return m ? parseInt(m[1], 10) : null;
}

/** La somme des durées d'un texte écrit à la suite (« 15 min, puis 6 min, retour 10 min »). */
function sommeDurees(txt: string): number {
  // « 1h30 à 2h », « 15 à 20 min » : une FOURCHETTE, dont seule la borne haute compte. Additionnées,
  // une sortie vélo « 1h30 à 2h » bloquait 3 h 50 (relecture du 27/11/2026).
  txt = sansFourchette(txt);
  let reste = txt;
  let total = 0;
  for (const h of txt.matchAll(/(\d+)\s*h\s*(\d{1,2})?(?:\s*min)?(?![a-zà-ÿ])/g)) { total += minutesDe(h[1], h[2]); reste = reste.replace(h[0], " "); }
  // « 20 à 25 min » : seule la borne haute porte l'unité, c'est elle qu'on garde.
  for (const m of reste.matchAll(/(\d+)\s*(?:min|['’](?!\s*[\d/]))/g)) total += parseInt(m[1], 10);
  return total;
}

/** « 2 min », « 1 min 30 », « 45 s » → minutes ; `null` sans durée. */
function enMinutes(txt: string): number | null {
  const m = txt.match(/(\d+)\s*min(?:\s*(\d{1,2})(?!\s*(?:min|s\b|km|m\b)))?/);
  if (m) return parseInt(m[1], 10) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
  const sec = txt.match(/(\d+)\s*s\b/);
  return sec ? parseInt(sec[1], 10) / 60 : null;
}

/** La somme des durées d'un groupe « (30 s vif / 30 s trottiné) ». */
function sommeGroupe(txt: string): number {
  return txt.split("/").reduce((t, x) => t + (enMinutes(x) ?? 0), 0);
}

/**
 * La durée d'UN morceau de corps de séance, en minutes ; `null` si on ne sait pas la lire.
 *   « 3×15 min …, récup 3 min »           → 3 × 15 + 2 × 3
 *   « 8×1 min vif / 1 min facile »        → 8 × (1 + 1)
 *   « 12×(30 s vif / 30 s trottiné) »     → 12 × 1
 *   « 6×1000 m à 3'40/km (récup 2 min) »  → 6 × 1 km × 3'40 + 5 × 2
 *   « 10×30 s en montée, récup descente » → la récupération sans durée vaut l'effort (descente au trot)
 *   « 25 min en Z1 », « ~3,5 km (environ 17 min) », « 8 km à 5'00/km »
 * ⚠️ Relecture du 27/11/2026 : « 3×15 min » se lisait 15 min (le multiplicateur et les
 * récupérations ignorés) — 40 min d'agenda pour une séance d'1 h 15.
 */
function dureeMorceau(seg: string): number | null {
  const recupTxt = seg.match(/r[ée]cup[^,;→]*/)?.[0] ?? null;
  const sansRecup = recupTxt ? seg.replace(recupTxt, " ") : seg;
  const recupLue = recupTxt ? enMinutes(recupTxt) : null;
  const allure = parsePaceSec(seg);
  const nb = (x: string) => parseFloat(x.replace(",", "."));

  const groupe = sansRecup.match(/(\d+)\s*[×x]\s*\(([^)]*)\)/);
  if (groupe && /\d\s*(?:min|s\b)/.test(groupe[2])) {
    const effort = sommeGroupe(groupe[2]);
    const n = parseInt(groupe[1], 10);
    return n * effort + (n - 1) * (recupLue ?? 0);
  }
  // « 2×(5×300 m) à ~4'10/km, récup 45 s, 3 min entre blocs » : des blocs de répétitions.
  const blocs = sansRecup.match(/(\d+)\s*[×x]\s*\((\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\)/);
  if (blocs && allure) {
    const nBlocs = parseInt(blocs[1], 10), n = parseInt(blocs[2], 10);
    const distKm = blocs[4] === "km" ? nb(blocs[3]) : nb(blocs[3]) / 1000;
    const entre = enMinutes(seg.match(/(\d+\s*min)\s*entre/)?.[1] ?? "") ?? 0;
    const unBloc = (n * distKm * allure) / 60 + (n - 1) * (recupLue ?? 0);
    return nBlocs * unBloc + (nBlocs - 1) * entre;
  }
  const repsTemps = sansRecup.match(/(\d+)\s*[×x]\s*(\d+\s*(?:min(?:\s*\d{1,2})?|s\b))(?:[^/,;]*\/\s*(\d+\s*(?:min|s\b)))?/);
  if (repsTemps) {
    const n = parseInt(repsTemps[1], 10);
    const effort = enMinutes(repsTemps[2]) ?? 0;
    const alterne = repsTemps[3] ? enMinutes(repsTemps[3]) ?? 0 : 0;
    const recup = recupLue ?? (recupTxt ? effort : 0);
    return n * (effort + alterne) + (n - 1) * recup;
  }
  const repsDist = sansRecup.match(/(\d+)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*(km|m)\b/);
  if (repsDist && allure) {
    const n = parseInt(repsDist[1], 10);
    const distKm = repsDist[3] === "km" ? nb(repsDist[2]) : nb(repsDist[2]) / 1000;
    return (n * distKm * allure) / 60 + (n - 1) * (recupLue ?? 0);
  }
  const duree = premiereDuree(sansRecup);
  if (duree != null) return duree;
  const km = sansRecup.match(/(\d+(?:[.,]\d+)?)\s*km/);
  if (km && allure) return (nb(km[1]) * allure) / 60;
  return null;
}

/** Le corps entier : ses morceaux « …, puis … » additionnés ; `null` dès qu'un morceau est illisible. */
function dureeCorps(tete: string): number | null {
  let total = 0;
  for (const seg of tete.split(/,?\s+puis\s+/)) {
    const m = dureeMorceau(seg);
    if (m == null) return null;
    total += m;
  }
  return Math.round(total);
}

/**
 * La durée de l'événement, en minutes (arrondie aux 5 min supérieures, entre 15 min et 5 h).
 *
 * C'est un CRÉNEAU d'agenda, pas une mesure : il dit au coureur combien de temps bloquer.
 * Il se lit dans le texte même du plan, dans cet ordre :
 *   1. une étiquette « N min » (marche-course : la durée totale y est écrite) ;
 *   2. « Échauffement N min → Corps : … (environ M min) → Retour au calme K min » : N + M + K ;
 *      un corps donné en km avec son allure (« ~3,5 km … (~4'48/km) ») se convertit ;
 *   3. les durées écrites à la suite (« 15 min… 6 min… 10 min » pour un test) ;
 *   4. sinon, la durée par défaut du type — LA MÊME que l'envoi à la montre (`durationForType`).
 */
export function dureeEvenementMin(s: Pick<SeanceFlux, "type" | "texte" | "tags">): number {
  // Les conseils ajoutés en fin de texte (météo, terrain, volume) ne sont pas la séance.
  const texte = (s.texte || "").split(/\n\n|💡|⛰️|🌡|⚠️/)[0].toLowerCase();
  let min: number | null = null;

  // 1. L'étiquette « N min » d'abord : la marche-course y écrit sa durée TOTALE (autoPlan). Lue
  //    après le corps, « Corps : 8 × (1 min de course / 2 min de marche) » donnait 5 + 1 = 6 min,
  //    soit le plancher de 15 min pour une séance de 32 (relecture du 27/11/2026).
  const etiquette = (s.tags || []).map((t) => t.match(/^\s*(\d+)\s*min\s*$/i)).find(Boolean);
  if (etiquette) min = parseInt(etiquette[1], 10);

  // 2. « Corps : », le mot suivi de ses deux-points — pas « squats au poids du corps 3×10, … Le
  //    but : » du renfo débutant, qui prenait 50 min (durée du type) pour une séance de 20.
  const corps = min == null ? texte.match(/(?:^|[\s→])corps\s*:/) : null;
  if (corps && corps.index != null) {
    const avant = texte.slice(0, corps.index);
    const apres = texte.slice(corps.index + corps[0].length);
    const tete = apres.split(/→|\n/)[0];
    const queue = apres.slice(tete.length);
    const corpsMin = dureeCorps(tete);
    if (corpsMin != null) {
      // Le retour au calme, nommé (« Retour au calme 10 min ») ou, à défaut, la dernière étape
      // (« → 5 min de marche pour finir » de la marche-course).
      const calme = queue.match(/retour au calme[^→\n]*/)?.[0] ?? queue.split("→").pop() ?? "";
      min = (premiereDuree(avant) ?? 0) + corpsMin + (premiereDuree(calme) ?? 0);
    } else {
      // Un corps sans durée ni allure (« ~4 km en Z2 ») : additionner l'échauffement et le
      // retour au calme oublierait la séance elle-même. On prend la durée du type.
      min = durationForType(s.type);
    }
  }
  if (min == null) {
    const somme = sommeDurees(texte);
    if (somme > 0) min = somme;
  }
  if (min == null || !(min > 0)) min = durationForType(s.type);
  return Math.min(300, Math.max(15, Math.ceil(min / 5) * 5));
}

// ── Écriture iCalendar ───────────────────────────────────────────────────────────────

/** Échappement d'une valeur TEXT (RFC 5545 § 3.3.11). */
export function echapperTexte(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Pliage des lignes à 75 OCTETS (RFC 5545 § 3.1) : la suite reprend après CRLF + espace.
 * On compte en octets UTF-8 et on ne coupe jamais au milieu d'un caractère (accents, emoji) :
 * Apple affiche sinon un « � » au milieu d'un mot.
 */
export function plierLigne(ligne: string): string {
  const morceaux: string[] = [];
  let courant = "";
  let octets = 0;
  for (const c of ligne) {
    const n = Buffer.byteLength(c, "utf8");
    const limite = morceaux.length === 0 ? 75 : 74; // la suite commence par une espace
    if (octets + n > limite) { morceaux.push(courant); courant = ""; octets = 0; }
    courant += c;
    octets += n;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

const deux = (n: number) => String(n).padStart(2, "0");

/** « 2026-11-28 » + 12:00 (+ durée) → « 20261128T120000 », heure flottante. */
function heureFlottante(date: string, h: number, m: number, plusMin = 0): string {
  const [a, mo, j] = date.split("-").map((x) => parseInt(x, 10));
  // Arithmétique en UTC pour ne dépendre d'AUCUN fuseau du moteur : seule l'horloge murale compte.
  const d = new Date(Date.UTC(a, mo - 1, j, h, m + plusMin));
  return `${d.getUTCFullYear()}${deux(d.getUTCMonth() + 1)}${deux(d.getUTCDate())}T${deux(d.getUTCHours())}${deux(d.getUTCMinutes())}00`;
}

const horodatageUtc = (d: Date) =>
  `${d.getUTCFullYear()}${deux(d.getUTCMonth() + 1)}${deux(d.getUTCDate())}T${deux(d.getUTCHours())}${deux(d.getUTCMinutes())}${deux(d.getUTCSeconds())}Z`;

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

type Libelles = { nom: string; desc: string; duree: string; detail: string; jourCourse: string; seance: string; types: Record<string, string> };

/**
 * TOUT ce qui s'écrit dans le calendrier, par langue : des libellés fixes, jamais une donnée du
 * coureur. Un type inconnu (nouveau type de séance) prend « Séance » — jamais son titre libre.
 */
export const ICS_T: Record<Lang, Libelles> = {
  fr: {
    nom: "Pacevo · séances", desc: "Tes séances Pacevo, mises à jour par le coach.",
    duree: "Durée prévue : environ {n} min.", detail: "Le détail et les allures de la séance : {url}", seance: "Séance",
    jourCourse: "Jour de course : le programme de la journée est dans Pacevo, {url}",
    types: { "Endurance": "Footing", "Récup": "Footing de récupération", "Sortie longue": "Sortie longue", "VMA": "Séance de VMA", "Seuil": "Séance au seuil", "Spécifique": "Séance à allure spécifique", "Renfo": "Renforcement musculaire", "Vélo": "Vélo", "Course": "Course", "Test": "Test", "Marche/course": "Marche-course" },
  },
  en: {
    nom: "Pacevo · sessions", desc: "Your Pacevo sessions, kept up to date by the coach.",
    duree: "Planned duration: about {n} min.", detail: "Session details and paces: {url}", seance: "Session",
    jourCourse: "Race day: the plan for the day is in Pacevo, {url}",
    types: { "Endurance": "Easy run", "Récup": "Recovery run", "Sortie longue": "Long run", "VMA": "VO2max session", "Seuil": "Threshold session", "Spécifique": "Race-pace session", "Renfo": "Strength training", "Vélo": "Bike", "Course": "Race", "Test": "Test", "Marche/course": "Run-walk" },
  },
  de: {
    nom: "Pacevo · Einheiten", desc: "Deine Pacevo-Einheiten, vom Coach aktuell gehalten.",
    duree: "Geplante Dauer: etwa {n} min.", detail: "Details und Tempi der Einheit: {url}", seance: "Einheit",
    jourCourse: "Wettkampftag: der Tagesplan ist in Pacevo, {url}",
    types: { "Endurance": "Lockerer Lauf", "Récup": "Erholungslauf", "Sortie longue": "Langer Lauf", "VMA": "VO2max-Einheit", "Seuil": "Schwelleneinheit", "Spécifique": "Wettkampftempo-Einheit", "Renfo": "Krafttraining", "Vélo": "Rad", "Course": "Wettkampf", "Test": "Test", "Marche/course": "Lauf-Geh-Training" },
  },
  es: {
    nom: "Pacevo · sesiones", desc: "Tus sesiones de Pacevo, actualizadas por el entrenador.",
    duree: "Duración prevista: unos {n} min.", detail: "El detalle y los ritmos de la sesión: {url}", seance: "Sesión",
    jourCourse: "Día de carrera: el plan del día está en Pacevo, {url}",
    types: { "Endurance": "Rodaje suave", "Récup": "Rodaje de recuperación", "Sortie longue": "Tirada larga", "VMA": "Sesión de VAM", "Seuil": "Sesión de umbral", "Spécifique": "Sesión a ritmo específico", "Renfo": "Trabajo de fuerza", "Vélo": "Bici", "Course": "Carrera", "Test": "Test", "Marche/course": "Correr y caminar" },
  },
  pt: {
    nom: "Pacevo · sessões", desc: "As tuas sessões Pacevo, atualizadas pelo treinador.",
    duree: "Duração prevista: cerca de {n} min.", detail: "O detalhe e os ritmos da sessão: {url}", seance: "Sessão",
    jourCourse: "Dia de prova: o plano do dia está no Pacevo, {url}",
    types: { "Endurance": "Corrida fácil", "Récup": "Corrida de recuperação", "Sortie longue": "Longo", "VMA": "Sessão de VAM", "Seuil": "Sessão de limiar", "Spécifique": "Sessão a ritmo específico", "Renfo": "Reforço muscular", "Vélo": "Bicicleta", "Course": "Prova", "Test": "Teste", "Marche/course": "Correr e caminhar" },
  },
};

const URL_PLAN = "https://pacevo.fr/dashboard/calendrier";

/** Le titre de l'événement : construit, jamais recopié du plan. */
export function titreEvenement(type: string, lang: Lang): string {
  const T = ICS_T[lang] ?? ICS_T.fr;
  return `Pacevo · ${T.types[type] ?? T.seance}`;
}

/**
 * Le calendrier complet. `graine` rend les UID propres au coureur sans y écrire son identifiant
 * (il part chez Apple ou Google) : on n'en met qu'une empreinte.
 */
export function construireIcs(seances: SeanceFlux[], opts: { graine: string; lang: Lang; maintenant: Date }): string {
  const T = ICS_T[opts.lang] ?? ICS_T.fr;
  const dtstamp = horodatageUtc(opts.maintenant);
  const prefixeUid = createHash("sha256").update(`pacevo-calendrier:${opts.graine}`).digest("hex").slice(0, 16);

  // Un seul événement par jour et par créneau, comme les écrans (dédoublonnage `date#moment`).
  const parCle = new Map<string, SeanceFlux>();
  for (const s of seances) {
    if (!DATE_ISO.test(s.date) || !seanceExportee(s)) continue;
    parCle.set(`${s.date}#${s.moment ?? ""}`, s);
  }
  const triees = [...parCle.entries()].sort(([a], [b]) => a.localeCompare(b));

  const l: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pacevo//Seances//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapperTexte(T.nom)}`,
    `X-WR-CALDESC:${echapperTexte(T.desc)}`,
    // Une indication : chaque application relit à son rythme (Google : plusieurs heures).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const [, s] of triees) {
    // ⚠️ LE JOUR DE COURSE EST UN ÉVÉNEMENT « JOURNÉE ENTIÈRE » : son heure de départ et sa durée
    // ne sont pas dans le plan (seuls l'échauffement et le retour au calme y sont écrits), et un
    // marathon bloqué 40 min à midi serait faux (relecture du 27/11/2026).
    const course = s.type === "Course";
    const { h, m } = heureDebut(s.moment);
    const duree = course ? 0 : dureeEvenementMin(s);
    const description = course
      ? T.jourCourse.replace("{url}", URL_PLAN)
      : `${T.duree.replace("{n}", String(duree))}\n\n${T.detail.replace("{url}", URL_PLAN)}`;
    l.push(
      "BEGIN:VEVENT",
      `UID:${prefixeUid}-${s.date}${s.moment ? `-${s.moment}` : ""}@pacevo.fr`,
      `DTSTAMP:${dtstamp}`,
      ...(course
        ? [`DTSTART;VALUE=DATE:${s.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${heureFlottante(s.date, 24, 0).slice(0, 8)}`]
        : [`DTSTART:${heureFlottante(s.date, h, m)}`, `DTEND:${heureFlottante(s.date, h, m, duree)}`]),
      `SUMMARY:${echapperTexte(titreEvenement(s.type, opts.lang))}`,
      `DESCRIPTION:${echapperTexte(description)}`,
      `URL:${URL_PLAN}`,
      course ? "TRANSP:TRANSPARENT" : "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  l.push("END:VCALENDAR");
  return l.map(plierLigne).join("\r\n") + "\r\n";
}
