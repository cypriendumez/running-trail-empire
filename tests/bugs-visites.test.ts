/**
 * LE BOUTON QUI « N'A PAS MARCHÉ », ET CE QU'IL A FALLU POUR LE VOIR.
 *
 * Le 14/09/2026, le premier vrai inscrit a terminé son inscription sur « Erreur lors de la
 * sauvegarde ». Cause : `performance_baselines` avait la RLS activée depuis la 001 mais
 * AUCUNE politique — l'insertion de la VMA depuis le navigateur était refusée (42501) pour
 * 100 % des inscrits, et le plan n'était donc jamais généré à l'inscription. Rien ne le
 * disait : l'erreur était gérée (un toast), donc invisible du journal, et le journal
 * lui-même n'était lu par personne.
 *
 * Trois garde-fous en sont sortis : une politique pour toute table écrite depuis le
 * navigateur, la journalisation des appels réseau refusés, et deux onglets dans l'espace
 * coach (bugs, visites) — avec une mesure d'audience qui ne stocke jamais d'adresse IP.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { estBruitDeDev, normaliserMessage, regrouperErreurs, type LigneErreur } from "../src/lib/admin/bugs";
import {
  appareilDe, empreinteVisiteur, espaceDe, estRobot, LONGUEUR_EMPREINTE, normaliserChemin, paysDe, pseudonymeCompte, referentDe,
} from "../src/lib/visites/empreinte";
import { agregerVisites, joursEntre, type LigneVisite } from "../src/lib/visites/agreger";
import { appelSurveille, reponseAnormale } from "../src/components/ErrorReporter";
import { INTERDITES } from "../src/lib/sauvegarde/tables";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
/** Sans commentaires ni lignes `//`, sans couper sur `://`. */
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

function fichiers(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) fichiers(p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}

// ── 1. RLS : toute table écrite depuis le NAVIGATEUR a une politique ─────────────
test("toute table écrite depuis le navigateur a une politique RLS dans les migrations", () => {
  const sql = fichiers("supabase/migrations", /\.sql$/).map((f) => readFileSync(f, "utf8")).join("\n").toLowerCase();
  const ecrites = new Set<string>();
  for (const f of [...fichiers("src/app", /\.tsx?$/), ...fichiers("src/components", /\.tsx?$/)]) {
    if (f.startsWith("src/app/api/")) continue; // côté serveur : client de service ou session, autre sujet
    const src = codeNu(f);
    for (const m of src.matchAll(/supabase\.from\("([a-z_]+)"\)\.(insert|update|upsert|delete)\(/g)) ecrites.add(m[1]);
  }
  assert.ok(ecrites.has("performance_baselines"), "l'inscription n'écrit plus la VMA depuis le navigateur : le test ne surveille plus le bon endroit");
  assert.ok(ecrites.size >= 5, `seulement ${ecrites.size} table(s) écrite(s) trouvée(s) : le motif ne trouve plus le code`);
  const sansPolitique: string[] = [];
  for (const t of ecrites) {
    const rls = new RegExp(`alter table ${t} enable row level security`).test(sql);
    const politique = new RegExp(`create policy "[^"]+" on ${t}\\b`).test(sql);
    // Une table SANS `enable row level security` dans les fichiers a été façonnée à la
    // main (user_goals, challenge_members) : les fichiers ne peuvent rien en dire.
    if (rls && !politique) sansPolitique.push(t);
  }
  assert.deepEqual(sansPolitique, [], `RLS activée sans aucune politique — l'écriture depuis le navigateur sera refusée (42501) : ${sansPolitique.join(", ")}`);
});

test("la migration 027 pose la politique de performance_baselines avec `with check`", () => {
  const sql = readFileSync("supabase/migrations/027_baselines_politique.sql", "utf8");
  assert.ok(/create policy "baselines_all_own" on performance_baselines\s+for all using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)/.test(sql),
    "la politique n'a plus la forme attendue (using + with check sur user_id)");
});

