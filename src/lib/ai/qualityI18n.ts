// ─────────────────────────────────────────────────────────────────────────────
//  SÉANCES DE QUALITÉ — les 5 langues.
//
//  Ce sont les descriptions produites par le menu de qualité de `coachContext`
//  (« Seuil : 3×10 min à ~4'10/km, récup 2 min »). Le plan les insère telles quelles
//  dans le CORPS de séance : sans elles, un athlète allemand lisait un échauffement
//  allemand, un corps de séance français, puis un retour au calme allemand.
//
//  ⚠️ TROIS CONTRAINTES QUI NE SONT PAS NÉGOCIABLES ICI.
//
//  1. LE FRANÇAIS EST CANONIQUE. `lib/watch/intervals.ts` lit CE texte pour fabriquer
//     les étapes Garmin : il y cherche « récup », « seuil », et le motif
//     « N×DISTANCE à ALLURE ». La montre ne reçoit donc QUE la version française.
//  2. LES CHIFFRES RESTENT DANS LA PHRASE. Une consigne sans ses nombres n'apprend
//     rien : on traduit autour des nombres, on ne les sort pas.
//  3. L'ALLURE GARDE LA NOTATION « 4'20 » DANS TOUTES LES LANGUES. C'est la notation
//     employée partout ailleurs dans l'app (profil, tableau de bord), et c'est aussi
//     celle que la correction de chaleur du plan retrouve par expression régulière
//     (`heatAdjustDesc`) : la changer pour « 4:20 » ferait passer les allures
//     traduites à côté de la correction, en silence.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesQualite = {
  /** Remplace le nom de la course quand l'athlète n'en a pas fixé (« objectif »). */
  objectif: string;

  vmaCourte: (n: number, p: string) => string;
  vmaMoyenne: (n: number, p: string) => string;
  vmaLongue800: (n: number, p: string) => string;
  vmaLongue1000: (n: number, p: string) => string;
  pyramide: (p: string) => string;
  trenteTrente: (n: number, p: string) => string;
  vmaDeuxBlocs: (n: number, p: string) => string;
  fartlek: (n: number) => string;

  seuilFractionne: (n: number, min: number, p: string) => string;
  seuilLongSous: (min: number, sub: string) => string;
  seuilReference: (n: number, min: number, p: string) => string;
  seuilContinuSous: (min: number, sub: string) => string;
  overUnder: (n: number, min: number, sub: string, p: string) => string;
  seuilProgressif: (min: number, sub: string, p: string) => string;
  tempoLongSous: (min: number, sub: string) => string;

  spec1km: (course: string, n: number, p: string) => string;
  spec1500: (course: string, n: number, p: string) => string;
  spec2km: (course: string, n: number, p: string) => string;
  spec3km: (course: string, p: string) => string;
  specSansAllure: string;

  cotesCourtes: (n: number) => string;
  cotesMoyennes: (n: number) => string;
  cotesLongues: (n: number) => string;
  cotesDescente: string;

  maraBloc20: (p: string) => string;
  maraBloc15: (p: string) => string;
  maraFinish: (p: string) => string;
  maraBlocLong: (p: string) => string;
  maraSansAllure: string;
};

