/**
 * HAUTEURS DE SEMELLE — runrepeat.com, mesures de laboratoire.
 *
 *   npx tsx scripts/collecte-runrepeat.ts             # tous les modèles sans hauteur
 *   npx tsx scripts/collecte-runrepeat.ts "ghost"
 *
 * ⚠️ POURQUOI UNE TROISIÈME SOURCE. La hauteur de semelle ne figure sur AUCUNE fiche
 * marchande française, et Running Warehouse — qui la publie — ne vend ni Salomon, ni
 * Brooks, ni New Balance, ni Puma, ni Merrell, ni Scott, ni Inov-8 : 116 modèles hors de
 * portée. La recherche adossée à un modèle de langage, elle, se heurte à un quota
 * journalier de quelques appels. Restaient 213 fiches sans la cote qui fait tout
 * l'intérêt du schéma de profil.
 *
 * CE QU'ON S'AUTORISE : leur `robots.txt` n'interdit que la recherche et les URL à
 * paramètres de filtre ; les fiches produit sont explicitement autorisées. Une requête
 * par modèle, deux secondes d'écart, et l'adresse se déduit de notre propre identifiant
 * — aucun balayage de leur site.
 *
 * ⚠️ CE SONT DES MESURES, PAS DES ANNONCES. Ils découpent la chaussure et mesurent ; le
 * fabricant, lui, annonce. Les deux diffèrent légitimement de un à deux millimètres —
 * d'où une tolérance plus large que celle appliquée aux sources marchandes. Au-delà, ce
 * n'est plus un écart de méthode : c'est que la page décrit une autre chaussure.
 */
import fs from "node:fs";
import path from "node:path";
import { dansLesBornes, coherenceStackDrop, type Modele } from "../src/lib/shop/modele";
import { normaliser } from "./collecte-irun";
import { prendreVerrou } from "../src/lib/shop/verrou";

const BASE = "https://runrepeat.com";
const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");
const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36", "Accept-Language": "en;q=0.9" };

/**
 * ⚠️ L'ÉCART ENTRE MESURE ET ANNONCE EST ORIENTÉ, ET LA TOLÉRANCE DOIT L'ÊTRE AUSSI.
 * Mesuré sur les 20 rejets d'un premier passage : 18 vont dans le MÊME sens, le
 * laboratoire trouvant de +2,6 à +6,7 mm de plus que la marque n'annonce — l'insemelle
 * est en place, et les points de mesure diffèrent. Ce n'est pas un désaccord, c'est une
 * méthode. Les deux écarts restants étaient NÉGATIFS (−3,9 et −3,8) : ceux-là n'ont pas
 * d'explication méthodologique et signalent une autre chaussure.
 *
 * Une tolérance symétrique large laisserait passer les seconds ; une tolérance serrée
 * rejetait 18 appariements justes. On accepte donc largement au-dessus, étroitement
 * en dessous.
 */
export const DROP_MESURE_MAX_MM = 7;   // le laboratoire peut trouver plus haut
export const DROP_MESURE_MIN_MM = 2.5; // mais guère plus bas
export const TOLERANCE_POIDS_G = 45;

export function dropIncoherent(annonce: number, mesure: number): boolean {
  const ecart = mesure - annonce;
  return ecart > DROP_MESURE_MAX_MM || ecart < -DROP_MESURE_MIN_MM;
}

/**
 * La valeur mesurée d'une section de test.
 *
 * ⚠️ ON PREND LA PREMIÈRE LIGNE DU TABLEAU, PAS LE PREMIER NOMBRE DE LA SECTION. La
 * section contient aussi de la prose (« it adds 1.1 mm over its predecessor ») et un
 * histogramme comparatif avec ses bornes : le premier « N mm » venu appartient une fois
 * sur deux à autre chose. Le tableau `lab-measurements-table` a deux lignes — la
 * chaussure, puis « Average ». C'est la première, et on écarte explicitement la moyenne.
 */
