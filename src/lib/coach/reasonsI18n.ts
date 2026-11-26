// ─────────────────────────────────────────────────────────────────────────────
//  MOTIFS DE FRAÎCHEUR — les 5 langues.
//
//  Ces motifs ne restent pas dans un tableau de bord : le plan les RECOPIE dans le
//  « pourquoi » des séances (« Aujourd'hui ton corps demande de la récupération :
//  VFC sous sa base, sommeil dégradé (58/100) »). Les laisser en français, c'était
//  livrer un « pourquoi » allemand qui bascule en français au milieu de la phrase.
//
//  ⚠️ La version française reste canonique : elle part dans le prompt du modèle et
//  dans le bandeau « pourquoi ce plan ». Les autres langues ne servent qu'à l'affichage.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesMotifs = {
  douleur: (zones: string) => string;
  /** « , dont 34 % venant d'un autre sport (3 × vélo…) » — d'où vient VRAIMENT la charge. */
  origineCross: (pct: number, label: string) => string;
  ratioRisque: (acr: string, origine: string) => string;
  tsbProfond: (tsb: string, origine: string) => string;
  vfcEtNuit: string;
  vfcBasse: string;
  sommeilDegrade: (score: string) => string;
  /** Dette CUMULÉE : la nuit dernière peut être correcte et l'athlète en manque quand même. */
  detteSommeil: (manque: string, nuits: string) => string;
  /** Chute d'UN matin sous sa propre base — invisible pour une moyenne de 7 jours. */
  vfcChute: (chute: string, valeur: string, base: string) => string;
  chargeAigue: (acr: string) => string;
  monotonie: (m: string) => string;
  rpeDerniere: (rpe: string) => string;
  rpeDuree: (moyen: string) => string;
  /** Fragments du constat « charge vue mais qualité maintenue ». */
  partRatio: (acr: string) => string;
  partTsb: (tsb: string) => string;
  chargeVueMaisMaintenue: (parts: string) => string;
  /** Récupération après une course courue (`lib/coach/apresCourse`). La date est déjà
   *  mise en forme dans la langue ; le nom de la course est un nom propre, il ne se
   *  traduit pas. */
  apresCourse: (course: string, jours: string, reprise: string, volumePct: string) => string;
  /** La reprise qui suit : une séance courte au seuil par semaine jusqu'à `fin`, premier
   *  jour d'entraînement normal (date déjà mise en forme). */
  repriseApresCourse: (course: string, jours: string, fin: string, volumePct: string) => string;
  /** Reprise après un arrêt de 6 à 28 jours (`lib/coach/repriseArret`). `enCours` : aucune
   *  sortie depuis — la montre peut aussi avoir cessé de synchroniser, on le dit. `qualite` :
   *  le nombre de séances dures permises PAR SEMAINE (0 ou 1), dit lui aussi. `arretLong` : plus
   *  de 14 jours d'arrêt — la séance dure attend la seconde moitié de la reprise, une sortie
   *  facile ne suffit pas, et le texte ne le laisse pas croire. `volumePct` : `null` quand le
   *  volume habituel n'est pas connu — aucun pourcentage n'est alors annoncé (le plan ne peut
   *  pas viser « la moitié » d'une habitude qu'il ignore), et le texte le dit. « On reprend par
   *  des footings » ne se dit que tant que l'athlète n'a pas repris : une fois reparti, une
   *  séance de qualité par semaine peut être permise, et le texte ne dit pas le contraire. */
  /** `plancher` : le plafond de la semaine est au plancher de deux footings, aucun pourcentage n'est dit (`volumePct`
   *  est alors `null`). « long » : pendant la reprise d'un arrêt de plus de 28 jours, les dernières semaines ne sont
   *  pas un repère. « court » : hors de là, l'habitude est réelle, le motif dit le minimum d'une semaine de reprise.
   *  « petit » : l'habitude est plus petite que deux footings, le plafond vaut l'habitude, rien n'est réduit.
   *  Au plancher, la semaine ne porte que des footings (ni séance au seuil ni sortie longue) : avec `qualite` à
   *  "footings", la fin du motif dit seulement « footings seulement cette semaine », sans parler de la sortie longue.
   *  `qualite` à "petite" : la semaine est trop petite pour porter une séance dure ET un footing (toute reprise,
   *  plancher ou non) : « footings seulement cette semaine : elle est trop petite… ». */
  repriseArret: (jours: string, volumePct: string | null, enCours: boolean, qualite: 0 | 1 | "footings" | "petite", arretLong: boolean, plancher?: "long" | "court" | "petit" | null) => string;
  /** Reprise après un arrêt de PLUS de 28 jours (`arretHorsEchelle`, `repriseVolumeLongArret`).
   *  L'intensité se dit : rien de dur pendant les deux premières semaines, puis une séance par
   *  semaine jusqu'à la quatrième.
   *  `volumePct` : le plafond de volume (Daniels : 33, 50, 70 ou 75, 85 % du volume d'AVANT l'arrêt),
   *  dit « au plus » parce que c'est un maximum ; `null` quand ce volume n'est pas connu.
   *  `qualite` : `null` une fois les quatre semaines de la règle d'intensité passées, quand seul
   *  le plafond de volume court encore (`volumePct` est alors toujours fourni).
   *  `qualite` : 0 = aucune séance dure encore, 1 = une par semaine au plus, "footings" = semaine sans sortie longue ni
   *  séance dure, `null` = seul le plafond se dit. `palierRemonte` : le pourcentage n'est pas celui de Daniels (petit
   *  volume, palier relevé pour garder deux footings) et Daniels n'est pas cité. `finJour` : le rang du jour de reprise
   *  où la règle d'intensité s'arrête quand ce n'est pas le 28ᵉ (`finRegleIntensite`) ; absent, le texte dit « la
   *  quatrième semaine ». `plancherKm` : aucun palier ne laisse deux footings au coureur (petit volume d'avant
   *  l'arrêt) et le plafond s'est replié sur ce plancher (`plafondReplieSurPlancher`) : le motif le dit en
   *  KILOMÈTRES (« 12 km au plus cette semaine »), sans pourcentage ni Daniels, et la semaine « footings seulement »
   *  ne parle pas de la sortie longue. */
  repriseLongArret: (jours: string, enCours: boolean, qualite: 0 | 1 | "footings" | "petite" | null, volumePct: string | null, volumeInconnu?: boolean, palierRemonte?: boolean, finJour?: string | null, plancherKm?: string | null) => string;
  /** La marche de sortie de la règle d'intensité d'un arrêt de plus de 28 jours : deux séances au plus, sans VMA ni côtes. */
  /** `footingsSeuls` : la semaine est trop petite pour porter une séance dure et un footing, elle ne porte que des
   *  footings (`semaineTropPetitePourQualite`) ; le motif le dit à la place des deux séances permises. */
  sortieReprise: (jours: string, footingsSeuls?: boolean) => string;
  /** Programme marche-course en cours (`lib/coach/marcheCourse`). */
  marcheCourse: (etape: string, total: string) => string;
  /** Course B ou C dans les sept jours du plan (`lib/coach/saison`) ; date déjà mise en forme. */
  courseSecondaire: (nom: string, date: string, b: boolean) => string;
};

