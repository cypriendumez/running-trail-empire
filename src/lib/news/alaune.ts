/**
 * « À LA UNE » : LES SUJETS DONT TOUT LE MONDE A PARLÉ CETTE SEMAINE.
 *
 * ⚠️ POURQUOI CE MODULE (09/11/2026, Cyprien : « pourquoi dans la newsletter il n'y a pas
 * la backyard de Clem qui court alors que c'était l'événement français du weekend »).
 * La une prenait les CINQ ARTICLES LES PLUS RÉCENTS au moment de l'envoi. Lundi 9/11,
 * c'étaient quatre articles américains publiés dans la demi-heure (Wiz Khalifa, un fait
 * divers à Brooklyn, un guide de chaussures), pendant que la backyard occupait L'Équipe,
 * Le Monde, Ouest-France, 20 Minutes et u-Trail depuis cinq jours. Rien ne mesurait
 * l'importance d'un sujet : seulement l'heure de publication.
 *
 * Le signal retenu est le plus simple qui soit vérifiable : COMBIEN DE MÉDIAS DIFFÉRENTS
 * ont écrit sur le même sujet pendant la semaine. Un média qui publie dix fois sur
 * un même sujet compte une fois (Marathon Handbook a sorti sept articles sur New York le
 * même dimanche : c'est un éditeur, pas un événement).
 *
 * Le « sujet » est un mot rare partagé par les titres (« backyard », « bordeaux »,
 * « detienne ») : pas d'IA ici, le classement doit pouvoir s'expliquer.
 */

export type ArticleSemaine = {
  title: string; source: string; link: string; date: string;
  texte?: string; langue?: "fr" | "en";
};

export type Sujet<T extends ArticleSemaine = ArticleSemaine> = {
  /** L'article qui représente le sujet dans la lettre. */
  article: T;
  /** Le mot qui réunit les titres du sujet. */
  mot: string;
  /** Nombre de MÉDIAS distincts qui en ont parlé (0 pour un article de remplissage). */
  medias: number;
  /**
   * TOUS les articles de la semaine rattachés au sujet, l'article retenu compris.
   * Sert à deux choses : ne pas ramener le sujet dans une autre rubrique (Le Parisien
   * titrait la backyard « les 25 heures de Clem qui court », sans le mot « backyard »,
   * et revenait en « Élites ») et résumer le sujet à partir de ce qu'en titrent les médias.
   */
  membres: T[];
};

/**
 * Les mots qui ne désignent aucun sujet : mots outils (français et anglais), vocabulaire
 * de toute la presse running (« marathon », « course », « résultats »), jours, mois.
 * ⚠️ « marathon » en fait partie : il est dans un titre sur trois, il réunirait Bordeaux,
 * New York et La Baule en un seul « sujet ». C'est la ville qui distingue l'événement.
 */
const VIDES = new Set(`
le la les un une des du de d l au aux et ou en a à dans sur sous par pour avec sans ce cet cette ces
son sa ses leur leurs mon ma mes ton ta tes notre nos votre vos qui que quoi dont où ne pas plus moins
est sont été être fait faire font va vont a ont avoir y il elle ils elles on nous vous je tu se s n c qu
tout tous toute toutes comme mais donc car si aussi très bien encore deja déjà apres après avant entre
chez vers pres près bat battu bats depuis pendant contre lors quand comment pourquoi quel quelle quels quelles voici voila voilà
the a an of to in on at for with by from and or but is are was were be been it its this that these those
how why what who when where your you our we they their his her he she my me not no as into after before
than then just about over up out new best more most can will has have had do does did vs
course courses courir court courent coureur coureurs coureuse coureuses pied running run runner runners
runs ran trail trails traileur traileuse ultra marathon marathons semi km kilometres kilomètres heure heures
resultat resultats résultat résultats classement direct live suivre suivez edition édition annee année
annees années race races racing jour jours semaine week weekend end victoire vainqueur gagne remporte
sport sports sportif sportive athletisme athlétisme athlete athletes athlète athlètes record records
video vidéo photos photo images infos info guide test tests review chaussure chaussures shoes shoe
premier premiere première premiers grand grande grands petit petite nouveau nouvelle nouvelles
euro euros don dons projet projets epreuve epreuves championnat championnats
ans an deux trois quatre cinq six sept huit neuf dix cent cents mille millier milliers participants inscrits
parcours foulee foulees foulée foulées nocturne nocturnes depart départ arrivee arrivée dossard dossards
inscription inscriptions organisateur organisateurs benevole benevoles bénévole bénévoles cross corrida
saint sainte saints ville villes france francais français francaise française french dernier derniere dernière
lundi mardi mercredi jeudi vendredi samedi dimanche monday tuesday wednesday thursday friday saturday sunday
janvier fevrier février mars avril mai juin juillet aout août septembre octobre novembre decembre décembre
january february march april may june july august september october november december
`.split(/\s+/).filter(Boolean).map((m) => normaliser(m)));

