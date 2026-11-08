/**
 * LES EN-TÊTES DE SÉCURITÉ SERVIS À CHAQUE PAGE.
 *
 * Relevés en production le 04/09/2026 : HSTS, `nosniff` et `X-Frame-Options: DENY`
 * étaient là ; `Referrer-Policy` et `Permissions-Policy` manquaient.
 *
 * ⚠️ `Content-Security-Policy` EST APPLIQUÉE DEPUIS LE 08/11/2026 (report-only du 16/10 au
 * 08/11, M4). Le danger d'une CSP appliquée est la panne INVISIBLE d'ici : une carte grise, une
 * image vide chez le visiteur. D'où les gardes ci-dessous, qui exécutent la VRAIE configuration
 * (`next.config.ts` → `headers()`) et vérifient que chaque fond de carte et chaque appel
 * `fetch("https://…")` du code est autorisé par la politique.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { lireRapportCsp, rapportLocal, rapportEtranger } from "../src/lib/csp/rapport";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}

// ⚠️ On retire les commentaires SANS confondre `//` (URL) ni `/*` (URL `https://*.hote`) avec
// un commentaire : un `/*` précédé de `:` ou `/` appartient à une URL (`://*`, `//*`), pas à un
// commentaire — sinon le bloc mange jusqu'au `*/` suivant et avale de vraies lignes.
const conf = readFileSync("next.config.ts", "utf8")
  .replace(/(^|[^:/])\/\*[\s\S]*?\*\//g, "$1")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

test("les cinq en-têtes de sécurité sont déclarés", () => {
  for (const [cle, valeur] of [
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["X-XSS-Protection", "1; mode=block"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(self)"],
  ]) {
    assert.ok(new RegExp(`"${cle}"[\\s\\S]{0,40}${valeur.replace(/[()[\]]/g, "\\$&")}`).test(conf),
      `l'en-tête ${cle} (${valeur}) n'est plus servi`);
  }
});

test("la géolocalisation reste ouverte à l'application elle-même", () => {
  // ⚠️ `geolocation=()` COUPERAIT UNE FONCTIONNALITÉ RÉELLE — le tri « près de moi »
  // des parcours appelle `navigator.geolocation.getCurrentPosition`. Le navigateur
  // refuserait alors sans message exploitable : une panne silencieuse causée par une
  // mesure de sécurité, ce qui est la pire façon de sécuriser.
  const pp = conf.match(/"Permissions-Policy",\s*value:\s*"([^"]+)"/);
  assert.ok(pp, "l'en-tête Permissions-Policy a disparu");
  assert.match(pp![1], /geolocation=\(self\)/, "la géolocalisation est coupée alors que l'application s'en sert");
  const usage = readFileSync("src/components/parcours/ParcoursBrowser.tsx", "utf8");
  assert.ok(/navigator\.geolocation\.getCurrentPosition/.test(usage),
    "plus personne n'utilise la géolocalisation : l'autorisation peut être retirée");
  // ⚠️ LA CAMÉRA AUSSI (08/11/2026) : « Ajouter des amis » scanne un QR code. `camera=()` la
  // faisait refuser en silence, exactement la panne décrite ci-dessus pour la géolocalisation.
  assert.match(pp![1], /camera=\(self\)/, "la caméra est coupée alors que le scan de QR code s'en sert");
  assert.ok(/getUserMedia\(\s*\{\s*video/.test(readFileSync("src/components/social/AjouterAmis.tsx", "utf8")),
    "plus personne n'utilise la caméra : l'autorisation peut être retirée");
  // Et ce qu'on n'utilise pas doit rester fermé.
  for (const interdit of ["microphone", "payment"]) {
    assert.ok(new RegExp(`${interdit}=\\(\\)`).test(pp![1]), `${interdit} n'est plus fermé`);
  }
});

test("un rapport CSP se lit dans ses deux formats", () => {
  assert.deepEqual(lireRapportCsp(JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "eval", "document-uri": "https://pacevo.fr/" } })),
    { directive: "script-src", bloque: "eval", page: "https://pacevo.fr/" });
  assert.deepEqual(lireRapportCsp(JSON.stringify([{ body: { effectiveDirective: "img-src", blockedURL: "https://x.test/a.png", documentURL: "https://pacevo.fr/dashboard" } }])),
    { directive: "img-src", bloque: "https://x.test/a.png", page: "https://pacevo.fr/dashboard" });
  assert.deepEqual(lireRapportCsp("pas du json"), { directive: "?", bloque: "?", page: "" });
});

