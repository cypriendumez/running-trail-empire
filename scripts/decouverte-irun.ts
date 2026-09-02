/**
 * DÉCOUVERTE DE MODÈLES — on ne devine plus les noms, on les lit chez le marchand.
 *
 *   npx tsx scripts/decouverte-irun.ts             # toutes les marques
 *   npx tsx scripts/decouverte-irun.ts Hoka        # une marque
 *
 * ⚠️ POURQUOI REMPLACER UNE LISTE ÉCRITE À LA MAIN. Le catalogue partait de 107 noms que
 * j'avais tapés de mémoire : 25 n'existaient pas sous cette forme, et rien ne garantit
 * que les 82 autres soient les modèles réellement vendus en France aujourd'hui. La
 * recherche du marchand, elle, ne rend que des produits qui existent et qu'il vend. On
 * lui demande une marque, il rend ses modèles — noms exacts, code-barres, prix du jour.
 *
 * ⚠️ ET UNE FICHE « HOMME » PEUT ÊTRE UNE FICHE FEMME. Vérifié : la fiche 144265 est
 * servie sous `/chaussures_homme/` alors que son JSON-LD annonce « Chaussures de sport
 * femme Running » — même produit, deux chemins. Se fier au chemin d'URL ferait entrer
 * dans le catalogue des poids et des cotes de la déclinaison femme sous l'étiquette
 * homme. C'est la catégorie déclarée dans les données structurées qui tranche.
 */
import fs from "node:fs";
import path from "node:path";
import { dansLesBornes, type Modele, type Terrain } from "../src/lib/shop/modele";
import { normaliser, caracteristiques, nombreDe, jsonProduit } from "./collecte-irun";
import { prendreVerrou } from "../src/lib/shop/verrou";

const BASE = "https://www.i-run.fr";
const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");
const UA = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9",
};

/** Les marques de course à pied qu'on interroge. Une recherche chacune. */
/**
 * ⚠️ UN SEUL LIBELLÉ PAR MARQUE. Le marchand écrit « Hoka One One » et « On Running » là
 * où l'on dit « Hoka » et « On » : sans normalisation, le filtre affichait deux entrées
 * pour la même marque et cocher l'une faisait rater la moitié du catalogue.
 */
export const ALIAS_MARQUE: Record<string, string> = { "Hoka One One": "Hoka", "On Running": "On", "Topo Athletic": "Topo" };
export const nomMarque = (v: string) => ALIAS_MARQUE[v] ?? v;

export const MARQUES = [
  "Adidas", "Altra", "Asics", "Brooks", "Craft", "Hoka", "Inov-8", "Kiprun", "La Sportiva",
  "Merrell", "Mizuno", "New Balance", "Nike", "NNormal", "Norda", "On", "Puma",
  "Saucony", "Salomon", "Scott", "Topo Athletic", "Under Armour",
  // ⚠️ AJOUTÉES APRÈS SONDAGE, PAS PAR ESPOIR. Vingt-deux marques candidates ont été
  //    interrogées une par une : celles-ci sont les seules qui rendent des fiches de
  //    chaussures de course chez ce marchand. Craft, Diadora, Karhu, Newton, Skechers,
  //    Xero, Joma, Raidlight, Icebug, VJ, Veja, Kiprun et Decathlon en rendent ZÉRO —
  //    les inscrire ici ferait tourner des recherches stériles à chaque passage.
  "Reebok", "Dynafit", "Vibram", "Millet", "Arc'teryx",
] as const;

/** Seules ces deux catégories du marchand nous intéressent : route et sentier. */
const CATEGORIES: Record<string, Terrain> = { Running_c23: "route", Running_c24: "route", Trail_c15: "trail", Trail_c16: "trail" };

async function page(url: string): Promise<string | null> {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) }).catch(() => null);
  if (!r?.ok) return null;
  return new TextDecoder("windows-1252").decode(await r.arrayBuffer());
}