export const MOTIF_T: Record<Lang, TextesMotifs> = {
  fr: {
    douleur: (z) => `douleur en cours (${z})`,
    origineCross: (p, l) => `, dont ${p} % venant d'un autre sport (${l})`,
    ratioRisque: (a, o) => `ratio aigu:chronique ${a} (zone de risque de blessure)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (fatigue profonde)${o}`,
    vfcEtNuit: "VFC en baisse ET nuit dégradée (double signal)",
    vfcBasse: "VFC sous sa base",
    sommeilDegrade: (s) => `sommeil dégradé (${s}/100)`,
    detteSommeil: (m, n) => `dette de sommeil : ${m} de retard sur ${n} nuits`,
    vfcChute: (c, v, b) => `VFC en chute nette (${c} sous ta base : ${v} contre ${b} ms)`,
    chargeAigue: (a) => `charge aiguë élevée (${a})`,
    monotonie: (m) => `monotonie ${m} (charge trop uniforme)`,
    rpeDerniere: (r) => `dernière séance vécue très dure (RPE ${r}/10)`,
    rpeDuree: (m) => `ressenti élevé sur la durée (RPE moyen ${m}/10 sur ses 3 derniers retours)`,
    partRatio: (a) => `ratio aigu:chronique ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `charge récente élevée (${p}) MAIS VFC nettement au-dessus de sa base, sommeil correct et aucune douleur : la qualité est maintenue. À surveiller si la VFC redescend.`,
    apresCourse: (c, j, r, v) => `récupération après ${c} (J+${j}) : pas d'intensité avant le ${r}, footings seulement d'ici là, et ${v} % de ton volume habituel cette semaine — un jour facile par tranche de 3 km courus`,
    repriseApresCourse: (c, j, f, v) => `reprise après ${c} (J+${j}) : une seule séance de qualité par semaine, courte et au seuil, et ${v} % de ton volume habituel cette semaine ; entraînement normal à partir du ${f} — ni VMA ni course avant un jour par mile couru`,
    repriseArret: (j, v, enCours, q, long, pl) => enCours
      ? `aucune course enregistrée depuis ${j} jours : ${v == null ? (pl === "court" ? "on reprend par deux footings courts, le minimum d'une semaine de reprise" : pl === "petit" ? "on reprend par des footings, sans réduire un volume habituel déjà petit" : pl === "long" ? "on reprend par des footings, ton volume des dernières semaines étant trop faible pour servir de repère" : "on reprend par des footings, ton volume habituel n'étant pas encore connu") : `on repart à ${v} % de ton volume habituel cette semaine (règle de Daniels)`}, ${long ? "sans séance dure avant la seconde moitié de la reprise" : "sans séance dure tant que tu n'as pas refait une sortie facile"}. Si tu as couru, ta montre ne synchronise plus : vérifie sa connexion`
      : `reprise après ${j} jours sans courir : ${v == null ? (pl === "court" ? "deux footings courts cette semaine, le minimum d'une semaine de reprise" : pl === "petit" ? "ton volume habituel est déjà petit, il n'est pas réduit cette semaine" : pl === "long" ? "ton volume des dernières semaines est trop faible pour servir de repère" : "ton volume habituel n'est pas encore connu") : `${v} % de ton volume habituel cette semaine`} — la reprise dure autant que l'arrêt (règle de Daniels) ; ${q === "petite" ? "footings seulement cette semaine : elle est trop petite pour porter une séance dure et un footing" : q === "footings" ? (pl ? "footings seulement cette semaine" : "footings seulement cette semaine : ta sortie longue serait plus courte que ta sortie habituelle, elle n'est pas posée, et la séance dure attend son retour") : q ? "une seule séance de qualité par semaine au plus, courte, jusqu'à la fin de la reprise" : "aucune séance dure pendant la première moitié de la reprise"}`,
    repriseLongArret: (j, enCours, q, v, inconnu, remonte, f, km) => enCours
      ? q == null ? `aucune course enregistrée depuis ${j} jours : ${km ? `${km} km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit` : `${v} % au plus de ton volume d'avant l'arrêt cette semaine${remonte ? "" : " (règle de Daniels)"}`}. Si tu as couru, ta montre ne synchronise plus : vérifie sa connexion` : `aucune course enregistrée depuis ${j} jours : on reprend par des footings${v == null ? (inconnu ? ", sans plafond de volume car ton volume d'avant l'arrêt n'est pas connu" : "") : `, à ${km ? `${km} km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit` : `${v} % au plus de ton volume d'avant l'arrêt cette semaine${remonte ? "" : " (règle de Daniels)"}`}`}, sans séance dure pendant les deux premières semaines de reprise. Si tu as couru, ta montre ne synchronise plus : vérifie sa connexion`
      : q == null
        ? `reprise après ${j} jours sans courir : ${km ? `${km} km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit` : `${v} % au plus de ton volume d'avant l'arrêt cette semaine${remonte ? "" : " (règle de Daniels)"}`}`
        : `reprise après ${j} jours sans courir : ${v == null ? (inconnu ? "ton volume d'avant l'arrêt n'est pas connu, aucun plafond de volume n'est posé ; " : "") : `${km ? `${km} km au plus cette semaine, ton volume d'avant l'arrêt étant déjà petit` : `${v} % au plus de ton volume d'avant l'arrêt cette semaine${remonte ? "" : " (règle de Daniels)"}`} ; `}${q === "petite" ? "footings seulement cette semaine : elle est trop petite pour porter une séance dure et un footing" : q === "footings" ? (km ? "footings seulement cette semaine" : "footings seulement cette semaine : ta sortie longue serait plus courte que ta sortie habituelle, elle n'est pas posée, et la séance dure attend son retour") : q ? `une seule séance de qualité par semaine au plus, courte, ${f ? `jusqu'au ${f}ᵉ jour de reprise` : "jusqu'à la fin de la quatrième semaine de reprise"}` : `aucune séance dure pendant les deux premières semaines de reprise, puis une seule par semaine ${f ? `jusqu'au ${f}ᵉ jour` : "jusqu'à la quatrième"}`}`,
    sortieReprise: (j, f) => `fin de la reprise après ${j} jours sans courir : ${f ? "footings seulement cette semaine, elle est trop petite pour porter une séance dure et un footing" : "deux séances de qualité au plus cette semaine, sans VMA ni côtes"}`,
    marcheCourse: (e, t) => `programme marche-course, étape ${e}/${t} : ni séance de qualité ni test VMA tant que tu ne cours pas 30 minutes d'affilée — la course s'allonge à chaque étape`,
    courseSecondaire: (n, d, b) => b ? `course B cette semaine : ${n} (${d}) — deux jours calmes avant et une semaine allégée de 15 %, puis la récupération` : `course C cette semaine : ${n} (${d}) — elle remplace une séance de qualité, sans affûtage`,
  },
  en: {
    douleur: (z) => `ongoing pain (${z})`,
    origineCross: (p, l) => `, ${p} % of it coming from another sport (${l})`,
    ratioRisque: (a, o) => `acute:chronic ratio ${a} (injury risk zone)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (deep fatigue)${o}`,
    vfcEtNuit: "HRV falling AND a poor night (double signal)",
    vfcBasse: "HRV below its baseline",
    sommeilDegrade: (s) => `degraded sleep (${s}/100)`,
    detteSommeil: (m, n) => `sleep debt: ${m} short over ${n} nights`,
    vfcChute: (c, v, b) => `sharp HRV drop (${c} below your baseline: ${v} vs ${b} ms)`,
    chargeAigue: (a) => `high acute load (${a})`,
    monotonie: (m) => `monotony ${m} (load too uniform)`,
    rpeDerniere: (r) => `last session felt very hard (RPE ${r}/10)`,
    rpeDuree: (m) => `high perceived effort over time (average RPE ${m}/10 across your last 3 reports)`,
    partRatio: (a) => `acute:chronic ratio ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `high recent load (${p}) BUT HRV clearly above baseline, decent sleep and no pain: the quality session stays. To watch if HRV comes back down.`,
    apresCourse: (c, j, r, v) => `recovering from ${c} (day ${j} after): no hard sessions before ${r}, easy runs only until then, and ${v}% of your usual volume this week — one easy day per 3 km raced`,
    repriseApresCourse: (c, j, f, v) => `easing back after ${c} (day ${j} after): one short threshold session a week at most, and ${v}% of your usual volume this week; normal training from ${f} — no VO2max work or racing before one day per mile raced`,
    repriseArret: (j, v, enCours, q, long, pl) => enCours
      ? `no run recorded for ${j} days: ${v == null ? (pl === "court" ? "we restart with two short easy runs, the minimum for a comeback week" : pl === "petit" ? "we restart with easy runs, without cutting a usual volume that is already small" : pl === "long" ? "we restart with easy runs, as your volume over the last few weeks is too low to serve as a reference" : "we restart with easy runs, as your usual volume is not known yet") : `we restart at ${v}% of your usual volume this week (Daniels' rule)`}, ${long ? "with no hard session before the second half of the comeback" : "with no hard session until you have done one easy run again"}. If you did run, your watch is no longer syncing: check its connection`
      : `back after ${j} days without running: ${v == null ? (pl === "court" ? "two short easy runs this week, the minimum for a comeback week" : pl === "petit" ? "your usual volume is already small, so it is not cut this week" : pl === "long" ? "your volume over the last few weeks is too low to serve as a reference" : "your usual volume is not known yet") : `${v}% of your usual volume this week`} — the comeback lasts as long as the break (Daniels' rule); ${q === "petite" ? "easy runs only this week: it is too small to hold a hard session and an easy run" : q === "footings" ? (pl ? "easy runs only this week" : "easy runs only this week: your long run would be shorter than your usual run, so it is not scheduled, and the hard session waits until it is back") : q ? "one quality session a week at most, a short one, until the comeback is over" : "no hard session during the first half of the comeback"}`,
    repriseLongArret: (j, enCours, q, v, inconnu, remonte, f, km) => enCours
      ? q == null ? `no run recorded for ${j} days: ${km ? `no more than ${km} km this week, as your pre-break volume was already small` : `no more than ${v}% of your pre-break volume this week${remonte ? "" : " (Daniels' rule)"}`}. If you did run, your watch is no longer syncing: check its connection` : `no run recorded for ${j} days: we restart with easy runs only${v == null ? (inconnu ? ", with no volume cap because your pre-break volume is not known" : "") : `, at ${km ? `no more than ${km} km this week, as your pre-break volume was already small` : `no more than ${v}% of your pre-break volume this week${remonte ? "" : " (Daniels' rule)"}`}`}, with no hard session during the first two weeks back. If you did run, your watch is no longer syncing: check its connection`
      : q == null
        ? `back after ${j} days without running: ${km ? `no more than ${km} km this week, as your pre-break volume was already small` : `no more than ${v}% of your pre-break volume this week${remonte ? "" : " (Daniels' rule)"}`}`
        : `back after ${j} days without running: ${v == null ? (inconnu ? "your pre-break volume is not known, so no volume cap is set; " : "") : `${km ? `no more than ${km} km this week, as your pre-break volume was already small` : `no more than ${v}% of your pre-break volume this week${remonte ? "" : " (Daniels' rule)"}`}; `}${q === "petite" ? "easy runs only this week: it is too small to hold a hard session and an easy run" : q === "footings" ? (km ? "easy runs only this week" : "easy runs only this week: your long run would be shorter than your usual run, so it is not scheduled, and the hard session waits until it is back") : q ? `one quality session a week at most, a short one, ${f ? `until day ${f} of your comeback` : "until the end of your fourth week back"}` : `no hard session during the first two weeks back, then one a week ${f ? `until day ${f}` : "until the fourth"}`}`,
    sortieReprise: (j, f) => `end of your comeback after ${j} days without running: ${f ? "easy runs only this week, it is too small to hold a hard session and an easy run" : "two quality sessions at most this week, with no VO2max or hill sessions"}`,
    marcheCourse: (e, t) => `walk/run programme, stage ${e}/${t}: no hard sessions and no VO2max test until you can run 30 minutes non-stop — the running gets longer at every stage`,
    courseSecondaire: (n, d, b) => b ? `B race this week: ${n} (${d}) — two easy days before and a week 15% lighter, then recovery` : `C race this week: ${n} (${d}) — it replaces a quality session, no taper`,
  },
  de: {
    douleur: (z) => `bestehende Schmerzen (${z})`,
    origineCross: (p, l) => `, davon ${p} % aus einer anderen Sportart (${l})`,
    ratioRisque: (a, o) => `Akut-Chronisch-Verhältnis ${a} (Verletzungsrisiko-Bereich)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (tiefe Ermüdung)${o}`,
    vfcEtNuit: "HRV fallend UND schlechte Nacht (Doppelsignal)",
    vfcBasse: "HRV unter ihrem Ausgangswert",
    sommeilDegrade: (s) => `verschlechterter Schlaf (${s}/100)`,
    detteSommeil: (m, n) => `Schlafdefizit: ${m} Rückstand über ${n} Nächte`,
    vfcChute: (c, v, b) => `deutlicher HRV-Einbruch (${c} unter deinem Ausgangswert: ${v} statt ${b} ms)`,
    chargeAigue: (a) => `hohe akute Belastung (${a})`,
    monotonie: (m) => `Monotonie ${m} (Belastung zu gleichförmig)`,
    rpeDerniere: (r) => `letzte Einheit sehr hart empfunden (RPE ${r}/10)`,
    rpeDuree: (m) => `dauerhaft hohes Anstrengungsempfinden (RPE-Mittel ${m}/10 über deine letzten 3 Rückmeldungen)`,
    partRatio: (a) => `Akut-Chronisch-Verhältnis ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `hohe jüngste Belastung (${p}), ABER HRV deutlich über dem Ausgangswert, ordentlicher Schlaf und keine Schmerzen: die Qualitätseinheit bleibt. Im Auge behalten, falls die HRV wieder fällt.`,
    apresCourse: (c, j, r, v) => `Erholung nach ${c} (Tag ${j} danach): keine intensiven Einheiten vor dem ${r}, bis dahin nur lockere Läufe, und ${v} % deines üblichen Umfangs diese Woche — ein lockerer Tag pro 3 gelaufene Kilometer`,
    repriseApresCourse: (c, j, f, v) => `Wiedereinstieg nach ${c} (Tag ${j} danach): höchstens eine kurze Schwelleneinheit pro Woche und ${v} % deines üblichen Umfangs diese Woche; normales Training ab dem ${f} — kein VO2max-Training und kein Wettkampf vor einem Tag pro gelaufener Meile`,
    repriseArret: (j, v, enCours, q, long, pl) => enCours
      ? `seit ${j} Tagen kein Lauf aufgezeichnet: ${v == null ? (pl === "court" ? "Diese Woche starten wir mit zwei kurzen lockeren Läufen neu, dem Minimum einer Wiedereinstiegswoche" : pl === "petit" ? "Diese Woche starten wir mit lockeren Läufen neu, ohne deinen ohnehin kleinen üblichen Umfang zu kürzen" : pl === "long" ? "Diese Woche starten wir mit lockeren Läufen neu, da dein Umfang der letzten Wochen zu gering ist, um als Maßstab zu dienen" : "Diese Woche starten wir mit lockeren Läufen neu, da dein üblicher Umfang noch nicht bekannt ist") : `Diese Woche starten wir mit ${v} % deines üblichen Umfangs neu (Daniels-Regel)`}, ${long ? "ohne harte Einheit vor der zweiten Hälfte des Wiedereinstiegs" : "ohne harte Einheit, bevor du wieder einen lockeren Lauf gemacht hast"}. Falls du gelaufen bist, synchronisiert deine Uhr nicht mehr: Prüfe ihre Verbindung`
      : `Wiedereinstieg nach ${j} Tagen ohne Laufen: ${v == null ? (pl === "court" ? "diese Woche zwei kurze lockere Läufe, das Minimum einer Wiedereinstiegswoche" : pl === "petit" ? "dein üblicher Umfang ist ohnehin klein und wird diese Woche nicht gekürzt" : pl === "long" ? "dein Umfang der letzten Wochen ist zu gering, um als Maßstab zu dienen" : "dein üblicher Umfang ist noch nicht bekannt") : `${v} % deines üblichen Umfangs diese Woche`} — der Wiedereinstieg dauert so lange wie die Pause (Daniels-Regel); ${q === "petite" ? "diese Woche nur lockere Läufe: Sie ist zu klein für eine harte Einheit und einen lockeren Lauf" : q === "footings" ? (pl ? "diese Woche nur lockere Läufe" : "vorerst nur lockere Läufe: Dein langer Lauf wäre kürzer als dein üblicher Lauf und wird deshalb nicht eingeplant, die harte Einheit wartet, bis er zurück ist") : q ? "höchstens eine kurze Qualitätseinheit pro Woche, bis der Wiedereinstieg abgeschlossen ist" : "keine harte Einheit in der ersten Hälfte des Wiedereinstiegs"}`,
    repriseLongArret: (j, enCours, q, v, inconnu, remonte, f, km) => enCours
      ? q == null ? `seit ${j} Tagen kein Lauf aufgezeichnet: diese Woche ${km ? `höchstens ${km} km, weil dein Umfang vor der Pause schon klein war` : `höchstens ${v} % deines Umfangs vor der Pause${remonte ? "" : " (Daniels-Regel)"}`}. Falls du gelaufen bist, synchronisiert deine Uhr nicht mehr: Prüfe ihre Verbindung` : `seit ${j} Tagen kein Lauf aufgezeichnet: Wir steigen nur mit lockeren Läufen wieder ein${v == null ? (inconnu ? ", ohne Umfangsgrenze, weil dein Umfang vor der Pause nicht bekannt ist" : "") : `, diese Woche mit ${km ? `höchstens ${km} km, weil dein Umfang vor der Pause schon klein war` : `höchstens ${v} % deines Umfangs vor der Pause${remonte ? "" : " (Daniels-Regel)"}`}`}, ohne harte Einheit in den ersten zwei Wochen. Falls du gelaufen bist, synchronisiert deine Uhr nicht mehr: Prüfe ihre Verbindung`
      : q == null
        ? `Wiedereinstieg nach ${j} Tagen ohne Laufen: diese Woche ${km ? `höchstens ${km} km, weil dein Umfang vor der Pause schon klein war` : `höchstens ${v} % deines Umfangs vor der Pause${remonte ? "" : " (Daniels-Regel)"}`}`
        : `Wiedereinstieg nach ${j} Tagen ohne Laufen: ${v == null ? (inconnu ? "dein Umfang vor der Pause ist nicht bekannt, es gilt keine Umfangsgrenze; " : "") : `diese Woche ${km ? `höchstens ${km} km, weil dein Umfang vor der Pause schon klein war` : `höchstens ${v} % deines Umfangs vor der Pause${remonte ? "" : " (Daniels-Regel)"}`}; `}${q === "petite" ? "diese Woche nur lockere Läufe: Sie ist zu klein für eine harte Einheit und einen lockeren Lauf" : q === "footings" ? (km ? "diese Woche nur lockere Läufe" : "vorerst nur lockere Läufe: Dein langer Lauf wäre kürzer als dein üblicher Lauf und wird deshalb nicht eingeplant, die harte Einheit wartet, bis er zurück ist") : q ? `höchstens eine kurze Qualitätseinheit pro Woche, ${f ? `bis Tag ${f} des Wiedereinstiegs` : "bis zum Ende der vierten Woche"}` : `keine harte Einheit in den ersten zwei Wochen, danach höchstens eine pro Woche ${f ? `bis Tag ${f}` : "bis zur vierten"}`}`,
    sortieReprise: (j, f) => `Ende des Wiedereinstiegs nach ${j} Tagen ohne Laufen: ${f ? "diese Woche nur lockere Läufe, sie ist zu klein für eine harte Einheit und einen lockeren Lauf" : "diese Woche höchstens zwei Qualitätseinheiten, ohne VMA- und Bergeinheiten"}`,
    marcheCourse: (e, t) => `Geh-Lauf-Programm, Stufe ${e}/${t}: keine intensiven Einheiten und kein VMA-Test, bis du 30 Minuten am Stück laufen kannst — das Laufen wird mit jeder Stufe länger`,
    courseSecondaire: (n, d, b) => b ? `B-Rennen diese Woche: ${n} (${d}) — zwei ruhige Tage davor und eine um 15 % leichtere Woche, danach Erholung` : `C-Rennen diese Woche: ${n} (${d}) — es ersetzt eine Qualitätseinheit, ohne Tapering`,
  },
  es: {
    douleur: (z) => `dolor en curso (${z})`,
    origineCross: (p, l) => `, de los cuales un ${p} % viene de otro deporte (${l})`,
    ratioRisque: (a, o) => `ratio agudo:crónico ${a} (zona de riesgo de lesión)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (fatiga profunda)${o}`,
    vfcEtNuit: "VFC a la baja Y noche degradada (doble señal)",
    vfcBasse: "VFC por debajo de su base",
    sommeilDegrade: (s) => `sueño degradado (${s}/100)`,
    detteSommeil: (m, n) => `deuda de sueño: ${m} de retraso en ${n} noches`,
    vfcChute: (c, v, b) => `caída marcada de la VFC (${c} por debajo de tu base: ${v} frente a ${b} ms)`,
    chargeAigue: (a) => `carga aguda elevada (${a})`,
    monotonie: (m) => `monotonía ${m} (carga demasiado uniforme)`,
    rpeDerniere: (r) => `última sesión vivida como muy dura (RPE ${r}/10)`,
    rpeDuree: (m) => `esfuerzo percibido alto de forma sostenida (RPE medio ${m}/10 en tus 3 últimos registros)`,
    partRatio: (a) => `ratio agudo:crónico ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `carga reciente elevada (${p}) PERO VFC claramente por encima de su base, sueño correcto y sin dolor: la sesión de calidad se mantiene. A vigilar si la VFC vuelve a bajar.`,
    apresCourse: (c, j, r, v) => `recuperación tras ${c} (día ${j} después): sin intensidad antes del ${r}, solo rodajes suaves hasta entonces, y un ${v} % de tu volumen habitual esta semana — un día suave por cada 3 km corridos`,
    repriseApresCourse: (c, j, f, v) => `vuelta tras ${c} (día ${j} después): como máximo una sesión corta de umbral por semana y un ${v} % de tu volumen habitual esta semana; entrenamiento normal a partir del ${f} — ni VMA ni carreras antes de un día por cada milla corrida`,
    repriseArret: (j, v, enCours, q, long, pl) => enCours
      ? `ninguna carrera registrada desde hace ${j} días: ${v == null ? (pl === "court" ? "esta semana retomamos con dos rodajes cortos, lo mínimo de una semana de vuelta" : pl === "petit" ? "esta semana retomamos con rodajes suaves, sin reducir un volumen habitual que ya es pequeño" : pl === "long" ? "esta semana retomamos con rodajes suaves, porque tu volumen de las últimas semanas es demasiado bajo para servir de referencia" : "esta semana retomamos con rodajes suaves, porque tu volumen habitual aún no se conoce") : `esta semana retomamos al ${v} % de tu volumen habitual (regla de Daniels)`}, ${long ? "sin sesión dura antes de la segunda mitad de la vuelta" : "sin sesión dura hasta que hayas hecho de nuevo una salida suave"}. Si has corrido, tu reloj ya no sincroniza: revisa su conexión`
      : `vuelta tras ${j} días sin correr: ${v == null ? (pl === "court" ? "dos rodajes cortos esta semana, lo mínimo de una semana de vuelta" : pl === "petit" ? "tu volumen habitual ya es pequeño y no se reduce esta semana" : pl === "long" ? "tu volumen de las últimas semanas es demasiado bajo para servir de referencia" : "tu volumen habitual aún no se conoce") : `un ${v} % de tu volumen habitual esta semana`}; la vuelta dura tanto como la pausa (regla de Daniels); ${q === "petite" ? "solo rodajes suaves esta semana: es demasiado corta para una sesión dura y un rodaje" : q === "footings" ? (pl ? "solo rodajes suaves esta semana" : "solo rodajes suaves esta semana: tu tirada larga sería más corta que tu salida habitual, así que no se programa, y la sesión dura espera a que vuelva") : q ? "como máximo una sesión de calidad por semana, corta, hasta el final de la vuelta" : "ninguna sesión dura durante la primera mitad de la vuelta"}`,
    repriseLongArret: (j, enCours, q, v, inconnu, remonte, f, km) => enCours
      ? q == null ? `ninguna carrera registrada desde hace ${j} días: esta semana ${km ? `como máximo ${km} km, porque tu volumen de antes de la pausa ya era pequeño` : `como máximo un ${v} % de tu volumen de antes de la pausa${remonte ? "" : " (regla de Daniels)"}`}. Si has corrido, tu reloj ya no sincroniza: revisa su conexión` : `ninguna carrera registrada desde hace ${j} días: retomamos solo con rodajes suaves${v == null ? (inconnu ? ", sin límite de volumen porque no conocemos tu volumen de antes de la pausa" : "") : `, esta semana ${km ? `como máximo ${km} km, porque tu volumen de antes de la pausa ya era pequeño` : `como máximo al ${v} % de tu volumen de antes de la pausa${remonte ? "" : " (regla de Daniels)"}`}`}, sin sesión dura durante las dos primeras semanas. Si has corrido, tu reloj ya no sincroniza: revisa su conexión`
      : q == null
        ? `vuelta tras ${j} días sin correr: esta semana ${km ? `como máximo ${km} km, porque tu volumen de antes de la pausa ya era pequeño` : `como máximo un ${v} % de tu volumen de antes de la pausa${remonte ? "" : " (regla de Daniels)"}`}`
        : `vuelta tras ${j} días sin correr: ${v == null ? (inconnu ? "no conocemos tu volumen de antes de la pausa, así que no hay límite de volumen; " : "") : `esta semana ${km ? `como máximo ${km} km, porque tu volumen de antes de la pausa ya era pequeño` : `como máximo un ${v} % de tu volumen de antes de la pausa${remonte ? "" : " (regla de Daniels)"}`}; `}${q === "petite" ? "solo rodajes suaves esta semana: es demasiado corta para una sesión dura y un rodaje" : q === "footings" ? (km ? "solo rodajes suaves esta semana" : "solo rodajes suaves esta semana: tu tirada larga sería más corta que tu salida habitual, así que no se programa, y la sesión dura espera a que vuelva") : q ? `como máximo una sesión de calidad por semana, corta, ${f ? `hasta el día ${f} de la vuelta` : "hasta el final de la cuarta semana"}` : `ninguna sesión dura durante las dos primeras semanas, después una por semana ${f ? `hasta el día ${f}` : "hasta la cuarta"}`}`,
    sortieReprise: (j, f) => `fin de la vuelta tras ${j} días sin correr: ${f ? "solo rodajes suaves esta semana, es demasiado corta para una sesión dura y un rodaje" : "como máximo dos sesiones de calidad esta semana, sin VMA ni cuestas"}`,
    marcheCourse: (e, t) => `programa de caminar y correr, etapa ${e}/${t}: ni sesiones de calidad ni test de VMA hasta que corras 30 minutos seguidos; la carrera se alarga en cada etapa`,
    courseSecondaire: (n, d, b) => b ? `carrera B esta semana: ${n} (${d}); dos días tranquilos antes y una semana un 15 % más suave, luego la recuperación` : `carrera C esta semana: ${n} (${d}); sustituye una sesión de calidad, sin puesta a punto`,
  },
  pt: {
    douleur: (z) => `dor em curso (${z})`,
    origineCross: (p, l) => `, dos quais ${p} % vêm de outro desporto (${l})`,
    ratioRisque: (a, o) => `rácio agudo:crónico ${a} (zona de risco de lesão)${o}`,
    tsbProfond: (t, o) => `TSB ${t} (fadiga profunda)${o}`,
    vfcEtNuit: "VFC em queda E noite degradada (sinal duplo)",
    vfcBasse: "VFC abaixo da sua base",
    sommeilDegrade: (s) => `sono degradado (${s}/100)`,
    detteSommeil: (m, n) => `dívida de sono: ${m} de atraso em ${n} noites`,
    vfcChute: (c, v, b) => `queda acentuada da VFC (${c} abaixo da sua base: ${v} contra ${b} ms)`,
    chargeAigue: (a) => `carga aguda elevada (${a})`,
    monotonie: (m) => `monotonia ${m} (carga demasiado uniforme)`,
    rpeDerniere: (r) => `última sessão sentida como muito dura (RPE ${r}/10)`,
    rpeDuree: (m) => `esforço percebido alto ao longo do tempo (RPE médio ${m}/10 nos teus 3 últimos registos)`,
    partRatio: (a) => `rácio agudo:crónico ${a}`,
    partTsb: (t) => `TSB ${t}`,
    chargeVueMaisMaintenue: (p) => `carga recente elevada (${p}) MAS VFC claramente acima da sua base, sono correto e sem dores: a sessão de qualidade mantém-se. A vigiar se a VFC voltar a descer.`,
    apresCourse: (c, j, r, v) => `recuperação após ${c} (dia ${j} depois): sem intensidade antes de ${r}, só corridas fáceis até lá, e ${v} % do teu volume habitual esta semana — um dia fácil por cada 3 km corridos`,
    repriseApresCourse: (c, j, f, v) => `retoma após ${c} (dia ${j} depois): no máximo uma sessão curta de limiar por semana e ${v} % do teu volume habitual esta semana; treino normal a partir de ${f} — nem VMA nem provas antes de um dia por cada milha corrida`,
    repriseArret: (j, v, enCours, q, long, pl) => enCours
      ? `nenhuma corrida registada há ${j} dias: ${v == null ? (pl === "court" ? "esta semana retomamos com duas corridas curtas, o mínimo de uma semana de retoma" : pl === "petit" ? "esta semana retomamos com corridas fáceis, sem reduzir um volume habitual que já é pequeno" : pl === "long" ? "esta semana retomamos com corridas fáceis, porque o teu volume das últimas semanas é demasiado baixo para servir de referência" : "esta semana retomamos com corridas fáceis, porque o teu volume habitual ainda não é conhecido") : `esta semana retomamos a ${v} % do teu volume habitual (regra de Daniels)`}, ${long ? "sem sessão dura antes da segunda metade da retoma" : "sem sessão dura enquanto não voltares a fazer uma corrida fácil"}. Se correste, o teu relógio deixou de sincronizar: verifica a ligação`
      : `retoma após ${j} dias sem correr: ${v == null ? (pl === "court" ? "duas corridas curtas esta semana, o mínimo de uma semana de retoma" : pl === "petit" ? "o teu volume habitual já é pequeno e não é reduzido esta semana" : pl === "long" ? "o teu volume das últimas semanas é demasiado baixo para servir de referência" : "o teu volume habitual ainda não é conhecido") : `${v} % do teu volume habitual esta semana`}; a retoma dura tanto quanto a pausa (regra de Daniels); ${q === "petite" ? "só corridas fáceis esta semana: é demasiado pequena para uma sessão dura e uma corrida fácil" : q === "footings" ? (pl ? "só corridas fáceis esta semana" : "só corridas fáceis esta semana: o teu treino longo seria mais curto do que a tua corrida habitual, por isso não é marcado, e a sessão dura espera que ele volte") : q ? "no máximo uma sessão de qualidade por semana, curta, até ao fim da retoma" : "nenhuma sessão dura durante a primeira metade da retoma"}`,
    repriseLongArret: (j, enCours, q, v, inconnu, remonte, f, km) => enCours
      ? q == null ? `nenhuma corrida registada há ${j} dias: esta semana ${km ? `no máximo ${km} km, porque o teu volume de antes da pausa já era pequeno` : `no máximo ${v} % do teu volume de antes da pausa${remonte ? "" : " (regra de Daniels)"}`}. Se correste, o teu relógio deixou de sincronizar: verifica a ligação` : `nenhuma corrida registada há ${j} dias: retomamos só com corridas fáceis${v == null ? (inconnu ? ", sem limite de volume porque o teu volume de antes da pausa não é conhecido" : "") : `, esta semana ${km ? `no máximo ${km} km, porque o teu volume de antes da pausa já era pequeno` : `no máximo a ${v} % do teu volume de antes da pausa${remonte ? "" : " (regra de Daniels)"}`}`}, sem sessão dura nas duas primeiras semanas. Se correste, o teu relógio deixou de sincronizar: verifica a ligação`
      : q == null
        ? `retoma após ${j} dias sem correr: esta semana ${km ? `no máximo ${km} km, porque o teu volume de antes da pausa já era pequeno` : `no máximo ${v} % do teu volume de antes da pausa${remonte ? "" : " (regra de Daniels)"}`}`
        : `retoma após ${j} dias sem correr: ${v == null ? (inconnu ? "o teu volume de antes da pausa não é conhecido, por isso não há limite de volume; " : "") : `esta semana ${km ? `no máximo ${km} km, porque o teu volume de antes da pausa já era pequeno` : `no máximo ${v} % do teu volume de antes da pausa${remonte ? "" : " (regra de Daniels)"}`}; `}${q === "petite" ? "só corridas fáceis esta semana: é demasiado pequena para uma sessão dura e uma corrida fácil" : q === "footings" ? (km ? "só corridas fáceis esta semana" : "só corridas fáceis esta semana: o teu treino longo seria mais curto do que a tua corrida habitual, por isso não é marcado, e a sessão dura espera que ele volte") : q ? `no máximo uma sessão de qualidade por semana, curta, ${f ? `até ao dia ${f} da retoma` : "até ao fim da quarta semana"}` : `nenhuma sessão dura nas duas primeiras semanas, depois uma por semana ${f ? `até ao dia ${f}` : "até à quarta"}`}`,
    sortieReprise: (j, f) => `fim da retoma após ${j} dias sem correr: ${f ? "só corridas fáceis esta semana, é demasiado pequena para uma sessão dura e uma corrida fácil" : "no máximo duas sessões de qualidade esta semana, sem VMA nem subidas"}`,
    marcheCourse: (e, t) => `programa de caminhada e corrida, etapa ${e}/${t}: nem sessões de qualidade nem teste de VMA até conseguires correr 30 minutos seguidos; a corrida aumenta a cada etapa`,
    courseSecondaire: (n, d, b) => b ? `prova B esta semana: ${n} (${d}); dois dias calmos antes e uma semana 15 % mais leve, depois a recuperação` : `prova C esta semana: ${n} (${d}); substitui uma sessão de qualidade, sem afinamento`,
  },
};