test("les rapports d'un poste de développement n'entrent pas dans la base de production", () => {
  // 05/11/2026 : 27 lignes « http://localhost:3000/ » dans error_logs, écrites par des `next dev`
  // locaux branchés sur la base de production.
  for (const [page, hote] of [["http://localhost:3000/", "localhost:3000"], ["http://127.0.0.1:3000/dashboard", null],
    ["", "localhost:3000"], ["http://app.localhost:3000/", null], ["http://[::1]:3000/", null]] as const) {
    assert.equal(rapportLocal(page, hote), true, `${page} / ${hote}`);
  }
  assert.equal(rapportLocal("https://pacevo.fr/dashboard", "pacevo.fr"), false, "un vrai visiteur est ignoré");
  assert.equal(rapportLocal("", "pacevo.fr"), false);
  // Et la route trie AVANT d'ouvrir la base (ni écriture, ni même le comptage par minute).
  const route = readFileSync("src/app/api/csp-report/route.ts", "utf8");
  const tri = route.indexOf('if (rapportLocal(page, req.headers.get("host"))) return rien();');
  assert.ok(tri > 0 && tri < route.indexOf("const admin = createAdminClient();"), "la route écrit les rapports locaux, ou les trie trop tard");
});

test("les rapports des extensions de navigateur et des cadres « about: » n'entrent pas dans Bugs", () => {
  // 07/11/2026 : 36 lignes en 30 jours venaient d'extensions (Joko, Firebase, scite…).
  const r = (c: Record<string, unknown>) => JSON.stringify({ "csp-report": { "document-uri": "https://pacevo.fr/courses/x", ...c } });
  assert.equal(rapportEtranger(r({ "blocked-uri": "https://joko.s3.amazonaws.com/a.png", "source-file": "safari-web-extension://1F1E/content.js" })), true);
  assert.equal(rapportEtranger(r({ "blocked-uri": "https://www.gstatic.com/f.js", "source-file": "chrome-extension://abc/c.js" })), true);
  assert.equal(rapportEtranger(r({ "blocked-uri": "moz-extension://abc/x.png" })), true);
  assert.equal(rapportEtranger(JSON.stringify({ "csp-report": { "document-uri": "about", "blocked-uri": "https://fonts.gstatic.com/x.woff2" } })), true);
  assert.equal(rapportEtranger(JSON.stringify([{ body: { documentURL: "https://pacevo.fr/", sourceFile: "chrome-extension://z/y.js", blockedURL: "eval" } }])), true);
  // Une vraie violation de NOTRE code reste : c'est elle qu'on veut voir.
  assert.equal(rapportEtranger(r({ "blocked-uri": "https://icons.duckduckgo.com/ip3/a.ico", "source-file": "https://pacevo.fr/_next/static/chunks/a.js" })), false);
  assert.equal(rapportEtranger(r({ "blocked-uri": "eval" })), false);
  assert.equal(rapportEtranger("pas du json"), false);
  const route = readFileSync("src/app/api/csp-report/route.ts", "utf8");
  const tri = route.indexOf("if (rapportEtranger(brut)) return rien();");
  assert.ok(tri > 0 && tri < route.indexOf("const admin = createAdminClient();"), "la route écrit les rapports des extensions, ou les trie trop tard");
});

test("le journal d'erreurs ignore un poste de développement, et l'onglet Actualité peut afficher ses icônes", () => {
  const route = readFileSync("src/app/api/log-error/route.ts", "utf8");
  const tri = route.indexOf('if (rapportLocal(typeof body.url === "string" ? body.url : "", req.headers.get("host")))');
  assert.ok(tri > 0 && tri < route.indexOf("const admin = createAdminClient();"), "un `next dev` local écrit de nouveau ses erreurs dans la base de production");
});

// ── LA CSP APPLIQUÉE, LUE DANS LA VRAIE CONFIGURATION ────────────────────────────────────────
type Regle = { source: string; headers: { key: string; value: string }[] };
type Conf = { headers: () => Promise<Regle[]> };

/** Les directives d'une CSP : `{ "img-src": ["'self'", "https://…"], … }`. */
function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(csp.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const [nom, ...valeurs] = d.split(/\s+/);
    return [nom, valeurs];
  }));
}

