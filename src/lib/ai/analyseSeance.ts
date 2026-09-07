// ─────────────────────────────────────────────────────────────────────────────
//  LES FAITS D'UNE SÉANCE — ce que le modèle a le droit d'écrire.
//
//  Le coach proposait la séance du jour ; aucune séance PASSÉE n'était jamais relue.
//  L'athlète voyait ses chiffres bruts et devait les interpréter seul, ce qui est
//  exactement le travail qu'il paie.
//
//  ⚠️ CE MODULE NE PARLE PAS AU MODÈLE. Il calcule des faits VÉRIFIABLES — intensité
//  réelle, répartition en zones, rang parmi les séances comparables, écart au prescrit —
//  et la route les lui donne en lui interdisant d'en inventer d'autres. C'est la seule
//  façon d'avoir une analyse qui ne raconte pas ce qui l'arrange : un modèle à qui on
//  tend des chiffres bruts en fabrique toujours un récit.
//
//  ⚠️ ET L'INTENSITÉ SE JUGE À LA FC, JAMAIS À L'ÉTIQUETTE. Mesuré sur un compte réel :
//  305 séances sur 334 sont dites « easy » par la montre, séances à 180 bpm comprises.
//  Se fier au champ `type` ferait analyser une séance de seuil comme un footing.
// ─────────────────────────────────────────────────────────────────────────────

/** Part de la FC max au-delà de laquelle une séance est DURE. Même valeur que le reste
 *  du coach (`PART_FC_DURE` dans coachContext) : deux seuils divergents donneraient deux
 *  verdicts différents sur la même séance selon l'écran. */
export const PART_FC_DURE = 0.85;
/** En deçà, la séance est un footing. Entre les deux, elle est « modérée ». */
export const PART_FC_FACILE = 0.75;
/** Écart de distance sous lequel deux séances sont jugées comparables. */
export const ECART_DISTANCE = 0.15;
/** En dessous, un classement ne veut rien dire. */
export const COMPARABLES_MIN = 4;
/**
 * FC moyenne en dessous de laquelle une séance de course n'est PAS crédible.
 *
 * ⚠️ VU SUR UN APPEL RÉEL. Une séance du compte porte 64 bpm de moyenne, 65 de maximum et
 * aucune distance : la montre a enregistré une période de repos. Le coach en a tiré
 * « une bonne gestion de l'effort malgré la chaleur » — il n'a inventé aucun chiffre, il
 * a inventé du SENS, ce qui est pire parce que ça ne se repère pas.
 */
export const FC_PLANCHER = 90;

export type SeanceBrute = {
  id?: string; date: string; title?: string | null; sport?: string | null;
  distance_km?: number | null; duration_seconds?: number | null;
  avg_pace_min_km?: number | null; gap_min_km?: number | null;
  avg_hr?: number | null; max_hr?: number | null;
  elevation_gain_m?: number | null; hr_zone_seconds?: unknown;
  avg_cadence_spm?: number | null; weather_temp_c?: number | null;
};

export type Reperes = { fcMax?: number | null; vma?: number | null; allureFacile?: string | null };

export type Prescrit = { type?: string | null; titre?: string | null; detail?: string | null } | null;

export type FaitsSeance = {
  /** Faux quand la séance n'a rien d'interprétable : le modèle doit alors se taire. */
  exploitable: boolean;
  date: string;
  sport: string;
  distanceKm: number | null;
  dureeMin: number | null;
  /** Allure réelle, en minutes par km. */
  allure: number | null;
  /** Allure corrigée du dénivelé, quand la montre la fournit. */
  allureCorrigee: number | null;
  fcMoy: number | null;
  fcMax: number | null;
  /** Part de la FC max de l'athlète, en %. `null` sans FC max connue. */
  partFcMax: number | null;
  intensite: "facile" | "moderee" | "dure" | null;
  /** Minutes passées dans chaque zone, mesurées par la montre. */
  zonesMin: number[] | null;
  dplus: number | null;
  tempC: number | null;
  cadence: number | null;
  /** Rang parmi les séances comparables, du plus rapide au plus lent. */
  rang: { place: number; total: number } | null;
  prescrit: { type: string; titre: string } | null;
  /** Ce qu'on NE SAIT PAS. Le modèle doit le dire au lieu de combler. */
  manques: string[];
};

const n = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const positif = (v: unknown): number | null => { const x = n(v); return x != null && x > 0 ? x : null; };

/** Minutes par zone. La montre renvoie des secondes, parfois en objet, parfois en tableau. */
export function zonesEnMinutes(brut: unknown): number[] | null {
  const t = Array.isArray(brut) ? brut
    : brut && typeof brut === "object" ? Object.values(brut as Record<string, unknown>)
    : null;
  if (!t || t.length === 0) return null;
  const min = t.map((v) => { const s = n(v); return s == null || s < 0 ? 0 : Math.round(s / 60); });
  // Une séance dont TOUTES les zones sont à zéro n'a pas été mesurée : la dire « 100 %
  // en zone 1 » serait une invention.
  return min.some((m) => m > 0) ? min : null;
}

/**
 * Faits d'une séance. Aucun n'est deviné : ce qui manque part dans `manques`, que la
 * route recopie dans l'invite pour que le modèle le dise plutôt que de le combler.
 *
 * @param comparables autres séances du même sport, pour situer celle-ci. Le rang n'est
 *                    calculé que sur des distances proches — comparer un 5 km à un
 *                    marathon ne dit rien.
 */
