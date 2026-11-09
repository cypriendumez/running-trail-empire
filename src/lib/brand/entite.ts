import { PROFILS_OFFICIELS } from "@/lib/brand/reseaux";
import { EDITEUR } from "@/lib/brand/editeur";
import { jourCivil, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

/**
 * L'ENTITÉ « PACEVO » TELLE QUE LES MOTEURS DOIVENT LA LIRE — une seule copie.
 *
 * ⚠️ CONSTAT DU 08/11/2026 : Google CORRIGE « pacevo » EN « pancevo ». La requête affiche
 * « Résultats pour pancevo — Essayez avec l'orthographe pacevo » et la première page entière
 * parle de la ville serbe ; pacevo.fr n'y figure pas. Un nom de marque jeune, à une lettre
 * d'un nom connu, est pris pour une faute de frappe tant que le moteur ne sait pas qu'il
 * désigne autre chose. Ce qui le lui apprend, côté site : un titre et des données
 * structurées qui nomment la marque et disent ce qu'elle est, et des profils officiels
 * (`sameAs`) qui renvoient vers le même domaine.
 *
 * Ce que le site affirmait jusque-là : un `<title>` réduit à « Pacevo », AUCUNE donnée
 * structurée sur l'accueil, et une image de partage servie depuis pacevo.app (faute de
 * `metadataBase`) — trois signaux de moins pour une marque que le moteur ne connaît pas.
 *
 * Rien ici n'est inventé : pas de note, pas d'avis, pas de date de création, pas de
 * nombre d'utilisateurs. Les profils viennent de `lib/brand/reseaux` (pied de page) et
 * l'adresse de contact de `lib/brand/editeur` : un profil retiré là disparaît d'ici.
 */

const BRUT = process.env.NEXT_PUBLIC_APP_URL;

/**
 * Domaine public servi. Même garde que `robots.ts` et `sitemap.ts` : jamais une adresse
 * locale, et un repli sur le domaine réellement servi (pacevo.fr depuis le 13/09/2026,
 * vers lequel pacevo.app, www. et l'adresse Vercel redirigent en 308).
 */
export const SITE_URL = (BRUT && BRUT.startsWith("http") && !BRUT.includes("localhost")
  ? BRUT
  : "https://pacevo.fr"
).replace(/\/+$/, "");

/** Le nom, tel qu'il s'écrit partout. */
export const NOM_MARQUE = "Pacevo";

/**
 * Ce que les gens tapent pour trouver la marque. « Pacevo Running » est la seconde requête
 * visée (Cyprien, 08/11/2026) ; ce n'est pas un nom inventé, c'est ainsi qu'on désigne
 * l'application en parlant d'elle.
 */
export const NOMS_ALTERNATIFS = ["Pacevo Running", "pacevo.fr"];

/** Une phrase, sans superlatif : ce que fait le produit. */
export const DESCRIPTION_MARQUE =
  "Pacevo est un coach de course à pied et de trail : il lit les données de ta montre (VFC, sommeil, charge, allures) et recalcule ta séance du jour à chaque synchronisation.";

/** Titre de l'accueil dans les résultats : la marque d'abord, puis ce qu'elle est. */
export const TITRE_ACCUEIL = "Pacevo — Coach running et trail adapté à ta montre";

/**
 * Données structurées de l'accueil : l'organisation et le site, reliés par leurs `@id`.
 * `WebSite.name` est ce que Google affiche comme nom du site au-dessus du résultat.
 */
export function donneesStructureesMarque() {
  const organisation = `${SITE_URL}/#organisation`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organisation,
        name: NOM_MARQUE,
        alternateName: NOMS_ALTERNATIFS,
        url: `${SITE_URL}/`,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/pacevo-logo.png`,
          width: 512,
          height: 512,
        },
        description: DESCRIPTION_MARQUE,
        email: EDITEUR.email,
        sameAs: PROFILS_OFFICIELS,
        knowsAbout: ["course à pied", "trail", "plan d'entraînement", "montre GPS", "variabilité de la fréquence cardiaque"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#site`,
        name: NOM_MARQUE,
        alternateName: NOMS_ALTERNATIFS,
        url: `${SITE_URL}/`,
        inLanguage: "fr-FR",
        publisher: { "@id": organisation },
      },
    ],
  };
}