/** Un hôte est-il autorisé par une liste de sources CSP ? (`https://*.a.b` couvre `x.a.b`, pas `a.b`) */
function autorise(sources: string[], hote: string): boolean {
  return sources.some((s) => {
    const m = s.match(/^https:\/\/(.+)$/);
    if (!m) return false;
    if (m[1].startsWith("*.")) return hote.endsWith(m[1].slice(1)) && hote.length > m[1].length - 1;
    return hote === m[1];
  });
}

/** Tous les fichiers .ts/.tsx de `src`, hors routes d'API (le serveur n'est pas soumis à la CSP). */
function fichiersClient(): string[] {
  const out: string[] = [];
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (p !== join("src", "app", "api")) parcourir(p); }
      else if (/\.(ts|tsx)$/.test(n)) out.push(p);
    }
  };
  parcourir("src");
  return out;
}

async function cspServie(nodeEnv: string, cleTurnstile?: string): Promise<{ cles: string[]; d: Record<string, string[]> }> {
  const env = process.env as Record<string, string | undefined>;
  const avant = [env.NODE_ENV, env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, env.NEXT_PUBLIC_SUPABASE_URL];
  env.NODE_ENV = nodeEnv;
  env.NEXT_PUBLIC_SUPABASE_URL = `https://${PROJET}`;
  if (cleTurnstile) env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = cleTurnstile; else delete env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  try {
    const conf = (await import("../next.config")).default as unknown as Conf;
    const regle = (await conf.headers()).find((r) => r.source === "/(.*)");
    const cles = (regle?.headers ?? []).map((h) => h.key);
    const csp = regle?.headers.find((h) => h.key === "Content-Security-Policy")?.value ?? "";
    return { cles, d: directives(csp) };
  } finally {
    env.NODE_ENV = avant[0];
    if (avant[1] === undefined) delete env.NEXT_PUBLIC_TURNSTILE_SITE_KEY; else env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = avant[1];
    if (avant[2] === undefined) delete env.NEXT_PUBLIC_SUPABASE_URL; else env.NEXT_PUBLIC_SUPABASE_URL = avant[2];
  }
}
/** Un projet Supabase fictif : la CSP doit n'autoriser QUE lui. */
const PROJET = "abcdefghijkl.supabase.co";

