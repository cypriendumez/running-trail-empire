// ─────────────────────────────────────────────────────────────────────────────
//  TRADUCTIONS DES AVERTISSEMENTS D'ÂGE.
//
//  Ces messages étaient en français uniquement — comme tous les avertissements
//  d'objectif depuis l'origine. Passable tant qu'on parle d'un chrono ; plus du tout
//  dès qu'on cite un RÈGLEMENT FRANÇAIS à un athlète allemand ou portugais.
//
//  ⚠️ UNE NUANCE QUE LA TRADUCTION SEULE NE RÈGLE PAS. La limite de distance par
//  catégorie vient de la Fédération française d'athlétisme : elle s'applique aux
//  épreuves organisées EN FRANCE, pas ailleurs. Traduire « tu ne pourras pas
//  t'inscrire » en allemand en laissant croire que c'est universel serait faux. Les
//  versions étrangères disent donc « en France » et invitent à vérifier le règlement
//  local — c'est moins net, mais c'est vrai.
//
//  L'avis médical de l'IMMDA, lui, est international : il se traduit sans réserve.
// ─────────────────────────────────────────────────────────────────────────────
import type { Lang } from "@/lib/i18n/translations";

export type TextesAge = {
  /** Locale pour le formatage des nombres — « 42,2 km » en français, « 42.2 km » en anglais. */
  locale: string;
  /** Règle fédérale : distance non autorisée. */
  regleTitre: string;
  regle: (p: { categorie: string; maxKm: number; effort: boolean; distance: string; mentionEffort: string }) => string;
  /** Mention du km effort, quand le dénivelé est connu. */
  mentionEffort: (effort: string) => string;
  /** Palier accessible dès maintenant + âge d'ouverture. */
  palier: (nom: string) => string;
  palierAucun: string;
  ouverture18: string;
  ouverture16: string;
  regleFin: string;
  /** Avis médical IMMDA + AAP. */
  medical: string;
  /** Conseil de progression. */
  progression: (p: { quoi: string; age: number; categorie: string; pourquoi: string; paliers: string }) => string;
  quoiUltra: string; quoiMarathon: string; quoiTrailLong: string; quoiSemi: string;
  pourquoiLong: string; pourquoiCourt: string;
  paliersLong: string; paliersCourt: string;
  sourceFfa: string; sourceImmda: string; sourceAap: string; sourceArrs: string;
};

