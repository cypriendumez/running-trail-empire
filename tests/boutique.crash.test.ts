/**
 * CRASH-TESTS DE LA BOUTIQUE.
 *
 * La boutique précédente a été retirée parce qu'elle affichait 1 167 prix INVENTÉS
 * attribués à de vraies enseignes. Ce fichier existe pour que cela ne puisse pas
 * recommencer, sous aucune forme — y compris les formes subtiles : une valeur estimée à
 * la place d'une valeur manquante, une note « pour toi » calculée sans donnée
 * personnelle, un filtre qui écarte silencieusement ce qu'il ne connaît pas.
 *
 *   npx tsx tests/boutique.crash.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CATALOGUE, filtrer, trier, alternatives, normalise } from "../src/lib/shop/catalogue";
import { dansLesBornes, coherenceStackDrop, sourceValide, sourceCitable, sourcesCitables, domaineDe, BORNES, type Modele } from "../src/lib/shop/modele";
import { decrire, familleAmorti, familleMasse, familleDrop } from "../src/lib/shop/description";
import { evaluer, verdictDe, type ProfilAthlete } from "../src/lib/shop/pourToi";
import { partTrail, sortieLongueKm, semainesAvant, construireProfil } from "../src/lib/shop/profilAthlete";
import { meilleure, type Offre } from "../src/lib/shop/offres";
import { SHOP, texteShop, texteFoulee } from "../src/components/shop/shopI18n";
import { choisirFiche, caracteristiques, nombreDe, normaliser } from "../scripts/collecte-irun";
import { specsDe, desaccord, choisirProduit, nomDeUrl, TOLERANCE } from "../scripts/collecte-rw";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void): void {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message.split("\n")[0]}`); console.log(`  KO ${nom}`); }
}
/** Le source d'un fichier, commentaires ET imports retirés : sinon un test se contente de sa propre explication. */
function codeOf(f: string): string {
  return readFileSync(f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n")
    .split("\n").filter((l) => !/^\s*import\s/.test(l)).join("\n");
}

const modele = (p: Partial<Modele> = {}): Modele => ({
  slug: "x", marque: "Marque", nom: "Modèle", annee: 2025, terrain: "route", usage: "quotidien", sources: ["exemple.fr"], ...p,
});
const mes = <T,>(v: T) => ({ valeur: v, vu: "2026-09-02" });

console.log("\nCATALOGUE — aucune valeur sans source ni hors du possible");

test("chaque fiche publiée porte au moins une source", () => {
  for (const m of CATALOGUE) {
    assert.ok(m.sources?.length, `${m.marque} ${m.nom} : aucune source`);
    for (const s of m.sources) assert.ok(sourceValide(s), `${m.marque} ${m.nom} : source inutilisable « ${s} »`);
  }
});

test("aucune valeur du catalogue ne sort des bornes physiques", () => {
  // ⚠️ C'est le filet qui rattrape une conversion ratée ou le prix d'un lot pris pour
  // celui d'une paire. Une valeur hors bornes doit être ABSENTE, pas rabotée.
  for (const m of CATALOGUE) {
    for (const champ of Object.keys(BORNES) as (keyof typeof BORNES)[]) {
      const v = (m[champ] as { valeur: number } | undefined)?.valeur;
      if (v == null) continue;
      assert.ok(dansLesBornes(champ, v), `${m.marque} ${m.nom} : ${champ} = ${v}, hors [${BORNES[champ].join(", ")}]`);
    }
    assert.ok(coherenceStackDrop(m.stackTalonMm?.valeur, m.dropMm?.valeur),
      `${m.marque} ${m.nom} : semelle ${m.stackTalonMm?.valeur} mm pour un drop de ${m.dropMm?.valeur} mm — l'avant-pied aurait une épaisseur négative`);
  }
});

test("les bornes rejettent, elles ne rabotent pas", () => {
  // ⚠️ LE TEST PRÉCÉDENT PORTE SUR LES DONNÉES, PAS SUR LA FONCTION. Tant que le
  // catalogue est sain, il resterait vert même si `dansLesBornes` répondait « oui » à
  // tout — vérifié par mutation. Celui-ci teste la fonction elle-même.
  assert.ok(dansLesBornes("poidsG", 250));
  assert.ok(!dansLesBornes("poidsG", 25), "25 g accepté comme poids de chaussure");
  assert.ok(!dansLesBornes("poidsG", 2500), "2,5 kg accepté comme poids de chaussure");
  assert.ok(!dansLesBornes("dropMm", 40), "40 mm accepté comme drop");
  assert.ok(!dansLesBornes("prixConseilleEur", 1290), "un prix de lot accepté comme prix d'une paire");
  assert.ok(!dansLesBornes("poidsG", Number.NaN) && !dansLesBornes("poidsG", null));
  // Et la cohérence entre deux cotes justes prises séparément.
  assert.ok(!coherenceStackDrop(6, 8), "une semelle de 6 mm avec 8 mm de drop a été acceptée");
  assert.ok(coherenceStackDrop(40, 8));
  assert.ok(coherenceStackDrop(undefined, 8), "une cote absente ne peut pas être incohérente");
});

test("les identifiants du catalogue sont uniques", () => {
  const slugs = CATALOGUE.map((m) => m.slug);
  assert.equal(slugs.length, new Set(slugs).size, "deux modèles partagent le même identifiant : l'un écraserait l'autre");
});

test("un code-barres a la forme d'un code-barres", () => {
  // Un EAN mal formé casserait silencieusement le rapprochement avec les offres : la
  // fiche dirait « aucune offre » alors que l'enseigne en a une.
  for (const m of CATALOGUE) if (m.ean) assert.match(m.ean, /^\d{8,14}$/, `${m.marque} ${m.nom} : EAN « ${m.ean} »`);
});

test("aucune image de produit n'est référencée", () => {
  // Les visuels produit appartiennent aux marques et aux marchands. Le jour où l'un
  // d'eux réapparaît dans un composant, ce test doit rougir.
  for (const f of ["src/components/shop/GearHub.tsx", "src/components/shop/SemelleProfil.tsx",
    "src/app/dashboard/shop/page.tsx", "src/app/dashboard/shop/[slug]/page.tsx"]) {
    const src = codeOf(f);
    assert.ok(!/<img\b/.test(src) && !/next\/image/.test(src), `${f} affiche une image`);
    assert.ok(!/image_url/.test(src), `${f} lit une URL d'image de marchand`);
  }
});

console.log("\nPRIX — une offre, ou rien");

test("la page boutique n'affiche aucun prix hors product_offers", () => {
  const route = codeOf("src/app/dashboard/shop/[slug]/page.tsx");
  const fiche = codeOf("src/components/shop/FicheModele.tsx");
  assert.ok(/offresPour\(/.test(route), "la route ne lit pas les offres importées");
  assert.ok(/prixConseilleEur/.test(fiche) && /shop\.spec\.prix/.test(fiche),
    "le prix fabricant doit être étiqueté « conseillé », sinon il se lit comme un prix marchand");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.match(SHOP[lang]["shop.spec.prix"], /conseill|recomm?end|empfehl|preisempfehlung/i,
      `${lang} : le libellé du prix fabricant ne dit pas qu'il est conseillé`);
  // Aucun montant en dur : c'est exactement ce que faisait l'ancien catalogue.
  for (const f of ["src/components/shop/FicheModele.tsx", "src/components/shop/GearHub.tsx"])
    assert.ok(!/\b\d{2,3}[.,]\d{2}\s*€/.test(codeOf(f)), `un montant est écrit en dur dans ${f}`);
});

test("une lecture d'offres en échec ne se lit pas comme « aucune offre »", () => {
  // Les deux se soldent par une liste vide : sans distinction, une panne de base
  // afficherait « aucune offre marchande » — une affirmation fausse.
  const src = codeOf("src/lib/shop/offres.ts");
  assert.ok(/throw new Error/.test(src), "une erreur PostgREST est avalée et rendue comme liste vide");
  const fiche = codeOf("src/app/dashboard/shop/[slug]/page.tsx");
  assert.ok(/offresLisibles/.test(fiche), "la fiche ne distingue pas l'échec de lecture de l'absence d'offre");
});

test("la meilleure offre ignore les indisponibles et les prix illisibles", () => {
  const o = (retailer: string, price: unknown, in_stock: boolean | null): Offre =>
    ({ retailer, price: price as number, currency: "EUR", url: "https://x.fr", in_stock, updated_at: "" });
  assert.equal(meilleure([o("A", 120, true), o("B", 90, false), o("C", 100, true)])?.retailer, "C",
    "une offre en rupture a été présentée comme la meilleure");
  assert.equal(meilleure([o("A", "n/c", true)]), null, "un prix illisible a été retenu");
  assert.equal(meilleure([]), null);
});

console.log("\nFILTRES ET TRI — l'inconnu n'est pas une valeur");

test("un filtre n'écarte jamais une fiche pour cause de donnée manquante", () => {
  // ⚠️ « Moins de 250 g » ne veut pas dire « et tant pis pour celles dont le poids n'est
  // pas publié » : l'athlète en déduirait qu'elles pèsent plus lourd.
  const connu = modele({ slug: "a", poidsG: mes(230) });
  const inconnu = modele({ slug: "b" });
  const r = filtrer([connu, inconnu], { poidsMax: 250 });
  assert.equal(r.length, 2, "une fiche sans poids a été écartée par un filtre de poids");
  assert.equal(filtrer([modele({ slug: "c", poidsG: mes(300) }), inconnu], { poidsMax: 250 }).length, 1,
    "le filtre ne retient plus rien : il ne filtre plus");
});

test("le filtre « plaque carbone » écarte l'inconnu, et le dit à l'écran", () => {
  const avec = modele({ slug: "a", plaqueCarbone: mes(true) });
  const inconnu = modele({ slug: "b" });
  assert.equal(filtrer([avec, inconnu], { plaqueCarbone: true }).length, 1);
  // L'avertissement est un texte traduit : on vérifie qu'il est RENDU (la clé est
  // appelée dans l'écran) ET qu'il existe dans les cinq langues, pas sa formulation
  // française — sinon le test tomberait à la première reformulation.
  assert.ok(/tx\("shop\.plaque_avert"\)/.test(readFileSync("src/components/shop/GearHub.tsx", "utf8")),
    "l'écran n'avertit pas que ce filtre écarte les modèles inconnus");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.ok(SHOP[lang]["shop.plaque_avert"], `avertissement absent en ${lang}`);
});

test("une fiche sans la valeur de tri part EN DERNIER, jamais en tête", () => {
  const a = modele({ slug: "a", poidsG: mes(300) });
  const b = modele({ slug: "b" });
  const c = modele({ slug: "c", poidsG: mes(200) });
  assert.deepEqual(trier([a, b, c], "poids").map((m) => m.slug), ["c", "a", "b"],
    "un modèle au poids inconnu s'est classé comme le plus léger");
});

test("la recherche ignore accents et casse", () => {
  assert.equal(normalise("Hoka Cliftôn"), "hoka clifton");
  assert.equal(filtrer([modele({ marque: "Hoka", nom: "Clifton 10" })], { q: "hoka clif" }).length, 1);
  assert.equal(filtrer([modele({ marque: "Hoka", nom: "Clifton 10" })], { q: "asics" }).length, 0);
});

test("une alternative n'est proposée que si elle est comparable", () => {
  // Deux fiches vides auraient une « distance » nulle et arriveraient en tête des
  // alternatives, alors qu'on ignore tout d'elles.
  const ref = modele({ slug: "ref", poidsG: mes(250), dropMm: mes(8) });
  const vide = modele({ slug: "vide" });
  const proche = modele({ slug: "proche", poidsG: mes(255), dropMm: mes(8) });
  const r = alternatives(ref, [ref, vide, proche]);
  assert.deepEqual(r.map((m) => m.slug), ["proche"], "une fiche sans aucune cote a été proposée comme alternative");
});

console.log("\nDESCRIPTION — pas de valeur, pas de phrase");

/** Le texte rendu d'une description, dans une langue donnée. */
function texteDe(m: Parameters<typeof decrire>[0], lang = "fr"): string {
  return decrire(m).bouts.map((b) => texteShop(lang, b.cle, b.params
    ? Object.fromEntries(Object.entries(b.params).map(([k, v]) =>
      [k, typeof v === "string" && v.startsWith("shop.") ? texteShop(lang, v) : v]))
    : undefined)).join(" ");
}

test("la description n'invente aucune phrase sur une donnée absente", () => {
  const { bouts, manquantes } = decrire(modele());
  // Deux bouts seulement : l'identité et le terrain, qui ne dépendent d'aucune mesure.
  assert.equal(bouts.length, 2, "une chaussure sans aucune cote produit plus que son identité");
  assert.ok(manquantes.includes("shop.spec.poids") && manquantes.includes("shop.spec.drop"),
    "les données absentes ne sont pas listées");
  const texte = texteDe(modele());
  assert.ok(!/\d+\s?(g|mm|km)\b/.test(texte), `un nombre apparaît sans donnée pour l'étayer : ${texte}`);
});

test("chaque nombre du texte vient de la fiche", () => {
  const m = modele({ poidsG: mes(238), dropMm: mes(6), stackTalonMm: mes(39), dureeVieKm: mes(700) });
  const texte = texteDe(m);
  const permis = new Set(["238", "6", "39", "700", "8", "10", "200", "300", "40"]); // repères cités dans les phrases
  for (const n of texte.match(/\b\d+\b/g) ?? [])
    assert.ok(permis.has(n), `le texte cite « ${n} », qui ne vient pas de la fiche : ${texte}`);
  assert.ok(!texte.includes("{"), `un paramètre n'a pas été remplacé : ${texte}`);
});

test("aucune clé produite ne manque à une des cinq langues", () => {
  // ⚠️ SANS CE TEST, UNE PHRASE MANQUANTE S'AFFICHE EN FRANÇAIS SANS RIEN SIGNALER. Le
  // contrôle d'i18n général n'inspecte que les fichiers `.tsx` : les phrases produites
  // par les moteurs lui échappent entièrement.
  const cles = new Set<string>();
  const profils: ProfilAthlete[] = [
    {}, { partTrail: 0.8, volumeHebdoKm: 70, vma: 18, objectifKm: 45, semainesAvantCourse: 6, dropsEnRotation: [10],
      rotation: [{ marque: "A", modele: "B", km: 500, maxKm: 550 }, { marque: "C", modele: "D", km: 540, maxKm: 560 }] },
    { partTrail: 0.05, volumeHebdoKm: 20, vma: 12, objectifKm: 10, semainesAvantCourse: 30, dropsEnRotation: [4],
      rotation: [{ marque: "A", modele: "B", km: 500, maxKm: 550 }] },
  ];
  for (const terrain of ["route", "trail"] as const)
    for (const usage of ["quotidien", "tempo", "competition", "trail_court", "trail_long", "amorti_max", "polyvalent"] as const)
      for (const stack of [undefined, mes(22), mes(45)])
        for (const plaque of [undefined, mes(true), mes(false)]) {
          const m = modele({ terrain, usage, stackTalonMm: stack, plaqueCarbone: plaque, poidsG: mes(240), dropMm: mes(6), dureeVieKm: mes(700) });
          for (const b of decrire(m).bouts) cles.add(b.cle);
          for (const x of decrire(m).manquantes) cles.add(x);
          for (const p of profils) {
            const a = evaluer(m, p);
            cles.add(a.verdict);
            // La carte affiche une variante COURTE du verdict : sans elle, le libellé
            // renverrait à des « réserves ci-dessous » qui n'existent pas sur une carte.
            cles.add(a.verdict.replace("shop.v.", "shop.vc."));
            for (const b of [...a.pour, ...a.contre, ...a.inconnu]) cles.add(b.cle);
          }
        }
  assert.ok(cles.size > 30, `couverture trop faible : ${cles.size} clés explorées`);
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const absentes = [...cles].filter((k) => !(k in SHOP[lang]));
    assert.equal(absentes.length, 0, `${lang} : ${absentes.length} clé(s) absente(s) — ${absentes.slice(0, 5).join(", ")}`);
  }
});

test("aucun texte des cinq langues ne laisse un paramètre non rempli", () => {
  // Un « {km} » à l'écran est le signe qu'une langue a été traduite sans son paramètre.
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    for (const [cle, valeur] of Object.entries(SHOP[lang])) {
      const attendus = [...(SHOP.fr[cle] ?? "").matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");
      const trouves = [...valeur.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");
      assert.equal(trouves, attendus, `${lang} « ${cle} » : paramètres ${trouves || "aucun"} au lieu de ${attendus || "aucun"}`);
    }
});

test("une semelle au-dessus de 40 mm n'est pas annoncée homologuée en compétition", () => {
  // ⚠️ VU À L'ÉCRAN : « la semelle atteint la limite autorisée » sur la Clifton 10, dont
  // les 42 mm DÉPASSENT le plafond de 40 mm de World Athletics. Laisser croire qu'une
  // chaussure est homologuée alors qu'elle ne l'est pas peut coûter une disqualification.
  const m = modele({ stackTalonMm: mes(42), dropMm: mes(8), poidsG: mes(260) });
  const bout = decrire(m).bouts.find((b) => b.cle === "shop.d.amorti.maximal");
  assert.ok(bout, "une semelle de 42 mm n'est pas classée en amorti maximal");
  assert.equal(bout!.params?.stack, 42, "la hauteur réelle n'accompagne pas la phrase");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    const t = texteShop(lang, "shop.d.amorti.maximal", { stack: 42 });
    assert.ok(t.includes("40"), `${lang} : le plafond de 40 mm n'est pas cité`);
    assert.ok(t.includes("42"), `${lang} : la hauteur du modèle n'est pas citée`);
  }
});

test("les familles d'amorti et de masse suivent des seuils, pas des impressions", () => {
  assert.equal(familleAmorti(undefined), null);
  assert.equal(familleAmorti(22), "fin");
  assert.equal(familleAmorti(30), "modere");
  assert.equal(familleAmorti(38), "genereux");
  assert.equal(familleAmorti(44), "maximal");
  assert.equal(familleMasse(undefined), null);
  assert.equal(familleMasse(190), "plume");
  assert.equal(familleMasse(320), "lourde");
});

test("le drop est expliqué par ce qu'il change, pas par un adjectif", () => {
  assert.equal(familleDrop(4), "bas");
  assert.equal(familleDrop(6), "intermediaire");
  assert.equal(familleDrop(8), "courant");
  assert.equal(familleDrop(11), "haut");
  assert.match(texteShop("fr", "shop.d.drop.bas", { drop: 4 }), /mollet|Achille/i);
  assert.match(texteShop("fr", "shop.d.drop.haut", { drop: 11 }), /genou/i);
});

console.log("\nAVIS PERSONNEL — sans donnée, pas de conseil personnel");

test("un athlète sans historique reçoit un avis qui se dit incomplet", () => {
  const a = evaluer(modele({ plaqueCarbone: mes(true) }), {});
  assert.ok(a.inconnu.length >= 3, "aucun manque n'est signalé alors qu'on ne sait rien de l'athlète");
  assert.ok(a.verdict === "shop.v.partiel" || a.verdict === "shop.v.rien", `verdict trompeur sur un profil vide : « ${a.verdict} »`);
});

test("une plaque carbone est déconseillée quand la VMA ne la rentabilise pas", () => {
  // La plaque travaille par flexion : sous ~15 km/h de VMA elle rigidifie le pied sans
  // rendre l'économie de course qu'elle promet. Ce n'est pas un jugement, c'est mécanique.
  const p: ProfilAthlete = { vma: 12.5, partTrail: 0.1, volumeHebdoKm: 30, objectifKm: 10, semainesAvantCourse: 8, dropsEnRotation: [8] };
  const lente = evaluer(modele({ plaqueCarbone: mes(true), usage: "competition" }), p);
  assert.ok(lente.contre.some((x) => x.cle === "shop.a.plaque_ko"), "aucune réserve sur la plaque à 12,5 km/h de VMA");
  const rapide = evaluer(modele({ plaqueCarbone: mes(true), usage: "competition" }), { ...p, vma: 18 });
  assert.ok(rapide.pour.some((x) => x.cle === "shop.a.plaque_ok"), "aucun argument pour la plaque à 18 km/h de VMA");
  assert.ok(rapide.score > lente.score, "la VMA ne change rien au score : le conseil n'est pas personnalisé");
});

test("une chaussure de trail est déconseillée à qui court sur route", () => {
  const route: ProfilAthlete = { partTrail: 0.05, volumeHebdoKm: 40 };
  const a = evaluer(modele({ terrain: "trail", usage: "trail_court" }), route);
  assert.ok(a.contre.some((x) => x.cle === "shop.a.trail_ko"));
  assert.ok(evaluer(modele({ terrain: "trail" }), { partTrail: 0.8 }).score > a.score);
});

test("un écart de drop important est signalé comme une transition à gérer", () => {
  const a = evaluer(modele({ dropMm: mes(4) }), { dropsEnRotation: [10, 10] });
  assert.ok(a.contre.some((x) => x.cle === "shop.a.drop_ecart"), "aucun avertissement sur 6 mm d'écart de drop");
  assert.ok(evaluer(modele({ dropMm: mes(9) }), { dropsEnRotation: [10, 10] }).contre.every((x) => x.cle !== "shop.a.drop_ecart"));
});

test("le verdict dépend de ce qu'on sait, pas seulement du score", () => {
  assert.equal(verdictDe(90, 4, 2, 0), "shop.v.partiel", "un score élevé sur quatre inconnues se présente comme un conseil sûr");
  assert.equal(verdictDe(90, 0, 3, 0), "shop.v.bien");
  assert.equal(verdictDe(20, 0, 0, 3), "shop.v.eviter");
});

console.log("\nPROFIL ATHLÈTE — mesuré, jamais supposé");

test("aucun champ du profil n'est rempli par défaut", () => {
  // ⚠️ C'est le défaut de l'amorce `ctl = 40` du tableau de bord, transposé : une valeur
  // « en attendant » produit un conseil qui a l'air personnel et ne l'est pas.
  const p = construireProfil({ seances: [], paires: [] });
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) { assert.equal(v.length, 0, `${k} n'est pas vide sur un compte vierge`); continue; }
    assert.equal(v, null, `${k} vaut ${v} alors qu'aucune donnée ne le justifie`);
  }
});