void (async () => {
  const prod = await cspServie("production");
  const dev = await cspServie("development");
  const avecCaptcha = await cspServie("production", "0x4AAAAAAA-cle-de-test");

  test("Cloudflare Turnstile n'entre dans la CSP QUE si sa clé est posée", () => {
    const cf = "https://challenges.cloudflare.com";
    assert.ok(!(prod.d["script-src"] ?? []).includes(cf) && !prod.d["frame-src"], "sans clé, la CSP ouvre quand même la porte à Cloudflare");
    assert.ok((avecCaptcha.d["script-src"] ?? []).includes(cf), "avec la clé, le script du CAPTCHA serait bloqué : plus personne ne pourrait se connecter");
    assert.deepEqual(avecCaptcha.d["frame-src"], [cf], "avec la clé, le cadre du CAPTCHA serait bloqué (ou frame-src s'ouvre à d'autres)");
    assert.deepEqual((avecCaptcha.d["script-src"] ?? []).filter((v) => v !== "'self'" && v !== "'unsafe-inline'"), [cf], "la clé Turnstile ouvre script-src à autre chose que Cloudflare");
  });

  test("la CSP est APPLIQUÉE (et plus seulement signalée), avec ses directives de base", () => {
    assert.ok(prod.cles.includes("Content-Security-Policy"), "la CSP n'est pas appliquée : le jeton de session redevient volable par un script étranger");
    assert.ok(!prod.cles.includes("Content-Security-Policy-Report-Only"), "une CSP report-only est encore servie en plus");
    for (const [nom, valeur] of [["default-src", "'self'"], ["object-src", "'none'"], ["frame-ancestors", "'none'"], ["base-uri", "'self'"], ["form-action", "'self'"], ["report-uri", "/api/csp-report"]]) {
      assert.deepEqual(prod.d[nom], [valeur], `${nom} n'est plus « ${valeur} »`);
    }
  });

  test("aucun script étranger ni `eval` en production ; `eval` seulement en développement", () => {
    const s = prod.d["script-src"] ?? [];
    assert.deepEqual(s.filter((v) => v !== "'self'" && v !== "'unsafe-inline'"), [], `script-src s'ouvre en production : ${s.join(" ")}`);
    assert.ok(s.includes("'self'"), "script-src ne permet plus les scripts du site");
    // Sans `'unsafe-eval'`, `next dev` (Turbopack) ne démarre plus dans le navigateur.
    assert.ok((dev.d["script-src"] ?? []).includes("'unsafe-eval'"), "`next dev` serait bloqué : 'unsafe-eval' absent en développement");
    for (const nom of ["connect-src", "img-src", "default-src"]) {
      assert.ok(!(prod.d[nom] ?? []).some((v) => v === "*" || v === "https:" || v === "http:"), `${nom} accepte n'importe quel site : l'exfiltration redevient possible`);
    }
  });

  test("chaque fond de carte du code est autorisé en img-src ET connect-src (Leaflet et MapLibre)", () => {
    const manquants: string[] = [];
    for (const f of fichiersClient()) {
      for (const m of readFileSync(f, "utf8").matchAll(/https:\/\/([a-z0-9.{}-]+)\/[^"'`\s]*\{[zxy]\}/gi)) {
        const hote = m[1].replace(/\{s\}/g, "a").toLowerCase();
        for (const nom of ["img-src", "connect-src"]) {
          if (!autorise(prod.d[nom] ?? [], hote)) manquants.push(`${hote} (${nom}, ${f})`);
        }
      }
    }
    assert.deepEqual([...new Set(manquants)], [], "des fonds de carte seraient GRIS chez le visiteur");
  });

  test("chaque appel fetch(\"https://…\") du code client est autorisé en connect-src", () => {
    // Modules appelés SEULEMENT par le serveur (la CSP ne s'applique pas à lui) : on le prouve en
    // vérifiant qu'aucun fichier `"use client"` ne les importe.
    const SERVEUR_SEUL = ["src/lib/ai/gemini.ts", "src/lib/cron/github.ts"];
    const clients = fichiersClient().filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));
    for (const s of SERVEUR_SEUL) {
      const mod = s.replace(/^src\//, "@/").replace(/\.ts$/, "");
      const fautifs = clients.filter((c) => readFileSync(c, "utf8").includes(`"${mod}"`));
      assert.deepEqual(fautifs, [], `${s} est importé par un composant client : son appel réseau passerait par la CSP`);
    }
    const manquants: string[] = [];
    for (const f of fichiersClient().filter((x) => !SERVEUR_SEUL.includes(x))) {
      for (const m of readFileSync(f, "utf8").matchAll(/fetch\(\s*[`"']https:\/\/([a-z0-9.-]+)/gi)) {
        if (!autorise(prod.d["connect-src"] ?? [], m[1].toLowerCase())) manquants.push(`${m[1]} (${f})`);
      }
    }
    assert.deepEqual(manquants, [], "des appels réseau seraient bloqués par la CSP");
  });

  test("les images connues sont autorisées (Actualité, photos, stockage Supabase)", () => {
    const img = prod.d["img-src"] ?? [];
    // Les icônes des sources de l'Actualité (lib/news/actualites) viennent de icons.duckduckgo.com.
    for (const h of ["icons.duckduckgo.com", "images.unsplash.com", PROJET, "cdnjs.cloudflare.com"]) {
      assert.ok(autorise(img, h), `${h} est hors politique CSP : images vides`);
    }
    assert.ok(autorise(prod.d["connect-src"] ?? [], PROJET) && (prod.d["connect-src"] ?? []).includes(`wss://${PROJET}`),
      "Supabase (REST ou temps réel) est bloqué : l'application entière tomberait");
  });

  test("seul NOTRE projet Supabase est autorisé, pas celui d'un attaquant", () => {
    // Relecture du 08/11/2026 : `*.supabase.co` couvrait les projets de tout le monde ; un script
    // injecté pouvait y envoyer le jeton de session, et la CSP laissait passer.
    for (const nom of ["connect-src", "img-src"]) {
      assert.ok(!autorise(prod.d[nom] ?? [], "projet-attaquant.supabase.co"), `${nom} laisse partir des données vers N'IMPORTE QUEL projet Supabase`);
      assert.ok(!(prod.d[nom] ?? []).some((v) => v.includes("*.supabase.co")), `${nom} garde le joker *.supabase.co`);
    }
  });

  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
})();
