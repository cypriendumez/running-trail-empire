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
 * ⚠️ LE TOUR DU MONT-BLANC : DEUX PRÉCAUTIONS, ET AUCUNE N'EST DÉCORATIVE.
 *
 * 1. LE MOT « RANDONNÉE » RESTE. Les journées enregistrées le sont en type `Hike`, pas
 *    `Run`. Sur un site de course, « j'ai fait le TMB » serait lu par n'importe quel
 *    coureur comme l'ultra-trail — un malentendu qui se retourne à la première
 *    vérification. Le tour complet à pied se défend seul.
 * 2. AUCUN CHIFFRE DE DISTANCE NI DE DÉNIVELÉ. La première version affichait « 83 km,
 *    D+6 087 m » : c'était le total des journées ENREGISTRÉES, et Cyprien a précisé
 *    qu'il avait fait le tour ENTIER sans tout enregistrer. Le chiffre sous-estimait donc
 *    la réalité tout en ayant l'air d'une mesure exacte — le pire des deux mondes. On ne
 *    remplace pas par les ~170 km du tour officiel : ce serait une donnée d'itinéraire
 *    présentée comme une mesure personnelle.
 *
 * Ce qui EST attesté par ses propres traces GPS : Saint-Gervais (France), Courmayeur
 * (Italie), Orsières (Suisse) — les trois pays du tour. C'est cela qu'on affiche.
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
        titre: "Le Tour du Mont-Blanc, sur un coup de tête",
        texte: "Avec Louis, nous avons bouclé le Tour du Mont-Blanc en entier, à pied, décidé presque du jour au lendemain. Le tour complet du massif, de Saint-Gervais à Courmayeur puis Orsières : trois pays en une semaine de marche. Aucune course, aucun chrono — mais c'est là qu'on comprend ce que l'endurance veut dire, et pourquoi la récupération compte autant que l'entraînement.",
      },
      {
        annee: "Sans club, sans coach",
        titre: "Je voulais progresser, personne n'était là pour me dire comment",
        texte: "Mes études de commerce ne m'ont jamais laissé le temps de m'inscrire en club. Pas de club, donc pas d'entraîneur — et pourtant l'envie de progresser à chaque sortie, de me surpasser à chaque dossard. Je me suis formé seul : des livres, des heures de vidéos, et surtout de longues discussions avec les coureurs autour de moi. J'ai fini par comprendre l'entraînement, la récupération, la nutrition.",
      },
      {
        annee: "Mon premier marathon",
        titre: "Il me fallait des séances précises, pas de la théorie",
        texte: "Lille sera mon premier marathon, et là, s'informer ne suffisait plus. Tout ce que j'avais appris était général : des principes, des pourcentages, des semaines types. Ce dont j'avais besoin, c'était d'une séance précise pour demain, tenant compte de ma nuit, de ma fatigue et de ce que j'avais couru la veille. Ma montre mesurait déjà tout — variabilité cardiaque, sommeil, charge, allures — et rien ne transformait ces mesures en décision. Alors j'ai construit Pacevo, en apprenant à coder avec l'intelligence artificielle comme copilote.",
      },
    ],
    chiffresTitre: "Ce que ça a donné",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "sur 10 km, entre 2023 et avril 2026" },
      { valeur: "2 786 km", label: "courus et synchronisés" },
      { valeur: "268", label: "sorties enregistrées" },
      { valeur: "3 pays", label: "le Tour du Mont-Blanc, juillet 2025" },
    ],
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
      { annee: "July 2025", titre: "The Tour du Mont-Blanc, on a whim", texte: "With Louis we walked the whole Tour du Mont-Blanc, decided almost overnight. The complete loop around the massif, from Saint-Gervais to Courmayeur and on to Orsières: three countries in a week on foot. No race, no stopwatch — but that is where you understand what endurance means, and why recovery matters as much as training." },
      { annee: "No club, no coach", titre: "I wanted to improve, and nobody was there to tell me how", texte: "My business studies never left me time to join a club. No club meant no coach — and yet the urge to improve on every run, to push further at every start line. So I taught myself: books, hours of videos, and above all long conversations with the runners around me. I ended up understanding training, recovery and nutrition." },
      { annee: "My first marathon", titre: "I needed precise sessions, not theory", texte: "Lille will be my first marathon, and there, reading up was no longer enough. Everything I had learned was general: principles, percentages, template weeks. What I needed was a precise session for tomorrow, accounting for my night, my fatigue and what I had run the day before. My watch already measured everything — heart-rate variability, sleep, load, paces — and nothing turned those measurements into a decision. So I built Pacevo, learning to code with artificial intelligence as a copilot." },
    ],
    chiffresTitre: "What came of it",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "over 10K, between 2023 and April 2026" },
      { valeur: "2,786 km", label: "run and synced" },
      { valeur: "268", label: "recorded runs" },
      { valeur: "3 countries", label: "the Tour du Mont-Blanc, July 2025" },
    ],
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
      { annee: "Juli 2025", titre: "Die Tour du Mont-Blanc, spontan", texte: "Mit Louis haben wir die ganze Tour du Mont-Blanc erwandert, fast über Nacht beschlossen. Die komplette Runde um das Massiv, von Saint-Gervais über Courmayeur bis Orsières: drei Länder in einer Woche zu Fuß. Kein Rennen, keine Stoppuhr – aber dort versteht man, was Ausdauer bedeutet und warum Erholung genauso zählt wie Training." },
      { annee: "Ohne Verein, ohne Trainer", titre: "Ich wollte besser werden, und niemand sagte mir wie", texte: "Mein Wirtschaftsstudium ließ mir nie Zeit für einen Verein. Kein Verein hieß kein Trainer – und trotzdem der Wunsch, bei jedem Lauf besser zu werden und bei jedem Start über mich hinauszugehen. Also habe ich es mir selbst beigebracht: Bücher, stundenlange Videos und vor allem lange Gespräche mit den Läufern um mich herum. Nach und nach verstand ich Training, Erholung und Ernährung." },
      { annee: "Mein erster Marathon", titre: "Ich brauchte genaue Einheiten, keine Theorie", texte: "Lille wird mein erster Marathon, und da reichte Nachlesen nicht mehr. Alles Gelernte war allgemein: Prinzipien, Prozentwerte, Musterwochen. Gebraucht hätte ich eine genaue Einheit für morgen, die meine Nacht, meine Müdigkeit und den Lauf von gestern berücksichtigt. Meine Uhr maß längst alles – Herzratenvariabilität, Schlaf, Belastung, Tempo – und nichts machte daraus eine Entscheidung. Also habe ich Pacevo gebaut und dabei das Programmieren mit künstlicher Intelligenz als Kopilot gelernt." },
    ],
    chiffresTitre: "Was daraus wurde",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "über 10 km, zwischen 2023 und April 2026" },
      { valeur: "2 786 km", label: "gelaufen und synchronisiert" },
      { valeur: "268", label: "aufgezeichnete Läufe" },
      { valeur: "3 Länder", label: "die Tour du Mont-Blanc, Juli 2025" },
    ],
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
      { annee: "Julio de 2025", titre: "El Tour del Mont Blanc, por capricho", texte: "Con Louis hicimos el Tour del Mont Blanc entero, caminando, decidido casi de un día para otro. La vuelta completa al macizo, de Saint-Gervais a Courmayeur y luego Orsières: tres países en una semana a pie. Ninguna carrera, ningún crono — pero ahí es donde entiendes qué significa la resistencia, y por qué la recuperación cuenta tanto como el entrenamiento." },
      { annee: "Sin club, sin entrenador", titre: "Quería progresar y nadie estaba ahí para decirme cómo", texte: "Mis estudios de comercio nunca me dejaron tiempo para apuntarme a un club. Sin club no hay entrenador — y sin embargo las ganas de mejorar en cada salida, de superarme en cada dorsal. Así que me formé solo: libros, horas de vídeos y, sobre todo, largas conversaciones con los corredores de mi entorno. Acabé entendiendo el entrenamiento, la recuperación y la nutrición." },
      { annee: "Mi primer maratón", titre: "Necesitaba sesiones precisas, no teoría", texte: "Lille será mi primer maratón, y ahí informarse ya no bastaba. Todo lo aprendido era general: principios, porcentajes, semanas tipo. Lo que necesitaba era una sesión precisa para mañana, teniendo en cuenta mi noche, mi fatiga y lo que había corrido la víspera. Mi reloj ya lo medía todo — variabilidad cardíaca, sueño, carga, ritmos — y nada convertía esas medidas en una decisión. Así que construí Pacevo, aprendiendo a programar con la inteligencia artificial como copiloto." },
    ],
    chiffresTitre: "Lo que dio de sí",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "en 10 km, entre 2023 y abril de 2026" },
      { valeur: "2 786 km", label: "corridos y sincronizados" },
      { valeur: "268", label: "salidas registradas" },
      { valeur: "3 países", label: "el Tour del Mont Blanc, julio de 2025" },
    ],
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
      { annee: "Julho de 2025", titre: "A Volta ao Monte Branco, por impulso", texte: "Com o Louis fizemos a Volta ao Monte Branco inteira, a caminhar, decidida quase de um dia para o outro. A volta completa ao maciço, de Saint-Gervais a Courmayeur e depois Orsières: três países numa semana a pé. Nenhuma prova, nenhum crono — mas é ali que se percebe o que é a resistência, e porque a recuperação conta tanto como o treino." },
      { annee: "Sem clube, sem treinador", titre: "Queria progredir e ninguém estava lá para me dizer como", texte: "Os meus estudos de comércio nunca me deixaram tempo para entrar num clube. Sem clube não há treinador — e mesmo assim a vontade de melhorar em cada saída, de me superar em cada dorsal. Formei-me sozinho: livros, horas de vídeos e, sobretudo, longas conversas com os corredores à minha volta. Acabei por perceber o treino, a recuperação e a nutrição." },
      { annee: "A minha primeira maratona", titre: "Precisava de treinos precisos, não de teoria", texte: "Lille será a minha primeira maratona, e aí informar-me deixou de chegar. Tudo o que tinha aprendido era geral: princípios, percentagens, semanas-tipo. O que me faltava era um treino preciso para amanhã, a contar com a minha noite, o meu cansaço e o que tinha corrido na véspera. O meu relógio já media tudo — variabilidade cardíaca, sono, carga, ritmos — e nada transformava essas medidas numa decisão. Foi assim que construí a Pacevo, aprendendo a programar com a inteligência artificial como copiloto." },
    ],
    chiffresTitre: "O que daí resultou",
    chiffres: [
      { valeur: "39:13 → 33:58", label: "em 10 km, entre 2023 e abril de 2026" },
      { valeur: "2 786 km", label: "corridos e sincronizados" },
      { valeur: "268", label: "saídas registadas" },
      { valeur: "3 países", label: "a Volta ao Monte Branco, julho de 2025" },
    ],
    fermetureTitre: "Hoje",
    fermeture: "A maratona de Lille aproxima-se e a aplicação treina comigo. É também a regra que me imponho: nenhuma funcionalidade entra se eu próprio não a usar para preparar uma prova.",
    cta: "Experimentar a Pacevo",
  },
};