test("la part de trail se déduit du dénivelé, pas du seul libellé de la montre", () => {
  // Beaucoup de montres enregistrent un trail en « run » : se fier au sport seul
  // classerait un coureur de montagne comme routier.
  const s = (d: number, km: number) => ({ date: "2026-08-01", distance_km: km, sport: "run", elevation_gain_m: d });
  assert.equal(partTrail([s(600, 12), s(500, 10), s(700, 14), s(10, 10), s(5, 8)]), 3 / 5);
  assert.equal(partTrail([s(600, 12)]), null, "un échantillon de une sortie a produit une part de trail");
  assert.equal(partTrail([{ date: "2026-08-01", distance_km: 10, sport: "run" }, { date: "2026-08-02", distance_km: 10, sport: "run" },
    { date: "2026-08-03", distance_km: 10, sport: "run" }, { date: "2026-08-04", distance_km: 10, sport: "run" },
    { date: "2026-08-05", distance_km: 10, sport: "run" }]), null,
    "sans dénivelé, des sorties ont quand même été classées");
});

test("une course passée ne produit pas un compte à rebours", () => {
  const now = new Date("2026-09-02T12:00:00Z");
  assert.equal(semainesAvant("2026-10-04", now), 4);
  assert.equal(semainesAvant("2026-08-01", now), null, "une course passée reste comptée comme à venir");
  assert.equal(semainesAvant("date bidon", now), null);
});