export function mesureDeSection(html: string, id: string): number | null {
  const debut = html.indexOf(`<section id="${id}"`);
  if (debut < 0) return null;
  const suivant = html.indexOf('<section id=', debut + 10);
  const bloc = html.slice(debut, suivant > 0 ? suivant : debut + 8000);
  const table = bloc.match(/<table class="lab-measurements-table[\s\S]*?<\/table>/);
  if (!table) return null;
  for (const tr of table[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cellules = [...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      .map((c) => c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (cellules.length < 2) continue;
    if (/^average$/i.test(cellules[0])) continue;
    const m = cellules[1].match(/([\d.]+)\s*(mm|g|oz)/i);
    if (!m) continue;
    const v = Number(m[1]);
    if (!Number.isFinite(v)) continue;
    // Les onces ne sont pas des grammes : on ne convertit pas, on refuse.
    return /oz/i.test(m[2]) ? null : v;
  }
  return null;
}

/**
 * Mots que la source peut omettre sans changer la chaussure désignée.
 *
 * ⚠️ CE SONT DES MOTS DE GAMME, PAS D'IDENTITÉ. Nike vend l'« Air Zoom Alphafly Next% 3 »,
 * la source l'appelle « Alphafly 3 » ; la « ZoomX Vaporfly Next% 4 » y est la
 * « Vaporfly 4 ». Exiger ces mots faisait échouer l'appariement sur des modèles pourtant
 * présents. À l'inverse, retirer un mot d'identité — « Speedgoat », « Bushido » —
 * apparierait deux chaussures différentes : la liste reste courte et se justifie mot à mot.
 */
const MOTS_DE_GAMME = new Set(["air", "zoom", "zoomx", "next", "one"]);

/** Les adresses à essayer, de la plus fidèle à la plus dépouillée. */
export function variantesSlug(marque: string, nom: string): string[] {
  const jetons = normaliser(`${marque} ${nom}`).split(" ").filter(Boolean);
  const brut = jetons.join("-");
  const sansGamme = jetons.filter((j) => !MOTS_DE_GAMME.has(j)).join("-");
  // ⚠️ On n'essaie une variante dépouillée que si elle reste identifiante : réduite à la
  //    seule marque, elle pointerait vers n'importe quel modèle de celle-ci.
  const marqueSeule = normaliser(marque).split(" ").join("-");
  const variantes = [brut];
  if (sansGamme !== brut && sansGamme.length > marqueSeule.length + 1) variantes.push(sansGamme);
  return variantes;
}

/**
 * La page décrit-elle bien NOTRE chaussure ?
 *
 * ⚠️ UNE ADRESSE DEVINÉE QUI RÉPOND 200 N'EST PAS UNE PREUVE. Le site peut rediriger, ou
 * servir une page voisine. On exige que le titre contienne tous les mots significatifs
 * de la marque et du modèle — la même règle que pour le catalogue de courses, où deux
 * mots communs avaient suffi à importer les distances d'une épreuve à 400 km de là.
 */
export function pageCorrespond(html: string, marque: string, nom: string): boolean {
  const titre = normaliser(html.match(/<h1[^>]*>([\s\S]{0,160}?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, " ") ?? "");
  // Les mots de gamme sont facultatifs ici aussi : sans quoi on rejetterait la page
  // « Nike Alphafly 3 » pour une chaussure que Nike nomme « Air Zoom Alphafly Next% 3 ».
  // ⚠️ UN CHIFFRE SEUL EST UN NUMÉRO DE VERSION, DONC UNE IDENTITÉ. Écarter les mots
  //    d'une seule lettre — pour ignorer les « X » et les initiales — écartait aussi le
  //    « 3 » d'« Alphafly 3 » : la page de l'Alphafly 2 passait le contrôle. Deux
  //    générations d'une même chaussure n'ont ni la même semelle ni le même drop.
  const attendus = normaliser(`${marque} ${nom}`).split(" ")
    .filter((w) => (w.length > 1 || /^\d$/.test(w)) && !MOTS_DE_GAMME.has(w));
  // ⚠️ PAS DE GARDE « TITRE VIDE » : il serait INATTEIGNABLE. Un titre absent rend une
  //    chaîne vide, et aucun mot non vide n'y est contenu — `every` répond déjà non.
  //    Vérifié par mutation : l'ajouter ne change aucun résultat. Un garde qu'aucune
  //    mutation ne fait tomber fait croire qu'un cas est traité alors qu'il ne l'est pas.
  //    En revanche un nom VIDE des deux côtés passerait : on l'écarte explicitement.
  if (!attendus.length) return false;
  return attendus.every((w) => titre.includes(w));
}

async function page(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (r && (r.status === 429 || r.status === 403 || r.status === 406)) {
    throw new Error(`la source refuse de répondre (HTTP ${r.status}) — reprise plus tard`);
  }
  return r?.ok ? r.text() : null;
}

async function principal(): Promise<void> {
  prendreVerrou("collecte-runrepeat");
  const filtre = process.argv[2]?.toLowerCase();
  const deja: Record<string, Modele> = JSON.parse(fs.readFileSync(SORTIE, "utf8"));
  const liste = Object.values(deja).filter((m) =>
    filtre ? `${m.marque} ${m.nom}`.toLowerCase().includes(filtre) : !m.stackTalonMm);
  console.log(`${liste.length} modèle(s) sans hauteur de semelle\n`);

  const vu = new Date().toISOString().slice(0, 10);
  let remplis = 0, absents = 0, refuses = 0;
  try {
    for (const m of liste) {
      let html: string | null = null;
      for (const v of variantesSlug(m.marque, m.nom)) {
        html = await page(`${BASE}/${v}`);
        await pause();
        if (html) break;
      }
      if (!html) { absents++; console.log(`  ✗ ${(m.marque + " " + m.nom).padEnd(36)} pas de fiche`); continue; }
      if (!pageCorrespond(html, m.marque, m.nom)) {
        refuses++;
        console.log(`  ⚠ ${(m.marque + " " + m.nom).padEnd(36)} la page ne porte pas ce nom`);
        await pause(); continue;
      }

      const talon = mesureDeSection(html, "heel-stack");
      const drop = mesureDeSection(html, "drop");
      const poids = mesureDeSection(html, "weight");

      // Contrôle croisé : au-delà de la tolérance, la page décrit une autre chaussure.
      const dConnu = m.dropMm?.valeur, pConnu = m.poidsG?.valeur;
      const litige = dConnu != null && drop != null && dropIncoherent(dConnu, drop)
        ? `drop ${dConnu} mm ici, ${drop} mm mesuré`
        : pConnu != null && poids != null && Math.abs(pConnu - poids) > TOLERANCE_POIDS_G
          ? `poids ${pConnu} g ici, ${poids} g mesuré` : null;
      if (litige) { refuses++; console.log(`  ⚠ ${(m.marque + " " + m.nom).padEnd(36)} REJETÉ : ${litige}`); await pause(); continue; }

      const stack = dansLesBornes("stackTalonMm", talon) ? talon! : null;
      if (stack == null || !coherenceStackDrop(stack, dConnu ?? drop ?? undefined)) {
        absents++; console.log(`  · ${(m.marque + " " + m.nom).padEnd(36)} hauteur absente ou incohérente`);
        await pause(); continue;
      }

      // ⚠️ ON NE PREND QUE LA HAUTEUR. Le drop et le poids MESURÉS cohabiteraient avec
      //    des valeurs ANNONCÉES sur d'autres fiches, décalées de trois à cinq
      //    millimètres, sans que rien ne les distingue à l'écran : deux chaussures
      //    paraîtraient différentes alors que seule la méthode de mesure change. La
      //    hauteur de semelle, elle, n'est publiée par personne d'autre — mieux vaut une
      //    mesure attribuée qu'une case vide.
      deja[m.slug] = {
        ...m,
        stackTalonMm: { valeur: stack, vu },
        sources: [...new Set([...(m.sources ?? []), "runrepeat.com"])],
      };
      remplis++;
      console.log(`  ✓ ${(m.marque + " " + m.nom).padEnd(36)} talon ${stack} mm · drop mesuré ${drop ?? "?"} · ${poids ?? "?"} g`);
      fs.writeFileSync(SORTIE, JSON.stringify(deja, null, 2));
      await pause();
    }
  } catch (e) {
    console.log(`\n⛔ ${(e as Error).message}`);
  }
  console.log(`\n${remplis} hauteur(s) ajoutée(s) · ${refuses} rejeté(s) au contrôle · ${absents} sans fiche exploitable`);
}

const pause = () => new Promise((r) => setTimeout(r, 2000));
if (require.main === module) void principal();
