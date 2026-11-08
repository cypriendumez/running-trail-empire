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
  dateIsoFr, donneesStructureesArticle,
} from "../src/lib/brand/entite";
import { RESEAUX } from "../src/lib/brand/reseaux";
import { ARTICLES } from "../src/app/blog/articles";
import { BLOG } from "../src/app/blog/blogI18n";

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
// ⚠️ SOURCE UNIQUE : les profils sont ceux du pied de page, pas une liste recopiée.
verifier("sameAs = les comptes de lib/brand/reseaux, dans l'ordre",
  JSON.stringify(org?.sameAs) === JSON.stringify(RESEAUX.map((r) => r.url)), JSON.stringify(org?.sameAs));
verifier("tous les profils sont en https", (org?.sameAs as string[] | undefined)?.every((u) => u.startsWith("https://")) ?? false);
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
let articlesOk = 0;
for (const a of ARTICLES) {
  const titre = BLOG.fr.posts[a.cle]?.title;
  const ld = donneesStructureesArticle({ slug: a.slug, titre, chapo: a.chapo, maj: a.maj, sources: a.sources }) as Noeud;
  const auteur = ld.author as Noeud, editeur = ld.publisher as Noeud;
  const bon = ld["@type"] === "Article" && ld.headline === titre && !!titre
    && ld.url === `${SITE_URL}/blog/${a.slug}`
    && ld.dateModified === dateIsoFr(a.maj) && typeof ld.dateModified === "string"
    && auteur?.name === "Pacevo" && editeur?.name === "Pacevo" && editeur?.["@id"] === org?.["@id"]
    && JSON.stringify(ld.citation) === JSON.stringify(a.sources.map((s) => s.url))
    && !("datePublished" in ld);
  if (bon) articlesOk++; else verifier(`article ${a.slug} : données structurées fidèles`, false, JSON.stringify(ld).slice(0, 300));
}
verifier(`les ${ARTICLES.length} articles ont des données structurées fidèles (titre, date de révision, éditeur Pacevo, sources)`, articlesOk === ARTICLES.length && ARTICLES.length > 0, `${articlesOk}/${ARTICLES.length}`);
verifier("la page d'article pose ces données", /<script type="application\/ld\+json" dangerouslySetInnerHTML=\{\{ __html: serialiserJsonLd\(ld\) \}\}\s*\/>/.test(code("src/app/blog/[slug]/page.tsx"))
  && /donneesStructureesArticle\(/.test(code("src/app/blog/[slug]/page.tsx")));

console.log(`\n${ok + ko} contrôles marque · ${ko} problème(s)`);
process.exit(ko ? 1 : 0);