test("la sortie longue se lit sur la fenêtre demandée, pas sur tout l'historique", () => {
  const now = Date.now();
  const j = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);
  const s = [{ date: j(10), distance_km: 22, sport: "run" }, { date: j(300), distance_km: 42, sport: "run" }];
  assert.equal(sortieLongueKm(s), 22, "une sortie vieille de dix mois a été présentée comme la sortie longue actuelle");
});

test("le vélo ne compte pas comme une sortie de course à pied", () => {
  const p = construireProfil({
    seances: [{ date: new Date().toISOString().slice(0, 10), distance_km: 90, sport: "bike" }], paires: [],
  });
  assert.equal(p.sortieLongueKm, null, "90 km de vélo sont devenus une sortie longue à pied");
});

console.log("\nCOLLECTE — la fiche décrite doit être LA bonne");

test("une variante n'est jamais prise pour le modèle", () => {
  // ⚠️ « Clifton 10 » ramène « Clifton 10 Wide » et « Clifton 10 GTX » : d'autres
  // chaussures, d'autres poids. Même leçon que sur le catalogue de courses, où « Kids
  // trail d'Antibes » avait failli hériter du 40 km de l'épreuve adulte.
  const liens = [
    "/chaussures_homme/Running_c23/Hoka-One-One_m143/Hoka-One-One-Clifton-10-Wide_Hoka-One-One_fiche_1.html",
    "/chaussures_homme/Running_c23/Hoka-One-One_m143/Hoka-One-One-Clifton-10_Hoka-One-One_fiche_2.html",
  ];
  assert.match(choisirFiche(liens, "Hoka", "Clifton 10")!, /fiche_2/);
  assert.equal(choisirFiche([liens[0]], "Hoka", "Clifton 10"), null, "la variante Wide a été acceptée");
});

