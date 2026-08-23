import type { Lang } from "@/lib/i18n/translations";

/**
 * « NOTRE HISTOIRE » — l'origine du produit, pas le portrait de son auteur.
 *
 * ⚠️ CE CHOIX D'ÉCRITURE EST DÉLIBÉRÉ, ET IL FAUT SAVOIR POURQUOI AVANT DE LE DÉFAIRE.
 * Le site est mis en vente. Une page centrée sur Cyprien — son parcours, ses records,
 * sa personnalité — devient un poids mort le jour où il n'est plus là : l'acheteur
 * hérite d'un texte qui parle d'un inconnu et doit le réécrire. Pire, si la crédibilité
 * du produit tient à une personne, une partie de sa valeur part avec elle.
 *
 * On raconte donc l'histoire DU PRODUIT : d'où il vient, quel problème il résout, et
 * pourquoi il est construit comme ça. Le parcours du fondateur sert de preuve, il n'est
 * pas le sujet. Le texte reste vrai après la vente.
 *
 * ⚠️ CHAQUE CHIFFRE EST VÉRIFIÉ DANS LE COMPTE RÉEL, relevé sur intervals.icu le
 * 23/08/2026 : 268 sorties, 2 786 km depuis le 26/04/2025, et un 10 km en 33:58 le
 * 04/04/2026. Le 39:23 de septembre 2023 est antérieur à la synchronisation : c'est le
 * seul chiffre de cette page qui repose sur la parole de Cyprien, et il est présenté
 * comme un souvenir daté, pas comme une mesure.
 *
 * ⚠️ CE QUI A ÉTÉ ÉCARTÉ FAUTE DE PREUVE : un semi-marathon annoncé en 1 h 15. Aucune
 * sortie entre 20,5 et 21,7 km n'existe dans l'historique — ni à Lille ni ailleurs. Le
 * chiffre est plausible au vu du 10 km, mais invérifiable ici. Sur une page qu'un
 * acheteur ira contrôler, un chrono invérifiable à côté d'un chrono prouvé affaiblit
 * les deux. À rajouter le jour où le résultat officiel de la course est produit.
 */
export type HistoirePage = {
  navLabel: string;
  metaTitle: string;
  metaDesc: string;
  eyebrow: string;
  titre: string;
  accent: string;
  chapo: string;
  /** Les repères, dans l'ordre. Le numéro d'étape n'est pas décoratif : c'est une
   *  chronologie, et l'ordre porte le sens. */
  etapes: { annee: string; titre: string; texte: string }[];
  chiffresTitre: string;
  chiffres: { valeur: string; label: string }[];
  chiffresNote: string;
  fermetureTitre: string;
  fermeture: string;
  cta: string;
};

