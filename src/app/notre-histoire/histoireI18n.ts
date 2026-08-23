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
 * 23/08/2026 : 268 sorties, 2 786 km depuis le 26/04/2025, un 10 km en 33:58 le
 * 04/04/2026, et le Tour du Mont-Blanc du 14 au 18/07/2025 — 83 km, D+6 087 m, 19 h de
 * marche sur 5 jours. Le 39:13 de septembre 2023 est antérieur à la synchronisation :
 * c'est le seul chiffre de cette page qui repose sur la parole de Cyprien, et il est
 * présenté comme un souvenir daté, pas comme une mesure.
 *
 * ⚠️ LE TOUR DU MONT-BLANC EST DIT « EN RANDONNÉE », ET CE MOT N'EST PAS NÉGOCIABLE.
 * Les cinq journées sont enregistrées en type `Hike` dans intervals.icu, pas `Run`.
 * Écrire « j'ai fait le TMB » sur un site de course serait lu par n'importe quel coureur
 * comme l'ultra-trail de 170 km — un malentendu qui se retourne à la première
 * vérification. Le trek reste une performance : 6 087 m de dénivelé en cinq jours se
 * défendent seuls, sans emprunter le prestige d'une course qui n'a pas été courue.
 *
 * ⚠️ CE QUI A ÉTÉ ÉCARTÉ FAUTE DE PREUVE : un semi-marathon annoncé en 1 h 15. Aucune
 * sortie entre 20,5 et 21,7 km n'existe dans l'historique — ni à Lille ni ailleurs. Le
 * chiffre est plausible au vu du 10 km, mais invérifiable ici. Sur une page qu'un
 * acheteur ira contrôler, un chrono invérifiable à côté d'un chrono prouvé affaiblit
 * les deux. À rajouter le jour où le résultat officiel de la course est produit.
 *
 * ⚠️ « LOUIS » EST UN PRÉNOM DE PERSONNE RÉELLE, cité avec l'accord de Cyprien. Prénom
 * seul, aucun nom de famille : c'est le minimum quand on publie l'identité d'un tiers
 * sur une page commerciale. Ne pas y ajouter de patronyme.
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
        texte: "Ma première vraie course : un 10 kilomètres, inscrit sur un coup de tête. 39 minutes 13. Je ne courais pas vraiment avant ça — quelques sorties pour accompagner ma mère, sans y prendre goût. Ce chrono a tout déclenché.",
      },
      {
        annee: "2024",
        titre: "Louis, et une famille qui court",
        texte: "Je m'y suis vraiment mis grâce à Louis, un très bon ami avec qui j'ai enchaîné les dossards depuis. Chez moi, courir n'a rien d'exceptionnel : mon frère court, mon père et ma mère aussi, mes oncles et mes parrains également. On se croise sur les mêmes lignes de départ. C'est là que la course est passée du chrono à une habitude de vie.",
      },
      {
        annee: "Juillet 2025",
        titre: "Le Tour du Mont-Blanc",
        texte: "Avec Louis, nous avons bouclé le Tour du Mont-Blanc en randonnée : cinq jours, 83 kilomètres, 6 087 mètres de dénivelé positif et dix-neuf heures de marche. Rien à voir avec une course — mais c'est là qu'on comprend ce que l'endurance veut dire, et pourquoi la récupération compte autant que l'entraînement.",
      },
      {
        annee: "Sans club",
        titre: "Beaucoup d'informations, aucune décision",
        texte: "Je n'ai jamais eu le temps de m'inscrire en club : mes études de commerce ne laissaient pas de place. Je me suis donc formé seul — des livres, des heures de vidéos, et surtout les coureurs autour de moi. J'ai trouvé énormément d'informations sur l'entraînement, la récupération, la nutrition. Ce que je n'ai trouvé nulle part, c'est une réponse à la seule question qui compte quand on prépare une course : qu'est-ce que je fais demain ?",
      },
      {
        annee: "L'application",
        titre: "Les données existaient, elles ne décidaient rien",
        texte: "Ma montre mesurait déjà tout — variabilité cardiaque, sommeil, charge, allures — et tout ça s'empilait dans des graphiques. Un plan imprimé douze semaines à l'avance, lui, ignore que j'ai mal dormi cette nuit. J'ai construit Pacevo pour ma propre préparation du marathon de Lille, en apprenant à coder avec l'intelligence artificielle comme copilote : sept jours de plan, recalculés après chaque sortie à partir de ce que la montre a réellement mesuré.",
      },
    ],
    chiffresTitre: "Ce que ça a donné",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "sur 10 km, entre 2023 et avril 2026" },
      { valeur: "2 786 km", label: "courus et synchronisés" },
      { valeur: "268", label: "sorties enregistrées" },
      { valeur: "83 km · D+6 087 m", label: "le Tour du Mont-Blanc, en 5 jours" },
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
      { annee: "September 2023", titre: "The spark", texte: "My first real race: a 10K, entered on a whim. 39 minutes 13. I was not really a runner before that — a few outings to keep my mother company, without enjoying it much. That time changed everything." },
      { annee: "2024", titre: "Louis, and a family that runs", texte: "I properly got into it thanks to Louis, a close friend I have raced alongside ever since. Running is nothing unusual in my family: my brother runs, so do my father and my mother, my uncles and my godfathers. We meet on the same start lines. That is when running stopped being a time on a clock and became a way of living." },
      { annee: "July 2025", titre: "The Tour du Mont-Blanc", texte: "With Louis we walked the Tour du Mont-Blanc: five days, 83 kilometres, 6,087 metres of climbing and nineteen hours on foot. Nothing like a race — but that is where you understand what endurance means, and why recovery matters as much as training." },
      { annee: "No club", titre: "Plenty of information, no decision", texte: "I never had time to join a club: my business studies left no room for it. So I taught myself — books, hours of videos, and above all the runners around me. I found a huge amount about training, recovery and nutrition. What I never found was an answer to the one question that matters while preparing for a race: what do I do tomorrow?" },
      { annee: "The app", titre: "The data existed, and decided nothing", texte: "My watch already measured everything — heart-rate variability, sleep, load, paces — and all of it piled up in charts. A plan printed twelve weeks ahead has no idea that I slept badly last night. I built Pacevo for my own Lille marathon build-up, learning to code with artificial intelligence as a copilot: seven days of plan, recalculated after every run from what the watch actually measured." },
    ],
    chiffresTitre: "What came of it",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "over 10K, between 2023 and April 2026" },
      { valeur: "2,786 km", label: "run and synced" },
      { valeur: "268", label: "recorded runs" },
      { valeur: "83 km · 6,087 m up", label: "the Tour du Mont-Blanc, in 5 days" },
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
      { annee: "September 2023", titre: "Der Auslöser", texte: "Mein erstes richtiges Rennen: ein 10-Kilometer-Lauf, spontan gemeldet. 39 Minuten 13. Davor war ich kein Läufer – ein paar Runden zur Begleitung meiner Mutter, ohne echte Freude daran. Diese Zeit hat alles ausgelöst." },
      { annee: "2024", titre: "Louis und eine laufende Familie", texte: "Richtig eingestiegen bin ich dank Louis, einem sehr guten Freund, mit dem ich seither Rennen um Rennen bestreite. Laufen ist bei uns nichts Besonderes: mein Bruder läuft, mein Vater und meine Mutter auch, meine Onkel und meine Paten ebenso. Wir treffen uns an denselben Startlinien. Da wurde aus einer Zeit auf der Uhr eine Lebensgewohnheit." },
      { annee: "Juli 2025", titre: "Die Tour du Mont-Blanc", texte: "Mit Louis haben wir die Tour du Mont-Blanc erwandert: fünf Tage, 83 Kilometer, 6 087 Höhenmeter und neunzehn Stunden zu Fuß. Kein Rennen – aber dort versteht man, was Ausdauer bedeutet und warum Erholung genauso zählt wie Training." },
      { annee: "Ohne Verein", titre: "Viele Informationen, keine Entscheidung", texte: "Für einen Verein hatte ich nie Zeit: mein Wirtschaftsstudium ließ keinen Raum. Also habe ich es mir selbst beigebracht – Bücher, stundenlange Videos und vor allem die Läufer um mich herum. Über Training, Erholung und Ernährung fand ich unendlich viel. Was ich nirgends fand, war die Antwort auf die entscheidende Frage einer Wettkampfvorbereitung: Was mache ich morgen?" },
      { annee: "Die App", titre: "Die Daten waren da und entschieden nichts", texte: "Meine Uhr maß längst alles – Herzratenvariabilität, Schlaf, Belastung, Tempo – und all das stapelte sich in Diagrammen. Ein zwölf Wochen im Voraus gedruckter Plan weiß nicht, dass ich letzte Nacht schlecht geschlafen habe. Ich habe Pacevo für meine eigene Marathonvorbereitung in Lille gebaut und dabei das Programmieren mit künstlicher Intelligenz als Kopilot gelernt: sieben Tage Plan, nach jedem Lauf neu berechnet aus dem, was die Uhr tatsächlich gemessen hat." },
    ],
    chiffresTitre: "Was daraus wurde",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "über 10 km, zwischen 2023 und April 2026" },
      { valeur: "2 786 km", label: "gelaufen und synchronisiert" },
      { valeur: "268", label: "aufgezeichnete Läufe" },
      { valeur: "83 km · 6 087 Hm", label: "die Tour du Mont-Blanc, in 5 Tagen" },
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
      { annee: "Septiembre de 2023", titre: "El detonante", texte: "Mi primera carrera de verdad: un 10 km, apuntado por capricho. 39 minutos 13. Antes no era corredor — alguna salida para acompañar a mi madre, sin disfrutarlo demasiado. Ese tiempo lo cambió todo." },
      { annee: "2024", titre: "Louis, y una familia que corre", texte: "Me metí de verdad gracias a Louis, un gran amigo con quien encadeno dorsales desde entonces. En mi casa correr no tiene nada de excepcional: corre mi hermano, mi padre y mi madre también, mis tíos y mis padrinos igual. Nos cruzamos en las mismas líneas de salida. Ahí correr dejó de ser un crono para convertirse en una forma de vivir." },
      { annee: "Julio de 2025", titre: "El Tour del Mont Blanc", texte: "Con Louis hicimos el Tour del Mont Blanc caminando: cinco días, 83 kilómetros, 6 087 metros de desnivel positivo y diecinueve horas de marcha. Nada que ver con una carrera — pero ahí es donde entiendes qué significa la resistencia, y por qué la recuperación cuenta tanto como el entrenamiento." },
      { annee: "Sin club", titre: "Mucha información, ninguna decisión", texte: "Nunca tuve tiempo de apuntarme a un club: mis estudios de comercio no dejaban hueco. Así que me formé solo — libros, horas de vídeos y, sobre todo, los corredores de mi entorno. Encontré muchísimo sobre entrenamiento, recuperación y nutrición. Lo que no encontré en ninguna parte fue la respuesta a la única pregunta que cuenta al preparar una carrera: ¿qué hago mañana?" },
      { annee: "La aplicación", titre: "Los datos existían y no decidían nada", texte: "Mi reloj ya lo medía todo — variabilidad cardíaca, sueño, carga, ritmos — y todo se acumulaba en gráficos. Un plan impreso doce semanas antes no sabe que anoche dormí mal. Construí Pacevo para mi propia preparación del maratón de Lille, aprendiendo a programar con la inteligencia artificial como copiloto: siete días de plan, recalculados tras cada salida a partir de lo que el reloj midió realmente." },
    ],
    chiffresTitre: "Lo que dio de sí",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "en 10 km, entre 2023 y abril de 2026" },
      { valeur: "2 786 km", label: "corridos y sincronizados" },
      { valeur: "268", label: "salidas registradas" },
      { valeur: "83 km · D+6 087 m", label: "el Tour del Mont Blanc, en 5 días" },
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
      { annee: "Setembro de 2023", titre: "O clique", texte: "A minha primeira corrida a sério: uns 10 km, inscrito por impulso. 39 minutos 13. Antes disso não era corredor — umas saídas para acompanhar a minha mãe, sem grande gosto. Aquele tempo mudou tudo." },
      { annee: "2024", titre: "O Louis, e uma família que corre", texte: "Entrei mesmo a sério graças ao Louis, um grande amigo com quem encadeio dorsais desde então. Lá em casa correr não tem nada de excecional: o meu irmão corre, o meu pai e a minha mãe também, os meus tios e os meus padrinhos igualmente. Cruzamo-nos nas mesmas linhas de partida. Foi aí que correr deixou de ser um crono para passar a ser um modo de vida." },
      { annee: "Julho de 2025", titre: "A Volta ao Monte Branco", texte: "Com o Louis fizemos a Volta ao Monte Branco a caminhar: cinco dias, 83 quilómetros, 6 087 metros de desnível positivo e dezanove horas de marcha. Nada a ver com uma prova — mas é ali que se percebe o que é a resistência, e porque a recuperação conta tanto como o treino." },
      { annee: "Sem clube", titre: "Muita informação, nenhuma decisão", texte: "Nunca tive tempo de me inscrever num clube: os meus estudos de comércio não deixavam espaço. Formei-me sozinho — livros, horas de vídeos e, sobretudo, os corredores à minha volta. Encontrei imenso sobre treino, recuperação e nutrição. O que nunca encontrei foi resposta à única pergunta que conta ao preparar uma prova: o que faço amanhã?" },
      { annee: "A aplicação", titre: "Os dados existiam e não decidiam nada", texte: "O meu relógio já media tudo — variabilidade cardíaca, sono, carga, ritmos — e tudo se acumulava em gráficos. Um plano impresso doze semanas antes não sabe que dormi mal esta noite. Construí a Pacevo para a minha própria preparação da maratona de Lille, aprendendo a programar com a inteligência artificial como copiloto: sete dias de plano, recalculados após cada saída a partir do que o relógio realmente mediu." },
    ],
    chiffresTitre: "O que daí resultou",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "em 10 km, entre 2023 e abril de 2026" },
      { valeur: "2 786 km", label: "corridos e sincronizados" },
      { valeur: "268", label: "saídas registadas" },
      { valeur: "83 km · D+6 087 m", label: "a Volta ao Monte Branco, em 5 dias" },
    ],
    chiffresNote: "Estes números vêm da minha própria conta Pacevo, sincronizada desde 26 de abril de 2025. São lidos, não arredondados a meu favor.",
    fermetureTitre: "Hoje",
    fermeture: "A maratona de Lille aproxima-se e a aplicação treina comigo. É também a regra que me imponho: nenhuma funcionalidade entra se eu próprio não a usar para preparar uma prova.",
    cta: "Experimentar a Pacevo",
  },
};