export const QUALITE_T: Record<Lang, TextesQualite> = {
  fr: {
    objectif: "objectif",
    vmaCourte: (n, p) => `VMA courte : ${n}×400 m à ~${p}/km, récup 45 s trottinés → aiguise la vitesse et la foulée`,
    vmaMoyenne: (n, p) => `VMA moyenne : ${n}×500 m à ~${p}/km, récup 1 min trottinée → tenue de la vitesse`,
    vmaLongue800: (n, p) => `VMA longue : ${n}×800 m à ~${p}/km, récup 1 min 30 trottinée → soutien du VO2max`,
    vmaLongue1000: (n, p) => `VMA longue : ${n}×1000 m à ~${p}/km, récup 2 min trottinée → le format le plus proche de la course`,
    pyramide: (p) => `Pyramide : 200-400-600-800-600-400-200 m à ~${p}/km, récup = temps de l'effort → varie la sollicitation, mentalement plus facile qu'une série uniforme`,
    trenteTrente: (n, p) => `30/30 : ${n}×(30 s vif / 30 s trottiné) à ~${p}/km → beaucoup de temps à VO2max pour peu de fatigue musculaire`,
    vmaDeuxBlocs: (n, p) => `VMA fractionnée en 2 blocs : 2×(${n}×300 m) à ~${p}/km, récup 45 s, 3 min entre blocs → volume élevé sans effondrement de la qualité`,
    fartlek: (n) => `Fartlek libre : ${n}×1 min vif / 1 min facile en terrain varié, à la sensation → réapprend à jouer avec les allures, sans montre`,
    seuilFractionne: (n, m, p) => `Seuil fractionné : ${n}×${m} min à ~${p}/km, récup 2 min → accumule du temps au seuil sans casser`,
    seuilLongSous: (m, s) => `Seuil long (SOUS-seuil) : 2×${m} min à ~${s}/km, récup 3 min → apprend à tenir l'effort`,
    seuilReference: (n, m, p) => `Seuil : ${n}×${m} min à ~${p}/km, récup 2 min → le format de référence`,
    seuilContinuSous: (m, s) => `Seuil continu (SOUS-seuil) : ${m} min d'un bloc à ~${s}/km → le plus exigeant mentalement, le plus payant`,
    overUnder: (n, m, s, p) => `Over-under : ${n}×${m} min en alternant 1 min à ~${s}/km (sous-seuil) / 1 min à ~${p}/km (au seuil), récup 3 min → apprend à recycler le lactate, la qualité qui sauve une fin de course`,
    seuilProgressif: (m, s, p) => `Seuil progressif : ${m} min en partant à ~${s}/km et en accélérant tous les 6 min pour finir à ~${p}/km → contrôle de l'allure et gestion de l'effort`,
    tempoLongSous: (m, s) => `Tempo long (SOUS-seuil) : ${m} min à ~${s}/km sur terrain roulant, sans regarder la montre après le 5e km → autonomie de l'athlète`,
    spec1km: (c, n, p) => `Allure spécifique ${c} : ${n}×1 km à ${p}/km, récup 1 min 30 → ancre l'allure`,
    spec1500: (c, n, p) => `Allure spécifique ${c} : ${n}×1500 m à ${p}/km, récup 2 min → allonge les portions`,
    spec2km: (c, n, p) => `Allure spécifique ${c} : ${n}×2 km à ${p}/km, récup 2 min 30 → se rapproche des conditions de course`,
    spec3km: (c, p) => `Allure spécifique ${c} : 2×3 km à ${p}/km, récup 3 min → simulation de course`,
    specSansAllure: `Allure spécifique objectif (répétitions à l'allure visée)`,
    cotesCourtes: (n) => `Côtes courtes : ${n}×30 s en montée vive, récup descente trottinée → force et explosivité`,
    cotesMoyennes: (n) => `Côtes moyennes : ${n}×45 s en montée soutenue, récup descente → puissance en montée`,
    cotesLongues: (n) => `Côtes longues : ${n}×2 min en montée régulière (FC Z4), récup descente → endurance de force`,
    cotesDescente: `Côtes + descente : 5×3 min en montée, DESCENTE travaillée en souplesse → prépare l'excentrique du trail`,
    maraBloc20: (p) => `Bloc allure marathon : 2×20 min à ${p}/km, intégré à la sortie longue`,
    maraBloc15: (p) => `Bloc allure marathon : 3×15 min à ${p}/km, récup 3 min`,
    maraFinish: (p) => `Finish rapide : sortie longue dont les 30 dernières minutes à ${p}/km`,
    maraBlocLong: (p) => `Bloc long : 1×40 min à ${p}/km au cœur de la sortie longue`,
    maraSansAllure: `Allure marathon en sortie longue`,
  },
  en: {
    objectif: "goal",
    vmaCourte: (n, p) => `Short VO2max: ${n}×400 m at ~${p}/km, 45 s jog recovery → sharpens speed and stride`,
    vmaMoyenne: (n, p) => `Medium VO2max: ${n}×500 m at ~${p}/km, 1 min jog recovery → holding the speed`,
    vmaLongue800: (n, p) => `Long VO2max: ${n}×800 m at ~${p}/km, 1 min 30 jog recovery → sustaining VO2max`,
    vmaLongue1000: (n, p) => `Long VO2max: ${n}×1000 m at ~${p}/km, 2 min jog recovery → the format closest to racing`,
    pyramide: (p) => `Pyramid: 200-400-600-800-600-400-200 m at ~${p}/km, recovery = duration of the effort → varies the stimulus, mentally easier than a uniform set`,
    trenteTrente: (n, p) => `30/30: ${n}×(30 s hard / 30 s jog) at ~${p}/km → plenty of time at VO2max for little muscular fatigue`,
    vmaDeuxBlocs: (n, p) => `VO2max split into 2 blocks: 2×(${n}×300 m) at ~${p}/km, 45 s recovery, 3 min between blocks → high volume without the quality collapsing`,
    fartlek: (n) => `Free fartlek: ${n}×1 min hard / 1 min easy over varied terrain, by feel → relearn how to play with paces, without a watch`,
    seuilFractionne: (n, m, p) => `Broken threshold: ${n}×${m} min at ~${p}/km, 2 min recovery → banks time at threshold without breaking you`,
    seuilLongSous: (m, s) => `Long threshold (SUB-threshold): 2×${m} min at ~${s}/km, 3 min recovery → teaches you to hold the effort`,
    seuilReference: (n, m, p) => `Threshold: ${n}×${m} min at ~${p}/km, 2 min recovery → the reference format`,
    seuilContinuSous: (m, s) => `Continuous threshold (SUB-threshold): ${m} min in one block at ~${s}/km → the hardest mentally, the most rewarding`,
    overUnder: (n, m, s, p) => `Over-under: ${n}×${m} min alternating 1 min at ~${s}/km (sub-threshold) / 1 min at ~${p}/km (at threshold), 3 min recovery → teaches you to clear lactate, the quality that saves the end of a race`,
    seuilProgressif: (m, s, p) => `Progressive threshold: ${m} min starting at ~${s}/km and speeding up every 6 min to finish at ~${p}/km → pace control and effort management`,
    tempoLongSous: (m, s) => `Long tempo (SUB-threshold): ${m} min at ~${s}/km on rolling terrain, without looking at the watch after the 5th km → athlete autonomy`,
    spec1km: (c, n, p) => `${c} race pace: ${n}×1 km at ${p}/km, 1 min 30 recovery → locks in the pace`,
    spec1500: (c, n, p) => `${c} race pace: ${n}×1500 m at ${p}/km, 2 min recovery → lengthens the reps`,
    spec2km: (c, n, p) => `${c} race pace: ${n}×2 km at ${p}/km, 2 min 30 recovery → closer to race conditions`,
    spec3km: (c, p) => `${c} race pace: 2×3 km at ${p}/km, 3 min recovery → race simulation`,
    specSansAllure: `Goal race pace (reps at the target pace)`,
    cotesCourtes: (n) => `Short hills: ${n}×30 s uphill and brisk, jog back down to recover → strength and explosiveness`,
    cotesMoyennes: (n) => `Medium hills: ${n}×45 s uphill and sustained, downhill recovery → uphill power`,
    cotesLongues: (n) => `Long hills: ${n}×2 min uphill and steady (HR Z4), downhill recovery → strength endurance`,
    cotesDescente: `Hills + descent: 5×3 min uphill, DESCENT worked smoothly → prepares the eccentric work of trail running`,
    maraBloc20: (p) => `Marathon-pace block: 2×20 min at ${p}/km, built into the long run`,
    maraBloc15: (p) => `Marathon-pace block: 3×15 min at ${p}/km, 3 min recovery`,
    maraFinish: (p) => `Fast finish: long run with the last 30 minutes at ${p}/km`,
    maraBlocLong: (p) => `Long block: 1×40 min at ${p}/km in the heart of the long run`,
    maraSansAllure: `Marathon pace inside the long run`,
  },
  de: {
    objectif: "Ziel",
    vmaCourte: (n, p) => `Kurze VO2max: ${n}×400 m zu ~${p}/km, 45 s Trabpause → schärft Schnelligkeit und Laufstil`,
    vmaMoyenne: (n, p) => `Mittlere VO2max: ${n}×500 m zu ~${p}/km, 1 min Trabpause → Tempo halten`,
    vmaLongue800: (n, p) => `Lange VO2max: ${n}×800 m zu ~${p}/km, 1 min 30 Trabpause → VO2max stützen`,
    vmaLongue1000: (n, p) => `Lange VO2max: ${n}×1000 m zu ~${p}/km, 2 min Trabpause → das wettkampfnächste Format`,
    pyramide: (p) => `Pyramide: 200-400-600-800-600-400-200 m zu ~${p}/km, Pause = Dauer der Belastung → wechselnder Reiz, mental leichter als eine gleichförmige Serie`,
    trenteTrente: (n, p) => `30/30: ${n}×(30 s zügig / 30 s traben) zu ~${p}/km → viel Zeit an der VO2max bei wenig muskulärer Ermüdung`,
    vmaDeuxBlocs: (n, p) => `VO2max in 2 Blöcken: 2×(${n}×300 m) zu ~${p}/km, 45 s Pause, 3 min zwischen den Blöcken → hoher Umfang, ohne dass die Qualität einbricht`,
    fartlek: (n) => `Freies Fahrtspiel: ${n}×1 min zügig / 1 min locker im wechselnden Gelände, nach Gefühl → wieder mit den Tempos spielen lernen, ohne Uhr`,
    seuilFractionne: (n, m, p) => `Gebrochene Schwelle: ${n}×${m} min zu ~${p}/km, 2 min Pause → sammelt Zeit an der Schwelle, ohne dich zu zerlegen`,
    seuilLongSous: (m, s) => `Lange Schwelle (UNTER der Schwelle): 2×${m} min zu ~${s}/km, 3 min Pause → lehrt dich, die Belastung zu halten`,
    seuilReference: (n, m, p) => `Schwelle: ${n}×${m} min zu ~${p}/km, 2 min Pause → das Referenzformat`,
    seuilContinuSous: (m, s) => `Durchgehende Schwelle (UNTER der Schwelle): ${m} min am Stück zu ~${s}/km → mental am fordernsten, am lohnendsten`,
    overUnder: (n, m, s, p) => `Over-under: ${n}×${m} min im Wechsel 1 min zu ~${s}/km (unter der Schwelle) / 1 min zu ~${p}/km (an der Schwelle), 3 min Pause → lehrt dich, Laktat zu verwerten — die Fähigkeit, die ein Rennende rettet`,
    seuilProgressif: (m, s, p) => `Progressive Schwelle: ${m} min, Start bei ~${s}/km und alle 6 min schneller bis ~${p}/km zum Schluss → Tempokontrolle und Krafteinteilung`,
    tempoLongSous: (m, s) => `Langer Tempolauf (UNTER der Schwelle): ${m} min zu ~${s}/km auf laufendem Gelände, ab dem 5. km ohne Blick auf die Uhr → Eigenständigkeit`,
    spec1km: (c, n, p) => `Wettkampftempo ${c}: ${n}×1 km zu ${p}/km, 1 min 30 Pause → verankert das Tempo`,
    spec1500: (c, n, p) => `Wettkampftempo ${c}: ${n}×1500 m zu ${p}/km, 2 min Pause → verlängert die Abschnitte`,
    spec2km: (c, n, p) => `Wettkampftempo ${c}: ${n}×2 km zu ${p}/km, 2 min 30 Pause → näher an den Wettkampfbedingungen`,
    spec3km: (c, p) => `Wettkampftempo ${c}: 2×3 km zu ${p}/km, 3 min Pause → Wettkampfsimulation`,
    specSansAllure: `Wettkampftempo des Ziels (Wiederholungen im angestrebten Tempo)`,
    cotesCourtes: (n) => `Kurze Berganläufe: ${n}×30 s zügig bergauf, Traben bergab als Pause → Kraft und Explosivität`,
    cotesMoyennes: (n) => `Mittlere Berganläufe: ${n}×45 s kräftig bergauf, bergab als Pause → Kraft am Berg`,
    cotesLongues: (n) => `Lange Berganläufe: ${n}×2 min gleichmäßig bergauf (HF Z4), bergab als Pause → Kraftausdauer`,
    cotesDescente: `Bergauf + bergab: 5×3 min bergauf, ABWÄRTS locker und sauber gelaufen → bereitet die exzentrische Belastung im Trail vor`,
    maraBloc20: (p) => `Marathontempo-Block: 2×20 min zu ${p}/km, in den langen Lauf eingebaut`,
    maraBloc15: (p) => `Marathontempo-Block: 3×15 min zu ${p}/km, 3 min Pause`,
    maraFinish: (p) => `Schneller Abschluss: langer Lauf, die letzten 30 Minuten zu ${p}/km`,
    maraBlocLong: (p) => `Langer Block: 1×40 min zu ${p}/km mitten im langen Lauf`,
    maraSansAllure: `Marathontempo im langen Lauf`,
  },
  es: {
    objectif: "objetivo",
    vmaCourte: (n, p) => `VAM corta: ${n}×400 m a ~${p}/km, recuperación 45 s trotados → afila la velocidad y la zancada`,
    vmaMoyenne: (n, p) => `VAM media: ${n}×500 m a ~${p}/km, recuperación 1 min trotada → mantener la velocidad`,
    vmaLongue800: (n, p) => `VAM larga: ${n}×800 m a ~${p}/km, recuperación 1 min 30 trotada → sostén del VO2max`,
    vmaLongue1000: (n, p) => `VAM larga: ${n}×1000 m a ~${p}/km, recuperación 2 min trotada → el formato más parecido a la competición`,
    pyramide: (p) => `Pirámide: 200-400-600-800-600-400-200 m a ~${p}/km, recuperación = tiempo del esfuerzo → varía el estímulo, mentalmente más fácil que una serie uniforme`,
    trenteTrente: (n, p) => `30/30: ${n}×(30 s vivo / 30 s trotado) a ~${p}/km → mucho tiempo a VO2max con poca fatiga muscular`,
    vmaDeuxBlocs: (n, p) => `VAM en 2 bloques: 2×(${n}×300 m) a ~${p}/km, recuperación 45 s, 3 min entre bloques → volumen alto sin que se hunda la calidad`,
    fartlek: (n) => `Fartlek libre: ${n}×1 min vivo / 1 min suave en terreno variado, por sensaciones → reaprende a jugar con los ritmos, sin reloj`,
    seuilFractionne: (n, m, p) => `Umbral fraccionado: ${n}×${m} min a ~${p}/km, recuperación 2 min → acumula tiempo en umbral sin romperte`,
    seuilLongSous: (m, s) => `Umbral largo (SUB-umbral): 2×${m} min a ~${s}/km, recuperación 3 min → enseña a sostener el esfuerzo`,
    seuilReference: (n, m, p) => `Umbral: ${n}×${m} min a ~${p}/km, recuperación 2 min → el formato de referencia`,
    seuilContinuSous: (m, s) => `Umbral continuo (SUB-umbral): ${m} min de un bloque a ~${s}/km → el más exigente mentalmente, el más rentable`,
    overUnder: (n, m, s, p) => `Over-under: ${n}×${m} min alternando 1 min a ~${s}/km (sub-umbral) / 1 min a ~${p}/km (en umbral), recuperación 3 min → enseña a reciclar el lactato, la cualidad que salva un final de carrera`,
    seuilProgressif: (m, s, p) => `Umbral progresivo: ${m} min saliendo a ~${s}/km y acelerando cada 6 min para acabar a ~${p}/km → control del ritmo y gestión del esfuerzo`,
    tempoLongSous: (m, s) => `Tempo largo (SUB-umbral): ${m} min a ~${s}/km en terreno rodador, sin mirar el reloj a partir del km 5 → autonomía del atleta`,
    spec1km: (c, n, p) => `Ritmo específico ${c}: ${n}×1 km a ${p}/km, recuperación 1 min 30 → fija el ritmo`,
    spec1500: (c, n, p) => `Ritmo específico ${c}: ${n}×1500 m a ${p}/km, recuperación 2 min → alarga las porciones`,
    spec2km: (c, n, p) => `Ritmo específico ${c}: ${n}×2 km a ${p}/km, recuperación 2 min 30 → se acerca a las condiciones de carrera`,
    spec3km: (c, p) => `Ritmo específico ${c}: 2×3 km a ${p}/km, recuperación 3 min → simulación de carrera`,
    specSansAllure: `Ritmo específico del objetivo (repeticiones al ritmo previsto)`,
    cotesCourtes: (n) => `Cuestas cortas: ${n}×30 s en subida viva, recuperación bajando al trote → fuerza y explosividad`,
    cotesMoyennes: (n) => `Cuestas medias: ${n}×45 s en subida sostenida, recuperación en la bajada → potencia en subida`,
    cotesLongues: (n) => `Cuestas largas: ${n}×2 min en subida regular (FC Z4), recuperación en la bajada → resistencia a la fuerza`,
    cotesDescente: `Cuestas + bajada: 5×3 min en subida, BAJADA trabajada con soltura → prepara el trabajo excéntrico del trail`,
    maraBloc20: (p) => `Bloque a ritmo maratón: 2×20 min a ${p}/km, integrado en la tirada larga`,
    maraBloc15: (p) => `Bloque a ritmo maratón: 3×15 min a ${p}/km, recuperación 3 min`,
    maraFinish: (p) => `Final rápido: tirada larga con los últimos 30 minutos a ${p}/km`,
    maraBlocLong: (p) => `Bloque largo: 1×40 min a ${p}/km en el corazón de la tirada larga`,
    maraSansAllure: `Ritmo maratón dentro de la tirada larga`,
  },
  pt: {
    objectif: "objetivo",
    vmaCourte: (n, p) => `VAM curta: ${n}×400 m a ~${p}/km, recuperação 45 s a trote → afia a velocidade e a passada`,
    vmaMoyenne: (n, p) => `VAM média: ${n}×500 m a ~${p}/km, recuperação 1 min a trote → manter a velocidade`,
    vmaLongue800: (n, p) => `VAM longa: ${n}×800 m a ~${p}/km, recuperação 1 min 30 a trote → suporte do VO2max`,
    vmaLongue1000: (n, p) => `VAM longa: ${n}×1000 m a ~${p}/km, recuperação 2 min a trote → o formato mais próximo da prova`,
    pyramide: (p) => `Pirâmide: 200-400-600-800-600-400-200 m a ~${p}/km, recuperação = tempo do esforço → varia o estímulo, mentalmente mais fácil do que uma série uniforme`,
    trenteTrente: (n, p) => `30/30: ${n}×(30 s vivo / 30 s a trote) a ~${p}/km → muito tempo em VO2max com pouca fadiga muscular`,
    vmaDeuxBlocs: (n, p) => `VAM em 2 blocos: 2×(${n}×300 m) a ~${p}/km, recuperação 45 s, 3 min entre blocos → volume elevado sem que a qualidade caia`,
    fartlek: (n) => `Fartlek livre: ${n}×1 min vivo / 1 min fácil em terreno variado, por sensações → reaprende a brincar com os ritmos, sem relógio`,
    seuilFractionne: (n, m, p) => `Limiar fracionado: ${n}×${m} min a ~${p}/km, recuperação 2 min → acumula tempo em limiar sem te partir`,
    seuilLongSous: (m, s) => `Limiar longo (SUB-limiar): 2×${m} min a ~${s}/km, recuperação 3 min → ensina a aguentar o esforço`,
    seuilReference: (n, m, p) => `Limiar: ${n}×${m} min a ~${p}/km, recuperação 2 min → o formato de referência`,
    seuilContinuSous: (m, s) => `Limiar contínuo (SUB-limiar): ${m} min de uma vez a ~${s}/km → o mais exigente mentalmente, o mais rentável`,
    overUnder: (n, m, s, p) => `Over-under: ${n}×${m} min alternando 1 min a ~${s}/km (sub-limiar) / 1 min a ~${p}/km (em limiar), recuperação 3 min → ensina a reciclar o lactato, a qualidade que salva um fim de prova`,
    seuilProgressif: (m, s, p) => `Limiar progressivo: ${m} min a começar a ~${s}/km e a acelerar de 6 em 6 min para acabar a ~${p}/km → controlo do ritmo e gestão do esforço`,
    tempoLongSous: (m, s) => `Tempo longo (SUB-limiar): ${m} min a ~${s}/km em terreno rolante, sem olhar para o relógio a partir do km 5 → autonomia do atleta`,
    spec1km: (c, n, p) => `Ritmo específico ${c}: ${n}×1 km a ${p}/km, recuperação 1 min 30 → fixa o ritmo`,
    spec1500: (c, n, p) => `Ritmo específico ${c}: ${n}×1500 m a ${p}/km, recuperação 2 min → alonga as porções`,
    spec2km: (c, n, p) => `Ritmo específico ${c}: ${n}×2 km a ${p}/km, recuperação 2 min 30 → aproxima-se das condições de prova`,
    spec3km: (c, p) => `Ritmo específico ${c}: 2×3 km a ${p}/km, recuperação 3 min → simulação de prova`,
    specSansAllure: `Ritmo específico do objetivo (repetições ao ritmo pretendido)`,
    cotesCourtes: (n) => `Subidas curtas: ${n}×30 s a subir vivo, recuperação a descer a trote → força e explosividade`,
    cotesMoyennes: (n) => `Subidas médias: ${n}×45 s a subir sustentado, recuperação na descida → potência a subir`,
    cotesLongues: (n) => `Subidas longas: ${n}×2 min a subir regular (FC Z4), recuperação na descida → resistência de força`,
    cotesDescente: `Subidas + descida: 5×3 min a subir, DESCIDA trabalhada com soltura → prepara o excêntrico do trail`,
    maraBloc20: (p) => `Bloco a ritmo de maratona: 2×20 min a ${p}/km, integrado no longo`,
    maraBloc15: (p) => `Bloco a ritmo de maratona: 3×15 min a ${p}/km, recuperação 3 min`,
    maraFinish: (p) => `Final rápido: longo com os últimos 30 minutos a ${p}/km`,
    maraBlocLong: (p) => `Bloco longo: 1×40 min a ${p}/km no coração do longo`,
    maraSansAllure: `Ritmo de maratona dentro do longo`,
  },
};