test("la déclinaison FEMME n'alimente pas la fiche homme", () => {
  // Le marchand suffixe « -M » et « -W ». Le poids publié n'est pas le même.
  const w = "/chaussures_femme/Trail_c15/Inov-8_m1/Inov-8-TrailFly-Ultra-G-280-W_Inov-8_fiche_1.html";
  const h = "/chaussures_homme/Trail_c15/Inov-8_m1/Inov-8-TrailFly-Ultra-G-280-M_Inov-8_fiche_2.html";
  assert.equal(choisirFiche([w], "Inov-8", "Trailfly Ultra G 280"), null, "la déclinaison femme a alimenté la fiche");
  assert.match(choisirFiche([w, h], "Inov-8", "Trailfly Ultra G 280")!, /fiche_2/);
});

test("les libellés de marque divergents ne bloquent pas l'appariement", () => {
  // Le marchand dit « Hoka One One » là où l'on dit « Hoka » : comparés d'un bloc,
  // AUCUN modèle ne correspondait — le script tournait sans rien trouver.
  const l = "/chaussures_homme/Running_c23/Hoka-One-One_m143/Hoka-One-One-Clifton-10_Hoka-One-One_fiche_1.html";
  assert.ok(choisirFiche([l], "Hoka", "Clifton 10"));
  assert.equal(choisirFiche([l], "Asics", "Clifton 10"), null, "une marque étrangère a été acceptée");
  assert.equal(normaliser("Inov-8"), "inov 8");
});

