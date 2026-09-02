/**
 * COLLECTE DES FICHES TECHNIQUES — un modèle de chaussure à la fois, sources à l'appui.
 *
 *   npx tsx scripts/collecte-specs.ts            # tous les modèles non encore renseignés
 *   npx tsx scripts/collecte-specs.ts "Hoka Clifton 10"
 *
 * ⚠️ CE SCRIPT N'ÉCRIT JAMAIS UNE VALEUR QU'IL N'A PAS VÉRIFIÉE. Trois filtres avant
 * d'accepter un nombre :
 *   · il vient d'une réponse ADOSSÉE À LA RECHERCHE (sources listées, sinon on jette) ;
 *   · il tombe dans les bornes physiques du champ (cf. BORNES) ;
 *   · il est cohérent avec les autres (le stack talon dépasse le drop).
 * Ce qui échoue reste VIDE et s'affichera « non communiqué ». Une case vide est honnête ;
 * un poids inventé ne l'est pas.
 *
 * ⚠️ DEUX APPELS, PAS UN. Gemini 2.5 dépense son budget de sortie en raisonnement : un
 * seul appel qui cherche ET met en forme rend une réponse tronquée au milieu d'un
 * nombre. Le premier appel cherche en prose, le second — sans recherche, sans
 * raisonnement — n'a plus qu'à recopier en JSON.
 */
import fs from "node:fs";
import path from "node:path";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
import { generateContent } from "../src/lib/ai/gemini";
import { dansLesBornes, coherenceStackDrop, sourceValide, type Modele } from "../src/lib/shop/modele";
import { MODELES_A_COLLECTER } from "./modeles-a-collecter";
import { prendreVerrou } from "../src/lib/shop/verrou";

const SORTIE = path.join(process.cwd(), "src/data/gear/chaussures.json");

function promptRecherche(m: { marque: string; nom: string }): string {
  return `Fiche technique de la chaussure de running « ${m.marque} ${m.nom} », déclinaison homme.
Consulte le site du fabricant et les revendeurs spécialisés français.
Indique précisément :
- le poids en grammes (taille de référence US 9 / EU 42)
- le drop en millimètres
- la hauteur de semelle au talon (stack) en millimètres
- la présence ou l'absence d'une plaque carbone
- le prix public conseillé en euros à sa sortie
- la durée de vie annoncée en kilomètres
Pour chaque valeur, cite le site où tu l'as lue. Si une valeur n'est publiée nulle part,
écris explicitement « non communiqué » : n'estime jamais, ne déduis jamais d'un modèle voisin.

Avant tout : si cette chaussure n'existe pas sous ce nom exact, réponds uniquement
MODELE INCONNU. Ne réponds JAMAIS avec les caractéristiques d'un modèle voisin ou d'une
autre génération — une fiche exacte pour un produit qui n'existe pas est le pire résultat
possible.`;
}

function promptExtraction(prose: string): string {
  return `Voici une fiche technique rédigée :

${prose.slice(0, 6000)}

Recopie-la en JSON strict, sans commentaire ni texte autour :
{"poidsG":nombre|null,"dropMm":nombre|null,"stackTalonMm":nombre|null,"plaqueCarbone":true|false|null,"prixConseilleEur":nombre|null,"dureeVieKm":nombre|null}
Mets null partout où le texte dit « non communiqué », hésite, ou ne donne pas la valeur.
N'invente aucun nombre absent du texte.`;
}

function jsonDe(t: string): Record<string, unknown> | null {
  const m = String(t).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { return null; }
}

/**
 * ⚠️ ON COMPLÈTE, ON N'ÉCRASE PAS. Premier jet : cette collecte reconstruisait la fiche à
 * partir de zéro et l'écrivait par-dessus l'existante. Constaté sur la Hoka Bondi 9 —
 * elle a perdu d'un coup son CODE-BARRES, son nom commercial exact et son type de
 * foulée, tous relevés chez un marchand. Le code-barres est la seule clé qui permettra
 * de recouper la même paire chez plusieurs enseignes : le perdre coûte bien plus que ce
 * que cette collecte apporte. Deux collectes qui alimentent la même fiche doivent
 * s'additionner, jamais se remplacer.
 *
 * Quand les deux sources donnent la même valeur, on garde CELLE DÉJÀ EN PLACE : elle a
 * été relevée dans un champ structuré, pas déduite d'une recherche.
 */