function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Les mots porteurs d'un titre, sans doublon. Les nombres ne désignent pas un sujet. */
export function motsDuTitre(titre: string): string[] {
  const mots = normaliser(titre).split(/[^a-z0-9]+/).filter((m) => m.length >= 3 && !/^\d+$/.test(m) && !VIDES.has(m));
  return [...new Set(mots)];
}

/** Les titres politiques (voir le choix de l'article d'un sujet). */
export const POLITIQUE = /candidat|[ée]lection|pr[ée]sidentielle|ministre|d[ée]put[ée]|s[ée]nateur|\bparti\b|gouvernement|politique/i;

/** Un sujet n'en est un qu'à partir de deux médias : un seul, c'est un article. */
export const MEDIAS_MIN = 2;
/**
 * Un mot repris par plus de cette part des MÉDIAS de la semaine n'est plus un sujet,
 * c'est le thème du fil (un mot que la liste `VIDES` n'aurait pas prévu).
 *
 * ⚠️ La part se compte en médias, PAS en articles. Mesuré sur la semaine du 9/11 :
 * « backyard » = 51 articles sur 585 (9 %), mais 26 médias sur 136 (19 %). Un plafond
 * en articles placé à 12 % passait de justesse ; une semaine où l'événement est encore
 * plus gros, il aurait écarté L'ÉVÉNEMENT LUI-MÊME comme « trop commun ». Le test de ce
 * module l'a montré sur une semaine réduite. Aucun sujet réel n'approche 40 % des médias.
 */
const PART_MEDIAS_MAX = 0.4;

/**
 * Hors sujet : la requête « trail » remonte les Trail Blazers de Portland (NBA), cinq
 * médias la semaine du 9/11 — assez pour faire un « sujet » une semaine calme.
 */
const HORS_SUJET = /\bnba\b|blazers/i;

const temps = (a: ArticleSemaine) => new Date(a.date).getTime() || 0;

/**
 * Choisit les `max` articles de la une : d'abord les sujets couverts par le plus de
 * médias, un article par sujet ; s'il en manque, les plus récents complètent.
 *
 * L'article choisi pour un sujet est l'un des plus CENTRAUX (ceux dont les autres mots sont
 * aussi repris par les autres médias du sujet) : la « Breizh Backyard Odyssée » partage
 * le mot « backyard » avec la backyard de Clem qui court, mais rien d'autre. Parmi ces
 * articles centraux, on préfère celui dont le flux fournit le texte (il pourra être
 * résumé), puis le plus récent (le bilan plutôt que l'annonce).
 */
