/**
 * LE CORPS DES ARTICLES DU BLOG.
 *
 * Le blog affichait huit cartes avec un temps de lecture, une date et un auteur, alors
 * qu'AUCUN article n'existait et que tous les liens menaient à /signup. La page a été
 * rendue honnête le 21/08/2026 (badge « Sujet à venir ») ; ce fichier est la suite.
 * Les HUIT articles sont écrits — trois d'abord, les cinq autres dans la foulée — et
 * `SLUG_PAR_CLE` reste le seul juge : une carte n'est cliquable que si son texte existe
 * ici. Si tu ajoutes un sujet à `blogI18n` sans l'écrire ici, il portera son badge tout
 * seul, et c'est voulu.
 *
 * ⚠️ DEUX TITRES ONT ÉTÉ RECADRÉS parce qu'ils promettaient l'impossible :
 *  · « UTMB 2026 : les 20 trails à ne pas manquer » annonçait une liste datée que
 *    personne n'avait dressée, et qui serait fausse en six mois → critères de choix ;
 *  · « Chaussures de trail : le comparatif IA selon ta foulée » annonçait que l'app
 *    analyse cadence, oscillation verticale et temps de contact au sol pour désigner
 *    une chaussure parmi « 200+ modèles ». CETTE FONCTIONNALITÉ N'EXISTE PAS →
 *    les paramètres qui décident vraiment. Écrire l'article a révélé la promesse.
 *
 * ── DEUX RÈGLES, ET ELLES NE SE NÉGOCIENT PAS ────────────────────────────────
 *
 * 1. AUCUN CHIFFRE DE RÉSULTAT QUI NE VIENNE D'UNE SOURCE CITÉE. Le blog annonçait
 *    « le plan qui a marché pour 2 300 coureurs », « une précision de 94 % », « testé
 *    6 semaines avec 80 coureurs ». Rien de tout cela n'existait : la base compte UN
 *    profil. Les chiffres qu'on lit ci-dessous viennent tous d'une publication dont le
 *    lien est en bas de l'article, et ils décrivent un CONSENSUS de littérature, jamais
 *    une performance de Pacevo.
 *
 * 2. CHAQUE RÉFÉRENCE A ÉTÉ VÉRIFIÉE UNE PAR UNE via l'API NCBI (esummary) :
 *    identifiant, année, revue et titre confirmés avant d'être écrits. Un lien qui
 *    « a l'air » d'exister n'est pas une source. Si tu en ajoutes une, fais de même :
 *      curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=<PMID>"
 *
 * ── LANGUE ───────────────────────────────────────────────────────────────────
 * Ce fichier porte la version FRANÇAISE, qui est la SOURCE : c'est elle qu'on écrit
 * d'abord, elle qui cite les publications, et elle qui sert de repli. Les traductions
 * vivent dans `articlesI18n.ts`, et elles sont PARTIELLES à dessein : un article non
 * traduit dans une langue s'affiche en français avec un bandeau qui le dit au lecteur
 * dans SA langue. On ne retient donc jamais un article français en attendant ses quatre
 * traductions, et on n'affiche jamais du français sans prévenir.
 *
 * ⚠️ Les SOURCES restent ici et NE SE TRADUISENT PAS : un titre de publication se cite
 * dans sa langue d'origine, sinon le lecteur ne le retrouve pas.
 */

export type Source = { label: string; url: string };
export type Bloc = { h?: string; p: string[] };

export type Article = {
  /** Segment d'URL. Ne jamais le changer une fois publié : un lien partagé le porte. */
  slug: string;
  /** Clé de `blogI18n` — le titre et le chapô de la carte restent traduits. */
  cle: string;
  /** Dernière révision du texte. Affichée : un article de fond se date. */
  maj: string;
  chapo: string;
  blocs: Bloc[];
  sources: Source[];
  /** Avertissement de santé, pour ce qui touche à l'alimentation ou à la blessure. */
  avertissement?: string;
};

