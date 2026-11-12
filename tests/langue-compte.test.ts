/**
 * LA LANGUE DU COMPTE, EXÉCUTÉE (13/11/2026).
 *
 * `langueDuCompte` (src/lib/i18n/serverLang.ts) est jouée avec un faux client Supabase et un repli
 * « navigateur » injecté : aucune requête Next, aucune base. Elle ne retombe jamais sur « fr » ; elle
 * dit si le profil a été LU, et les deux routes d'IA ne mémorisent pas un texte écrit dans une langue
 * de repli (l'analyse de séance, dont le cache ignore la langue, l'aurait resservi à jamais).
 *
 *   npx tsx tests/langue-compte.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { langueDuCompte, getAccountLang } from "../src/lib/i18n/serverLang";

let passed = 0; const fails: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log("  ✓ " + nom); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log("  ✗ " + nom + "\n      " + (e as Error).message); }
}
const codeNu = (p: string) => readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Faux client : `profiles.select().eq().maybeSingle()` rend `reponse`, ou lève. Il note la requête. */
function fauxClient(reponse: { data: unknown; error: unknown } | "leve") {
  const vu: string[] = [];
  const sb = {
    from: (t: string) => { vu.push(`from:${t}`); return {
      select: (c: string) => { vu.push(`select:${c}`); return {
        eq: (k: string, v: string) => { vu.push(`eq:${k}=${v}`); return {
          maybeSingle: async () => { vu.push("maybeSingle"); if (reponse === "leve") throw new Error("réseau coupé"); return reponse; },
          single: async () => { throw new Error("single() : « aucune ligne » serait une erreur"); },
        }; },
      }; },
    }; },
  };
  return { sb: sb as never, vu };
}
const navigateur = (l: "de" | "es") => async () => l;

async function main() {
  // Les erreurs journalisées par la fonction ne doivent pas polluer la sortie du test.
  const erreur = console.error; const journal: unknown[][] = [];
  console.error = (...a: unknown[]) => { journal.push(a); };
  try {
    await test("langue du compte lue : c'est elle, profil lu", async () => {
      const { sb, vu } = fauxClient({ data: { preferred_language: "en" }, error: null });
      assert.deepEqual(await langueDuCompte(sb, "u1", navigateur("de")), { lang: "en", profilLu: true });
      assert.deepEqual(vu, ["from:profiles", "select:preferred_language", "eq:id=u1", "maybeSingle"], `requête inattendue : ${vu.join(" ")}`);
    });
    await test("aucune ligne de profil : le navigateur, et ce n'est PAS une panne (profil lu)", async () => {
      const { sb } = fauxClient({ data: null, error: null });
      assert.deepEqual(await langueDuCompte(sb, "u1", navigateur("de")), { lang: "de", profilLu: true });
    });
    await test("langue vide ou faite d'espaces : le navigateur, jamais « fr »", async () => {
      for (const vide of ["", "   ", null, 42]) {
        const { sb } = fauxClient({ data: { preferred_language: vide }, error: null });
        assert.deepEqual(await langueDuCompte(sb, "u1", navigateur("es")), { lang: "es", profilLu: true }, `langue ${JSON.stringify(vide)}`);
      }
    });
    await test("lecture en ERREUR : le navigateur, profil NON lu, erreur journalisée", async () => {
      journal.length = 0;
      const { sb } = fauxClient({ data: null, error: { message: "permission denied", code: "42501" } });
      assert.deepEqual(await langueDuCompte(sb, "u1", navigateur("de")), { lang: "de", profilLu: false });
      assert.ok(journal.some((a) => String(a.join(" ")).includes("permission denied")), "l'erreur de lecture n'est pas journalisée");
    });
    await test("exception (réseau) : le navigateur, profil NON lu, journalisée", async () => {
      journal.length = 0;
      const { sb } = fauxClient("leve");
      assert.deepEqual(await langueDuCompte(sb, "u1", navigateur("es")), { lang: "es", profilLu: false });
      assert.ok(journal.some((a) => String(a.join(" ")).includes("réseau coupé")), "l'exception n'est pas journalisée");
    });
    await test("une langue inconnue se normalise, sans tomber au repli", async () => {
      const { sb } = fauxClient({ data: { preferred_language: "pt-BR" }, error: null });
      const r = await langueDuCompte(sb, "u1", navigateur("de"));
      assert.equal(r.profilLu, true);
      assert.ok(["pt", "fr", "en", "de", "es"].includes(r.lang), `langue hors des 5 : ${r.lang}`);
    });
    await test("getAccountLang rend la langue de langueDuCompte (langue du compte lue)", async () => {
      const { sb } = fauxClient({ data: { preferred_language: "de" }, error: null });
      assert.equal(await getAccountLang(sb, "u1"), "de");
    });
  } finally { console.error = erreur; }

  await test("les deux routes d'IA ne MÉMORISENT pas un texte écrit dans une langue de repli", () => {
    const bilan = codeNu("src/app/api/ai/bilan/route.ts");
    assert.match(bilan, /const \{ lang, profilLu \} = await langueDuCompte\(supabase, user\.id\);/, "bilan : la langue ne dit plus si le profil a été lu");
    const iGardeB = bilan.indexOf("if (!profilLu) return NextResponse.json({ ok: true, texte, memorise: false });");
    assert.ok(iGardeB > 0 && iGardeB < bilan.indexOf("const donnees = {"), "bilan : un bilan en langue de repli est mémorisé (il écrase le bon, le modèle est repayé)");
    const ana = codeNu("src/app/api/ai/analyse-seance/route.ts");
    assert.match(ana, /const \{ lang, profilLu \} = await langueDuCompte\(supabase, user\.id\);/, "analyse : la langue ne dit plus si le profil a été lu");
    const iGardeA = ana.search(/if \(!profilLu\) \{[^}]*return NextResponse\.json\(\{ ok: true, texte, memorise: false/);
    assert.ok(iGardeA > 0 && iGardeA < ana.indexOf("const ligne = {"), "analyse : une analyse en langue de repli est mémorisée (resservie à jamais)");
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