test("les caractéristiques se lisent dans le balisage, pas dans la prose", () => {
  const html = `<li class="prdDtl__summary__item prdDtl__summary__item--drop "> <span>Drop :</span> 5 mm </li>
    <li class="prdDtl__summary__item prdDtl__summary__item--weight last"> <span>Poids :</span>255g </li>`;
  const c = caracteristiques(html);
  assert.equal(nombreDe(c.drop), 5);
  assert.equal(nombreDe(c.weight), 255);
  assert.equal(nombreDe(undefined), undefined);
  assert.equal(nombreDe("non communiqué"), undefined);
});

test("les deux balisages de la seconde source sont lus", () => {
  // ⚠️ DEUX BALISAGES COEXISTENT SUR LE MÊME SITE : liste pour les modèles récents,
  // tableau pour les anciens. Un lecteur qui n'en connaît qu'un rend un objet vide sans
  // erreur — la Clifton 10 était « sans hauteur publiée » alors que la page l'affichait.
  const tableau = `<td>Weight:</td><td>9.1 oz<br />258 g</td><td>Heel Stack:</td><td>43 mm</td><td>Forefoot Stack:</td><td>35 mm</td><td>Heel-Toe Offset:</td><td>8 mm</td>`;
  const liste = `<li><strong>Weight: </strong>9.2 oz | 261 g</li><li><strong>Heel Stack: </strong>43 mm</li><li><strong>Forefoot Stack: </strong>35 mm</li><li><strong>Heel-Toe Offset:</strong> 8 mm</li>`;
  for (const [nom, html] of [["tableau", tableau], ["liste", liste]] as const) {
    const r = specsDe(html);
    assert.equal(r.stackTalonMm, 43, `${nom} : hauteur de talon non lue`);
    assert.equal(r.dropMm, 8, `${nom} : drop non lu`);
    assert.ok(r.poidsG === 258 || r.poidsG === 261, `${nom} : le poids en ONCES a été pris pour des grammes (${r.poidsG})`);
  }
});

