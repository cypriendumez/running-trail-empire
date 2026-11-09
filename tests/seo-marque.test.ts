/**
 * LA MARQUE « PACEVO » LISIBLE PAR LES MOTEURS.
 *
 * Constaté le 08/11/2026 : Google corrige la requête « pacevo » en « pancevo » (ville de
 * Serbie) et pacevo.fr n'apparaît pas en première page. Le HTML servi expliquait une partie
 * du problème :
 *   · `<title>Pacevo</title>` sur l'accueil, sans rien qui dise ce qu'est Pacevo ;
 *   · AUCUNE donnée structurée sur l'accueil (ni Organization ni WebSite) ;
 *   · pas de canonique sur l'accueil ;
 *   · l'image de partage de toutes les pages servie depuis pacevo.app (pas de `metadataBase`) ;
 *   · « Notre histoire » et les tarifs absents du sitemap.
 *
 * Ce fichier fige chacune de ces corrections.
 *
 *   npx tsx tests/seo-marque.test.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  SITE_URL, NOM_MARQUE, TITRE_ACCUEIL, DESCRIPTION_MARQUE,
  donneesStructureesMarque, jsonLdMarque, serialiserJsonLd,
  dateIsoFr, donneesStructureesArticle, debutDuJourParis,
} from "../src/lib/brand/entite";
import { RESEAUX, PROFILS_SANS_ICONE } from "../src/lib/brand/reseaux";
import { ARTICLES } from "../src/app/blog/articles";
import { BLOG } from "../src/app/blog/blogI18n";
import { POSTS, photoPartage } from "../src/app/blog/posts";

let ok = 0;
let ko = 0;
const verifier = (q: string, cond: boolean, d = "") => {
  if (cond) { ok++; console.log(`  ✓ ${q}`); }
  else { ko++; console.log(`  ✗ ${q}${d ? "\n      " + d : ""}`); }
};
/** Retire les commentaires SANS couper `://`. */
const sansComm = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\s*\}/g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");
const code = (f: string) => sansComm(readFileSync(join(process.cwd(), f), "utf8"));

type Noeud = Record<string, unknown>;
const graphe = donneesStructureesMarque()["@graph"] as Noeud[];
const org = graphe.find((n) => n["@type"] === "Organization");
const site = graphe.find((n) => n["@type"] === "WebSite");