// ── 2. Le journal, regroupé ──────────────────────────────────────────────────────
const ligne = (p: Partial<LigneErreur>): LigneErreur => ({
  id: p.id ?? Math.random().toString(36).slice(2), created_at: p.created_at ?? "2026-09-14T10:00:00Z",
  user_id: p.user_id ?? null, source: p.source ?? "client", message: p.message ?? "x", stack: p.stack ?? null,
  url: p.url ?? "https://pacevo.fr/dashboard", user_agent: p.user_agent ?? null, meta: p.meta ?? null,
});

test("les occurrences d'un même défaut sont regroupées malgré les identifiants et adresses", () => {
  const g = regrouperErreurs([
    ligne({ message: "HTTP 500 : GET /api/x?id=a3793412-17b7-4af3-821f-230b36e8c4a4", user_id: "u1", created_at: "2026-09-14T10:00:00Z" }),
    ligne({ message: "HTTP 500 : GET /api/x?id=8f9f20b8-30eb-47ed-9abc-1cbdfae8a981", user_id: "u2", created_at: "2026-09-14T12:00:00Z", stack: "récent" }),
    ligne({ message: "HTTP 500 : GET /api/x?id=8f9f20b8-30eb-47ed-9abc-1cbdfae8a981", user_id: null, created_at: "2026-09-13T12:00:00Z" }),
    ligne({ message: "autre chose", created_at: "2026-09-10T12:00:00Z" }),
  ]);
  assert.equal(g.length, 2, "deux défauts attendus");
  assert.equal(g[0].occurrences, 3);
  assert.equal(g[0].comptes, 2, "deux comptes distincts");
  assert.equal(g[0].anonymes, 1);
  assert.equal(g[0].premier, "2026-09-13T12:00:00Z");
  assert.equal(g[0].dernier, "2026-09-14T12:00:00Z");
  assert.equal(g[0].exemple.stack, "récent", "l'exemple doit être l'occurrence la plus RÉCENTE");
  assert.ok(g[0].dernier > g[1].dernier, "le plus récent d'abord");
  assert.ok(!g[0].message.includes("a3793412"), "l'identifiant n'a pas été normalisé");
});

test("le bruit technique est masqué par défaut, jamais perdu — et un vrai bug reste", () => {
  const bruit = [
    ligne({ url: "http://localhost:3000/preview-dash-tmp", message: "computeHrZones is not defined" }), // dev
    ligne({ url: "https://pacevo.fr/preview-cal-tmp", message: "ChevronDown is not defined" }),          // banc d'essai
    ligne({ message: "preview" }),                                                                        // marqueur preview
    ligne({ url: "https://running-trail-empire-woad.vercel.app/dashboard/segments", message: "erreur ancienne" }), // ancien domaine
    ligne({ url: "u", message: "x", user_agent: "curl/8.6.0" }),                                          // scan
    ligne({ url: "https://pacevo.fr/dashboard/profile", message: "Script error.", meta: { file: "", line: 0 } }), // opaque
  ];
  const vrai = ligne({ url: "https://pacevo.fr/dashboard", message: "vrai bug", user_agent: "Mozilla/5.0 (iPhone)" });
  const tout = [...bruit, vrai];
  assert.equal(regrouperErreurs(tout).length, 1, "seul le vrai bug doit rester");
  assert.equal(regrouperErreurs(tout)[0].message, "vrai bug");
  assert.equal(regrouperErreurs(tout, { masquerBruit: false }).length, tout.length, "avec le bruit, tout doit être là");
  // Chaque famille de bruit, une par une.
  for (const l of bruit) assert.equal(estBruitDeDev(l), true, `« ${l.message} » (${l.url}) devrait être du bruit`);
  // ⚠️ Une VRAIE erreur de prod avec un fichier n'est PAS du bruit — même si c'est « Script error. »
  //    ailleurs : c'est l'absence de fichier (cross-origin) qui la rend opaque, pas le message.
  assert.equal(estBruitDeDev({ url: "https://pacevo.fr/dashboard", message: "Script error.", meta: { file: "app.js", line: 12 } }), false, "une Script error AVEC fichier reste actionnable");
  assert.equal(estBruitDeDev({ url: "https://pacevo.fr/dashboard", message: "TypeError: x is not a function" }), false, "un vrai bug de prod ne doit pas être masqué");
  assert.equal(normaliserMessage("Minified React error #418; visit https://react.dev/errors/418?args[]=text"), "Minified React error #<n>; visit <url>");
});