export function faitsDeSeance(
  s: SeanceBrute, reperes: Reperes = {}, comparables: readonly SeanceBrute[] = [], prescrit: Prescrit = null,
): FaitsSeance {
  const manques: string[] = [];
  const distanceKm = positif(s.distance_km);
  const dureeSec = positif(s.duration_seconds);
  const fcMoy = positif(s.avg_hr);
  const fcMaxAthlete = positif(reperes.fcMax);

  const allure = positif(s.avg_pace_min_km) ?? (distanceKm && dureeSec ? dureeSec / 60 / distanceKm : null);
  const allureCorrigee = positif(s.gap_min_km);
  if (allureCorrigee == null && positif(s.elevation_gain_m)) {
    manques.push("allure corrigée du dénivelé non fournie par la montre : le relief n'est pas neutralisé");
  }

  const partFcMax = fcMoy != null && fcMaxAthlete != null ? Math.round((fcMoy / fcMaxAthlete) * 100) : null;
  if (fcMoy == null) manques.push("aucune fréquence cardiaque enregistrée");
  else if (fcMaxAthlete == null) manques.push("FC maximale de l'athlète inconnue : l'intensité ne peut pas être située");

  // ⚠️ L'INTENSITÉ VIENT DE LA FC, PAS DU CHAMP `type` de la montre.
  const intensite: FaitsSeance["intensite"] = partFcMax == null ? null
    : partFcMax >= PART_FC_DURE * 100 ? "dure"
    : partFcMax >= PART_FC_FACILE * 100 ? "moderee" : "facile";

  // ── LA SÉANCE EST-ELLE SEULEMENT EXPLOITABLE ? ──────────────────────────────
  // Sans distance NI durée, il n'y a pas de séance : l'analyser reviendrait à commenter
  // une ligne vide, ce que le modèle fait très volontiers si on ne l'en empêche pas.
  const vide = distanceKm == null && dureeSec == null;
  if (vide) manques.push("séance quasiment vide : ni distance ni durée enregistrées — il n'y a rien à interpréter, et il faut le dire");
  if (fcMoy != null && fcMoy < FC_PLANCHER) {
    manques.push(`fréquence cardiaque moyenne de ${Math.round(fcMoy)} : incompatible avec une course, la montre a probablement enregistré du repos — ne rien conclure de cette séance`);
  }

  const zonesMin = zonesEnMinutes(s.hr_zone_seconds);
  if (zonesMin == null) manques.push("temps passé en zones non mesuré");

  // Rang parmi les séances de distance proche, à l'allure corrigée du relief quand elle
  // existe. Sans assez de points de comparaison, on ne classe pas.
  const rang = (() => {
    if (distanceKm == null) return null;
    const vitesse = (w: SeanceBrute) => {
      const a = positif(w.gap_min_km) ?? positif(w.avg_pace_min_km);
      return a != null ? a : null;
    };
    const moi = allureCorrigee ?? allure;
    if (moi == null) return null;
    const proches = comparables.filter((w) => {
      const d = positif(w.distance_km);
      return d != null && Math.abs(d - distanceKm) / distanceKm <= ECART_DISTANCE && vitesse(w) != null;
    });
    if (proches.length + 1 < COMPARABLES_MIN) return null;
    const plusRapides = proches.filter((w) => (vitesse(w) as number) < moi).length;
    return { place: plusRapides + 1, total: proches.length + 1 };
  })();

  return {
    exploitable: !vide && !(fcMoy != null && fcMoy < FC_PLANCHER),
    date: String(s.date ?? "").slice(0, 10),
    sport: String(s.sport ?? "run"),
    distanceKm: distanceKm == null ? null : Math.round(distanceKm * 100) / 100,
    dureeMin: dureeSec == null ? null : Math.round(dureeSec / 60),
    allure: allure == null ? null : Math.round(allure * 100) / 100,
    allureCorrigee: allureCorrigee == null ? null : Math.round(allureCorrigee * 100) / 100,
    fcMoy, fcMax: positif(s.max_hr), partFcMax, intensite, zonesMin,
    dplus: n(s.elevation_gain_m), tempC: n(s.weather_temp_c), cadence: positif(s.avg_cadence_spm),
    rang,
    prescrit: prescrit?.type ? { type: String(prescrit.type), titre: String(prescrit.titre ?? "") } : null,
    manques,
  };
}

/** Allure en `m'ss`, ou `null`. Écrire « 4.75 min/km » à un coureur n'a aucun sens. */
export function allureTexte(minParKm: number | null): string | null {
  if (minParKm == null || !Number.isFinite(minParKm) || minParKm <= 0) return null;
  const m = Math.floor(minParKm);
  const s = Math.round((minParKm - m) * 60);
  return s === 60 ? `${m + 1}'00` : `${m}'${String(s).padStart(2, "0")}`;
}

/**
 * Date en toutes lettres. Le modèle RECOPIE ce qu'on lui donne : lui tendre
 * « 2026-08-24 » lui faisait servir cette chaîne telle quelle à l'athlète.
 *
 * ⚠️ CE QUI PROTÈGE LA DATE, C'EST `timeZone: "UTC"` — pas l'heure de midi. J'avais
 * d'abord écrit l'inverse ; la mutation l'a démenti : passer le parse à minuit ne change
 * RIEN tant que le formatage est forcé en UTC. Sans ce `timeZone`, en revanche, le
 * serveur (iad1, aux États-Unis) reculerait la date d'un jour. Le parse à midi reste une
 * ceinture de sécurité si quelqu'un retire un jour le `timeZone`.
 */
export function dateLisible(iso: string, lang = "fr"): string {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  if (!Number.isFinite(d.getTime())) return String(iso);
  const etiquette: Record<string, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };
  return d.toLocaleDateString(etiquette[lang] ?? "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