test("un champ absent ne prend pas la valeur du champ suivant", () => {
  // Sans la borne au libellé suivant, « Heel Stack » vide aurait pris les 35 mm de
  // « Forefoot Stack » : une hauteur de talon fausse, sans la moindre alerte.
  const r = specsDe(`<li><strong>Weight: </strong>261 g</li><li><strong>Heel Stack: </strong>non publié</li><li><strong>Forefoot Stack: </strong>35 mm</li>`);
  assert.equal(r.stackTalonMm, undefined, "la hauteur de talon a été prise sur le champ voisin");
  assert.equal(r.stackAvantMm, 35);
});

test("le contrôle croisé porte sur le drop, pas sur le poids", () => {
  // ⚠️ MESURÉ SUR SEPT MODÈLES : les deux sources donnent des poids écartés de 22 à 38 g
  // pour la même chaussure, parce qu'aucune ne publie la pointure de référence. Rejeter
  // là-dessus écartait des appariements JUSTES. Le drop, lui, est une cote de conception.
  const m = modele({ poidsG: mes(245), dropMm: mes(4) });
  assert.equal(desaccord(m, { poidsG: 283, dropMm: 4 }), null, "un écart de poids a rejeté un appariement juste");
  assert.ok(desaccord(m, { poidsG: 246, dropMm: 8 }), "un drop de 8 mm face à 4 mm n'a pas été rejeté");
  assert.equal(desaccord(undefined, { dropMm: 8 }), null);
  assert.ok(TOLERANCE.dropMm <= 1, "la tolérance de drop doit rester serrée : c'est le seul contrôle d'identité");
});