/**
 * LE CONTRÔLE CROISÉ DE LA RECHERCHE.
 *
 * ⚠️ MESURÉ : pour l'« Adizero Adios 9 », la recherche a rendu « 0 mm de drop » alors que
 * deux marchands s'accordent sur 7 mm. Un modèle de langage qui se trompe sur une valeur
 * VÉRIFIABLE n'est pas plus fiable sur celles qu'on ne peut pas vérifier — or c'est
 * précisément lui qui fournit la hauteur de semelle, la plaque carbone et le prix
 * conseillé, qu'aucune fiche marchande ne publie. On refuse donc TOUTE sa réponse pour ce
 * modèle plutôt que d'en garder la partie invérifiable.
 *
 * La tolérance sur le poids est large (la pointure de référence n'est jamais publiée) ;
 * celle sur le drop est serrée, c'est une cote de conception.
 */
export function contredit(ancien: Modele | undefined, neuf: Modele): string | null {
  if (!ancien) return null;
  const d = ancien.dropMm?.valeur, dn = neuf.dropMm?.valeur;
  if (d != null && dn != null && Math.abs(d - dn) > 1) return `drop ${d} mm connu, ${dn} mm annoncé`;
  const p = ancien.poidsG?.valeur, pn = neuf.poidsG?.valeur;
  if (p != null && pn != null && Math.abs(p - pn) > 45) return `poids ${p} g connu, ${pn} g annoncé`;
  return null;
}

export function fusionner(ancien: Modele | undefined, neuf: Modele): Modele {
  const garder = <T,>(a: T | undefined, n: T | undefined) => a ?? n;
  return {
    ...neuf,
    poidsG: garder(ancien?.poidsG, neuf.poidsG),
    dropMm: garder(ancien?.dropMm, neuf.dropMm),
    stackTalonMm: garder(ancien?.stackTalonMm, neuf.stackTalonMm),
    plaqueCarbone: garder(ancien?.plaqueCarbone, neuf.plaqueCarbone),
    prixConseilleEur: garder(ancien?.prixConseilleEur, neuf.prixConseilleEur),
    dureeVieKm: garder(ancien?.dureeVieKm, neuf.dureeVieKm),
    // Ces trois-là ne viennent QUE du marchand : rien ne peut les remplacer ici.
    ean: ancien?.ean ?? neuf.ean,
    nomExact: ancien?.nomExact ?? neuf.nomExact,
    foulee: ancien?.foulee ?? neuf.foulee,
    sources: [...new Set([...(ancien?.sources ?? []), ...neuf.sources])].slice(0, 8),
    sourceFabricant: ancien?.sourceFabricant || neuf.sourceFabricant,
  };
}

