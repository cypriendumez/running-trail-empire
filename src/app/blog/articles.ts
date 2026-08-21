/**
 * LE CORPS DES ARTICLES DU BLOG.
 *
 * Le blog affichait huit cartes avec un temps de lecture, une date et un auteur, alors
 * qu'AUCUN article n'existait et que tous les liens menaient à /signup. La page a été
 * rendue honnête le 21/08/2026 (badge « Sujet à venir ») ; ce fichier est la suite :
 * les articles s'écrivent pour de bon, trois d'abord, et une carte ne devient cliquable
 * que le jour où son texte existe ici. Les cinq autres gardent leur badge, ce qui est vrai.
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
 * 2. LES CINQ RÉFÉRENCES ONT ÉTÉ VÉRIFIÉES UNE PAR UNE via l'API NCBI (esummary) :
 *    identifiant, année, revue et titre confirmés avant d'être écrits. Un lien qui
 *    « a l'air » d'exister n'est pas une source. Si tu en ajoutes une, fais de même :
 *      curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=<PMID>"
 *
 * ── LANGUE ───────────────────────────────────────────────────────────────────
 * Ces textes sont en FRANÇAIS UNIQUEMENT, à dessein. Le reste de l'app vit en cinq
 * langues, et les titres, extraits et catégories du blog le sont aussi. Traduire à la
 * chaîne trois articles de fond sur l'entraînement et la nutrition sans relecture par
 * un locuteur produirait exactement le genre de texte approximatif que ce projet
 * s'emploie à retirer. La page d'article le DIT au lecteur non francophone plutôt que
 * de le laisser buter sur du français sans prévenir.
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
];

/** Clé d'article → slug, pour que l'index sache quelles cartes sont cliquables. */
export const SLUG_PAR_CLE: Record<string, string> = Object.fromEntries(
  ARTICLES.map((a) => [a.cle, a.slug]),
);

export const articleParSlug = (slug: string) =>
  ARTICLES.find((a) => a.slug === slug);