test("une variante n'est pas prise pour le modèle chez la seconde source non plus", () => {
  const urls = [
    "https://x/HOKA_Clifton_11_Wide/descpage-A.html",
    "https://x/HOKA_Clifton_11/descpage-B.html",
    "https://x/HOKA_Clifton_11_GTX/descpage-C.html",
  ];
  assert.match(choisirProduit(urls, "Hoka", "Clifton 11")!, /descpage-B/);
  assert.equal(choisirProduit([urls[0], urls[2]], "Hoka", "Clifton 11"), null, "une variante a été acceptée");
  assert.equal(choisirProduit(["https://x/HOKA_Clifton_11_Womens/descpage-D.html"], "Hoka", "Clifton 11"), null,
    "la déclinaison femme a été acceptée");
  assert.equal(nomDeUrl("https://x/HOKA_Clifton_11/descpage-B.html"), "hoka clifton 11");
});

test("un écart de poids entre sources est AFFICHÉ, pas tranché en silence", () => {
  const fiche = readFileSync("src/components/shop/FicheModele.tsx", "utf8");
  assert.ok(/poidsG\?\.autre/.test(fiche), "la fiche ne signale pas qu'une autre source donne un autre poids");
  for (const lang of ["fr", "en", "de", "es", "pt"] as const)
    assert.ok(SHOP[lang]["shop.poids_ecart"]?.includes("{autre}"), `${lang} : la note d'écart n'affiche pas l'autre valeur`);
});

test("un refus de la source arrête la collecte au lieu d'insister", () => {
  // ⚠️ APRÈS ~90 REQUÊTES, la source a répondu 406 sur les fiches produit alors que son
  // accueil répondait 200 : c'est une limite de débit, donc un « non ». Le premier jet le
  // traitait comme une panne et enchaînait les quarante suivantes.
  const src = codeOf("scripts/collecte-rw.ts");
  assert.ok(/406/.test(src) && /429/.test(src), "les codes de refus ne sont pas reconnus");
  assert.ok(/class Refus/.test(src) && /instanceof Refus/.test(src), "le refus n'interrompt pas la boucle");
});

test("la collecte ne recopie ni prix, ni texte, ni note du marchand", () => {
  // On prend les FAITS du produit (poids, drop, code-barres) ; le prix relève d'une
  // relation commerciale qui n'existe pas, le texte et les appréciations sont le
  // travail éditorial du marchand.
  const src = codeOf("scripts/collecte-irun.ts");
  for (const interdit of ["offers", "\"price\"", "aggregateRating", "prod?.description", "j.description"])
    assert.ok(!src.includes(interdit), `la collecte lit « ${interdit} » chez le marchand`);
});