test("le faux positif intervals/sync est corrigé : « pas de montre » n'est plus un 503", () => {
  const src = codeNu("src/app/api/intervals/sync/route.ts");
  assert.ok(/if \(!ATHLETE_ID \|\| !API_KEY\)/.test(src), "le garde « pas d'identifiants » a disparu");
  // Le bloc « non configuré » ne doit plus répondre 503 (ni aucun ≥ 500 que le journal remonterait).
  const bloc = /if \(!ATHLETE_ID \|\| !API_KEY\) \{([\s\S]*?)\n  \}/.exec(src)?.[1] ?? "";
  assert.ok(/configured: false/.test(bloc), "la réponse ne porte plus le drapeau configured:false");
  assert.ok(!/status: 5\d\d/.test(bloc), "« pas de montre » répond encore avec un code d'erreur serveur (le journal des bugs le remonterait)");
});

// ── 3. L'empreinte : jamais l'adresse, jamais deux jours de suite ────────────────
test("l'empreinte change chaque jour et ne contient pas l'adresse", () => {
  const base = { sel: "secret", ip: "203.0.113.7", ua: "Mozilla/5.0" };
  const lundi = empreinteVisiteur({ ...base, jour: "2026-09-14" })!;
  const mardi = empreinteVisiteur({ ...base, jour: "2026-09-15" })!;
  assert.equal(lundi.length, LONGUEUR_EMPREINTE);
  assert.notEqual(lundi, mardi, "la même personne doit avoir une empreinte différente le lendemain");
  assert.equal(lundi, empreinteVisiteur({ ...base, jour: "2026-09-14" }), "la même visite le même jour doit donner la même empreinte");
  assert.ok(!lundi.includes("203") && !lundi.includes("113"), "l'adresse transparaît dans l'empreinte");
  assert.equal(empreinteVisiteur({ ...base, jour: "2026-09-14", sel: "" }), null, "sans sel, on ne compte pas");
});

test("le pseudonyme d'un compte est STABLE d'un jour à l'autre, et lié au sel", () => {
  const a = pseudonymeCompte({ sel: "secret", userId: "u1" });
  assert.equal(a, pseudonymeCompte({ sel: "secret", userId: "u1" }));
  assert.notEqual(a, pseudonymeCompte({ sel: "autre", userId: "u1" }));
  assert.notEqual(a, empreinteVisiteur({ sel: "secret", jour: "2026-09-14", ip: "u1", ua: "" }), "un pseudonyme ne doit pas se confondre avec une empreinte");
  assert.equal(pseudonymeCompte({ sel: "", userId: "u1" }), null);
});