export function classerALaUne<T extends ArticleSemaine>(articles: T[], max: number): Sujet<T>[] {
  const tous = articles.filter((a) => a.title && a.link && !HORS_SUJET.test(a.title));
  const mots = new Map<T, string[]>(tous.map((a) => [a, motsDuTitre(a.title)]));

  // Fréquence en articles (départage les égalités : le mot le plus rare est le plus
  // précis) et en médias (écarte les mots du thème, voir PART_MEDIAS_MAX).
  const freq = new Map<string, number>();
  const mediasDuMot = new Map<string, Set<string>>();
  for (const a of tous) for (const m of mots.get(a)!) {
    freq.set(m, (freq.get(m) ?? 0) + 1);
    if (!mediasDuMot.has(m)) mediasDuMot.set(m, new Set());
    mediasDuMot.get(m)!.add(normaliser(a.source));
  }
  const nbMedias = new Set(tous.map((a) => normaliser(a.source))).size;
  const plafond = Math.max(MEDIAS_MIN, Math.floor(nbMedias * PART_MEDIAS_MAX));

  const restants = new Set(tous);
  const choisis: Sujet<T>[] = [];

  while (choisis.length < max) {
    // Médias distincts par mot, sur les articles qui n'appartiennent encore à aucun sujet.
    const medias = new Map<string, Set<string>>();
    for (const a of restants) {
      for (const m of mots.get(a)!) {
        if (mediasDuMot.get(m)!.size > plafond) continue;
        if (!medias.has(m)) medias.set(m, new Set());
        medias.get(m)!.add(normaliser(a.source));
      }
    }
    let meilleur: { mot: string; n: number } | null = null;
    for (const [mot, s] of medias) {
      if (s.size < MEDIAS_MIN) continue;
      // À égalité de médias, le mot le plus rare est le plus précis.
      if (!meilleur || s.size > meilleur.n || (s.size === meilleur.n && (freq.get(mot)! < freq.get(meilleur.mot)! || (freq.get(mot) === freq.get(meilleur.mot) && mot < meilleur.mot)))) {
        meilleur = { mot, n: s.size };
      }
    }
    if (!meilleur) break;

    const groupe = [...restants].filter((a) => mots.get(a)!.includes(meilleur!.mot));
    // Centralité : pour chaque autre mot de l'article, combien de médias du groupe le reprennent.
    const mediasDuGroupe = new Map<string, Set<string>>();
    for (const a of groupe) for (const m of mots.get(a)!) {
      if (!mediasDuGroupe.has(m)) mediasDuGroupe.set(m, new Set());
      mediasDuGroupe.get(m)!.add(normaliser(a.source));
    }
    const centralite = (a: T) => mots.get(a)!.reduce((s, m) => s + (m === meilleur!.mot ? 0 : mediasDuGroupe.get(m)!.size - 1), 0);
    const aTexte = (a: T) => ((a.texte ?? "").trim().length >= 320 ? 1 : 0);
    // Un titre POLITIQUE ne représente pas un sujet de course quand le sujet en offre un
    // autre : le 9/11/2026, Nice-Cannes (17 médias) était présenté par « David Lisnard et
    // Christian Estrosi courent […], le candidat à l'élection présidentielle boucle… ».
    const politique = (a: T) => (POLITIQUE.test(a.title) ? 1 : 0);
    // Un lien direct pourra être ouvert et résumé ; un lien Google News, jamais.
    const direct = (a: T) => (/^https?:\/\/news\.google\.com\//.test(a.link) ? 0 : 1);
    // Les articles au cœur du sujet (au moins la moitié de la meilleure centralité) ; parmi
    // eux, le plus récent. Sans ce seuil, le titre le plus long gagnait toujours : celui
    // qui énumère six coureurs AVANT le départ, pas celui qui donne le résultat.
    const cMax = Math.max(...groupe.map(centralite));
    const coeur = groupe.filter((a) => centralite(a) * 2 >= cMax);
    coeur.sort((x, y) => politique(x) - politique(y) || aTexte(y) - aTexte(x) || direct(y) - direct(x) || temps(y) - temps(x));

    const sujet: Sujet<T> = { article: coeur[0], mot: meilleur.mot, medias: meilleur.n, membres: [...groupe] };
    choisis.push(sujet);
    // Tout le groupe sort du jeu : un même sujet ne prend pas deux places à la une.
    for (const a of groupe) restants.delete(a);
    // ⚠️ Y COMPRIS les articles du sujet qui n'emploient pas son mot. L'Équipe a titré
    // « Théo Detienne vainqueur, Stéphanie Gicquel et Blandine L'Hirondel finishers… »
    // sans écrire « backyard » : sans ce rattrapage, la backyard revenait une seconde
    // fois dans la une. Un article qui partage DEUX mots repris par plusieurs médias
    // du sujet (« detienne », « gicquel ») en fait partie.
    const motsDuSujet = new Set([...mediasDuGroupe].filter(([m, s]) => m !== meilleur!.mot && s.size >= MEDIAS_MIN).map(([m]) => m));
    for (const a of [...restants]) {
      if (mots.get(a)!.filter((m) => motsDuSujet.has(m)).length >= 2) { restants.delete(a); sujet.membres.push(a); }
    }
  }

  // Semaine calme : on complète avec les plus récents, comme avant.
  if (choisis.length < max) {
    const pris = new Set(choisis.map((c) => c.article.link));
    const recents = [...restants].filter((a) => !pris.has(a.link)).sort((x, y) => temps(y) - temps(x));
    for (const a of recents.slice(0, max - choisis.length)) choisis.push({ article: a, mot: "", medias: 0, membres: [a] });
  }
  return choisis;
}

/**
 * LE TEXTE À RÉSUMER POUR UN SUJET DE LA UNE : ce qu'en ont titré les médias.
 *
 * ⚠️ Les articles de la une viennent surtout de Google Actualités, qui ne fournit pas le
 * texte, et le lien qu'il donne est une redirection : la lettre partait en titres seuls.
 * Les TITRES des médias qui ont couvert le sujet, eux, sont dans le flux. Ils disent les
 * faits saillants (vainqueur, montant récolté, abandons) et le garde-fou des chiffres
 * s'applique contre eux comme contre un article : un nombre absent des titres est refusé.
 * La lettre cite le nombre de médias à côté de la source, pour que le lecteur sache que
 * le résumé ne vient pas d'un seul article.
 *
 * Rend une chaîne vide quand le sujet n'a qu'un article (rien de plus que son titre).
 */
export function texteDuSujet(sujet: Sujet, max = 2600): string {
  if (sujet.medias < MEDIAS_MIN) return "";
  const vus = new Set<string>();
  const lignes: string[] = [];
  const parDate = [...sujet.membres].sort((x, y) => temps(y) - temps(x));
  for (const a of parDate) {
    const cle = normaliser(a.title).replace(/[^a-z0-9]+/g, " ").trim();
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    lignes.push(`- ${a.title} (${a.source})`);
  }
  // ⚠️ L'en-tête dit au modèle que ce ne sont QUE des titres. Sans lui, le 9/11/2026, il
  // a complété la backyard d'un « pic à 200 000 spectateurs » qu'aucun titre ne donnait :
  // le contrôle des chiffres l'a rejeté, et le sujet n° 1 est parti sans résumé.
  let texte = `Ce texte n'est pas un article : ce sont les titres publiés cette semaine par ${sujet.medias} médias sur un même sujet. Résume ce qu'ils disent ensemble, sans rien ajouter qu'ils ne disent (aucun chiffre d'audience, de participants ou de dons qui n'y figure pas).`;
  for (const l of lignes) {
    if (texte.length + l.length + 1 > max) break;
    texte += `\n${l}`;
  }
  return texte;
}
