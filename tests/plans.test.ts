/**
 * LES PLANS TOUT CONSTRUITS — CE QUI EST PROMIS DEHORS DOIT EXISTER DEDANS.
 *
 * ⚠️ DÉFAUT RÉEL, RELEVÉ LE 17/09/2026 EN COMPARANT LA LANDING AU CODE. La page d'accueil
 * vend neuf « programmes ». Cinq seulement existaient, et uniquement sous forme d'objectif
 * de COURSE : le macro-plan du coach rend un tableau vide sans date de course. « Débuter »,
 * « Améliorer sa vitesse » et « Reprendre après blessure » ne reposaient sur rien, et le
 * mode perte de poids n'avait pas de progression à montrer.
 *
 * Ces tests tiennent les deux bouts : les neuf cartes ont un programme, et chaque plan
 * généré respecte la physiologie que le projet applique déjà ailleurs (+10 %/semaine,
 * décharge une semaine sur quatre, sortie longue plafonnée, pas de qualité en reprise).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROGRAMMES, genererPlan, niveauDeVma, volumeTotal, HAUSSE_MAX, CYCLE_DECHARGE, PLAFOND_MONTEE,
  type CleProgramme,
} from "../src/lib/plans/catalogue";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

console.log("\nPLANS TOUT CONSTRUITS — la landing promet, le catalogue livre");

const TOUTES = Object.keys(PROGRAMMES) as CleProgramme[];

test("les neuf cartes de la landing ont toutes un programme réel", () => {
  // La landing nomme ses cartes dans `landingI18n` (items). Si quelqu'un en ajoute une
  // là-bas sans programme ici, la promesse repart dans le vide — c'est exactement le
  // défaut d'origine, et c'est ce test qui doit le dire.
  const landing = readFileSync("src/components/landing/landingI18n.ts", "utf8");
  // On délimite le bloc `items` en comptant les accolades, plutôt qu'en se fiant à
  // l'indentation (fausse au premier reformatage) ou au premier « }, » rencontré (qui
  // ferme la PREMIÈRE carte, pas le bloc). D'autres blocs de la landing — `sync`,
  // `pillars`, `cta` — commencent eux aussi par `title:` et seraient pris à tort.
  // ⚠️ On part du dictionnaire FRANÇAIS, pas du début du fichier : le premier `items: {`
  // rencontré est celui de la DÉCLARATION DE TYPE, où les cartes n'ont pas de valeurs.
  // Premier jet du test : il lisait le type et ne trouvait qu'une seule carte.
  const frBloc = landing.indexOf("const fr:");
  assert.ok(frBloc > 0, "le dictionnaire français de la landing est introuvable");
  const debut = landing.indexOf("items: {", frBloc);
  assert.ok(debut > 0, "le bloc `items` des programmes est introuvable dans landingI18n");
  let profondeur = 0, fin = debut;
  for (let i = landing.indexOf("{", debut); i < landing.length; i++) {
    if (landing[i] === "{") profondeur++;
    else if (landing[i] === "}") { profondeur--; if (profondeur === 0) { fin = i; break; } }
  }
  const bloc = landing.slice(debut, fin);
  const cartes = [...new Set([...bloc.matchAll(/(\w+):\s*\{\s*title:/g)].map((m) => m[1]))];
  assert.ok(cartes.length >= 9, `${cartes.length} carte(s) lue(s) sur la landing : le motif ne trouve plus les programmes`);
  // Correspondance carte → programme. Les noms diffèrent (la landing parle « endurance »
  // pour le 10 km) : la table est explicite, jamais devinée.
  const versProgramme: Record<string, CleProgramme> = {
    km10: "km5", endurance: "km10", semi: "semi", marathon: "marathon", trail: "trail",
    beginner: "debutant", speed: "vitesse", injury: "blessure", weightloss: "poids",
  };
  const orphelines = cartes.filter((c) => !versProgramme[c] || !PROGRAMMES[versProgramme[c]]);
  assert.deepEqual(orphelines, [], `carte(s) de la landing sans programme : ${orphelines.join(", ")}`);
});

test("le volume ne monte JAMAIS de plus de 10 % d'une semaine à l'autre", () => {
  // La règle qui évite la blessure du coureur pressé. Une seule semaine au-dessus suffit
  // à la rendre fausse, donc on les vérifie toutes, sur les neuf programmes.
  // ⚠️ LA COMPARAISON SE FAIT DE SEMAINE DE CHARGE À SEMAINE DE CHARGE. Comparer à une
  // semaine de DÉCHARGE ferait voir un « +48 % » à chaque reprise après assimilation —
  // alors que remonter au-dessus du palier précédent est précisément le but du cycle.
  // Premier jet du test, et il avait tort : c'est la règle qui était mal posée, pas le plan.
  for (const cle of TOUTES) {
    const p = genererPlan({ programme: cle, niveau: "intermediaire", volumeDepartKm: 30 });
    let dernierEnCharge: number | null = null;
    for (const w of p) {
      if (w.decharge || w.phase === "Affûtage") continue;  // ni décharge ni affûtage ne chargent
      if (dernierEnCharge != null && w.volumeKm > dernierEnCharge) {
        const hausse = (w.volumeKm - dernierEnCharge) / dernierEnCharge;
        assert.ok(hausse <= HAUSSE_MAX + 0.02,
          `${cle} S${w.semaine} : +${Math.round(hausse * 100)} % (${dernierEnCharge}→${w.volumeKm} km), au-dessus des 10 %`);
      }
      dernierEnCharge = w.volumeKm;
    }
  }
});

test("le plan ne fait jamais DOUBLER le volume de l'athlète", () => {
  // ⚠️ DÉFAUT TROUVÉ EN EXERÇANT LA PAGE, pas en lisant le code : une prépa marathon de
  // 16 semaines partie de 48 km/sem culminait à 113 km/sem. +10 %/semaine composé donne
  // ce résultat, et il est arithmétiquement juste — mais aucun entraîneur ne double le
  // volume d'un coureur en quatre mois. Même plafond que le macro-plan du coach.
  for (const cle of TOUTES) {
    for (const depart of [12, 30, 48, 70]) {
      const p = genererPlan({ programme: cle, niveau: "confirme", volumeDepartKm: depart, semaines: 20 });
      const pic = Math.max(...p.map((w) => w.volumeKm));
      const base = p[0].volumeKm;
      assert.ok(pic <= Math.round(base * PLAFOND_MONTEE) + 1,
        `${cle} (départ ${base} km/sem) : pic à ${pic} km/sem, soit ×${(pic / base).toFixed(2)} — au-dessus du plafond de +${Math.round((PLAFOND_MONTEE - 1) * 100)} %`);
    }
  }
});

test("une semaine sur quatre recule — l'assimilation n'est pas du temps perdu", () => {
  const p = genererPlan({ programme: "marathon", niveau: "confirme", volumeDepartKm: 50, semaines: 16 });
  const décharges = p.filter((w) => w.decharge);
  assert.ok(décharges.length >= 3, `${décharges.length} décharge(s) sur 16 semaines : le cycle de ${CYCLE_DECHARGE} n'est pas appliqué`);
  for (const d of décharges) {
    const avant = p[d.semaine - 2];
    assert.ok(avant && d.volumeKm < avant.volumeKm,
      `S${d.semaine} est annoncée en décharge mais son volume ne recule pas (${avant?.volumeKm}→${d.volumeKm})`);
    assert.equal(d.qualites, 0, `S${d.semaine} : une décharge avec de la qualité n'est pas une décharge`);
  }
});

test("reprise de blessure : aucune qualité tant que la base n'est pas revenue", () => {
  const p = genererPlan({ programme: "blessure", niveau: "intermediaire", volumeDepartKm: 40, semaines: 12 });
  const reprise = p.filter((w) => w.phase === "Reprise");
  assert.ok(reprise.length >= 3, `${reprise.length} semaine(s) de reprise sur 12 : la phase est trop courte pour un retour`);
  for (const w of reprise) {
    assert.equal(w.qualites, 0, `S${w.semaine} : du fractionné prescrit en pleine reprise de blessure`);
  }
  // Et la moitié du volume sort de l'impact : c'est là tout l'intérêt d'une reprise.
  assert.ok(PROGRAMMES.blessure.sansImpactPct >= 50, "la reprise ne déporte plus la moitié du volume hors impact");
  assert.ok(PROGRAMMES.blessure.marcheCourse, "la reprise ne passe plus par la marche/course");
  for (const w of p) {
    assert.ok(w.sansImpactKm > 0, `S${w.semaine} : aucune part sans impact dans un plan de reprise`);
  }
});

test("le plan part du volume RÉEL de l'athlète, pas d'un plan de magazine", () => {
  // Servir 60 km/semaine à quelqu'un qui en court 20 est une invitation à la blessure.
  // Deux athlètes différents doivent donc recevoir deux plans différents.
  const petit = genererPlan({ programme: "km10", niveau: "debutant", volumeDepartKm: 12 });
  const gros = genererPlan({ programme: "km10", niveau: "confirme", volumeDepartKm: 55 });
  assert.ok(gros[0].volumeKm > petit[0].volumeKm * 2,
    `même départ pour 12 km/sem et 55 km/sem (${petit[0].volumeKm} vs ${gros[0].volumeKm}) : le plan ignore l'athlète`);
  assert.ok(volumeTotal(gros) > volumeTotal(petit), "le volume total ne suit pas le niveau de l'athlète");
  // Plancher : un débutant à 0 km déclaré doit quand même recevoir un plan qui progresse.
  const zero = genererPlan({ programme: "debutant", niveau: "debutant", volumeDepartKm: 0 });
  assert.ok(zero[0].volumeKm > 0, "un athlète à 0 km reçoit un plan à 0 km, qui ne progressera jamais");
  // On compare le PIC, pas la dernière semaine : le dernier microcycle peut tomber sur une
  // décharge (volume volontairement plus bas), et conclure « ça ne progresse pas » serait
  // faux — c'est même le signe que le cycle d'assimilation fonctionne.
  assert.ok(Math.max(...zero.map((w) => w.volumeKm)) > zero[0].volumeKm, "le plan du débutant ne progresse pas");
});

test("la sortie longue ne dépasse jamais le pic utile de la distance", () => {
  // Sans ce plafond, une prépa marathon à gros volume prescrirait 45 km en sortie longue.
  const p = genererPlan({ programme: "marathon", niveau: "elite", volumeDepartKm: 90, semaines: 20 });
  for (const w of p) {
    assert.ok(w.sortieLongueKm != null && w.sortieLongueKm <= 32,
      `S${w.semaine} : sortie longue de ${w.sortieLongueKm} km en prépa marathon`);
  }
  // Et les programmes en marche/course n'ont PAS de sortie longue en km : compter des
  // kilomètres à quelqu'un qui alterne marche et course n'a pas de sens.
  for (const cle of ["debutant", "blessure", "poids"] as CleProgramme[]) {
    const q = genererPlan({ programme: cle, niveau: "debutant", volumeDepartKm: 10 });
    assert.ok(q.every((w) => w.sortieLongueKm == null), `${cle} : une sortie longue en km dans un plan marche/course`);
  }
});

test("seuls les programmes avec une course s'affûtent", () => {
  // Affûter sans date d'arrivée coûte du volume sans rien apporter.
  for (const cle of TOUTES) {
    const p = genererPlan({ programme: cle, niveau: "intermediaire", volumeDepartKm: 30 });
    const affute = p.some((w) => w.phase === "Affûtage");
    assert.equal(affute, PROGRAMMES[cle].distanceKm != null,
      `${cle} : affûtage=${affute} alors que distance=${PROGRAMMES[cle].distanceKm}`);
  }
});

test("le niveau suit la MÊME échelle de VMA que le coach", () => {
  // Deux échelles de niveau finiraient par diverger, et l'athlète verrait « débutant »
  // ici et « confirmé » là. Les bornes sont celles de `libLevel` (coachContext).
  assert.equal(niveauDeVma(11), "debutant");
  assert.equal(niveauDeVma(15), "intermediaire");
  assert.equal(niveauDeVma(17.6), "confirme");
  assert.equal(niveauDeVma(20), "elite");
  assert.equal(niveauDeVma(null), "debutant", "une VMA absente doit être prudente, pas optimiste");
  const coach = readFileSync("src/lib/ai/coachContext.ts", "utf8");
  assert.ok(/vma < 13 \? "debutant" : vma < 16 \? "intermediaire" : vma < 19 \? "confirme"/.test(coach),
    "les bornes de niveau du coach ont changé : le catalogue ne dit plus la même chose que lui");
});

console.log(`\n${passed} test(s) de plans passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