// ── 1. Le domaine ─────────────────────────────────────────────────────────────
console.log("\n— Domaine");
verifier("SITE_URL vaut pacevo.fr sans NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL ? true : SITE_URL === "https://pacevo.fr", SITE_URL);
verifier("SITE_URL sans barre finale ni localhost", !SITE_URL.endsWith("/") && !SITE_URL.includes("localhost"), SITE_URL);

// ── 2. L'organisation ─────────────────────────────────────────────────────────
console.log("\n— Organization");
verifier("une Organization nommée Pacevo", !!org && org.name === NOM_MARQUE && NOM_MARQUE === "Pacevo", JSON.stringify(org?.name));
verifier("son url est l'accueil de pacevo.fr", org?.url === `${SITE_URL}/`, String(org?.url));
verifier("« Pacevo Running » figure parmi les noms alternatifs",
  Array.isArray(org?.alternateName) && (org!.alternateName as string[]).includes("Pacevo Running"));
const logo = org?.logo as Noeud | undefined;
const fichierLogo = typeof logo?.url === "string" ? join(process.cwd(), "public", (logo.url as string).replace(SITE_URL, "")) : "";
verifier("le logo déclaré existe dans public/", !!fichierLogo && existsSync(fichierLogo), fichierLogo);
if (fichierLogo && existsSync(fichierLogo)) {
  // Largeur et hauteur RÉELLES du PNG (en-tête IHDR), pas celles qu'on a écrites.
  const png = readFileSync(fichierLogo);
  const l = png.readUInt32BE(16), h = png.readUInt32BE(20);
  verifier("le logo fait au moins 112 px (exigence de Google) et ses dimensions déclarées sont vraies",
    l >= 112 && h >= 112 && logo?.width === l && logo?.height === h, `${l}×${h} réels, ${logo?.width}×${logo?.height} déclarés`);
}
// ⚠️ SOURCE UNIQUE : les profils sont ceux de lib/brand/reseaux (pied de page, puis profils
// sans icône), pas une liste recopiée.
const sameAs = (org?.sameAs as string[] | undefined) ?? [];
verifier("sameAs = les comptes de lib/brand/reseaux (pied de page, puis sans icône), dans l'ordre",
  JSON.stringify(sameAs) === JSON.stringify([...RESEAUX, ...PROFILS_SANS_ICONE].map((r) => r.url)), JSON.stringify(sameAs));
verifier("tous les profils sont en https", sameAs.length > 0 && sameAs.every((u) => u.startsWith("https://")));
// Club créé avec Cyprien le 09/11/2026 : un profil de course de plus qui renvoie vers pacevo.fr.
verifier("le club Strava Pacevo est déclaré", sameAs.includes("https://www.strava.com/clubs/pacevo"), JSON.stringify(sameAs));
verifier("aucun profil déclaré deux fois", new Set(sameAs).size === sameAs.length, JSON.stringify(sameAs));
// Pied de page : un compte de RESEAUX sans glyphe y deviendrait une pastille vide.
const piedReseaux = code("src/components/brand/SocialLinks.tsx");
verifier("chaque compte du pied de page a son logo dessiné",
  RESEAUX.every((r) => new RegExp(`\\b${r.cle}:\\s*\\(`).test(piedReseaux)), RESEAUX.map((r) => r.cle).join(", "));
verifier("le pied de page n'affiche que RESEAUX, pas les profils sans icône",
  /RESEAUX\.map\(/.test(piedReseaux) && !/PROFILS_(SANS_ICONE|OFFICIELS)/.test(piedReseaux));
verifier("la description nomme la marque et la course", /^Pacevo\b/.test(DESCRIPTION_MARQUE) && /course à pied|trail/.test(DESCRIPTION_MARQUE));
// Rien d'inventé : une note, un avis ou un effectif seraient affichés par le moteur comme des faits.
const brut = JSON.stringify(donneesStructureesMarque());
for (const interdit of ["aggregateRating", "review", "ratingValue", "numberOfEmployees", "foundingDate", "userCount"]) {
  verifier(`aucune donnée inventée : pas de « ${interdit} »`, !brut.includes(`"${interdit}"`));
}

// ── 3. Le site ────────────────────────────────────────────────────────────────
console.log("\n— WebSite");
verifier("un WebSite nommé Pacevo (nom affiché au-dessus du résultat)", !!site && site.name === "Pacevo");
verifier("publié par l'organisation (même @id)", (site?.publisher as Noeud | undefined)?.["@id"] === org?.["@id"], JSON.stringify(site?.publisher));

// ── 4. Le JSON posé dans la page ──────────────────────────────────────────────
console.log("\n— Sérialisation");
const sortie = jsonLdMarque();
verifier("aucun « < » brut (un « </script> » fermerait la balise)", !sortie.includes("<"));
verifier("le JSON relu redonne les mêmes données", JSON.stringify(JSON.parse(sortie)) === brut);
// Les données d'aujourd'hui ne contiennent aucun « < » : sans cette chaîne piégée, retirer
// l'échappement laissait le test vert (constaté par mutation).
const piege = { name: "x</script><img src=x onerror=alert(1)>" };
const piegeSortie = serialiserJsonLd(piege);
verifier("une chaîne « </script> » ne ferme pas la balise", !piegeSortie.includes("<") && JSON.parse(piegeSortie).name === piege.name, piegeSortie);

// ── 5. Le layout racine ───────────────────────────────────────────────────────
console.log("\n— Layout racine");
const layout = code("src/app/layout.tsx");
verifier("metadataBase posé sur SITE_URL (image de partage et canoniques sur pacevo.fr)", /metadataBase:\s*new URL\(SITE_URL\)/.test(layout));
verifier("le titre par défaut (celui de l'accueil) vient de TITRE_ACCUEIL", /default:\s*TITRE_ACCUEIL/.test(layout));
verifier("TITRE_ACCUEIL commence par Pacevo et dit « running »", /^Pacevo\b/.test(TITRE_ACCUEIL) && /running/i.test(TITRE_ACCUEIL), TITRE_ACCUEIL);
verifier("TITRE_ACCUEIL tient dans un résultat (≤ 60 caractères)", TITRE_ACCUEIL.length <= 60, `${TITRE_ACCUEIL.length} car.`);
// ⚠️ Une canonique dans le layout racine serait HÉRITÉE par toutes les pages qui n'en
// déclarent pas : /contact, /avis… se déclareraient doublons de l'accueil.
const blocMeta = layout.slice(layout.indexOf("export const metadata"), layout.indexOf("export const viewport"));
verifier("le layout racine ne déclare AUCUNE canonique (elle serait héritée partout)", blocMeta.length > 0 && !/alternates|canonical/.test(blocMeta));
verifier("la description par défaut commence par la marque", /description:\s*\n?\s*"Pacevo\b/.test(blocMeta));

// ── 6. L'accueil ──────────────────────────────────────────────────────────────
console.log("\n— Accueil");
const accueil = code("src/app/page.tsx");
verifier("canonique de l'accueil sur SITE_URL", /<link rel="canonical" href=\{SITE_URL\}\s*\/>/.test(accueil));
verifier("données structurées de la marque posées", /<script type="application\/ld\+json" dangerouslySetInnerHTML=\{\{ __html: jsonLdMarque\(\) \}\}\s*\/>/.test(accueil));
const h1 = accueil.slice(accueil.indexOf("<h1"), accueil.indexOf("</h1>"));
verifier("le H1 porte le nom de la marque (lecteurs d'écran et moteurs)", h1.length > 0 && /\{NOM_MARQUE\}/.test(h1));

// ── 7. Le sitemap ─────────────────────────────────────────────────────────────
console.log("\n— Sitemap");
const sitemap = code("src/app/sitemap.ts");
// Viser le BLOC des pages fixes, pas le fichier entier.
const fixes = sitemap.slice(sitemap.indexOf("const entries"), sitemap.indexOf("const fixes"));
for (const p of ["/notre-histoire", "/pricing"]) {
  verifier(`${p} déclaré parmi les pages fixes`, fixes.includes(`path: "${p}"`));
}
verifier("/pricing porte sa canonique", /canonical:\s*"\/pricing"/.test(code("src/app/pricing/layout.tsx")));
verifier("/notre-histoire porte sa canonique", /canonical:\s*"\/notre-histoire"/.test(code("src/app/notre-histoire/page.tsx")));

// ── 8. Les autres pages fixes ─────────────────────────────────────────────────
// Audit du 08/11/2026 sur 524 pages servies : ces huit pages n'avaient AUCUNE canonique, et
// /avis reprenait mot pour mot la description de l'accueil.
console.log("\n— Pages fixes");
for (const [fichier, chemin] of [
  ["src/app/avis/page.tsx", "/avis"],
  ["src/app/blog/layout.tsx", "/blog"],
  ["src/app/contact/page.tsx", "/contact"],
  ["src/app/mentions-legales/page.tsx", "/mentions-legales"],
  ["src/app/confidentialite/page.tsx", "/confidentialite"],
  ["src/app/terms/page.tsx", "/terms"],
  ["src/app/robot/page.tsx", "/robot"],
] as const) {
  verifier(`${chemin} porte sa canonique`, new RegExp(`canonical:\\s*"${chemin.replace("/", "\\/")}"`).test(code(fichier)));
}
const avis = code("src/app/avis/page.tsx");
const descAvis = avis.match(/export const metadata = \{[\s\S]*?description:\s*"([^"]+)"/)?.[1] ?? "";
const descDefaut = blocMeta.match(/description:\s*\n?\s*"([^"]+)"/)?.[1] ?? "";
verifier("/avis a sa propre description, différente de l'accueil", descAvis.length > 30 && descAvis !== descDefaut, descAvis);
// /pricing n'avait aucun H1 : son titre sortait en H2.
verifier("/pricing rend son titre en H1", /<SectionHeading niveau="h1"/.test(code("src/app/pricing/page.tsx")));
verifier("SectionHeading rend le niveau demandé (h2 par défaut)", /niveau:\s*Titre\s*=\s*"h2"/.test(code("src/components/ui/Container.tsx")) && /<Titre className=/.test(code("src/components/ui/Container.tsx")));

// ── 9. Les articles du blog ───────────────────────────────────────────────────
console.log("\n— Articles");
verifier("dateIsoFr lit « 21 août 2026 »", dateIsoFr("21 août 2026") === "2026-08-21", String(dateIsoFr("21 août 2026")));
verifier("dateIsoFr lit « 1er mai 2026 »", dateIsoFr("1er mai 2026") === "2026-05-01", String(dateIsoFr("1er mai 2026")));
verifier("dateIsoFr refuse une date impossible ou illisible (jamais inventée)",
  dateIsoFr("31 juin 2026") === null && dateIsoFr("bientôt") === null && dateIsoFr("21 aout 2026") === null);
// Le test des résultats enrichis signalait « il manque le fuseau horaire » (08/11/2026).
// Jours de changement d'heure compris : à minuit, l'heure n'a pas encore changé.
for (const [jour, attendu] of [
  ["2026-08-21", "2026-08-21T00:00:00+02:00"], ["2026-11-08", "2026-11-08T00:00:00+01:00"],
  ["2026-03-29", "2026-03-29T00:00:00+01:00"], ["2026-10-25", "2026-10-25T00:00:00+02:00"],
] as const) {
  verifier(`debutDuJourParis(${jour}) = ${attendu}`, debutDuJourParis(jour) === attendu, String(debutDuJourParis(jour)));
}
let articlesOk = 0;
for (const a of ARTICLES) {
  const titre = BLOG.fr.posts[a.cle]?.title;
  const photo = photoPartage(a.cle);
  const ld = donneesStructureesArticle({ slug: a.slug, titre, chapo: a.chapo, maj: a.maj, sources: a.sources, image: photo }) as Noeud;
  // La photo de partage est CELLE DE LA CARTE (même identifiant), au même rapport 4:3 :
  // c'est ce cadrage-là qui a été audité.
  const carte = POSTS.find((p) => p.key === a.cle)?.img.match(/photo-\d{10,}-[0-9a-z]+/)?.[0];
  const img = ld.image as Noeud | undefined;
  const photoOk = !!photo && !!carte && photo.url.includes(carte) && photo.width >= 1200 && photo.height * 4 === photo.width * 3
    && new RegExp(`[?&]w=${photo.width}&h=${photo.height}&fit=crop`).test(photo.url)
    && img?.url === photo.url && img?.width === photo.width && img?.height === photo.height;
  const auteur = ld.author as Noeud, editeur = ld.publisher as Noeud;
  const bon = ld["@type"] === "Article" && ld.headline === titre && !!titre
    && ld.url === `${SITE_URL}/blog/${a.slug}`
    && typeof ld.dateModified === "string" && ld.dateModified === debutDuJourParis(dateIsoFr(a.maj) ?? "")
    && /^\d{4}-\d{2}-\d{2}T00:00:00\+0[12]:00$/.test(ld.dateModified as string)
    && photoOk
    && auteur?.name === "Pacevo" && editeur?.name === "Pacevo" && editeur?.["@id"] === org?.["@id"]
    && JSON.stringify(ld.citation) === JSON.stringify(a.sources.map((s) => s.url))
    && !("datePublished" in ld);
  if (bon) articlesOk++; else verifier(`article ${a.slug} : données structurées fidèles`, false, JSON.stringify(ld).slice(0, 300));
}
verifier(`les ${ARTICLES.length} articles ont des données structurées fidèles (titre, date de révision à l'heure de Paris, photo de leur carte, éditeur Pacevo, sources)`, articlesOk === ARTICLES.length && ARTICLES.length > 0, `${articlesOk}/${ARTICLES.length}`);
verifier("la page d'article pose ces données", /<script type="application\/ld\+json" dangerouslySetInnerHTML=\{\{ __html: serialiserJsonLd\(ld\) \}\}\s*\/>/.test(code("src/app/blog/[slug]/page.tsx"))
  && /donneesStructureesArticle\(/.test(code("src/app/blog/[slug]/page.tsx")));
verifier("sans photo connue, aucune image (jamais celle d'un autre article)", photoPartage("cle-inexistante") === null
  && !("image" in donneesStructureesArticle({ slug: "x", titre: "x", chapo: "x", maj: "21 août 2026", sources: [], image: null })));
// Partage : constaté le 08/11/2026, un article partait SANS IMAGE, et sur X avec le titre
// de l'accueil. Viser le bloc de `generateMetadata`, pas le fichier.
const pageArticle = code("src/app/blog/[slug]/page.tsx");
const meta = pageArticle.slice(pageArticle.indexOf("export async function generateMetadata"), pageArticle.indexOf("export default"));
const og = meta.slice(meta.indexOf("openGraph:"), meta.indexOf("twitter:"));
const tw = meta.slice(meta.indexOf("twitter:"));
verifier("l'article déclare son image de partage (Open Graph)", /images:\s*\[\{\s*url:\s*photo\.url/.test(og) && /const photo = photoPartage\(a\.cle\)/.test(meta));
verifier("l'article déclare son adresse dans Open Graph", /url:\s*`\/blog\/\$\{a\.slug\}`/.test(og));
verifier("sur X, l'article a SON titre, SA description et SA photo", meta.includes("twitter:") && /title:\s*t\.title/.test(tw) && /description:\s*a\.chapo/.test(tw) && /images:\s*\[photo\.url\]/.test(tw));
verifier("le JSON-LD de l'article reçoit la photo", /image:\s*photoPartage\(a\.cle\)/.test(pageArticle));

console.log(`\n${ok + ko} contrôles marque · ${ko} problème(s)`);
process.exit(ko ? 1 : 0);