/**
 * Du JSON prêt à poser dans un `<script type="application/ld+json">`. `<` est échappé :
 * une chaîne contenant `</script>` fermerait la balise et injecterait du HTML. Le JSON
 * relu reste identique (`\u003c` est un `<` pour tout lecteur JSON).
 */
export function serialiserJsonLd(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}

export function jsonLdMarque(): string {
  return serialiserJsonLd(donneesStructureesMarque());
}

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * « 21 août 2026 » → « 2026-08-21 ». Une date illisible rend `null` : on n'en fabrique
 * pas une (un moteur afficherait la date inventée comme celle de l'article).
 */
export function dateIsoFr(texte: string): string | null {
  const m = texte.trim().toLowerCase().match(/^(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})$/);
  if (!m) return null;
  const mois = MOIS_FR.indexOf(m[2]);
  const jour = Number(m[1]);
  const annee = Number(m[3]);
  // Nombre de jours du mois : le « jour 0 » du mois suivant est le dernier de celui-ci.
  // Pur calcul de calendrier, aucun fuseau en jeu. (Pas de `Date.UTC` : ce module part
  // dans le navigateur, et `tests/bundle.test.ts` y lit toute `.MAJUSCULES` comme une
  // variable d'environnement.)
  const joursDuMois = mois < 0 ? 0 : new Date(annee, mois + 1, 0).getDate();
  if (jour < 1 || jour > joursDuMois) return null; // « 31 juin » n'existe pas
  return `${annee}-${String(mois + 1).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

/**
 * « 2026-08-21 » → « 2026-08-21T00:00:00+02:00 » : le début du jour À PARIS, avec son
 * décalage réel (+01:00 l'hiver, +02:00 l'été). Le test des résultats enrichis signalait
 * une date sans heure ni fuseau (08/11/2026). Minuit n'est pas une heure inventée : c'est
 * la façon d'écrire « ce jour-là » dans un format qui exige une heure.
 *
 * Le bon décalage est celui pour lequel minuit local tombe bien CE jour-là à Paris ; +02:00
 * est essayé d'abord (l'été, +01:00 donnerait 01:00 du même jour, donc passerait aussi).
 * Jours de changement d'heure compris : minuit est encore à l'heure d'avant.
 */
export function debutDuJourParis(iso: string): string | null {
  for (const decalage of ["+02:00", "+01:00"]) {
    const instant = `${iso}T00:00:00${decalage}`;
    if (Number.isNaN(new Date(instant).getTime())) return null;
    if (jourCivil(instant, FUSEAU_DEFAUT) === iso) return instant;
  }
  return null;
}

/**
 * Données structurées d'un article du blog, PUBLIÉ PAR l'organisation de l'accueil (même
 * `@id`). Chaque article sourcé rattache ainsi le nom « Pacevo » à la course à pied aux
 * yeux du moteur. Aucune donnée ajoutée : pas de date de publication (le texte ne garde
 * que sa dernière révision, `maj`), pas d'auteur personne (il n'est pas signé).
 */
export function donneesStructureesArticle(a: {
  slug: string; titre: string; chapo: string; maj: string; sources: { url: string }[];
  /** La photo auditée de la carte, au format de partage (`photoPartage` du blog). */
  image?: { url: string; width: number; height: number } | null;
}) {
  const url = `${SITE_URL}/blog/${a.slug}`;
  const jour = dateIsoFr(a.maj);
  const revise = jour ? debutDuJourParis(jour) : null;
  // ⚠️ L'ORGANISATION EST RÉÉCRITE EN ENTIER, pas seulement son `@id` : le moteur ne
  // va pas chercher sur l'accueil un nœud déclaré ailleurs, et un auteur sans `name` est
  // signalé par le test des résultats enrichis.
  const pacevo = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organisation`,
    name: NOM_MARQUE,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/pacevo-logo.png`, width: 512, height: 512 },
  };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: a.titre,
    description: a.chapo,
    url,
    mainEntityOfPage: url,
    inLanguage: "fr-FR",
    ...(revise ? { dateModified: revise } : {}),
    // Sans photo connue, pas de champ : jamais l'image d'un autre article ni le logo en guise d'illustration.
    ...(a.image ? { image: { "@type": "ImageObject", url: a.image.url, width: a.image.width, height: a.image.height } } : {}),
    author: pacevo,
    publisher: pacevo,
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#site`, name: NOM_MARQUE, url: `${SITE_URL}/` },
    citation: a.sources.map((s) => s.url),
  };
}