export const AGE_T: Record<Lang, TextesAge> = {
  fr: {
    locale: "fr-FR",
    regleTitre: "⚠️ DISTANCE NON AUTORISÉE À TON ÂGE",
    regle: (p) => `en catégorie ${p.categorie}, la Fédération française d'athlétisme limite les épreuves à ${p.maxKm} km${p.effort ? " en km effort" : ""}, et ton objectif fait ${p.distance} km${p.mentionEffort}. Tu ne pourras donc pas t'inscrire à une épreuve officielle en France.`,
    mentionEffort: (e) => ` (${e} km effort : le dénivelé ajoute 1 km par tranche de 100 m de D+)`,
    palier: (nom) => ` Le ${nom} t'est ouvert dès maintenant`,
    palierAucun: " Des distances plus courtes te sont ouvertes",
    ouverture18: ", et le marathon s'ouvrira à tes 20 ans.",
    ouverture16: ", le semi à 18 ans et le marathon à 20 ans.",
    regleFin: " Ton plan est construit quand même — mais parles-en à un médecin du sport avant de viser cette distance.",
    medical: "🩺 AVIS MÉDICAL : l'association internationale des directeurs médicaux de marathons (IMMDA) recommande de réserver le marathon aux athlètes ayant atteint leurs 18 ans. Les motifs qu'elle invoque ne sont pas le cartilage de croissance — les études n'y retrouvent pas de lésion de façon constante — mais le cumul des blessures de surmenage sur un corps encore en développement, une thermorégulation moins efficace qu'à l'âge adulte, le risque de carences nutritionnelles et la charge psychologique de la distance. L'Académie américaine de pédiatrie ajoute qu'au-delà d'environ 5 km chez l'enfant, c'est un avis médical INDIVIDUEL qui doit trancher, pas une règle générale : va voir un médecin du sport avant de t'engager.",
    progression: (p) => `💡 ${p.quoi} à ${p.age} ans, c'est autorisé (catégorie ${p.categorie}) et parfaitement faisable — mais ${p.pourquoi}. Le chemin le plus sûr passe par des paliers : ${p.paliers}. Ton plan est construit pour l'objectif que tu as choisi ; si tu n'as jamais couru la moitié de cette distance, envisage un palier intermédiaire d'abord.`,
    quoiUltra: "Un ultra", quoiMarathon: "Un marathon", quoiTrailLong: "Un trail long", quoiSemi: "Un semi-marathon",
    pourquoiLong: "c'est l'effort le plus exigeant de la course à pied, et rien ne presse : la plupart des coureurs atteignent leur meilleur niveau sur cette distance entre 28 et 35 ans",
    pourquoiCourt: "c'est un vrai palier d'endurance, et il se prépare mieux qu'il ne s'improvise",
    paliersLong: "un 10 km solide, puis un semi, puis la distance visée",
    paliersCourt: "un 10 km solide avant de doubler la distance",
    sourceFfa: "Fédération française d'athlétisme — règlement des manifestations running",
    sourceImmda: "IMMDA — déclaration sur les enfants et le marathon",
    sourceAap: "American Academy of Pediatrics — rapport clinique sur la course de fond chez l'enfant",
    sourceArrs: "Association of Road Racing Statisticians — âge du pic de performance",
  },
  en: {
    locale: "en-GB",
    regleTitre: "⚠️ DISTANCE NOT ALLOWED AT YOUR AGE",
    regle: (p) => `in the ${p.categorie} category, the French athletics federation caps races at ${p.maxKm} km${p.effort ? " in effort-km" : ""}, and your goal is ${p.distance} km${p.mentionEffort}. You will not be able to enter an official race in France — check the rules of your own federation, they often set similar limits.`,
    mentionEffort: (e) => ` (${e} effort-km: every 100 m of climbing counts as 1 extra km)`,
    palier: (nom) => ` The ${nom} is open to you right now`,
    palierAucun: " Shorter distances are open to you",
    ouverture18: ", and the marathon opens up when you turn 20.",
    ouverture16: ", the half at 18 and the marathon at 20.",
    regleFin: " Your plan is built anyway — but talk to a sports physician before targeting this distance.",
    medical: "🩺 MEDICAL ADVICE: the International Marathon Medical Directors Association (IMMDA) recommends reserving the marathon for athletes who have reached their eighteenth birthday. The reasons it gives are not growth-plate damage — studies do not consistently find it — but the build-up of overuse injuries on a still-developing body, less efficient thermoregulation than in adults, the risk of nutritional deficiencies, and the psychological load of the distance. The American Academy of Pediatrics adds that beyond roughly 5 km in a child, it is an INDIVIDUAL medical opinion that should decide, not a blanket rule: see a sports physician before committing.",
    progression: (p) => `💡 ${p.quoi} at ${p.age} is allowed (${p.categorie} category) and perfectly doable — but ${p.pourquoi}. The safest path goes through steps: ${p.paliers}. Your plan is built for the goal you chose; if you have never run half this distance, consider an intermediate step first.`,
    quoiUltra: "An ultra", quoiMarathon: "A marathon", quoiTrailLong: "A long trail race", quoiSemi: "A half marathon",
    pourquoiLong: "it is the most demanding effort in running, and there is no rush: most runners reach their best on this distance between 28 and 35",
    pourquoiCourt: "it is a real endurance step, and it is better prepared than improvised",
    paliersLong: "a solid 10 km, then a half, then the distance you are aiming for",
    paliersCourt: "a solid 10 km before doubling the distance",
    sourceFfa: "French Athletics Federation — road running regulations",
    sourceImmda: "IMMDA — advisory statement on children and marathoning",
    sourceAap: "American Academy of Pediatrics — clinical report on distance running in children",
    sourceArrs: "Association of Road Racing Statisticians — age of peak performance",
  },
  de: {
    locale: "de-DE",
    regleTitre: "⚠️ DISTANZ IN DEINEM ALTER NICHT ZUGELASSEN",
    regle: (p) => `In der Kategorie ${p.categorie} begrenzt der französische Leichtathletikverband Wettkämpfe auf ${p.maxKm} km${p.effort ? " in Anstrengungs-Kilometern" : ""}, und dein Ziel liegt bei ${p.distance} km${p.mentionEffort}. In Frankreich kannst du dich also nicht offiziell anmelden — prüfe die Regeln deines eigenen Verbands, sie setzen oft ähnliche Grenzen.`,
    mentionEffort: (e) => ` (${e} Anstrengungs-km: je 100 Höhenmeter zählt 1 zusätzlicher Kilometer)`,
    palier: (nom) => ` ${nom} steht dir schon jetzt offen`,
    palierAucun: " Kürzere Distanzen stehen dir offen",
    ouverture18: ", und der Marathon öffnet sich mit 20 Jahren.",
    ouverture16: ", der Halbmarathon mit 18 und der Marathon mit 20.",
    regleFin: " Dein Plan wird trotzdem erstellt — sprich aber mit einer Sportmedizinerin oder einem Sportmediziner, bevor du diese Distanz angehst.",
    medical: "🩺 MEDIZINISCHER HINWEIS: Die internationale Vereinigung der medizinischen Marathonleiter (IMMDA) empfiehlt, den Marathon Athletinnen und Athleten ab dem vollendeten 18. Lebensjahr vorzubehalten. Die genannten Gründe sind nicht Schäden an den Wachstumsfugen — Studien finden diese nicht durchgängig —, sondern Überlastungsverletzungen an einem noch wachsenden Körper, eine weniger wirksame Thermoregulation als bei Erwachsenen, das Risiko von Nährstoffmängeln und die psychische Belastung der Distanz. Die American Academy of Pediatrics ergänzt, dass jenseits von etwa 5 km bei Kindern eine INDIVIDUELLE ärztliche Einschätzung entscheiden sollte, keine pauschale Regel: Geh vorher zur Sportmedizin.",
    progression: (p) => `💡 ${p.quoi} mit ${p.age} Jahren ist erlaubt (Kategorie ${p.categorie}) und durchaus machbar — aber ${p.pourquoi}. Der sicherste Weg führt über Zwischenschritte: ${p.paliers}. Dein Plan ist auf dein gewähltes Ziel ausgelegt; wenn du nie die Hälfte dieser Distanz gelaufen bist, überlege dir zuerst einen Zwischenschritt.`,
    quoiUltra: "Ein Ultra", quoiMarathon: "Ein Marathon", quoiTrailLong: "Ein langer Trail", quoiSemi: "Ein Halbmarathon",
    pourquoiLong: "es ist die anspruchsvollste Belastung im Laufsport, und es eilt nicht: Die meisten Laufenden erreichen auf dieser Distanz ihr Bestes zwischen 28 und 35",
    pourquoiCourt: "es ist ein echter Ausdauerschritt, und er lässt sich besser vorbereiten als improvisieren",
    paliersLong: "ein solider 10-km-Lauf, dann ein Halbmarathon, dann die Zieldistanz",
    paliersCourt: "ein solider 10-km-Lauf, bevor du die Distanz verdoppelst",
    sourceFfa: "Französischer Leichtathletikverband — Wettkampfordnung Straßenlauf",
    sourceImmda: "IMMDA — Stellungnahme zu Kindern und Marathon",
    sourceAap: "American Academy of Pediatrics — klinischer Bericht zum Langstreckenlauf bei Kindern",
    sourceArrs: "Association of Road Racing Statisticians — Alter der Bestleistung",
  },
  es: {
    locale: "es-ES",
    regleTitre: "⚠️ DISTANCIA NO PERMITIDA A TU EDAD",
    regle: (p) => `en la categoría ${p.categorie}, la federación francesa de atletismo limita las pruebas a ${p.maxKm} km${p.effort ? " en km esfuerzo" : ""}, y tu objetivo es de ${p.distance} km${p.mentionEffort}. No podrás inscribirte en una prueba oficial en Francia — consulta el reglamento de tu propia federación, suele fijar límites parecidos.`,
    mentionEffort: (e) => ` (${e} km esfuerzo: cada 100 m de desnivel positivo suman 1 km)`,
    palier: (nom) => ` El ${nom} ya está a tu alcance`,
    palierAucun: " Tienes distancias más cortas disponibles",
    ouverture18: ", y el maratón se abrirá cuando cumplas 20 años.",
    ouverture16: ", la media a los 18 y el maratón a los 20.",
    regleFin: " Tu plan se construye igualmente, pero habla con un médico deportivo antes de apuntar a esta distancia.",
    medical: "🩺 OPINIÓN MÉDICA: la asociación internacional de directores médicos de maratones (IMMDA) recomienda reservar el maratón a quienes hayan cumplido 18 años. Los motivos que alega no son las lesiones del cartílago de crecimiento —los estudios no las encuentran de forma constante— sino la acumulación de lesiones por sobrecarga en un cuerpo aún en desarrollo, una termorregulación menos eficaz que en el adulto, el riesgo de carencias nutricionales y la carga psicológica de la distancia. La Academia Americana de Pediatría añade que más allá de unos 5 km en un niño debe decidir una valoración médica INDIVIDUAL, no una regla general: consulta a un médico deportivo antes de comprometerte.",
    progression: (p) => `💡 ${p.quoi} a los ${p.age} años está permitido (categoría ${p.categorie}) y es perfectamente factible, pero ${p.pourquoi}. El camino más seguro pasa por etapas: ${p.paliers}. Tu plan se construye para el objetivo que has elegido; si nunca has corrido la mitad de esta distancia, plantéate antes una etapa intermedia.`,
    quoiUltra: "Un ultra", quoiMarathon: "Un maratón", quoiTrailLong: "Un trail largo", quoiSemi: "Una media maratón",
    pourquoiLong: "es el esfuerzo más exigente del atletismo popular, y no hay prisa: la mayoría alcanza su mejor nivel en esta distancia entre los 28 y los 35 años",
    pourquoiCourt: "es un verdadero salto de resistencia, y se prepara mejor de lo que se improvisa",
    paliersLong: "un 10 km sólido, después una media, y después la distancia objetivo",
    paliersCourt: "un 10 km sólido antes de doblar la distancia",
    sourceFfa: "Federación Francesa de Atletismo — reglamento de pruebas en ruta",
    sourceImmda: "IMMDA — declaración sobre los niños y el maratón",
    sourceAap: "American Academy of Pediatrics — informe clínico sobre carrera de fondo en niños",
    sourceArrs: "Association of Road Racing Statisticians — edad del pico de rendimiento",
  },
  pt: {
    locale: "pt-PT",
    regleTitre: "⚠️ DISTÂNCIA NÃO AUTORIZADA NA TUA IDADE",
    regle: (p) => `na categoria ${p.categorie}, a federação francesa de atletismo limita as provas a ${p.maxKm} km${p.effort ? " em km esforço" : ""}, e o teu objetivo é de ${p.distance} km${p.mentionEffort}. Não vais poder inscrever-te numa prova oficial em França — confirma o regulamento da tua federação, costuma ter limites semelhantes.`,
    mentionEffort: (e) => ` (${e} km esforço: cada 100 m de desnível positivo somam 1 km)`,
    palier: (nom) => ` O ${nom} já está ao teu alcance`,
    palierAucun: " Tens distâncias mais curtas disponíveis",
    ouverture18: ", e a maratona abre-se aos teus 20 anos.",
    ouverture16: ", a meia aos 18 e a maratona aos 20.",
    regleFin: " O teu plano é construído na mesma — mas fala com um médico do desporto antes de apontares a esta distância.",
    medical: "🩺 PARECER MÉDICO: a associação internacional dos diretores médicos de maratonas (IMMDA) recomenda reservar a maratona a atletas que já tenham feito 18 anos. Os motivos invocados não são lesões da cartilagem de crescimento — os estudos não as encontram de forma constante — mas a acumulação de lesões por sobrecarga num corpo ainda em desenvolvimento, uma termorregulação menos eficaz do que no adulto, o risco de carências nutricionais e a carga psicológica da distância. A American Academy of Pediatrics acrescenta que, acima de cerca de 5 km numa criança, deve decidir uma avaliação médica INDIVIDUAL e não uma regra geral: consulta um médico do desporto antes de te comprometeres.",
    progression: (p) => `💡 ${p.quoi} aos ${p.age} anos é permitido (categoria ${p.categorie}) e perfeitamente possível — mas ${p.pourquoi}. O caminho mais seguro passa por etapas: ${p.paliers}. O teu plano é construído para o objetivo que escolheste; se nunca correste metade desta distância, considera primeiro uma etapa intermédia.`,
    quoiUltra: "Um ultra", quoiMarathon: "Uma maratona", quoiTrailLong: "Um trail longo", quoiSemi: "Uma meia maratona",
    pourquoiLong: "é o esforço mais exigente da corrida, e não há pressa: a maioria atinge o seu melhor nesta distância entre os 28 e os 35 anos",
    pourquoiCourt: "é um verdadeiro patamar de resistência, e prepara-se melhor do que se improvisa",
    paliersLong: "um 10 km sólido, depois uma meia, e depois a distância pretendida",
    paliersCourt: "um 10 km sólido antes de duplicar a distância",
    sourceFfa: "Federação Francesa de Atletismo — regulamento das provas de estrada",
    sourceImmda: "IMMDA — declaração sobre as crianças e a maratona",
    sourceAap: "American Academy of Pediatrics — relatório clínico sobre corrida de fundo em crianças",
    sourceArrs: "Association of Road Racing Statisticians — idade do pico de desempenho",
  },
};

/** Noms de paliers, traduits — « Le semi-marathon t'est ouvert » doit se lire dans la
 *  langue de l'athlète, pas moitié en français. */
export const PALIER_NOM: Record<Lang, { p10: string; p21: string; p42: string }> = {
  fr: { p10: "10 km", p21: "semi-marathon", p42: "marathon" },
  en: { p10: "10 km", p21: "half marathon", p42: "marathon" },
  de: { p10: "10 km", p21: "Halbmarathon", p42: "Marathon" },
  es: { p10: "10 km", p21: "media maratón", p42: "maratón" },
  pt: { p10: "10 km", p21: "meia maratona", p42: "maratona" },
};

/** Nom de catégorie FFA — inchangé d'une langue à l'autre (Junior/U20 est un code
 *  fédéral), sauf pour « et au-delà » qui est du français dans le texte. */
export const CAT_SUFFIXE: Record<Lang, string> = {
  fr: " et au-delà", en: " and above", de: " und darüber", es: " y superiores", pt: " e acima",
};