console.log("\nSOURCES");

test("un domaine seul reste une source, une phrase n'en est pas une", () => {
  // ⚠️ Exiger « https:// » a fait rejeter CHAQUE fiche collectée : la recherche rend
  // souvent le domaine seul. Le script tournait, ne se plaignait de rien, n'écrivait rien.
  assert.ok(sourceValide("hoka.com") && sourceValide("https://www.i-run.fr/x"));
  assert.ok(!sourceValide("de mémoire") && !sourceValide("") && !sourceValide("source interne"));
  assert.equal(domaineDe("https://www.i-run.fr/x"), "i-run.fr");
  assert.equal(domaineDe("hoka.com"), "hoka.com");
  assert.equal(domaineDe("pas une source"), "");
});

test("le pluriel n'est pas écrit « modèle(s) »", () => {
  // Un « (s) » sur une page premium se remarque ; et dans plusieurs langues il n'existe pas.
  for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
    assert.ok(SHOP[lang]["shop.n_modeles_un"] && SHOP[lang]["shop.n_modeles_plusieurs"], `pluriel absent en ${lang}`);
    assert.ok(!/\(s\)/.test(SHOP[lang]["shop.n_modeles_un"]) && !/\(s\)/.test(SHOP[lang]["shop.n_modeles_plusieurs"]));
  }
  assert.ok(/n_modeles_plusieurs/.test(readFileSync("src/components/shop/GearHub.tsx", "utf8")),
    "l'écran n'utilise pas la forme plurielle");
});

test("une vidéo n'est pas une source de fiche technique", () => {
  // ⚠️ CONSTATÉ À L'ÉCRAN sur la Clifton 10 : « Relevé sur youtube.com, rei.com… ».
  // Une source non consultable abîme la seule chose qui donne du prix au reste : le fait
  // que le lecteur puisse aller vérifier lui-même.
  assert.ok(!sourceCitable("youtube.com") && !sourceCitable("m.youtube.com") && !sourceCitable("reddit.com"));
  assert.ok(sourceCitable("hoka.com") && sourceCitable("i-run.fr") && sourceCitable("rei.com"),
    "un revendeur étranger publie bien la fiche produit : il ne doit pas être écarté");
  assert.deepEqual(sourcesCitables(["youtube.com", "hoka.com", "reddit.com"]), ["hoka.com"]);
  assert.deepEqual(sourcesCitables(undefined), []);
  // Et l'écran doit passer par ce filtre, pas afficher `m.sources` brut.
  const fiche = readFileSync("src/components/shop/FicheModele.tsx", "utf8");
  assert.ok(/sourcesCitables\(m\.sources\)/.test(fiche), "la fiche affiche les sources sans les filtrer");
  assert.ok(!/m\.sources\.join/.test(fiche), "la fiche affiche encore la liste brute des sources");
});

test("une date affichée n'est pas au format machine", () => {
  const fiche = readFileSync("src/components/shop/FicheModele.tsx", "utf8");
  assert.ok(/dateLisible\(/.test(fiche), "la date de relevé s'affiche au format ISO");
});

test("une étiquette venue des DONNÉES se traduit aussi", () => {
  // ⚠️ « Neutre » s'affichait tel quel sur la fiche d'un athlète allemand. Le contrôle
  // d'i18n ne pouvait rien voir : la chaîne ne vient pas du code, elle vient de la
  // source. Les seules valeurs présentes au catalogue sont vérifiées ci-dessous.
  const vues = [...new Set(CATALOGUE.map((m) => m.foulee).filter(Boolean))] as string[];
  for (const v of vues)
    for (const lang of ["fr", "en", "de", "es", "pt"] as const) {
      const t = texteFoulee(lang, v);
      assert.ok(t, `« ${v} » ne produit rien en ${lang}`);
      if (lang !== "fr") assert.notEqual(t, v, `« ${v} » reste en français en ${lang}`);
    }
  assert.equal(texteFoulee("fr", undefined), null, "une valeur absente produit un badge vide");
  // Une valeur inconnue est rendue telle quelle : mieux vaut un mot en français qu'une
  // caractéristique qui disparaît sans explication.
  assert.equal(texteFoulee("de", "Supination"), "Supination");
});

test("le catalogue existe et n'est pas vide", () => {
  assert.ok(existsSync("src/data/gear/chaussures.json"));
  assert.ok(CATALOGUE.length >= 50, `catalogue trop maigre : ${CATALOGUE.length} modèles`);
});

console.log(`\n${passed} crash-test(s) de la boutique passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log(`  KO ${f}`); process.exit(1); }