export const ARTICLES: Article[] = [
  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "ia-coach-ce-quun-humain-ne-fait-pas",
    cle: "p1",
    maj: "21 août 2026",
    chapo:
      "On oppose souvent l'algorithme et l'entraîneur comme s'il fallait choisir. La vraie ligne de partage n'est pas l'intelligence : c'est la fréquence d'observation. Voici ce que chacun voit, et ce qu'aucun des deux ne voit.",
    blocs: [
      {
        h: "Ce qu'un entraîneur fait, et qu'aucun programme ne remplace",
        p: [
          "Un entraîneur lit un visage. Il entend dans une phrase que la séparation, le déménagement ou la nuit blanche pèsent plus que la charge d'entraînement. Il sait qu'un athlète qui dit « ça va » à la fin d'une séance de seuil ment une fois sur deux, et il sait lequel des deux.",
          "Il porte aussi une vision longue. Il décide qu'une saison sera sacrifiée pour la suivante, que tel objectif est prématuré, que celui-ci compte parce qu'il tient à cœur et qu'un athlète motivé encaisse ce qu'un athlète résigné refuse. Rien de tout cela ne se déduit d'une série de mesures.",
          "Enfin, il ajuste en direct. Une côte plus dure que prévu, un groupe qui part trop vite, une douleur au mollet au troisième kilomètre : il change la séance sur place, avec ce qu'il voit.",
        ],
      },
      {
        h: "Ce qu'un programme fait, et qu'aucun entraîneur ne peut faire",
        p: [
          "Il regarde toutes les nuits. Pas le lundi soir au téléphone : toutes les nuits, et après chaque séance. C'est la seule différence qui compte vraiment, et elle est structurelle — un entraîneur qui suit trente athlètes ne peut pas relire trente courbes de sommeil chaque matin, quel que soit son talent.",
          "Il ne se fatigue pas et n'a pas d'affect. Il ne surestime pas la séance qu'il a lui-même prescrite, ne se souvient pas mieux du dernier bon entraînement que des trois moyens, et n'a pas d'orgueil à défendre quand les données contredisent le plan.",
          "Il calcule sur des fenêtres qu'aucune mémoire ne tient. La charge chronique se construit sur des semaines, le rapport entre charge récente et charge de fond se lit sur un mois glissant. Ce sont des moyennes mobiles : elles se calculent, elles ne s'intuitionnent pas.",
        ],
      },
      {
        h: "La ligne de partage : la fréquence, pas l'intelligence",
        p: [
          "Un entraîneur observe par épisodes — une séance, un appel, un message. Un programme observe en continu, mais ne voit que ce qui est mesuré. Le premier a du contexte et peu de points de mesure ; le second a beaucoup de points de mesure et aucun contexte.",
          "C'est pour cela que l'opposition est mal posée. La question n'est pas « qui décide mieux » mais « qui voit quoi, et à quelle fréquence ». Un plan qui ne bouge qu'une fois par semaine ignore par construction ce qui s'est passé mardi soir.",
        ],
      },
      {
        h: "Ce que ça change dans une semaine réelle",
        p: [
          "Prenons une semaine ordinaire. Mardi, séance de seuil menée comme prévu. Mercredi, nuit courte et variabilité cardiaque nettement sous la normale. Jeudi, une séance de qualité était au programme.",
          "Sans relecture quotidienne, la séance de jeudi tient : elle a été écrite dimanche. Avec relecture quotidienne, elle est allégée, et la qualité est déplacée au samedi, quand les indicateurs sont revenus. Le volume de la semaine ne change presque pas ; c'est sa répartition qui change, et c'est elle qui décide de l'usure.",
          "Cette logique — piloter la progression de la charge plutôt que sa quantité brute — est au cœur des travaux de Tim Gabbett sur le paradoxe entre entraînement et blessure : ce sont souvent les hausses rapides de charge, plus que la charge élevée en elle-même, qui exposent l'athlète.",
        ],
      },
      {
        h: "La limite, et il faut la dire",
        p: [
          "Un programme décide à partir de ce qu'il mesure. Ce qu'il ne mesure pas n'existe pas pour lui : une douleur qui commence, un deuil, une charge mentale au travail, une chaussure en fin de vie. Il ne les verra jamais, et aucune version future ne les verra tant qu'ils ne passent pas par un capteur.",
          "Les indicateurs eux-mêmes demandent de la prudence. Martin Buchheit a montré que les mesures dérivées de la fréquence cardiaque ne racontent pas toutes la même histoire selon le contexte, le moment de la mesure et le type d'effort : une valeur isolée ne veut rien dire, c'est la tendance qui informe.",
          "La conclusion honnête n'est donc pas « l'algorithme remplace ». C'est : il regarde tous les jours ce qu'un humain ne peut regarder que par intermittence, et il ne comprend rien à ce qu'un humain saisit d'un coup d'œil. Le coureur qui progresse est celui qui donne à chacun ce qu'il sait faire.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Gabbett TJ. The training-injury prevention paradox. Br J Sports Med, 2016",
        url: "https://pubmed.ncbi.nlm.nih.gov/26758673/",
      },
      {
        label:
          "Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome ? Front Physiol, 2014",
        url: "https://pubmed.ncbi.nlm.nih.gov/24578692/",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "vfc-et-charge-voir-la-fatigue-arriver",
    cle: "p2",
    maj: "21 août 2026",
    chapo:
      "Trois courbes et une mesure du matin. Ce que chacune dit, ce qu'elle ne dit pas, et pourquoi c'est leur croisement — jamais une valeur isolée — qui permet d'alléger avant que ça casse.",
    blocs: [
      {
        h: "Les trois courbes : ce que CTL, ATL et TSB veulent dire",
        p: [
          "Le modèle utilisé par la plupart des plateformes d'entraînement descend des travaux d'Eric Banister sur la réponse à la charge. Il tient en trois nombres, tous dérivés de la même série de séances.",
          "La charge chronique, souvent notée CTL, est une moyenne mobile longue — de l'ordre de six semaines. C'est ta condition de fond : elle monte lentement, elle descend lentement, et elle représente ce que ton corps a l'habitude d'encaisser.",
          "La charge aiguë, ATL, est la même chose sur une fenêtre courte, de l'ordre de la semaine. C'est ta fatigue récente : elle monte vite après une grosse séance et redescend vite au repos.",
          "La fraîcheur, TSB, est simplement l'écart entre les deux. Négative, tu es en train d'encaisser plus que d'habitude. Positive, tu es reposé — et c'est ce qu'on cherche le jour d'une course, pas pendant la préparation.",
        ],
      },
      {
        h: "La variabilité cardiaque : ce qu'elle mesure vraiment",
        p: [
          "La variabilité de fréquence cardiaque, ou VFC, ne mesure pas la fatigue. Elle mesure l'écart entre deux battements successifs, qui reflète l'équilibre entre les deux branches du système nerveux autonome. Une VFC basse signale que ton organisme est en mode de mobilisation ; elle ne dit pas pourquoi.",
          "C'est une distinction qui change tout en pratique. Une nuit d'alcool, un début de rhume, une chambre trop chaude, un décalage horaire ou une contrariété font baisser la VFC exactement comme un entraînement trop dur. La mesure est vraie ; l'interprétation « je suis surentraîné » ne l'est pas.",
          "Deuxième précaution : une valeur isolée ne vaut rien. La VFC varie beaucoup d'un jour à l'autre chez la même personne. Ce qui informe, c'est l'écart à TA base — la moyenne de tes derniers jours — et la direction de la tendance. Buchheit insiste sur ce point : les indicateurs dérivés de la fréquence cardiaque doivent être lus dans leur contexte, pas isolément.",
        ],
      },
      {
        h: "Pourquoi il faut croiser les deux",
        p: [
          "Prises séparément, les deux familles d'indicateurs se trompent de façon prévisible.",
          "La charge seule ne sait rien de ta vie. Elle voit que tu as couru trois fois cette semaine ; elle ignore que tu as dormi cinq heures par nuit. Elle continuera donc à prescrire comme si tout allait bien.",
          "La VFC seule ne sait rien de ton entraînement. Elle voit un indicateur bas ; elle ne peut pas distinguer une grosse semaine assumée — où une fraîcheur négative est normale et souhaitée — d'une dérive vers l'épuisement.",
          "Croisées, elles se corrigent. Une fraîcheur négative avec une VFC stable, c'est une charge acceptée : le plan continue. Une fraîcheur négative avec une VFC qui décroche plusieurs jours de suite, c'est un signal d'alerte : on allège. Une VFC basse alors que la charge est faible n'a probablement rien à voir avec la course.",
        ],
      },
      {
        h: "Ce que Pacevo en fait, concrètement",
        p: [
          "Ces indicateurs remontent de ta montre via intervals.icu — sommeil, VFC, fréquence cardiaque au repos, charge de chaque séance. Pacevo les relit après chaque synchronisation et réécrit le plan glissant des sept jours à venir quand ils changent.",
          "L'allègement ne consiste pas à supprimer la semaine. En pratique, il déplace la séance de qualité, raccourcit sa partie intense, ou remplace une sortie par un footing en endurance — le volume bouge peu, l'intensité bouge beaucoup.",
          "Et le calendrier écrit POURQUOI. C'est le point qui compte le plus à l'usage : un plan qu'on ne comprend pas, on le contourne. Un plan qui dit « ta variabilité est sous ta base depuis trois jours, la séance de seuil passe à samedi » se respecte.",
        ],
      },
      {
        h: "Ce que ça ne fait pas",
        p: [
          "Cela ne prédit pas une blessure. La progression de la charge est un facteur parmi d'autres — la biomécanique, le terrain, le matériel, l'historique de blessure et le sommeil comptent aussi, et rien de tout cela ne tient dans trois courbes.",
          "Cela ne remplace pas ton jugement. Une douleur qui s'installe, une gêne qui change ta foulée, une fatigue qui persiste malgré des indicateurs normaux : ce sont des motifs d'arrêt, quoi que dise un tableau de bord. Un modèle a toujours raison sur ce qu'il mesure et tort sur tout le reste.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome ? Front Physiol, 2014",
        url: "https://pubmed.ncbi.nlm.nih.gov/24578692/",
      },
      {
        label:
          "Gabbett TJ. The training-injury prevention paradox. Br J Sports Med, 2016",
        url: "https://pubmed.ncbi.nlm.nih.gov/26758673/",
      },
      {
        label:
          "Helgerud J et al. Aerobic high-intensity intervals improve VO2max more than moderate training. Med Sci Sports Exerc, 2007",
        url: "https://pubmed.ncbi.nlm.nih.gov/17414804/",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "ravitaillement-marathon-quoi-quand-combien",
    cle: "p7",
    maj: "21 août 2026",
    chapo:
      "Les recommandations de glucides pendant l'effort font l'objet d'un consensus assez stable dans la littérature. Voici ce qu'il dit, d'où viennent les chiffres, et pourquoi le point le plus important n'est pas la quantité mais l'entraînement de ton intestin.",
    avertissement:
      "Cet article résume des recommandations générales issues de publications scientifiques. Il ne remplace pas l'avis d'un médecin ou d'un diététicien, en particulier en cas de trouble digestif, de diabète, de grossesse ou de traitement en cours.",
    blocs: [
      {
        h: "Pourquoi le sujet existe",
        p: [
          "Le corps stocke une quantité limitée de glycogène — dans le foie et dans les muscles. Sur un effort d'endurance prolongé, cette réserve devient le facteur limitant bien avant les muscles eux-mêmes. C'est la cause physiologique de ce que les coureurs appellent le mur.",
          "Apporter des glucides pendant l'effort ne sert pas à « avoir de l'énergie » au sens vague : cela sert à épargner une réserve qu'on ne peut pas agrandir le jour J.",
        ],
      },
      {
        h: "Combien : ce que dit le consensus",
        p: [
          "La synthèse d'Asker Jeukendrup publiée dans Sports Med en 2014 propose une échelle selon la durée de l'effort plutôt qu'un chiffre unique. Autour de 30 à 60 grammes de glucides par heure pour un effort d'une à deux heures et demie ; jusqu'à environ 90 grammes par heure au-delà, mais à une condition précise, développée juste en dessous.",
          "La prise de position conjointe de l'American College of Sports Medicine sur la nutrition et la performance, publiée la même année, va dans le même sens et resitue ces apports dans l'alimentation générale de l'athlète.",
          "Ces fourchettes sont larges à dessein. Le poids, l'allure, la chaleur et la tolérance individuelle déplacent le curseur, et l'écart entre deux coureurs de même niveau est considérable.",
        ],
      },
      {
        h: "La condition que tout le monde oublie : deux sucres, pas un",
        p: [
          "Le glucose passe la paroi intestinale par un transporteur qui sature — c'est ce qui plafonne l'absorption autour de 60 grammes par heure. Le fructose emprunte un transporteur différent, qui ne sature pas en même temps.",
          "C'est pourquoi les apports élevés reposent sur un mélange de glucose et de fructose. Chercher 90 grammes par heure avec du glucose seul ne les fera pas passer : le surplus reste dans l'intestin, et c'est là que naissent les troubles digestifs qui ruinent une fin de course.",
          "Concrètement, cela veut dire lire l'étiquette. Un produit qui annonce un ratio de deux pour un entre glucose et fructose est conçu pour cela ; un autre non.",
        ],
      },
      {
        h: "Quand : la course commence avant le départ",
        p: [
          "Les jours qui précèdent, l'objectif est de partir avec des réserves pleines, ce qui passe par une alimentation riche en glucides et un volume d'entraînement réduit — l'affûtage joue ici autant que l'assiette.",
          "Le matin, un repas digeste pris quelques heures avant le départ, composé de ce que tu as déjà testé. Ce n'est pas le jour d'essayer un nouveau pain.",
          "Pendant, la règle la plus utile est de commencer tôt et de fractionner. Attendre d'avoir faim, c'est déjà trop tard : la vidange gastrique prend du temps, et le rattrapage en une prise massive est exactement ce que l'intestin refuse.",
        ],
      },
      {
        h: "Boire : à la soif, et penser au sodium",
        p: [
          "La recommandation d'inonder l'organisme a été abandonnée. Boire à la soif reste le repère le plus sûr pour la majorité des coureurs, et boire beaucoup trop d'eau pure sur un effort long expose à un vrai danger — l'hyponatrémie, une dilution du sodium sanguin.",
          "Par forte chaleur ou quand tu transpires abondamment, l'apport de sodium compte autant que le volume de boisson. La plupart des boissons de l'effort en contiennent ; l'eau plate n'en contient pas.",
        ],
      },
      {
        h: "Le point le plus important : entraîner son intestin",
        p: [
          "L'intestin s'adapte à ce qu'on lui demande régulièrement. Un coureur qui ne s'alimente jamais à l'entraînement et qui absorbe 90 grammes par heure le jour de la course expose son estomac à une charge inédite au pire moment.",
          "La conséquence pratique est simple, et c'est celle qu'on suit le moins : les sorties longues sont l'endroit où l'on teste le ravitaillement. Mêmes produits, mêmes quantités, mêmes intervalles que le jour J. Le plan de nutrition se répète à l'entraînement, exactement comme l'allure.",
        ],
      },
      {
        h: "Après",
        p: [
          "La reconstitution du glycogène est plus rapide dans les heures qui suivent l'effort, ce qui a de l'importance quand on enchaîne, beaucoup moins quand la course suivante est dans trois semaines.",
          "Pour une course objectif, le vrai sujet d'après n'est pas la fenêtre métabolique : c'est de laisser redescendre la charge avant de repartir.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Jeukendrup A. A step towards personalized sports nutrition: carbohydrate intake during exercise. Sports Med, 2014",
        url: "https://pubmed.ncbi.nlm.nih.gov/24791914/",
      },
      {
        label:
          "American College of Sports Medicine Joint Position Statement. Nutrition and Athletic Performance. Med Sci Sports Exerc, 2016",
        url: "https://pubmed.ncbi.nlm.nih.gov/26891166/",
      },
    ],
  },
  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "semi-en-moins-de-1h45-construire-le-plan",
    cle: "p3",
    maj: "21 août 2026",
    chapo:
      "1 h 45 sur un semi-marathon, c'est tenir 4 min 59 au kilomètre pendant 21,1 km. Voici d'où sort chaque séance d'une préparation qui vise ce chrono, et pourquoi l'essentiel du travail se fait à une allure bien plus lente.",
    blocs: [
      {
        h: "Ce que le chrono demande, en arithmétique",
        p: [
          "105 minutes pour 21,0975 km : cela fait 4 min 59 au kilomètre, soit un peu plus de 12 km/h. Ce n'est pas une opinion, c'est une division — et c'est le seul chiffre de cet article qui décrive une performance.",
          "La difficulté n'est pas d'atteindre cette allure : beaucoup de coureurs la tiennent sur 5 km. Elle est de la tenir une heure quarante-cinq, ce qui est un problème d'endurance bien plus que de vitesse.",
        ],
      },
      {
        h: "Pourquoi la majorité du volume se court lentement",
        p: [
          "C'est le point le plus contre-intuitif de la préparation, et celui qu'on saute le plus souvent. Stephen Seiler a décrit ce que font réellement les athlètes d'endurance de haut niveau : la très grande majorité de leur volume se situe à basse intensité, et une petite fraction seulement à intensité élevée. Ce qu'on appelle la distribution polarisée.",
          "L'intuition dit l'inverse : si je veux courir vite, je cours vite. Le problème est que l'intensité coûte de la récupération. Courir toutes ses sorties à allure moyennement dure produit un coureur moyennement fatigué en permanence, qui ne récupère jamais assez pour faire une vraie séance de qualité.",
          "En pratique, l'endurance fondamentale doit être franchement facile : une allure où l'on peut parler par phrases entières. Si tu dois t'interrompre pour respirer, tu es trop vite.",
        ],
      },
      {
        h: "La séance de seuil, le cœur du dispositif",
        p: [
          "Le seuil est l'allure que l'on peut tenir environ une heure en course. Pour un semi visé en 1 h 45, elle est logiquement un peu plus rapide que l'allure de course elle-même.",
          "On la travaille par blocs — des fractions longues, de plusieurs minutes, avec des récupérations courtes — plutôt qu'en continu, ce qui permet d'accumuler du temps à cette intensité sans que la séance devienne ingérable.",
          "Le travail à intensité plus élevée a lui aussi sa place. Les travaux de Jan Helgerud comparant des formats d'entraînement ont montré que les intervalles à haute intensité améliorent la consommation maximale d'oxygène davantage qu'un travail continu modéré. Mais c'est un condiment, pas le plat.",
        ],
      },
      {
        h: "La sortie longue",
        p: [
          "Elle construit ce que les séances rapides ne construisent pas : la capacité à tenir. Elle se court en endurance, et sa durée compte davantage que sa distance — c'est le temps passé debout qui produit l'adaptation.",
          "Une variante utile en fin de préparation consiste à en terminer une portion à l'allure visée. Cela apprend à trouver cette allure sur des jambes déjà fatiguées, ce qui est exactement la situation du 15ᵉ kilomètre.",
        ],
      },
      {
        h: "L'affûtage",
        p: [
          "Les dernières semaines réduisent le volume tout en gardant des touches d'intensité. L'objectif est d'arriver avec une fraîcheur positive : la charge récente redescend, la condition de fond reste.",
          "L'erreur classique est de vouloir rattraper. Une grosse séance à dix jours du départ ne rattrape rien — elle ne fait que dégrader la fraîcheur qu'on vient de construire.",
        ],
      },
      {
        h: "Ce qui fait bouger le plan en cours de route",
        p: [
          "Un plan écrit huit semaines à l'avance suppose que les huit semaines se dérouleront comme prévu. Elles ne le font jamais : une semaine de travail difficile, un rhume, une nuit blanche, une chaleur inattendue.",
          "C'est là que la relecture quotidienne des indicateurs prend son sens. Dans Pacevo, la séance de qualité se déplace ou s'allège quand la fraîcheur et la variabilité cardiaque le disent, et le calendrier explique la décision. Le volume de la semaine bouge peu ; sa répartition, beaucoup.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Seiler S. What is best practice for training intensity and duration distribution in endurance athletes ? Int J Sports Physiol Perform, 2010",
        url: "https://pubmed.ncbi.nlm.nih.gov/20861519/",
      },
      {
        label:
          "Helgerud J et al. Aerobic high-intensity intervals improve VO2max more than moderate training. Med Sci Sports Exerc, 2007",
        url: "https://pubmed.ncbi.nlm.nih.gov/17414804/",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "body-battery-basse-faut-il-courir",
    cle: "p4",
    maj: "21 août 2026",
    chapo:
      "Un indicateur au plus bas le matin n'est ni un feu vert ni un feu rouge : c'est une question. Voici les trois éléments qui permettent d'y répondre, et le seul cas où la réponse est non sans discussion.",
    avertissement:
      "Cet article parle d'entraînement, pas de médecine. Une fatigue qui persiste plusieurs semaines, une douleur, un essoufflement inhabituel ou une fréquence cardiaque au repos durablement élevée sont des motifs de consultation, quels que soient les chiffres affichés par une montre.",
    blocs: [
      {
        h: "Ce que l'indicateur mesure — et ce qu'il ne mesure pas",
        p: [
          "Body Battery est un indicateur propriétaire de Garmin. Ce n'est pas une mesure directe : c'est un composite, calculé à partir de la variabilité cardiaque, du niveau de stress estimé, de l'activité et du sommeil. D'autres marques proposent des équivalents sous d'autres noms, construits différemment.",
          "La conséquence est importante : un tel score ne mesure pas ta fatigue musculaire. Il reflète l'état de ton système nerveux autonome tel qu'un algorithme le déduit de capteurs au poignet. Tes jambes n'y sont pour rien.",
          "C'est pourquoi il peut être bas alors que tu te sens bien, et correct alors que tu as des courbatures. Les deux situations sont normales et aucune des deux n'est une erreur de la montre.",
        ],
      },
      {
        h: "Première question : est-ce un jour, ou une tendance ?",
        p: [
          "Une valeur isolée ne dit presque rien. Ces indicateurs varient beaucoup d'un jour à l'autre chez la même personne, et Martin Buchheit rappelle que les mesures dérivées de la fréquence cardiaque doivent se lire dans leur contexte et dans leur tendance, jamais isolément.",
          "Un matin bas après une soirée tardive ou une séance dure la veille est attendu — c'est même le signe que la mesure fonctionne. Trois ou quatre matins bas d'affilée alors que rien ne le justifie, c'est un autre message.",
        ],
      },
      {
        h: "Deuxième question : pourquoi est-il bas ?",
        p: [
          "L'algorithme ne connaît pas la cause. Un manque de sommeil, un début d'infection, l'alcool, une chambre trop chaude, un décalage horaire, une contrariété professionnelle : tout cela produit le même chiffre bas.",
          "Le sommeil mérite une place à part. La revue de Hugh Fullagar sur le sujet montre que la privation de sommeil affecte la performance à l'exercice et les fonctions cognitives — et courir fatigué dégrade aussi la vigilance, ce qui compte sur un chemin technique ou en ville.",
          "Si la cause est identifiable et ponctuelle, elle se traite : dormir. Si elle ne l'est pas, ou si elle ressemble à un début de maladie, la séance n'est pas la priorité.",
        ],
      },
      {
        h: "Troisième question : quelle séance était prévue ?",
        p: [
          "C'est la question qu'on oublie, et c'est la plus utile. « Faut-il courir ? » n'a pas de réponse générale ; « faut-il faire CETTE séance ? » en a une.",
          "Un footing facile de quarante minutes ne demande presque rien au système nerveux, et beaucoup de coureurs se sentent mieux après qu'avant. Une séance de seuil ou de VMA, elle, exige d'être en état d'encaisser — la faire sur un organisme déjà mobilisé produit une séance médiocre ET une récupération allongée.",
          "La bonne décision est donc rarement binaire. Elle consiste presque toujours à garder la sortie et à changer son intensité, ou à déplacer la qualité de deux jours.",
        ],
      },
      {
        h: "Le seul cas où c'est non",
        p: [
          "Fièvre, courbatures diffuses, gorge prise, ganglions : on ne court pas, quel que soit l'indicateur. Ce n'est pas une question de performance mais de risque — un effort intense pendant une infection n'a rien d'anodin.",
          "En dehors de cette situation, un indicateur bas est une invitation à alléger, pas un interdit. Et si le doute persiste plusieurs jours, c'est un médecin qui tranche, pas une montre.",
        ],
      },
      {
        h: "Ce que Pacevo en fait",
        p: [
          "Ces valeurs remontent via intervals.icu et entrent dans le calcul du plan glissant. Quand elles décrochent en tendance, la séance de qualité est allégée ou reportée, et le calendrier écrit pourquoi.",
          "Mais l'app n'a accès qu'à ce qui passe par un capteur. Elle ne sait pas que tu couves quelque chose, ni que la semaine a été rude au travail. Sur ce point, ton jugement passe avant le sien.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Fullagar HHK et al. Sleep and athletic performance: the effects of sleep loss on exercise performance. Sports Med, 2015",
        url: "https://pubmed.ncbi.nlm.nih.gov/25315456/",
      },
      {
        label:
          "Fullagar HHK et al. Time to wake up: individualising the approach to sleep promotion interventions. Br J Sports Med, 2016",
        url: "https://pubmed.ncbi.nlm.nih.gov/26701930/",
      },
      {
        label:
          "Buchheit M. Monitoring training status with HR measures. Front Physiol, 2014",
        url: "https://pubmed.ncbi.nlm.nih.gov/24578692/",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "choisir-son-premier-ultra-ce-qui-distingue-les-epreuves",
    cle: "p5",
    maj: "21 août 2026",
    chapo:
      "Le titre de cet article annonçait « les trails français à ne pas manquer en 2026 » : une liste datée qui serait fausse dans six mois. Voici plutôt les critères qui font qu'une épreuve te conviendra ou non — ils, eux, ne périment pas.",
    blocs: [
      {
        h: "La distance est le pire des critères",
        p: [
          "Deux courses de 80 km n'ont presque rien en commun si l'une présente 1 500 m de dénivelé positif et l'autre 5 000. Le dénivelé décide du temps passé debout, de la part de marche, de la sollicitation des descentes — et c'est la descente, pas la montée, qui détruit les cuisses.",
          "Un repère plus utile que la distance seule est le rapport entre dénivelé et kilomètres. Au-delà d'une certaine pente moyenne, on ne court plus vraiment : on randonne vite en montée et on encaisse en descente. Ce n'est ni mieux ni moins bien, mais cela demande une préparation différente.",
          "Deuxième repère : le temps limite prévu par l'organisation. C'est lui qui dit à quelle population l'épreuve s'adresse, bien mieux que le nombre de kilomètres.",
        ],
      },
      {
        h: "Les barrières horaires, la contrainte qu'on découvre trop tard",
        p: [
          "La plupart des ultras imposent des heures de passage à des points intermédiaires. Être arrêté à un ravitaillement parce qu'on a dix minutes de retard est l'échec le plus fréquent — et le plus évitable.",
          "Elles se lisent avant l'inscription, pas la veille. Compare-les à ton allure réelle en montagne, pas à ton allure sur route : l'écart entre les deux est considérable, et c'est là que les projections optimistes se fracassent.",
        ],
      },
      {
        h: "La nuit change tout",
        p: [
          "Dès qu'une épreuve déborde sur la nuit, elle devient un exercice différent : vigilance dégradée, terrain moins lisible, froid, et une gestion du sommeil qui n'existe pas sur un format court.",
          "Un premier ultra qui se termine avant la nuit est une progression plus raisonnable qu'un format nocturne, même à distance égale. Si la nuit est inévitable, elle se répète à l'entraînement — une sortie longue à la frontale, au moins.",
        ],
      },
      {
        h: "Autonomie et ravitaillements",
        p: [
          "Certaines épreuves ravitaillent souvent et copieusement ; d'autres imposent une autonomie longue entre deux points, parfois en eau. Le matériel obligatoire en découle, et il pèse.",
          "Cette information figure au règlement. La lire, c'est aussi anticiper ce que tu devras transporter — et donc ce que tu dois avoir testé en sortie longue.",
        ],
      },
      {
        h: "Les systèmes de qualification",
        p: [
          "Plusieurs grandes épreuves n'acceptent pas une inscription directe. Le circuit UTMB, par exemple, utilise un indice de performance calculé sur les résultats des coureurs, et des pierres de qualification à obtenir sur des courses labellisées pour entrer au tirage au sort de certaines épreuves.",
          "Ce sont des dispositifs officiels, dont les modalités évoluent d'une année à l'autre. La seule source qui fasse foi est le site de l'organisateur : la consulter avant de bâtir un calendrier de saison évite de découvrir en janvier qu'il fallait s'y prendre l'année précédente.",
        ],
      },
      {
        h: "Comment s'en servir concrètement",
        p: [
          "Le calendrier de Pacevo recense les épreuves à venir avec leur distance, leur date et le lien vers l'inscription. Choisir une course comme objectif y cale la préparation sur sa date.",
          "Mais l'app ne lit pas les règlements à ta place. Le dénivelé, les barrières horaires, l'autonomie et les qualifications se vérifient sur le site de l'organisateur — c'est lui qui engage, pas nous.",
        ],
      },
    ],
    sources: [
      { label: "UTMB — l'indice UTMB (site officiel)", url: "https://utmb.world/utmb-index" },
      { label: "UTMB Mont-Blanc — règlements et modalités d'inscription (site officiel)", url: "https://montblanc.utmb.world/" },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "coach-vocal-en-course-ce-que-ca-change",
    cle: "p6",
    maj: "21 août 2026",
    chapo:
      "Le vrai problème d'une course n'est pas la vitesse : c'est la gestion de l'allure. Ce que change une voix dans l'oreille, ce qu'elle ne peut pas savoir, et pourquoi elle sert surtout quand on est fatigué.",
    blocs: [
      {
        h: "Le problème que ça adresse",
        p: [
          "Chester Abbiss et Paul Laursen ont décrit les stratégies d'allure adoptées en compétition et la façon dont elles pèsent sur le résultat. La conclusion générale de cette littérature est constante : la répartition de l'effort compte, et partir trop vite est l'erreur la plus coûteuse.",
          "Le problème est qu'un coureur perçoit mal son allure, et de plus en plus mal à mesure qu'il fatigue. La sensation d'effort augmente pendant que la vitesse baisse — donc au moment précis où l'on ralentit, on a l'impression d'accélérer.",
        ],
      },
      {
        h: "Ce qu'un écran ne règle pas",
        p: [
          "Une montre affiche déjà l'allure. Mais la lire demande de baisser les yeux, de faire la mise au point, et surtout de comparer mentalement ce chiffre à un objectif qu'on garde en tête — trois opérations qui deviennent coûteuses au 30ᵉ kilomètre.",
          "Il y a pire : l'allure instantanée oscille beaucoup, surtout en ville ou sous couvert d'arbres où le signal satellite se dégrade. Un coureur qui corrige à chaque oscillation produit une course en accordéon, plus fatigante qu'une allure régulière.",
        ],
      },
      {
        h: "Ce qu'annonce le Ghost Runner",
        p: [
          "À chaque kilomètre, une voix annonce trois choses : l'allure tenue, l'écart au plan et le chrono projeté à l'arrivée si tu continues ainsi.",
          "Le troisième élément est celui qui change le comportement. « 5 min 12 » est une information ; « à ce rythme tu finis quatre minutes au-dessus de ton objectif » est une décision. La conversion mentale est faite pour toi, au moment où tu es le moins capable de la faire.",
          "Et parce que c'est audio, cela ne demande ni de regarder ailleurs ni de casser sa foulée.",
        ],
      },
      {
        h: "Ses limites, et elles sont réelles",
        p: [
          "Il ne connaît pas le terrain. Une portion en côte ralentit légitimement l'allure ; l'annonce d'un écart n'y est pas un signal d'accélérer, sauf à griller ses jambes dans une bosse.",
          "Il ne connaît pas non plus tes jambes. Il compare une vitesse à un objectif ; il ne sait pas si ta cuisse tire depuis dix minutes. L'objectif que tu as fixé au départ peut devenir le mauvais objectif au milieu de la course, et c'est à toi de le décider.",
          "Enfin, courir avec un écouteur suppose d'entendre ce qui t'entoure. Sur route ouverte, une seule oreille — et sur certaines épreuves, les écouteurs sont interdits par le règlement.",
        ],
      },
      {
        h: "Quand ça sert le plus",
        p: [
          "Sur les efforts longs à allure cible, où la dérive est lente et donc invisible de l'intérieur. Sur une première tentative à un chrono donné, quand on n'a pas encore la sensation calibrée. Et à l'entraînement, pour apprendre à quoi ressemble vraiment l'allure visée.",
          "Sur un fractionné court, en revanche, il n'apporte rien : les efforts sont trop brefs pour qu'une annonce au kilomètre ait le temps d'exister.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Abbiss CR, Laursen PB. Describing and understanding pacing strategies during athletic competition. Sports Med, 2008",
        url: "https://pubmed.ncbi.nlm.nih.gov/18278984/",
      },
      {
        label: "The Manipulation of Pace within Endurance Sport. Front Physiol, 2017",
        url: "https://pubmed.ncbi.nlm.nih.gov/28289392/",
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  {
    slug: "chaussure-de-trail-ce-qui-compte-avant-la-marque",
    cle: "p8",
    maj: "21 août 2026",
    chapo:
      "Le titre de cet article annonçait un « comparatif selon ta foulée » : il aurait fallu noter des modèles précis, sur des critères que nous ne mesurons pas, et le classement serait périmé à la sortie de la collection suivante. Voici plutôt les quatre paramètres qui décident vraiment, et ce que la littérature en dit.",
    blocs: [
      {
        h: "La masse, le seul paramètre au lien clairement établi",
        p: [
          "C'est le point sur lequel les données sont les plus nettes. Les travaux de Wouter Hoogkamer et de son équipe ont montré qu'une modification de l'économie de course se traduit directement en performance sur distance — et la masse aux pieds est l'un des leviers les plus simples de cette économie.",
          "En pratique : une chaussure plus lourde protège davantage mais coûte à chaque foulée, et le coût se paie d'autant plus longtemps que la course est longue. C'est un arbitrage, pas une règle — sur un terrain cassant, la protection peut valoir son poids.",
        ],
      },
      {
        h: "Le drop : beaucoup de discours, peu de preuves",
        p: [
          "Le drop est la différence de hauteur entre talon et avant-pied. C'est l'argument marketing le plus répandu, et l'un des plus faibles.",
          "L'essai de Laurent Malisoux publié dans l'American Journal of Sports Medicine a comparé des chaussures de drops différents chez des coureurs de loisir : il n'a pas mis en évidence d'effet du drop sur le risque de blessure dans l'ensemble du groupe. Autrement dit, il n'existe pas de drop « correct » applicable à tout le monde.",
          "La conséquence pratique est libératrice : choisis le drop auquel tu es habitué, et si tu veux en changer, fais-le progressivement — c'est la transition brutale qui pose problème, pas la valeur elle-même.",
        ],
      },
      {
        h: "Les crampons : c'est le terrain qui décide",
        p: [
          "Des crampons profonds et espacés mordent la boue et évacuent la terre ; ils sont inconfortables et s'usent vite sur du sec et du caillou. Des crampons bas accrochent la roche et roulent bien sur les portions courantes ; ils patinent dès que ça glisse.",
          "Il n'existe donc pas de meilleure semelle, seulement une meilleure semelle pour TON terrain habituel. Un coureur de forêt argileuse et un coureur de calcaire sec n'ont pas le même besoin, et aucun test générique ne le dira à leur place.",
        ],
      },
      {
        h: "L'amorti et la protection : une question de durée",
        p: [
          "Plus l'effort est long, plus les impacts s'accumulent et plus l'amorti compte. Sur un format court et rapide, une chaussure basse et précise donne un meilleur retour de terrain.",
          "La plaque de protection, elle, ne se juge pas au confort mais aux cailloux : sur un terrain pierreux, son absence se paie en fin de course, quand la plante du pied ne pardonne plus.",
        ],
      },
      {
        h: "Ce qui compte plus que tout le reste : le chaussant",
        p: [
          "La meilleure chaussure sur le papier est inutile si elle ne va pas à ton pied. La largeur d'avant-pied, le maintien du talon et le volume varient énormément d'une marque à l'autre — davantage, souvent, que les paramètres techniques dont on parle.",
          "Le pied gonfle sur un effort long : essayer en fin de journée, avec les chaussettes de course, et prévoir de la marge devant. Une chaussure parfaitement ajustée en magasin est une chaussure trop petite au 40ᵉ kilomètre.",
        ],
      },
      {
        h: "La conclusion honnête",
        p: [
          "Aucun classement ne peut te dire quel modèle prendre, parce que les deux paramètres décisifs — ton terrain et ton pied — ne figurent dans aucun test.",
          "Ce que l'on peut faire, en revanche, c'est suivre l'usure. Pacevo enregistre le kilométrage par paire : c'est un fait mesuré, pas un avis, et il vaut mieux qu'une intuition pour décider quand une paire est en fin de vie.",
        ],
      },
    ],
    sources: [
      {
        label:
          "Hoogkamer W et al. Altered Running Economy Directly Translates to Altered Distance-Running Performance. Med Sci Sports Exerc, 2016",
        url: "https://pubmed.ncbi.nlm.nih.gov/27327023/",
      },
      {
        label:
          "Malisoux L et al. Influence of the Heel-to-Toe Drop of Standard Cushioned Running Shoes on Injury Risk. Am J Sports Med, 2016",
        url: "https://pubmed.ncbi.nlm.nih.gov/27501833/",
      },
    ],
  },

];

/** Clé d'article → slug, pour que l'index sache quelles cartes sont cliquables. */
export const SLUG_PAR_CLE: Record<string, string> = Object.fromEntries(
  ARTICLES.map((a) => [a.cle, a.slug]),
);

export const articleParSlug = (slug: string) =>
  ARTICLES.find((a) => a.slug === slug);