export const HISTOIRE: Record<Lang, HistoirePage> = {
  fr: {
    navLabel: "Notre histoire",
    metaTitle: "Notre histoire",
    metaDesc: "Pacevo est née de la préparation d'un marathon. Voici le problème qu'elle résout, et pourquoi elle est construite comme ça.",
    eyebrow: "Notre histoire",
    titre: "Un 10 km sur un coup de tête,",
    accent: " et tout a changé.",
    chapo: "Pacevo n'est pas née d'une étude de marché. Elle est née de la préparation d'un marathon, et du constat qu'aucun outil ne répondait à la seule question qui compte vraiment.",
    etapes: [
      {
        annee: "Septembre 2023",
        titre: "Le déclic",
        texte: "Ma première vraie course : un 10 kilomètres, inscrit sur un coup de tête. 39 minutes 23. Je ne courais pas vraiment avant ça — quelques sorties pour accompagner ma mère, sans y prendre goût. Ce chrono a tout déclenché.",
      },
      {
        annee: "Décembre 2024",
        titre: "Beaucoup d'informations, aucune décision",
        texte: "Je me suis mis à courir bien plus sérieusement : des livres, des heures de vidéos, des discussions avec les coureurs autour de moi. J'ai trouvé énormément d'informations sur l'entraînement, la récupération, la nutrition. Ce que je n'ai trouvé nulle part, c'est une réponse à la seule question qui compte quand on prépare une course : qu'est-ce que je fais demain ?",
      },
      {
        annee: "Le problème",
        titre: "Les données existaient, elles ne décidaient rien",
        texte: "Ma montre mesurait déjà tout — variabilité cardiaque, sommeil, charge d'entraînement, allures. Toutes ces mesures s'empilaient dans des graphiques que je regardais sans savoir quoi en faire. Un plan imprimé douze semaines à l'avance, lui, ignore que j'ai mal dormi cette nuit et que ma dernière séance m'a coûté plus cher que prévu.",
      },
      {
        annee: "L'application",
        titre: "Un plan qui se réécrit au lieu de se subir",
        texte: "J'ai construit Pacevo pour ma propre préparation du marathon de Lille : sept jours de plan, recalculés après chaque sortie à partir de ce que la montre a réellement mesuré. Pas un tableau figé — une prescription qui change quand le corps change.",
      },
    ],
    chiffresTitre: "Ce que ça a donné",
    chiffres: [
      { valeur: "39:23 → 33:58", label: "sur 10 km, entre 2023 et avril 2026" },
      { valeur: "2 786 km", label: "courus et synchronisés" },
      { valeur: "268", label: "sorties enregistrées" },
      { valeur: "~15", label: "courses, du 10 km au trail" },
    ],
    chiffresNote: "Ces chiffres viennent de mon propre compte Pacevo, synchronisé depuis le 26 avril 2025. Ils sont relevés, pas arrondis à l'avantage.",
    fermetureTitre: "Aujourd'hui",
    fermeture: "Le marathon de Lille approche, et l'application s'entraîne avec moi. C'est aussi la règle que je m'impose : aucune fonctionnalité n'est ajoutée si je ne m'en sers pas moi-même pour préparer une course.",
    cta: "Essayer Pacevo",
  },
  en: {
    navLabel: "Our story",
    metaTitle: "Our story",
    metaDesc: "Pacevo was born out of marathon training. Here is the problem it solves, and why it is built the way it is.",
    eyebrow: "Our story",
    titre: "A 10K entered on a whim,",
    accent: " and everything changed.",
    chapo: "Pacevo did not come out of market research. It came out of training for a marathon, and realising that no tool answered the one question that actually matters.",
    etapes: [
      { annee: "September 2023", titre: "The spark", texte: "My first real race: a 10K, entered on a whim. 39 minutes 23. I was not really a runner before that — a few outings to keep my mother company, without enjoying it much. That time changed everything." },
      { annee: "December 2024", titre: "Plenty of information, no decision", texte: "I started training far more seriously: books, hours of videos, conversations with the runners around me. I found a huge amount about training, recovery and nutrition. What I never found was an answer to the one question that matters while preparing for a race: what do I do tomorrow?" },
      { annee: "The problem", titre: "The data existed, and decided nothing", texte: "My watch already measured everything — heart-rate variability, sleep, training load, paces. All of it piled up in charts I looked at without knowing what to do with them. And a plan printed twelve weeks ahead has no idea that I slept badly last night, or that my last session cost more than expected." },
      { annee: "The app", titre: "A plan that rewrites itself", texte: "I built Pacevo for my own Lille marathon build-up: seven days of plan, recalculated after every run from what the watch actually measured. Not a fixed table — a prescription that changes when the body changes." },
    ],
    chiffresTitre: "What came of it",
    chiffres: [
      { valeur: "39:23 → 33:58", label: "over 10K, between 2023 and April 2026" },
      { valeur: "2,786 km", label: "run and synced" },
      { valeur: "268", label: "recorded runs" },
      { valeur: "~15", label: "races, from 10K to trail" },
    ],
    chiffresNote: "These figures come from my own Pacevo account, synced since 26 April 2025. They are read off, not rounded in my favour.",
    fermetureTitre: "Today",
    fermeture: "The Lille marathon is coming, and the app trains alongside me. That is the rule I hold myself to: no feature ships unless I use it myself to prepare for a race.",
    cta: "Try Pacevo",
  },
  de: {
    navLabel: "Unsere Geschichte",
    metaTitle: "Unsere Geschichte",
    metaDesc: "Pacevo entstand aus der Vorbereitung auf einen Marathon. Hier steht, welches Problem sie löst und warum sie so gebaut ist.",
    eyebrow: "Unsere Geschichte",
    titre: "Ein 10er aus einer Laune heraus –",
    accent: " und alles änderte sich.",
    chapo: "Pacevo ist nicht aus einer Marktanalyse entstanden, sondern aus der Vorbereitung auf einen Marathon – und aus der Erkenntnis, dass kein Werkzeug die eine Frage beantwortet, auf die es wirklich ankommt.",
    etapes: [
      { annee: "September 2023", titre: "Der Auslöser", texte: "Mein erstes richtiges Rennen: ein 10-Kilometer-Lauf, spontan gemeldet. 39 Minuten 23. Davor war ich kein Läufer – ein paar Runden zur Begleitung meiner Mutter, ohne echte Freude daran. Diese Zeit hat alles ausgelöst." },
      { annee: "Dezember 2024", titre: "Viele Informationen, keine Entscheidung", texte: "Ich begann deutlich ernsthafter zu trainieren: Bücher, stundenlange Videos, Gespräche mit Läufern um mich herum. Über Training, Erholung und Ernährung fand ich unendlich viel. Was ich nirgends fand, war die Antwort auf die entscheidende Frage einer Wettkampfvorbereitung: Was mache ich morgen?" },
      { annee: "Das Problem", titre: "Die Daten waren da und entschieden nichts", texte: "Meine Uhr maß längst alles – Herzratenvariabilität, Schlaf, Belastung, Tempo. All das stapelte sich in Diagrammen, mit denen ich nichts anzufangen wusste. Und ein zwölf Wochen im Voraus gedruckter Plan weiß nicht, dass ich letzte Nacht schlecht geschlafen habe." },
      { annee: "Die App", titre: "Ein Plan, der sich neu schreibt", texte: "Ich habe Pacevo für meine eigene Marathonvorbereitung in Lille gebaut: sieben Tage Plan, nach jedem Lauf neu berechnet aus dem, was die Uhr tatsächlich gemessen hat. Keine starre Tabelle – eine Verordnung, die sich ändert, wenn sich der Körper ändert." },
    ],
    chiffresTitre: "Was daraus wurde",
    chiffres: [
      { valeur: "39:23 → 33:58", label: "über 10 km, zwischen 2023 und April 2026" },
      { valeur: "2 786 km", label: "gelaufen und synchronisiert" },
      { valeur: "268", label: "aufgezeichnete Läufe" },
      { valeur: "~15", label: "Rennen, von 10 km bis Trail" },
    ],
    chiffresNote: "Diese Zahlen stammen aus meinem eigenen Pacevo-Konto, synchronisiert seit dem 26. April 2025. Sie sind abgelesen, nicht zu meinen Gunsten gerundet.",
    fermetureTitre: "Heute",
    fermeture: "Der Marathon von Lille rückt näher, und die App trainiert mit. Das ist auch meine Regel: keine Funktion, die ich nicht selbst zur Wettkampfvorbereitung nutze.",
    cta: "Pacevo testen",
  },
  es: {
    navLabel: "Nuestra historia",
    metaTitle: "Nuestra historia",
    metaDesc: "Pacevo nació de la preparación de un maratón. Aquí está el problema que resuelve y por qué está hecha así.",
    eyebrow: "Nuestra historia",
    titre: "Un 10 km por capricho,",
    accent: " y todo cambió.",
    chapo: "Pacevo no nació de un estudio de mercado, sino de preparar un maratón y descubrir que ninguna herramienta respondía a la única pregunta que de verdad importa.",
    etapes: [
      { annee: "Septiembre de 2023", titre: "El detonante", texte: "Mi primera carrera de verdad: un 10 km, apuntado por capricho. 39 minutos 23. Antes no era corredor — alguna salida para acompañar a mi madre, sin disfrutarlo demasiado. Ese tiempo lo cambió todo." },
      { annee: "Diciembre de 2024", titre: "Mucha información, ninguna decisión", texte: "Empecé a entrenar mucho más en serio: libros, horas de vídeos, conversaciones con los corredores de mi entorno. Encontré muchísimo sobre entrenamiento, recuperación y nutrición. Lo que no encontré en ninguna parte fue la respuesta a la única pregunta que cuenta al preparar una carrera: ¿qué hago mañana?" },
      { annee: "El problema", titre: "Los datos existían y no decidían nada", texte: "Mi reloj ya lo medía todo — variabilidad cardíaca, sueño, carga, ritmos. Todo se acumulaba en gráficos que miraba sin saber qué hacer con ellos. Y un plan impreso doce semanas antes no sabe que anoche dormí mal." },
      { annee: "La aplicación", titre: "Un plan que se reescribe", texte: "Construí Pacevo para mi propia preparación del maratón de Lille: siete días de plan, recalculados tras cada salida a partir de lo que el reloj midió realmente. No una tabla fija — una prescripción que cambia cuando cambia el cuerpo." },
    ],
    chiffresTitre: "Lo que dio de sí",
    chiffres: [
      { valeur: "39:23 → 33:58", label: "en 10 km, entre 2023 y abril de 2026" },
      { valeur: "2 786 km", label: "corridos y sincronizados" },
      { valeur: "268", label: "salidas registradas" },
      { valeur: "~15", label: "carreras, del 10 km al trail" },
    ],
    chiffresNote: "Estas cifras vienen de mi propia cuenta Pacevo, sincronizada desde el 26 de abril de 2025. Están leídas, no redondeadas a mi favor.",
    fermetureTitre: "Hoy",
    fermeture: "El maratón de Lille se acerca y la aplicación entrena conmigo. Es también la regla que me impongo: ninguna función se añade si yo mismo no la uso para preparar una carrera.",
    cta: "Probar Pacevo",
  },
  pt: {
    navLabel: "A nossa história",
    metaTitle: "A nossa história",
    metaDesc: "A Pacevo nasceu da preparação de uma maratona. Eis o problema que resolve e porque está construída assim.",
    eyebrow: "A nossa história",
    titre: "Uns 10 km por impulso,",
    accent: " e tudo mudou.",
    chapo: "A Pacevo não nasceu de um estudo de mercado, mas de preparar uma maratona e perceber que nenhuma ferramenta respondia à única pergunta que realmente conta.",
    etapes: [
      { annee: "Setembro de 2023", titre: "O clique", texte: "A minha primeira corrida a sério: uns 10 km, inscrito por impulso. 39 minutos 23. Antes disso não era corredor — umas saídas para acompanhar a minha mãe, sem grande gosto. Aquele tempo mudou tudo." },
      { annee: "Dezembro de 2024", titre: "Muita informação, nenhuma decisão", texte: "Comecei a treinar bastante mais a sério: livros, horas de vídeos, conversas com os corredores à minha volta. Encontrei imenso sobre treino, recuperação e nutrição. O que nunca encontrei foi resposta à única pergunta que conta ao preparar uma prova: o que faço amanhã?" },
      { annee: "O problema", titre: "Os dados existiam e não decidiam nada", texte: "O meu relógio já media tudo — variabilidade cardíaca, sono, carga, ritmos. Tudo se acumulava em gráficos que eu olhava sem saber o que fazer com eles. E um plano impresso doze semanas antes não sabe que dormi mal esta noite." },
      { annee: "A aplicação", titre: "Um plano que se reescreve", texte: "Construí a Pacevo para a minha própria preparação da maratona de Lille: sete dias de plano, recalculados após cada saída a partir do que o relógio realmente mediu. Não uma tabela fixa — uma prescrição que muda quando o corpo muda." },
    ],
    chiffresTitre: "O que daí resultou",
    chiffres: [
      { valeur: "39:23 → 33:58", label: "em 10 km, entre 2023 e abril de 2026" },
      { valeur: "2 786 km", label: "corridos e sincronizados" },
      { valeur: "268", label: "saídas registadas" },
      { valeur: "~15", label: "provas, dos 10 km ao trail" },
    ],
    chiffresNote: "Estes números vêm da minha própria conta Pacevo, sincronizada desde 26 de abril de 2025. São lidos, não arredondados a meu favor.",
    fermetureTitre: "Hoje",
    fermeture: "A maratona de Lille aproxima-se e a aplicação treina comigo. É também a regra que me imponho: nenhuma funcionalidade entra se eu próprio não a usar para preparar uma prova.",
    cta: "Experimentar a Pacevo",
  },
};