test("robots, appareils, pays", () => {
  assert.equal(estRobot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  assert.equal(estRobot("curl/8.6.0"), true);
  assert.equal(estRobot(""), true, "un agent vide n'est pas un navigateur");
  assert.equal(estRobot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"), false);
  assert.equal(appareilDe("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)"), "mobile");
  assert.equal(appareilDe("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"), "ordinateur");
  assert.equal(appareilDe("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "tablette");
  assert.equal(paysDe("fr"), "FR");
  assert.equal(paysDe("France"), null);
});

test("les chemins sont repliés sur leur gabarit, et chaque route dynamique en a un", () => {
  assert.equal(normaliserChemin("/courses/marathon-de-paris?utm=x#top"), "/courses/[slug]");
  assert.equal(normaliserChemin("/courses/region/bretagne"), "/courses/region/[slug]");
  assert.equal(normaliserChemin("/dashboard/"), "/dashboard");
  assert.equal(normaliserChemin("/api/visite"), null, "une route d'API n'est pas une page");
  assert.equal(normaliserChemin("/_next/static/x.js"), null);
  assert.equal(normaliserChemin("sans-slash"), null);
  assert.equal(normaliserChemin("/x/a3793412-17b7-4af3-821f-230b36e8c4a4"), "/x/[id]");
  // Chaque dossier `[param]` de src/app (hors API) doit être couvert : sinon 17 000 courses
  // feraient 17 000 lignes distinctes dans « pages les plus vues ».
  const dynamiques = fichiers("src/app", /^page\.tsx$/)
    .map((f) => f.replace(/^src\/app/, "").replace(/\/page\.tsx$/, ""))
    .filter((r) => r.includes("[") && !r.startsWith("/api"));
  assert.ok(dynamiques.length >= 5, `seulement ${dynamiques.length} route(s) dynamique(s) trouvée(s)`);
  for (const r of dynamiques) {
    const exemple = r.replace(/\[[^\]]+\]/g, "exemple-123");
    assert.equal(normaliserChemin(exemple), r, `la route dynamique ${r} n'a pas de gabarit : ${exemple} resterait tel quel`);
  }
});

test("site public d'un côté, application de l'autre ; provenance = hôte seulement", () => {
  assert.equal(espaceDe("/"), "site");
  assert.equal(espaceDe("/courses/[slug]"), "site");
  assert.equal(espaceDe("/login"), "site");
  assert.equal(espaceDe("/dashboard/calendrier"), "app");
  assert.equal(espaceDe("/onboarding"), "app");
  assert.equal(referentDe("https://www.google.com/search?q=pacevo&token=SECRET", "pacevo.fr"), "google.com");
  assert.equal(referentDe("https://pacevo.fr/courses", "pacevo.fr"), null, "une page du site n'est pas une provenance");
  assert.equal(referentDe("", "pacevo.fr"), null);
});

// ── 4. L'agrégation ───────────────────────────────────────────────────────────────
test("les jours sans visite existent (à zéro), les comptes actifs sont distincts sur la période", () => {
  const v = (p: Partial<LigneVisite>): LigneVisite => ({ jour: "2026-09-14", chemin: "/", espace: "site", visiteur: "a", ...p });
  const a = agregerVisites([
    v({ visiteur: "a" }), v({ visiteur: "a", chemin: "/tarifs" }), v({ visiteur: "b" }),
    v({ jour: "2026-09-12", visiteur: "a", espace: "app", chemin: "/dashboard", compte: "c1", connecte: true }),
    v({ jour: "2026-09-14", visiteur: "z", espace: "app", chemin: "/dashboard", compte: "c1", connecte: true }),
    v({ jour: "2026-09-14", visiteur: "y", espace: "app", chemin: "/dashboard", compte: "c2", connecte: true }),
    v({ jour: "2026-09-01", visiteur: "q", espace: "app", chemin: "/dashboard", compte: "c3", connecte: true }),
    v({ jour: "2026-08-01", visiteur: "hors", compte: "c9" }),
  ], { du: "2026-09-01", au: "2026-09-14" });
  assert.equal(a.jours.length, 14);
  assert.equal(a.jours.find((j) => j.jour === "2026-09-13")!.vues, 0, "un jour sans visite doit exister à zéro");
  const j14 = a.jours.find((j) => j.jour === "2026-09-14")!;
  assert.equal(j14.vues, 5);
  assert.equal(j14.visiteurs, 4, "a, b, z, y");
  assert.equal(j14.visiteursSite, 2);
  assert.equal(j14.visiteursApp, 2);
  assert.equal(j14.comptes, 2, "c1 et c2");
  assert.equal(a.total.comptesActifs, 3, "c1, c2, c3 — c9 est hors période");
  assert.equal(a.total.comptesActifs7j, 2, "c3 date du 1er : hors des 7 derniers jours");
  assert.equal(a.total.visiteursJours, 1 + 1 + 4, "cumul des visiteurs quotidiens (a compte le 12 ET le 14)");
  assert.equal(a.pages[0].cle, "/dashboard");
  assert.equal(a.pages[0].vues, 4);
  assert.equal(joursEntre("2026-12-30", "2027-01-02").length, 4, "le passage d'année est mal compté");
});

test("l'affluence horaire est calculée dans le fuseau de l'éditeur, pas celui du serveur", () => {
  const v = (p: Partial<LigneVisite>): LigneVisite => ({ jour: "2026-09-14", chemin: "/", espace: "site", visiteur: "a", ...p });
  // 23:30 UTC le 14 = 01:30 le 15 à Paris (été, +2). Le fuseau doit ranger la vue à 1 h, pas 23 h.
  const a = agregerVisites([
    v({ created_at: "2026-09-14T23:30:00Z", visiteur: "n1" }),
    v({ created_at: "2026-09-14T23:45:00Z", visiteur: "n2" }),
    v({ created_at: "2026-09-14T08:00:00Z", visiteur: "m1" }), // 10 h à Paris
  ], { du: "2026-09-14", au: "2026-09-15", tz: "Europe/Paris" });
  assert.equal(a.heures.length, 24);
  assert.equal(a.heures[1].vues, 2, "les deux vues de 23:30/23:45 UTC tombent à 1 h de Paris");
  assert.equal(a.heures[10].vues, 1, "la vue de 08:00 UTC tombe à 10 h de Paris");
  assert.equal(a.heures[23].vues, 0, "aucune vue à 23 h de Paris — sinon le fuseau du serveur a fui");
});

test("la tendance compare à la période précédente de même longueur", () => {
  const v = (jour: string): LigneVisite => ({ jour, chemin: "/", espace: "site", visiteur: `x${jour}` });
  // Période courante 10-11 (2 vues), précédente 08-09 (1 vue).
  const a = agregerVisites([v("2026-09-08"), v("2026-09-10"), v("2026-09-11")], { du: "2026-09-10", au: "2026-09-11" });
  assert.equal(a.total.vues, 2, "période courante");
  assert.equal(a.precedent.vues, 1, "période précédente (08-09) — une seule vue le 08");
});

// ── 5. Les appels réseau qui répondent mal ───────────────────────────────────────
test("seuls les appels qui révèlent un bug sont journalisés — jamais les balises elles-mêmes", () => {
  const H = "abc.supabase.co";
  assert.equal(appelSurveille("/api/feedback", "POST", H), "api");
  assert.equal(appelSurveille("/api/log-error", "POST", H), null, "journaliser le journal ferait une boucle");
  assert.equal(appelSurveille("/api/visite", "POST", H), null);
  assert.equal(appelSurveille(`https://${H}/rest/v1/performance_baselines?select=id`, "POST", H), "supabase");
  assert.equal(appelSurveille(`https://${H}/rest/v1/workouts?select=*`, "GET", H), null, "une lecture filtrée par la RLS répond 200 vide, pas 4xx : rien à voir ici");
  assert.equal(appelSurveille("https://api.openweathermap.org/x", "POST", H), null);
  assert.equal(reponseAnormale("api", 401), false, "une 401 est une réponse, pas un bug");
  assert.equal(reponseAnormale("api", 422), false);
  assert.equal(reponseAnormale("api", 500), true);
  assert.equal(reponseAnormale("supabase", 403), true, "le 42501 de l'inscription arrive en 403 : c'est LE cas à voir");
  assert.equal(reponseAnormale("supabase", 201), false);
});

test("ErrorReporter enveloppe fetch, n'envoie jamais le corps de la requête, et se retire", () => {
  const src = codeNu("src/components/ErrorReporter.tsx");
  assert.ok(/window\.fetch = enveloppe/.test(src), "fetch n'est plus enveloppé");
  assert.ok(/res\.clone\(\)\.text\(\)/.test(src), "la réponse doit être lue sur un CLONE, jamais consommée");
  assert.ok(/window\.fetch = original/.test(src), "l'enveloppe ne se retire plus au démontage");
  assert.ok(!/init\?\.body|init\.body/.test(src), "le corps de la requête part dans le journal : il peut porter des données personnelles");
  assert.ok(/err\?\.name !== "AbortError"/.test(src), "une annulation volontaire serait journalisée comme une panne");
});

test("l'inscription journalise ses échecs d'enregistrement, avec la source « onboarding »", () => {
  const src = codeNu("src/app/onboarding/page.tsx");
  assert.ok(/if \(profileError \|\| echecs\.length\) \{[\s\S]{0,900}fetch\("\/api\/log-error"[\s\S]{0,400}source: "onboarding"/.test(src),
    "l'échec de sauvegarde n'est plus envoyé au journal (ou plus avec la source onboarding)");
});

// ── 6. La mesure d'audience : ce qui entre en base, et ce qui n'y entre jamais ──
test("/api/visite : l'adresse n'est jamais écrite, l'éditeur n'est pas compté, l'erreur est lue", () => {
  const src = codeNu("src/app/api/visite/route.ts");
  const insertion = /admin\.from\("visites"\)\.insert\(\{([\s\S]*?)\}\)/.exec(src)?.[1] ?? "";
  assert.ok(insertion, "l'insertion dans visites est introuvable");
  assert.ok(!/\bip\b|user_id|user_agent|email/.test(insertion), "l'insertion écrit une donnée qu'elle ne doit pas écrire (ip, user_id, user_agent, email)");
  assert.ok(/const \{ error \} = await admin\.from\("visites"\)\.insert/.test(src), "l'erreur d'insertion n'est plus lue");
  assert.ok(/if \(user && estAdmin\(user\.email\)\) return rien\(\)/.test(src), "l'éditeur est compté parmi les visiteurs");
  assert.ok(/empreinteVisiteur\(\{ sel, jour, ip, ua/.test(src), "l'empreinte ne prend plus le jour : elle deviendrait un identifiant permanent");
  assert.ok(/estRobot\(ua\)/.test(src), "les robots sont comptés");
  assert.ok(/status: 204/.test(src), "la balise doit répondre 204");
});

test("la balise est montée à la racine, ignore le poste de développement, et la purge existe", () => {
  assert.ok(/<Visite \/>/.test(readFileSync("src/app/layout.tsx", "utf8")), "la balise n'est plus montée dans le layout racine");
  const balise = codeNu("src/components/Visite.tsx");
  assert.ok(/localhost\|127\\\.0\\\.0\\\.1/.test(balise), "le poste de développement serait compté");
  assert.ok(/sendBeacon\("\/api\/visite"/.test(balise), "la balise n'appelle plus /api/visite");
  const cron = codeNu("src/app/api/cron/races-maintenance/route.ts");
  assert.ok(/from\("visites"\)\s*\.delete\(\{ count: "exact" \}\)\.lt\("jour", limiteVisites\)/.test(cron), "la purge des visites a disparu du cron d'entretien");
  assert.ok(/13 \* 30\.5 \* 864e5/.test(cron), "la conservation n'est plus de 13 mois");
  assert.ok(INTERDITES.includes("visites"), "visites doit rester interdite à la sauvegarde publique");
});

test("l'espace coach a ses deux onglets et la politique de confidentialité dit la mesure d'audience en 5 langues", () => {
  const admin = readFileSync("src/components/admin/AdminDashboard.tsx", "utf8");
  assert.ok(/key: "bugs"/.test(admin) && /<BugsPanel \/>/.test(admin), "onglet Bugs absent");
  assert.ok(/key: "visites"/.test(admin) && /<VisitesPanel \/>/.test(admin), "onglet Visites absent");
  assert.ok(/key: "micro"/.test(admin) && /<MicroPanel \/>/.test(admin), "onglet Micro-entreprise absent");
  // L'onglet Micro-entreprise vient APRÈS Comptabilité.
  assert.ok(admin.indexOf('key: "compta"') < admin.indexOf('key: "micro"'), "Micro-entreprise doit suivre Comptabilité");
  const legal = readFileSync("src/app/legalI18n.ts", "utf8");
  for (const mot of ["Mesure d'audience", "Audience measurement", "Reichweitenmessung", "Medición de audiencia", "Medição de audiência"]) {
    assert.ok(legal.includes(mot), `la politique de confidentialité ne mentionne plus la mesure d'audience (« ${mot} »)`);
  }
  // Les routes d'administration refont le contrôle d'accès : le layout ne protège pas les API.
  for (const r of ["src/app/api/admin/bugs/route.ts", "src/app/api/admin/visites/route.ts"]) {
    const src = codeNu(r);
    assert.ok(/const acces = await verdictAdmin\(\);\s*if \(!acces\.ok\)/.test(src), `${r} n'exige plus verdictAdmin`);
    assert.ok(/status: 403/.test(src) && /acces\.motif === "indisponible"[\s\S]{0,200}status: 503/.test(src), `${r} ne distingue plus « refus » (403) de « invérifiable » (503)`);
  }
});

console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