export async function collecter(m: (typeof MODELES_A_COLLECTER)[number]): Promise<Modele | null> {
  const rech = await generateContent(
    [{ role: "user", parts: [{ text: promptRecherche(m) }] }],
    { temperature: 0, maxOutputTokens: 2200 },
    { tools: [{ google_search: {} }] },
  );
  if (!rech.ok || !rech.text.trim()) return null;
  // ⚠️ UN NOM DE MODÈLE FAUX PRODUIT UNE FICHE VRAISEMBLABLE. Sans ce garde-fou, une
  // coquille dans la liste ferait décrire la génération voisine, avec des sources
  // authentiques à l'appui : la fiche paraîtrait irréprochable et serait fausse.
  if (/MODELE INCONNU/i.test(rech.text)) return null;

  // ⚠️ SANS SOURCE CONSULTÉE, LA RÉPONSE EST DE MÉMOIRE — donc invérifiable. On jette.
  const sources = (rech.sources ?? []).map((s: unknown) =>
    typeof s === "string" ? s : String((s as { url?: string; uri?: string })?.url ?? (s as { uri?: string })?.uri ?? "")
  ).filter(sourceValide);
  if (!sources.length) return null;

  const ext = await generateContent(
    [{ role: "user", parts: [{ text: promptExtraction(rech.text) }] }],
    { temperature: 0, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
  );
  if (!ext.ok) return null;
  const j = jsonDe(ext.text);
  if (!j) return null;

  const vu = new Date().toISOString().slice(0, 10);
  const mesure = <T,>(v: T | null | undefined) => (v == null ? undefined : { valeur: v, vu });
  // Le site du fabricant parmi les sources = relevé de première main. On le signale sans
  // l'exiger : beaucoup de marques ne publient pas le poids sur leur boutique française.
  const marqueNormalisee = m.marque.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sourceFabricant = sources.some((s) => s.toLowerCase().replace(/[^a-z0-9]/g, "").includes(marqueNormalisee));

  const nombre = (champ: "poidsG" | "dropMm" | "stackTalonMm" | "prixConseilleEur" | "dureeVieKm") => {
    const v = Number(j[champ]);
    return dansLesBornes(champ, v) ? Math.round(v * 10) / 10 : undefined;
  };
  const poidsG = nombre("poidsG"), dropMm = nombre("dropMm");
  let stackTalonMm = nombre("stackTalonMm");
  // Une semelle avant d'épaisseur négative n'existe pas : c'est la valeur lue qui est fausse.
  if (!coherenceStackDrop(stackTalonMm, dropMm)) stackTalonMm = undefined;

  return {
      slug: m.slug, marque: m.marque, nom: m.nom, annee: m.annee, terrain: m.terrain,
    poidsG: mesure(poidsG), dropMm: mesure(dropMm), stackTalonMm: mesure(stackTalonMm),
    plaqueCarbone: typeof j.plaqueCarbone === "boolean" ? mesure(j.plaqueCarbone) : undefined,
    prixConseilleEur: mesure(nombre("prixConseilleEur")), dureeVieKm: mesure(nombre("dureeVieKm")),
    sources: [...new Set(sources)].slice(0, 6), sourceFabricant,
  };
}

async function principal(): Promise<void> {
  prendreVerrou("collecte-specs");
  const filtre = process.argv[2]?.toLowerCase();
  const deja: Record<string, Modele> = fs.existsSync(SORTIE) ? JSON.parse(fs.readFileSync(SORTIE, "utf8")) : {};
  // ⚠️ « FICHE ABSENTE » N'EST PAS LE BON CRITÈRE. Une fiche peut exister — poids, drop,
  //    code-barres relevés chez le marchand — et n'avoir NI hauteur de semelle, NI
  //    présence de plaque, NI prix conseillé, qui ne figurent sur aucune fiche produit.
  //    Filtrer sur l'absence de fiche laissait donc 48 modèles définitivement incomplets
  //    en n'en proposant que 25, sans que rien ne le signale.
  const incomplet = (m: Modele | undefined) =>
    !m || !m.stackTalonMm || !m.plaqueCarbone || !m.prixConseilleEur;
  const liste = MODELES_A_COLLECTER.filter((m) =>
    filtre ? `${m.marque} ${m.nom}`.toLowerCase().includes(filtre) : incomplet(deja[m.slug]));
  console.log(`${liste.length} modèle(s) à collecter · ${Object.keys(deja).length} déjà en fiche`);

  let ok = 0, vides = 0;
  for (const m of liste) {
    try {
      const fiche = await collecter(m);
      if (!fiche) { vides++; console.log(`  ✗ ${m.marque} ${m.nom} — aucune donnée vérifiable`); continue; }
      const litige = contredit(deja[m.slug], fiche);
      if (litige) {
        vides++;
        console.log(`  ⚠ ${m.marque} ${m.nom} — RÉPONSE REJETÉE : ${litige}`);
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      deja[m.slug] = fusionner(deja[m.slug], fiche);
      ok++;
      // ⚠️ ON JOURNALISE CE QUI EST RETENU, PAS CE QUI A ÉTÉ PROPOSÉ. Le premier jet
      // affichait les valeurs brutes de la réponse : le journal annonçait « 0 mm » sur
      // une fiche où 7 mm avaient été conservés. Un journal qui décrit autre chose que
      // l'état réel fait chercher des défauts qui n'existent pas — et masque les vrais.
      const e = deja[m.slug];
      const r = [
        e.poidsG ? `${e.poidsG.valeur} g` : "poids ?",
        e.dropMm ? `${e.dropMm.valeur} mm` : "drop ?",
        e.stackTalonMm ? `stack ${e.stackTalonMm.valeur}` : "stack ?",
        e.prixConseilleEur ? `${e.prixConseilleEur.valeur} €` : "prix ?",
      ].join(" · ");
      console.log(`  ✓ ${(m.marque + " " + m.nom).padEnd(34)} ${r}`);
      fs.writeFileSync(SORTIE, JSON.stringify(deja, null, 2));
    } catch (e) { vides++; console.log(`  ✗ ${m.marque} ${m.nom} — ${String(e).slice(0, 60)}`); }
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log(`\n${ok} fiche(s) écrite(s), ${vides} sans donnée vérifiable · ${SORTIE}`);
}

if (require.main === module) void principal();
