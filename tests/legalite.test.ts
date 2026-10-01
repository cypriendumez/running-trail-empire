/**
 * LA LÉGALITÉ, FIGÉE (01/10/2026).
 *
 * Cyprien : « je vais vendre mon application, donc reste dans la légalité ». Un audit de
 * reprise regarde d'abord ce que l'application fait chez les AUTRES et ce qu'elle dit faire :
 *   - les robots s'identifient (PacevoBot → pacevo.fr/robot) : quatre scripts du comparateur
 *     se présentaient comme Chrome, trois routes serveur aussi ;
 *   - un site peut refuser : robots.txt respecté, liste d'opposition lue par chaque robot ;
 *   - la politique de confidentialité décrit ce qui est VRAIMENT collecté (la messagerie, le
 *     contact d'urgence — données d'un tiers —, la mesure d'audience n'y figuraient pas) ;
 *   - le refus de la mesure d'audience promis par la politique existe dans le code.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { UA_PACEVOBOT, PAGE_ROBOT, SITES_EXCLUS, siteExclu } from "../src/lib/races/robot";
import { pageOfficielle } from "../src/lib/races/veille";
import { robotsAutorise } from "../src/lib/races/resultatsSite";
import { lectureAutorisee, lirePoliment } from "../scripts/acces-poli";
import { TEXTES_ROBOT, ROBOTS_TXT_REFUS } from "../src/app/robot/textes";
import { LEGAL } from "../src/app/legalI18n";
import { refusMesure } from "../src/lib/visites/empreinte";

let ok = 0, ko = 0;
async function t(nom: string, f: () => void | Promise<void>) {
  try { await f(); ok++; } catch (e) { ko++; console.error(`✗ ${nom}\n  ${(e as Error).message}`); }
}
const lire = (f: string) => readFileSync(f, "utf8");
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx|mjs|js)$/.test(n) ? [p] : [];
  });
}
const CODE = [...fichiers("src"), ...fichiers("scripts")];
const LANGUES = ["fr", "en", "de", "es", "pt"] as const;

(async () => {
  // ── 1. UNE IDENTITÉ DÉCLARÉE, JAMAIS UN DÉGUISEMENT ──────────────────────────
  await t("l'identité de PacevoBot renvoie à une page qui existe", () => {
    assert.match(UA_PACEVOBOT, /PacevoBot\/\d/);
    assert.ok(UA_PACEVOBOT.includes(PAGE_ROBOT));
    assert.equal(new URL(PAGE_ROBOT).pathname, "/robot");
    assert.ok(existsSync("src/app/robot/page.tsx"), "la page /robot a disparu : l'identité du robot renvoie à un 404");
  });

  await t("aucun code ne se fait passer pour un navigateur ni ne garde une ancienne identité", () => {
    const fautifs = CODE.filter((f) => /Chrome\/\d|AppleWebKit\/|Firefox\/\d|Safari\/\d|RunningTrailEmpire\/|PacevoNewsletter|running-empire\.fr/.test(lire(f)));
    assert.deepEqual(fautifs, []);
  });

  await t("chaque fichier qui choisit un User-Agent prend celui de PacevoBot (seule exception : l'API GitHub, notre propre compte)", () => {
    const EXCEPTIONS = ["src/lib/cron/github.ts"];
    const fautifs = CODE.filter((f) => /["']User-Agent["']/.test(lire(f)) && !EXCEPTIONS.includes(f))
      .filter((f) => {
        const s = lire(f);
        return !/import\s*\{[^}]*\bUA_PACEVOBOT\b[^}]*\}\s*from\s*["'][^"']*robot["']/.test(s) || /["']User-Agent["']\s*:\s*["'`]/.test(s);
      });
    assert.deepEqual(fautifs, []);
    for (const e of EXCEPTIONS) assert.match(lire(e), /api\.github\.com/, `${e} ne parle plus à GitHub : l'exception n'a plus lieu d'être`);
  });

  await t("les quatre collecteurs du comparateur passent tous par l'accès poli, jamais par fetch nu", () => {
    for (const f of ["scripts/collecte-irun.ts", "scripts/collecte-rw.ts", "scripts/collecte-runrepeat.ts", "scripts/decouverte-irun.ts"]) {
      const s = lire(f);
      assert.match(s, /lirePoliment\(/, f);
      assert.doesNotMatch(s, /(^|[^\w.])fetch\(/m, `${f} appelle fetch directement : robots.txt et l'opposition sont contournés`);
    }
  });

  // ── 2. LE DROIT DE DIRE NON ─────────────────────────────────────────────────
  await t("siteExclu : un domaine couvre ses sous-domaines ; une adresse illisible est exclue par prudence", () => {
    const liste = ["exemple.fr", "https://autre-course.com"];
    assert.equal(siteExclu("https://www.exemple.fr/resultats", liste), true);
    assert.equal(siteExclu("https://inscriptions.exemple.fr/", liste), true);
    assert.equal(siteExclu("https://autre-course.com/2026", liste), true);
    assert.equal(siteExclu("https://exemple-trail.fr/", liste), false);
    assert.equal(siteExclu("https://www.letraildubuis.fr/", []), false);
    assert.equal(siteExclu("pas une adresse", []), true);
  });

  await t("un site sur la liste d'opposition n'a plus de page officielle pour la veille", () => {
    const course = { site_officiel: "https://www.letraildubuis.fr/", registration_url: null };
    assert.equal(pageOfficielle(course), "https://www.letraildubuis.fr/");
    (SITES_EXCLUS as string[]).push("letraildubuis.fr");
    try { assert.equal(pageOfficielle(course), null); }
    finally { (SITES_EXCLUS as string[]).pop(); }
  });

  await t("les deux lignes données aux organisateurs arrêtent VRAIMENT PacevoBot", () => {
    assert.equal(robotsAutorise(ROBOTS_TXT_REFUS, "/"), false);
    assert.equal(robotsAutorise(ROBOTS_TXT_REFUS, "/resultats-2026.pdf"), false);
    assert.equal(robotsAutorise("User-agent: *\nDisallow: /prive", "/public"), true);
  });

  await t("l'accès poli : opposition, puis robots.txt ; un robots.txt illisible interdit ; l'identité est imposée", async () => {
    const vrai = globalThis.fetch;
    const appels: { url: string; ua: string | null }[] = [];
    globalThis.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
      const url = String(entree);
      appels.push({ url, ua: new Headers(init?.headers).get("user-agent") });
      if (url === "https://a-robots.fr/robots.txt") return new Response("User-agent: *\nDisallow: /prive", { status: 200 });
      if (url === "https://sans-robots.fr/robots.txt") return new Response("", { status: 404 });
      if (url === "https://en-panne.fr/robots.txt") return new Response("", { status: 503 });
      return new Response("<html></html>", { status: 200 });
    }) as typeof fetch;
    try {
      assert.equal(await lectureAutorisee("https://a-robots.fr/prive/page"), false);
      assert.equal(await lectureAutorisee("https://a-robots.fr/course"), true);
      assert.equal(await lectureAutorisee("https://sans-robots.fr/course"), true);
      assert.equal(await lectureAutorisee("https://en-panne.fr/course"), false);
      (SITES_EXCLUS as string[]).push("sans-robots.fr");
      try {
        const avant = appels.length;
        assert.equal(await lirePoliment("https://sans-robots.fr/course"), null);
        assert.equal(appels.length, avant, "un site opposé a quand même été contacté");
      } finally { (SITES_EXCLUS as string[]).pop(); }
      assert.equal(await lirePoliment("https://a-robots.fr/prive/page"), null);
      const r = await lirePoliment("https://a-robots.fr/course", { headers: { "User-Agent": "Mozilla/5.0 Chrome/124" } });
      assert.ok(r);
      const dernier = appels.at(-1)!;
      assert.equal(dernier.url, "https://a-robots.fr/course");
      assert.equal(dernier.ua, UA_PACEVOBOT, "l'appelant a pu imposer une autre identité");
      assert.ok(appels.filter((a) => a.url.endsWith("/robots.txt")).every((a) => a.ua === UA_PACEVOBOT));
    } finally { globalThis.fetch = vrai; }
  });

  // ── 3. LA PAGE /robot DIT LA MÊME CHOSE DANS LES CINQ LANGUES ───────────────
  await t("/robot : cinq langues complètes, les lignes robots.txt, l'adresse de contact et l'identité affichées", () => {
    for (const l of LANGUES) {
      const x = TEXTES_ROBOT[l];
      assert.ok(x, l);
      for (const [k, v] of Object.entries(x)) assert.ok(Array.isArray(v) ? v.length === 4 && v.every((s) => s.trim()) : String(v).trim(), `${l}.${k}`);
      assert.match(x.quoi.join(" "), /robots\.txt/, l);
    }
    const page = lire("src/app/robot/page.tsx");
    assert.match(page, /\{ROBOTS_TXT_REFUS\}/);
    assert.match(page, /EDITEUR\.email/);
    assert.match(page, /\{UA_PACEVOBOT\}/);
    assert.match(lire("src/app/sitemap.ts"), /path: "\/robot"/);
  });

  // ── 4. LA POLITIQUE DE CONFIDENTIALITÉ DÉCRIT CE QUI EST COLLECTÉ ───────────
  await t("la politique nomme messagerie, contact d'urgence, audience, Resend, Microsoft et les fonds de carte — dans les cinq langues", () => {
    const URGENCE: Record<string, RegExp> = { fr: /Contact d'urgence/, en: /Emergency contact/, de: /Notfallkontakt/, es: /Contacto de emergencia/, pt: /Contacto de emergência/ };
    const MESSAGES: Record<string, RegExp> = { fr: /Messagerie/, en: /Messaging/, de: /Nachrichten/, es: /Mensajería/, pt: /Mensagens/ };
    // Section par section : un mot présent ailleurs (les finalités nomment aussi le contact
    // d'urgence) ne doit pas suffire à combler un trou dans la liste des données collectées.
    for (const l of LANGUES) {
      const p = LEGAL[l].privacy;
      const sec = (n: number) => {
        const s = p.sections.find((x) => x.title.startsWith(`${n}. `));
        assert.ok(s, `${l} : section ${n} introuvable`);
        return [...(s.paras ?? []), ...(s.list ?? [])].join("\n");
      };
      for (const re of [URGENCE[l], MESSAGES[l], /IP/]) assert.match(sec(2), re, `${l} §2 (données) : ${re}`);
      for (const re of [URGENCE[l], MESSAGES[l]]) assert.match(sec(3), re, `${l} §3 (finalités) : ${re}`);
      for (const re of [/Do Not Track/, /Global Privacy Control/]) assert.match(sec(4), re, `${l} §4 (bases légales) : ${re}`);
      for (const re of [/Resend/, /Microsoft/, /OVHcloud/, /MapTiler/]) assert.match(sec(5), re, `${l} §5 (destinataires) : ${re}`);
      assert.match(sec(6), /Resend, Microsoft/, `${l} §6 : transferts hors UE incomplets`);
      assert.match(sec(7), /13/, `${l} §7 : durée de conservation de l'audience absente`);
    }
    assert.match(lire("src/app/confidentialite/page.tsx"), /date="01\/10\/2026"/);
  });

  // ── 5. LE REFUS DE LA MESURE D'AUDIENCE EXISTE ──────────────────────────────
  await t("Do Not Track et Global Privacy Control : la visite n'est pas comptée", () => {
    assert.equal(refusMesure(new Headers({ "sec-gpc": "1" })), true);
    assert.equal(refusMesure(new Headers({ dnt: "1" })), true);
    assert.equal(refusMesure(new Headers({ dnt: "0" })), false);
    assert.equal(refusMesure(new Headers()), false);
    const route = lire("src/app/api/visite/route.ts");
    const refus = route.indexOf("refusMesure(req.headers)");
    assert.ok(refus > 0 && refus < route.indexOf(".insert("), "le refus n'est pas lu avant l'écriture de la visite");
  });

  // ── 6. PLUS DE PRIX SIMULÉS ATTRIBUÉS À DE VRAIES ENSEIGNES ─────────────────
  await t("la route publique des prix simulés reste supprimée", () => {
    assert.equal(existsSync("src/app/api/shop/prices/route.ts"), false);
  });

  console.log(`légalité : ${ok} ok, ${ko} échec(s)`);
  if (ko) process.exit(1);
})();