/** Le terrain vient de la catégorie du marchand, pas d'un jugement de notre part. */
export function terrainDeUrl(url: string): Terrain | null {
  const m = url.match(/\/chaussures_[a-z]+\/([A-Za-z]+_c\d+)\//);
  return m ? (CATEGORIES[m[1]] ?? null) : null;
}

/**
 * ⚠️ LA DÉCLINAISON FEMME EST UN AUTRE PRODUIT : autres poids, autres pointures, parfois
 * une autre semelle. La catégorie annoncée dans les données structurées est la seule
 * source fiable — le chemin d'URL, non.
 */
export function estFemme(produit: Record<string, unknown> | null, url: string): boolean {
  const cat = String((produit?.offers as { category?: string } | undefined)?.category ?? "");
  if (/femme/i.test(cat)) return true;
  if (/\bhomme\b/i.test(cat)) return false;
  // Aucune catégorie déclarée : on retombe sur le chemin, faute de mieux.
  return /\/chaussures_femme\//.test(url);
}

/** Les formes longues sous lesquelles le marchand écrit une marque. */
export const FORMES_LONGUES: Record<string, string[]> = {
  Hoka: ["Hoka One One"], On: ["On Running"], Topo: ["Topo Athletic"],
};

/**
 * Retire un préfixe de marque en respectant la ponctuation du marchand.
 *
 * ⚠️ COMPTER LES MOTS SUR LA VERSION NORMALISÉE ÉTAIT FAUX. Le marchand écrit
 * « On-Running Cloudmonster Hyper » : un seul mot pour un découpage sur les espaces,
 * DEUX une fois normalisé. Retirer « deux mots » du libellé d'origine emportait donc
 * « On-Running » ET « Cloudmonster », et le modèle entrait au catalogue sous le nom
 * « Hyper ». Résultat visible : huit modèles en double, chacun présent sous son vrai nom
 * et sous un nom tronqué, partageant le même code-barres.
 *
 * On consomme donc les mots un par un sur le libellé D'ORIGINE, en acceptant l'espace
 * comme le trait d'union comme séparateur — et le reste est rendu tel quel, ce qui
 * préserve les traits d'union internes (« Gel-Nimbus » reste « Gel-Nimbus »).
 */
export function retirerPrefixe(nom: string, prefixe: string): string | null {
  const attendus = normaliser(prefixe).split(" ").filter(Boolean);
  let reste = nom.trim();
  for (const t of attendus) {
    const m = reste.match(/^([\p{L}\p{N}]+)[\s-]*/u);
    if (!m || normaliser(m[1]) !== t) return null;
    reste = reste.slice(m[0].length);
  }
  return reste.trim() || null;
}

/** Nom du modèle, marque retirée, tel que le marchand l'écrit. */
export function modeleDeNom(nomComplet: string, marque: string): string {
  // La forme la plus longue d'abord : « Hoka One One » avant « Hoka », sans quoi il
  // resterait « One One Mach X 3 ».
  const prefixes = [...(FORMES_LONGUES[marque] ?? []), marque].sort((a, b) => b.length - a.length);
  for (const p of prefixes) {
    const reste = retirerPrefixe(nomComplet, p);
    // ⚠️ LE « M » FINAL EST UN MARQUEUR DE DÉCLINAISON, PAS UN MORCEAU DU NOM. Le marchand
    //    publie « TrailFly Ultra G 280 » ET « TrailFly Ultra G 280 M » pour la même
    //    chaussure : deux entrées au catalogue, même code-barres, l'athlète la voit deux
    //    fois. On le retire, comme on le fait déjà chez l'autre source.
    if (reste) return reste.replace(/\s+M$/, "");
  }
  return nomComplet;
}

/** Les variantes qui ne sont pas le modèle nu. */
const VARIANTES = /\b(wide|gtx|gore.?tex|w|femme|junior|kid|kids|large)\b/i;

/**
 * Faut-il seulement TÉLÉCHARGER cette fiche ?
 *
 * ⚠️ SANS CE TRI PRÉALABLE, ON PAIE UNE REQUÊTE POUR RIEN. Sur le premier recensement,
 * 144 fiches sur 300 ont été écartées APRÈS téléchargement — variantes larges, Gore-Tex,
 * déclinaisons femme. Le nom du produit figure déjà dans l'URL : autant s'en servir. La
 * recherche élargie multiplie les candidates par quatre, ce gaspillage n'est plus tenable
 * — ni pour nous, ni pour le serveur d'en face.
 *
 * On ne garde que le chemin HOMME : le même produit y est servi sous les deux chemins, et
 * la vérification fine de la catégorie déclarée reste faite après lecture.
 */
export function vautLeCoup(url: string): boolean {
  if (!/\/chaussures_homme\//.test(url)) return false;
  if (!terrainDeUrl(url)) return false;
  const fichier = url.split("/").pop() ?? "";
  const nom = fichier.replace(/_fiche_\d+\.html.*$/, "").replace(/[-_]/g, " ");
  return !VARIANTES.test(nom);
}

/**
 * La FAMILLE d'un modèle : « Speedgoat 6 » → « Speedgoat ».
 *
 * ⚠️ C'EST ELLE QUI DÉBLOQUE LE VOLUME. Interroger la marque seule rend ~16 fiches, quelle
 * que soit la taille de son catalogue : le marchand plafonne ses résultats. Mesuré sur
 * Hoka : « Hoka » → 16, mais « Hoka Bondi », « Hoka Mach », « Hoka Clifton »… cumulent 55.
 * Les familles ne s'inventent pas — elles se lisent sur les modèles déjà trouvés, et
 * chacune en révèle d'autres. La recherche fait boule de neige à partir d'elle-même.
 */
export function familleDe(nom: string): string | null {
  // ⚠️ ON NE COUPE PAS SUR LE TRAIT D'UNION : « Gel-Nimbus 28 » a pour famille
  //    « Gel-Nimbus », pas « Gel » — qui ne désigne rien et ramènerait tout le catalogue
  //    Asics sans distinction.
  let mot = nom.trim().split(/\s+/)[0] ?? "";
  // « 1080v14 » est un modèle précis ; sa famille est « 1080 », qui révèle les versions
  // antérieures. Sans ce retrait, chaque version devient sa propre requête stérile.
  mot = mot.replace(/v\d+$/i, "");
  // Un mot de trois lettres ou moins n'est pas une famille, c'est du bruit (« X », « SL »).
  return mot.length >= 4 ? mot : null;
}

/**
 * LE PRIX PUBLIC CONSEILLÉ, tel que le marchand l'affiche à côté de son propre prix.
 *
 * ⚠️ CETTE SOURCE VAUT MIEUX QUE LA RECHERCHE. La collecte adossée à un modèle de langage
 * rendait le prix conseillé une fois sur dix, et s'est trompée sur des valeurs
 * vérifiables (« 0 mm de drop » pour l'Adizero Adios 9). Ici, la page écrit noir sur
 * blanc « 130 € — Prix de vente conseillé par la marque », juste à côté des 78 € qu'elle
 * pratique. Même page, même instant, aucune interprétation.
 *
 * ⚠️ ET ON EXIGE LE LIBELLÉ. Prendre « le second montant de la zone » marcherait
 * aujourd'hui et casserait au premier remaniement de leur page, en silence : le
 * mensualité « 3× sans frais » y figure aussi. On ancre sur les mots « prix conseillé ».
 */
export function prixConseilleDe(html: string): number | null {
  const i = html.indexOf("prdDtl__priceZone");
  if (i < 0) return null;
  const texte = html.slice(i, i + 2000).replace(/<[^>]+>/g, " ")
    .replace(/&euro;/g, " €").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = texte.match(/([\d]+(?:[.,]\d+)?)\s*€\s*Prix conseill/i);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  return Number.isFinite(v) && v >= 40 && v <= 400 ? v : null;
}

/**
 * LA PLAQUE CARBONE — on constate sa PRÉSENCE, jamais son absence.
 *
 * ⚠️ L'ASYMÉTRIE EST LE CŒUR DE CETTE FONCTION. Vérifié sur quatre fiches : celle de la
 * Vaporfly 4 annonce « une plaque en fibre de carbone sur toute la longueur », mais celle
 * de l'Adizero Adios Pro 4 — qui en a une, indiscutablement — n'en dit pas un mot. Le
 * silence d'une fiche produit ne prouve rien : il signifie « non mentionné », pas
 * « absente ». Conclure `false` sur un silence rangerait des chaussures de compétition
 * parmi les chaussures d'entraînement, et l'avis « pour toi » s'en trouverait faussé.
 *
 * On ne rend donc `false` que sur une négation EXPLICITE (« sans plaque carbone »), et
 * `undefined` — donc « non communiqué » à l'écran — dans tous les autres cas.
 */
export function plaqueCarboneDe(html: string): boolean | undefined {
  const txt = html.replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&eacute;/g, "é").replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à").replace(/&ccedil;/g, "ç").replace(/\s+/g, " ");
  // On travaille phrase par phrase : « sans plaque carbone » et « plaque carbone » ne
  // doivent pas se confondre parce qu'ils partagent des mots.
  for (const phrase of txt.split(/[.!?]/)) {
    if (!/plaque/i.test(phrase)) continue;
    if (!/carbone|carbon/i.test(phrase)) continue;
    if (/\b(sans|pas de|aucune|dépourvues?|non pourvues?)\b[^.]{0,40}plaque/i.test(phrase)) return false;
    return true;
  }
  return undefined;
}

export type Trouvaille = { fiche: Modele; prix: number | null; dispo: boolean; url: string };

export function lireFiche(html: string, url: string, marque: string): Trouvaille | null {
  const prod = jsonProduit(html);
  if (!prod || typeof prod.name !== "string") return null;
  if (estFemme(prod, url)) return null;
  const terrain = terrainDeUrl(url);
  if (!terrain) return null;

  const nomComplet = prod.name.trim();
  const nom = modeleDeNom(nomComplet, marque);
  if (!nom || VARIANTES.test(nom)) return null;

  const c = caracteristiques(html);
  const poids = nombreDe(c.weight), drop = nombreDe(c.drop);
  const vu = new Date().toISOString().slice(0, 10);
  const mesure = <T,>(v: T | undefined) => (v == null ? undefined : { valeur: v, vu });

  const offre = prod.offers as { price?: string; availability?: string } | undefined;
  const prix = offre?.price != null && Number.isFinite(Number(offre.price)) ? Number(offre.price) : null;
  const conseille = prixConseilleDe(html);
  const plaque = plaqueCarboneDe(html);

  const slug = `${marque}-${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    fiche: {
      slug, marque, nom, terrain,
      poidsG: dansLesBornes("poidsG", poids) ? mesure(poids) : undefined,
      dropMm: dansLesBornes("dropMm", drop) ? mesure(drop) : undefined,
      prixConseilleEur: conseille != null ? mesure(conseille) : undefined,
      plaqueCarbone: plaque != null ? mesure(plaque) : undefined,
      ean: typeof prod.gtin13 === "string" ? prod.gtin13 : undefined,
      nomExact: nomComplet,
      foulee: c.stability || undefined,
      sources: ["i-run.fr"],
    },
    prix,
    dispo: !/OutOfStock/i.test(String(offre?.availability ?? "")),
    url,
  };
}

/** Le fichier qui retient les fiches déjà lues, pour qu'une relance ne les repaie pas. */
const CACHE = path.join(process.cwd(), ".scratch/fiches-vues.json");

/**
 * ⚠️ TRENTE RECHERCHES PAR MARQUE, PAS PLUS. La boule de neige pourrait tourner
 * longtemps : chaque modèle livre une famille, chaque famille d'autres modèles. Sans
 * borne, un catalogue riche déclencherait des centaines de requêtes chez le marchand pour
 * un rendement qui s'effondre — les derniers tours ne rapportent presque plus rien.
 */
const RECHERCHES_MAX = 30;

type OffreRelevee = { slug: string; ean?: string; prix: number; dispo: boolean; url: string };

async function principal(): Promise<void> {
  prendreVerrou("decouverte-irun");
  const args = process.argv.slice(2);
  // ⚠️ DEUX MODES, PARCE QUE LE CACHE A UN EFFET DE BORD. Il évite de retélécharger une
  //    fiche déjà lue — parfait pour élargir le catalogue, désastreux pour les prix : au
  //    second passage, AUCUN prix n'était relevé (la fiche n'était plus ouverte) et le
  //    fichier d'offres se retrouvait vide. `--prix` ignore le cache et rouvre tout.
  const rafraichirPrix = args.includes("--prix");
  const filtre = args.find((a) => !a.startsWith("--"))?.toLowerCase();
  const marques = MARQUES.filter((m) => !filtre || m.toLowerCase().includes(filtre));
  const deja: Record<string, Modele> = fs.existsSync(SORTIE) ? JSON.parse(fs.readFileSync(SORTIE, "utf8")) : {};
  const vues: Record<string, string> = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : {};

  // ⚠️ ON FUSIONNE, ON N'ÉCRASE PAS. Le second passage a remplacé 248 prix relevés par une
  //    liste vide : un fichier de sortie qui rétrécit sans qu'on le remarque est une perte
  //    silencieuse de données.
  const FICHIER_OFFRES = path.join(process.cwd(), ".scratch/offres-irun.json");
  const offres: Record<string, OffreRelevee> = Object.fromEntries(
    (fs.existsSync(FICHIER_OFFRES) ? JSON.parse(fs.readFileSync(FICHIER_OFFRES, "utf8")) as OffreRelevee[] : [])
      .map((o) => [o.slug, o]));

  let nouveaux = 0, revus = 0, ecartes = 0, recherches = 0;
  for (const brut of marques) {
    const marque = nomMarque(brut);
    const aChercher: string[] = [brut];
    const faites = new Set<string>();
    const famillesVues = new Set<string>();
    let trouves = 0;

    while (aChercher.length && faites.size < RECHERCHES_MAX) {
      const q = aChercher.shift()!;
      if (faites.has(q.toLowerCase())) continue;
      faites.add(q.toLowerCase());
      recherches++;

      const rech = await page(`${BASE}/recherche.html?q=${encodeURIComponent(q)}`);
      await pause();
      if (!rech) continue;
      const fiches = [...new Set([...rech.matchAll(/href="(\/chaussures_[a-z]+\/[^"]*_fiche_\d+\.html)"/g)].map((m) => m[1].split("?")[0]))]
        .filter(vautLeCoup);

      for (const f of fiches) {
        // Déjà lue lors d'un passage précédent : on ne repaie pas la requête, mais on
        // relance quand même sa famille — elle peut ouvrir sur des modèles inconnus.
        if (vues[f] && !rafraichirPrix) {
          const fam = familleDe(vues[f]);
          if (fam && !famillesVues.has(fam.toLowerCase())) { famillesVues.add(fam.toLowerCase()); aChercher.push(`${brut} ${fam}`); }
          continue;
        }
        const html = await page(BASE + f);
        await pause();
        if (!html) continue;
        const t = lireFiche(html, f, marque);
        if (!t) { ecartes++; vues[f] = ""; continue; }
        vues[f] = t.fiche.nom;

        const ancien = deja[t.fiche.slug];
        deja[t.fiche.slug] = ancien ? {
          ...ancien,
          poidsG: ancien.poidsG ?? t.fiche.poidsG, dropMm: ancien.dropMm ?? t.fiche.dropMm,
          prixConseilleEur: t.fiche.prixConseilleEur ?? ancien.prixConseilleEur,
        plaqueCarbone: ancien.plaqueCarbone ?? t.fiche.plaqueCarbone,
          ean: ancien.ean ?? t.fiche.ean, nomExact: ancien.nomExact ?? t.fiche.nomExact,
          foulee: ancien.foulee ?? t.fiche.foulee, terrain: t.fiche.terrain,
          sources: [...new Set([...(ancien.sources ?? []), "i-run.fr"])],
        } : t.fiche;
        if (ancien) revus++; else { nouveaux++; trouves++; }
        if (t.prix != null && t.fiche.ean) {
          offres[t.fiche.slug] = { slug: t.fiche.slug, ean: t.fiche.ean, prix: t.prix, dispo: t.dispo, url: BASE + f };
        }
        console.log(`   ${ancien ? "·" : "+"} ${(marque + " " + t.fiche.nom).padEnd(38).slice(0, 38)} ${t.fiche.poidsG?.valeur ?? "?"} g · ${t.fiche.dropMm?.valeur ?? "?"} mm · ${t.prix ?? "?"} €${conseilleTexte(t)}`);

        // La famille du modèle trouvé devient une nouvelle recherche.
        const fam = familleDe(t.fiche.nom);
        if (fam && !famillesVues.has(fam.toLowerCase())) { famillesVues.add(fam.toLowerCase()); aChercher.push(`${brut} ${fam}`); }

        fs.writeFileSync(SORTIE, JSON.stringify(deja, null, 2));
        fs.writeFileSync(CACHE, JSON.stringify(vues, null, 2));
        fs.writeFileSync(FICHIER_OFFRES, JSON.stringify(Object.values(offres), null, 2));
      }
    }
    console.log(`■ ${marque} — ${faites.size} recherche(s), ${trouves} nouveau(x)`);
  }
  fs.writeFileSync(FICHIER_OFFRES, JSON.stringify(Object.values(offres), null, 2));
  console.log(`\n${nouveaux} modèle(s) découvert(s) · ${revus} complété(s) · ${ecartes} écarté(s) · ${recherches} recherche(s)`);
  console.log(`${Object.keys(offres).length} prix relevés · ${Object.keys(deja).length} modèles au catalogue`);
}

const conseilleTexte = (t: Trouvaille) =>
  t.fiche.prixConseilleEur ? ` (conseillé ${t.fiche.prixConseilleEur.valeur} €)` : "";

const pause = () => new Promise((r) => setTimeout(r, 1100));
if (require.main === module) void principal();
