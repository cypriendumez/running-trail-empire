/**
 * L'AUDIT DES 60 ROUTES RESTANTES ET DES DONNÉES DE SANTÉ (08/11/2026).
 *
 * Après les 15 routes de tests/echecs-muets.test.ts, trois sous-agents
 * `chasseur-echecs-muets` ont passé les 60 autres routes d'écriture et
 * `gardien-donnees-sante` toute l'application. Chaque trouvaille a été relue dans le code
 * avant d'être corrigée ; ce fichier fige les corrections.
 *
 * D'abord la sécurité, déployée à part : une route de maintenance du catalogue des
 * courses était ouverte à toute requête anonyme, et le journal d'erreurs recevait
 * l'adresse complète des pages, y compris le lien secret du suivi GPS en direct.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { urlJournalisable } from "../src/lib/journal/urlJournal";
import { sansAdresse, MASQUE } from "../src/lib/journal/sansAdresse";
import { parseGPX } from "../src/lib/intervals/gpx";
import { coursesExistantes } from "../src/lib/races/existantes";
import { estMajeur, ageEntier, AGE_MINIMUM } from "../src/lib/legal/age";
import { KINE_IA_ACTIF } from "../src/lib/health/kineIa";
import { enregistrerDouleurDeclaree } from "../src/lib/health/douleurDeclaree";
import { SEUIL_DOULEUR_DECLAREE } from "../src/lib/health/seuilDouleur";

let passed = 0; const fails: string[] = [];
function test(nom: string, fn: () => void) {
  try { fn(); passed++; console.log(`  OK ${nom}`); }
  catch (e) { fails.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
// Les tests asynchrones s'enchaînent UN PAR UN (relecture du 08/11/2026) : celui de la
// reconduction remplace `globalThis.fetch` et `RESEND_API_KEY` ; lancés ensemble, un autre
// test pouvait traverser ce faux réseau pendant qu'il était en place.
let enAttente: Promise<void> = Promise.resolve();
function testAsync(nom: string, fn: () => Promise<void>) {
  enAttente = enAttente.then(() => fn()).then(
    () => { passed++; console.log(`  OK ${nom}`); },
    (e: Error) => { fails.push(`${nom} — ${e.message}`); console.log(`  ✗ ${nom}`); },
  );
}

// ── Un faux client Supabase qui RETOURNE ses erreurs, comme le vrai ─────────────
type Rep = { data?: unknown; error?: { message: string; code?: string } | null };
type Op = { table: string; action: "select" | "insert" | "update" | "upsert" | "delete"; valeur?: unknown; filtres: string[] };
function fauxClient(repondre: (op: Op) => Rep | "lever") {
  const ops: Op[] = [];
  const stockage: { seau: string; action: string; chemins?: unknown }[] = [];
  const client = {
    from(table: string) {
      const op: Op = { table, action: "select", filtres: [] };
      const b: Record<string, unknown> = {};
      for (const m of ["eq", "gte", "lte", "in", "limit", "order", "maybeSingle", "single", "neq", "is", "not", "or", "range"]) {
        b[m] = (...a: unknown[]) => { op.filtres.push(`${m}:${a.map(String).join(",")}`); return b; };
      }
      b.select = () => b;
      for (const a of ["insert", "update", "upsert", "delete"] as const) b[a] = (v?: unknown) => { op.action = a; op.valeur = v; return b; };
      b.then = (ok: (r: Rep) => unknown, ko?: (e: unknown) => unknown) => {
        ops.push({ ...op, filtres: [...op.filtres] });
        const r = repondre(op);
        if (r === "lever") return Promise.reject(new Error("coupure réseau simulée")).then(ok, ko);
        return Promise.resolve({ data: null, error: null, ...r }).then(ok, ko);
      };
      return b;
    },
    storage: {
      from(seau: string) {
        return {
          list: async (prefixe: string) => { stockage.push({ seau, action: "list", chemins: prefixe }); return { data: [{ name: "avatar.jpg" }], error: null }; },
          remove: async (chemins: string[]) => { stockage.push({ seau, action: "remove", chemins }); return { data: [], error: null }; },
        };
      },
    },
  };
  return { client: client as unknown as SupabaseClient, ops, stockage };
}
const auJournal = (ops: Op[]) => ops.filter((o) => o.table === "error_logs" && o.action === "insert")
  .map((o) => o.valeur as { source: string; message: string });

/** Sans commentaires : une explication qui décrit le défaut n'est pas le correctif. */
const codeNu = (f: string) => readFileSync(f, "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

/** Le corps de chaque handler exporté d'une route : `{ GET: "...", PATCH: "..." }`. */
function handlers(f: string): Record<string, string> {
  const src = codeNu(f);
  const out: Record<string, string> = {};
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;
  const pos = [...src.matchAll(re)].map((m) => ({ meth: m[1], i: m.index! }));
  pos.forEach((p, k) => { out[p.meth] = src.slice(p.i, k + 1 < pos.length ? pos[k + 1].i : undefined); });
  return out;
}

// ── 1. Sécurité ─────────────────────────────────────────────────────────────────
test("chaque méthode des routes de maintenance du catalogue est gardée", () => {
  // Elles écrivent avec la clé de service. Le PATCH de races/dedup ne l'était pas :
  // n'importe quelle requête anonyme renommait ou redatait une course.
  const routes = ["races/dedup", "races/geocode", "races/seed", "races/seed-full", "races/sync"];
  let vues = 0;
  for (const r of routes) {
    for (const [meth, corps] of Object.entries(handlers(`src/app/api/${r}/route.ts`))) {
      vues++;
      const tete = corps.slice(0, 1600);
      // Le secret des tâches planifiées COMPARÉ, puis l'administrateur à défaut : une simple
      // mention de `CRON_SECRET` ne suffit pas (relecture des tests du 08/11/2026).
      const garde = /const denied = await denyIfNotAdmin\(req\);\s*if \(denied\) return/.test(tete)
        && (!/CRON_SECRET/.test(tete) || /const parCron = !!secret && req\.headers\.get\("authorization"\) === `Bearer \$\{secret\}`;\s*if \(!parCron\) \{\s*const denied = await denyIfNotAdmin\(req\);/.test(tete));
      assert.ok(garde, `${r} ${meth} n'a aucune garde`);
    }
  }
  assert.ok(vues >= 11, `seulement ${vues} méthodes trouvées : le découpage ne voit plus les routes`);
});

test("chaque route d'administration exige aussi l'appareil de confiance", () => {
  // Audit du 08/11/2026 : 14 routes ne vérifiaient que l'adresse du compte, et 5 autres
  // s'ouvraient au seul secret partagé `x-admin-secret`. Le panneau exige l'appareil scellé :
  // ses routes s'appellent directement, elles doivent l'exiger aussi. Seule exception, la
  // route qui SCELLE l'appareil (elle ne peut pas exiger ce qu'elle délivre).
  const fichiers = (readdirSync("src/app/api/admin", { recursive: true }) as string[])
    .filter((f) => f.endsWith("route.ts")).map((f) => `src/app/api/admin/${f}`)
    .filter((f) => f !== "src/app/api/admin/appareil/route.ts");
  let vues = 0;
  const sansAppareil: string[] = [];
  for (const f of fichiers) {
    // La compta passe par une aide locale (`admin()`, `editeur()`) qui commence par `gardeAdmin`.
    const src = codeNu(f);
    const aideGardee = (nom: string) => new RegExp(`async function ${nom}\\(\\)[^\\n]*\\{\\s*if \\(!\\(await gardeAdmin\\(\\)\\)\\) return null;`).test(src);
    for (const [meth, corps] of Object.entries(handlers(f))) {
      vues++;
      const tete = corps.slice(0, 1600);
      const direct = /await (verdictAdmin|gardeAdmin)\(\)|!estAdmin\(user\?\.email\) \|\| await appareilRefuse\(user\.id\)/.test(tete);
      const parAide = ["admin", "editeur"].some((n) => new RegExp(`await ${n}\\(\\)`).test(tete) && aideGardee(n));
      if (!direct && !parAide) sansAppareil.push(`${f} ${meth}`);
    }
  }
  assert.deepEqual(sansAppareil, [], `route(s) d'administration sans appareil de confiance : ${sansAppareil.join(", ")}`);
  assert.ok(vues >= 29, `seulement ${vues} méthodes vues (29 le 08/11/2026) : le parcours des routes est cassé`);
  // Le secret partagé n'ouvre plus aucune route du panneau.
  for (const f of fichiers) assert.ok(!/headers\.get\("x-admin-secret"\)/.test(codeNu(f)), `${f} s'ouvre de nouveau au secret partagé`);
  // La garde des routes de maintenance exige l'appareil pour une session, et la garde
  // complète passe par le même contrôle.
  const garde = codeNu("src/lib/api/adminGuard.ts");
  assert.match(garde, /if \(user && estAdmin\(user\.email\) && !\(await appareilRefuse\(user\.id\)\)\) return null;/, "une session administrateur sans appareil rouvre les routes de maintenance");
  // Le secret partagé ouvrait aussi ces routes (dont `races/dedup`, qui supprime) SANS second
  // facteur, et plus aucun script ne l'envoyait (2e relecture du 08/11/2026).
  assert.ok(!/x-admin-secret|ADMIN_SECRET/.test(garde), "le secret partagé rouvre les routes de maintenance sans appareil");
  const acces = codeNu("src/lib/admin/acces.ts");
  assert.match(acces, /if \(await appareilRefuse\(user!\.id\)\) return \{ ok: false, motif: "refus" \};/, "verdictAdmin ne vérifie plus l'appareil");
  assert.match(acces, /if \(!appareilExige\(\)\) return false;\s*return !verifierAppareil\(/, "le contrôle d'appareil ne refuse plus un jeton invalide");
});

test("un secret absent n'ouvre pas l'import du flux de la boutique", () => {
  const src = codeNu("src/app/api/shop/import-feed/route.ts");
  assert.match(src, /const accepte = \(attendu: string \| undefined\) => !!secret && !!attendu && secret === attendu;/,
    "une variable d'environnement absente rend `undefined !== undefined` faux : la route s'ouvre");
  assert.ok(!/secret !== process\.env\./.test(src), "l'ancienne comparaison est revenue");
});

test("le journal ne reçoit jamais l'adresse complète d'une page", () => {
  // Le lien de suivi en direct : son identifiant est le seul secret de la position GPS.
  assert.equal(urlJournalisable("https://pacevo.fr/suivre/k3j9x2a7q"), "https://pacevo.fr/suivre/[id]");
  assert.equal(urlJournalisable("https://pacevo.fr/dashboard?suivre=abc&code=XYZ#token=1"), "https://pacevo.fr/dashboard");
  assert.equal(urlJournalisable("https://pacevo.fr/login?next=/dashboard/sync"), "https://pacevo.fr/login");
  assert.equal(urlJournalisable("http://localhost:3000/dashboard"), "http://localhost:3000/dashboard", "l'origine sert au tri du bruit de développement");
  assert.equal(urlJournalisable("https://pacevo.fr/api/messages/piece/123e4567-e89b-12d3-a456-426614174000"), "https://pacevo.fr/api/messages/piece/[id]");
  assert.equal(urlJournalisable("/suivre/abc?x=1"), "/suivre/[id]");
  assert.equal(urlJournalisable(""), null);
  assert.equal(urlJournalisable(42), null);
  const route = codeNu("src/app/api/log-error/route.ts");
  assert.match(route, /url: urlJournalisable\(body\.url\),/, "la route publique stocke de nouveau l'adresse telle que l'envoie le navigateur");
  assert.ok(!/url: cut\(body\.url/.test(route), "l'adresse brute est de nouveau écrite");
  assert.ok(!/url: location\.href/.test(codeNu("src/components/ErrorReporter.tsx")), "le rapporteur envoie de nouveau l'adresse complète");
});

test("l'identifiant du partage en direct est tiré au hasard cryptographique", () => {
  const src = codeNu("src/components/trail/TrailBuilder.tsx");
  assert.match(src, /const sid = idPartage\(\);/, "le partage en direct ne passe plus par idPartage");
  assert.ok(!/Math\.random\(\)\.toString\(36\)/.test(src), "un identifiant de suivi GPS tiré par Math.random est revenu");
});

// ── 2. Le coach ne supprime pas un plan sur une panne ───────────────────────────
testAsync("une VMA illisible ne fait ni purger le plan ni prescrire le test VMA", async () => {
  const { autoCoachForUser } = await import("../src/lib/ai/autoCoach");
  const { client, ops } = fauxClient((op) => {
    if (op.table === "profiles") return { data: { created_at: new Date().toISOString(), subscription_tier: "premium", email: "coureur@exemple.fr", preferred_language: "fr" } };
    if (op.table === "performance_baselines") return { error: { message: "upstream connect error" } };
    return { data: [] };
  });
  const r = await autoCoachForUser(client as never, { userId: "u1" });
  assert.equal(r.processed, false, "une panne est traitée comme « pas de VMA » et le coach repart d'un test");
  assert.equal(r.reason, "vma illisible");
  const seances = ops.filter((o) => o.table === "notifications" && (o.action === "delete" || o.action === "insert"));
  assert.equal(seances.length, 0, `le plan a été touché sur une panne : ${seances.map((o) => o.action).join(", ")}`);
  assert.equal(auJournal(ops).length, 1, "la panne n'atteint pas error_logs");
  assert.ok(!/coureur@exemple/.test(auJournal(ops)[0].message), "l'adresse du coureur part dans le journal");
});

testAsync("un profil illisible ne fait pas non plus repartir le coach de zéro", async () => {
  const { autoCoachForUser } = await import("../src/lib/ai/autoCoach");
  const { client, ops } = fauxClient((op) => (op.table === "profiles" ? { error: { message: "timeout" } } : { data: [] }));
  const r = await autoCoachForUser(client as never, { userId: "u1" });
  assert.equal(r.processed, false);
  assert.equal(r.reason, "profil illisible");
  assert.equal(ops.filter((o) => o.table === "notifications" && o.action !== "select").length, 0, "une écriture du plan a eu lieu");
});

// ── 3. La suppression de compte efface tout, ou rien ────────────────────────────
test("supprimer son compte efface aussi fichiers, lettre, journal et abonnement, ou n'efface rien", () => {
  const src = codeNu("src/app/api/account/delete/route.ts");
  const pos = (motif: RegExp, quoi: string) => { const i = src.search(motif); assert.ok(i >= 0, `${quoi} : étape absente`); return i; };
  const lecture = pos(/\.select\("intervals_api_key"\)/, "lecture du jeton");
  const stripeArret = pos(/stripe\.subscriptions\.cancel\(abonnement/, "résiliation Stripe");
  const fichiers = pos(/for \(const seau of \["avatars", SEAU_PJ\]\)/, "avatar et pièces jointes");
  const retrait = pos(/\.storage\.from\(seau\)\.remove\(chemins\)/, "retrait des fichiers");
  const lettre = pos(/from\("newsletter_subscribers"\)\.delete\(\)\.eq\("user_id", user\.id\)/, "lettre (compte)");
  pos(/from\("newsletter_subscribers"\)\.delete\(\)\.eq\("email", user\.email\.toLowerCase\(\)\)/, "lettre (adresse)");
  const journal = pos(/from\("error_logs"\)\.delete\(\)\.eq\("user_id", user\.id\)/, "journal d'erreurs");
  const profil = pos(/from\("profiles"\)\.delete\(\)/, "profil");
  const compte = pos(/deleteUser\(/, "compte");
  // Stripe en DERNIER avant le profil : une étape précédente en échec ne doit pas arrêter
  // l'abonnement d'un compte qui reste en place (relecture du 08/11/2026).
  assert.ok(lecture < fichiers && fichiers < retrait && retrait < lettre && lettre < journal && journal < stripeArret && stripeArret < profil && profil < compte,
    "ordre attendu : lire, fichiers, lettre, journal, résilier, profil, compte");
  assert.match(src, /for \(let tour = 0; tour < 50; tour\+\+\)/, "les fichiers ne sont plus retirés par lots : au-delà de 1 000, il en reste");
  assert.ok(!/intacts/.test(src), "le message affirme de nouveau que tout est intact après une étape irréversible");
  // Chaque étape lue : une erreur arrête tout AVANT l'effacement du compte.
  for (const e of ["eMontre", "eFacturation", "eListe", "eRetrait", "eLettreCompte", "eLettreAdresse", "eJournal", "eProfil"]) {
    assert.match(src, new RegExp(`if \\(${e}\\) (\\{\\s*)?return echec\\(`), `l'erreur ${e} ne bloque plus la suppression`);
  }
  assert.ok(!/console\.error\("\[compte\] jeton intervals\.icu illisible/.test(src), "une lecture ratée du profil laisse de nouveau filer la suppression");
  // Les notifications (objectif, course planifiée, état d'abonnement) partent AVEC le profil,
  // par la cascade, jamais avant une étape qui peut échouer (relecture du 08/11/2026).
  assert.ok(!/from\("notifications"\)\.delete\(\)/.test(src), "les notifications sont de nouveau effacées avant le profil : un échec laisse un compte sans objectif");
  // Le message dit ce qui est vrai : rien d'effacé, en partie effacé, ou tout sauf l'identifiant.
  assert.ok(!/existe toujours/.test(src), "le message promet de nouveau un compte intact après une étape irréversible");
  assert.match(src, /error: entame \? EN_PARTIE|const message = entame \? EN_PARTIE/, "le message d'échec ne distingue plus « rien effacé » de « en partie effacé »");
  const fichiersSrc = src.slice(src.search(/for \(const seau of/), src.search(/\.storage\.from\(seau\)\.remove\(chemins\)/));
  assert.match(fichiersSrc, /entame = true;/, "un retrait de fichiers n'est plus compté comme une suppression entamée");
  assert.match(src, /entame = true;\s*const \{ error: eLettreCompte \}/, "l'effacement de la lettre n'est plus compté comme une suppression entamée");
  assert.match(src, /stripe\.subscriptions\.cancel\([^;]*;\s*resilie = true;/, "une résiliation faite n'est plus dite à l'athlète si la suite échoue");
});

// ── 4. Newsletter, import GPX, heure de départ ──────────────────────────────────
test("la désinscription lit son écriture et répond au bouton des messageries", () => {
  const src = codeNu("src/app/api/newsletter/unsubscribe/route.ts");
  assert.match(src, /const \{ error \} = await admin\.from\("newsletter_subscribers"\)\.update\(\{ unsubscribed: true \}\)/, "l'écriture de la désinscription n'est plus lue");
  assert.match(src, /if \(!error\) return \{ ok: true \};/, "un refus de la base est de nouveau annoncé « C'est fait »");
  assert.match(src, /export async function POST\(req: Request\) \{\s*const r = await desinscrire\(req\);/, "le POST en un clic (RFC 8058) a disparu : Gmail reçoit un 405");
  // Les e-mails annoncent le POST : la route doit y répondre.
  assert.match(readFileSync("src/app/api/newsletter/weekly/route.ts", "utf8"), /List-Unsubscribe-Post/);
});

test("un GPX sans heures ni trace est refusé, et le dénivelé ne s'invente pas", () => {
  const src = codeNu("src/app/api/intervals/import-gpx/route.ts");
  assert.match(src, /if \(points\.length < 2\) \{\s*return NextResponse\.json\([\s\S]{0,120}status: 400/, "un fichier sans trace fait de nouveau tomber la route ou crée une séance vide");
  assert.match(src, /if \(!points\[0\]\.time \|\| !points\[points\.length - 1\]\.time\) \{\s*return NextResponse\.json\([\s\S]{0,300}status: 400/, "un GPX sans heures devient une séance de 1 s datée d'aujourd'hui");
  assert.match(src, /if \(a == null \|\| b == null\) continue;/, "un point sans altitude compte de nouveau un dénivelé inventé");
  assert.match(src, /if \(eDeja\) return NextResponse\.json\([\s\S]{0,120}status: 503/, "un doublon non vérifiable est de nouveau inséré");
});

test("un GPX se lit quel que soit l'ordre de ses attributs", () => {
  // 3e relecture du 08/11/2026 : seul `lat="…" lon="…"` était lu ; un export `lon` d'abord
  // arrivait vide et, depuis le refus des fichiers sans trace, était refusé.
  const pts = parseGPX(`<gpx><trk><name>Sortie</name><trkseg>
    <trkpt lon="2.35" lat="48.85"><ele>35</ele><time>2026-11-08T08:00:00Z</time></trkpt>
    <trkpt lat='48.86' lon='2.36'><time>2026-11-08T08:05:00Z</time></trkpt>
    <trkpt lat="48.87" lon="2.37"/>
    <trkpt lat="abc" lon="2.38"><time>2026-11-08T08:10:00Z</time></trkpt>
  </trkseg></trk></gpx>`);
  assert.equal(pts.name, "Sortie");
  assert.deepEqual(pts.points.map((p) => [p.lat, p.lng]), [[48.85, 2.35], [48.86, 2.36], [48.87, 2.37]], "un point est perdu, inversé, ou un point illisible entre dans la trace");
  assert.equal(pts.points[0].ele, 35);
  assert.equal(pts.points[0].time, "2026-11-08T08:00:00Z");
  assert.equal(pts.points[1].time, "2026-11-08T08:05:00Z", "un point à guillemets simples perd son heure");
  assert.equal(pts.points[2].time, undefined);
  assert.match(codeNu("src/app/api/intervals/import-gpx/route.ts"), /import \{[^}]*\bparseGPX\b[^}]*\} from "@\/lib\/intervals\/gpx"/, "la route lit de nouveau le GPX avec sa propre copie");
});

test("le cron de l'heure de départ n'écrase pas un objectif modifié pendant sa recherche", () => {
  const src = codeNu("src/app/api/cron/heure-depart/route.ts");
  const iRelue = src.indexOf('const { data: actuelle, error: eRelue } = await sb.from("notifications").select("data").eq("id", l.id)');
  const iEcrit = src.indexOf("update({ data: { ...now, ...ajout }");
  assert.ok(iRelue > 0 && iEcrit > iRelue, "la ligne n'est plus relue juste avant d'écrire");
  assert.match(src, /const memeCourse = now\.race === o\.race && now\.raceDate === o\.raceDate;/, "une heure trouvée pour l'ancienne course irait sur la nouvelle");
  assert.ok(!/update\(\{ data: majBase/.test(src), "la copie lue en début de passage écrase de nouveau l'objectif");
});

// ── 5. Aucune adresse e-mail dans le journal ────────────────────────────────────
test("le journal ne reçoit plus aucune adresse, d'où qu'elle vienne", () => {
  assert.equal(sansAdresse("E-mail non envoyé à jean.dupont+test@exemple.fr : Resend HTTP 403 — jean.dupont+test@exemple.fr non vérifié"),
    `E-mail non envoyé à ${MASQUE} : Resend HTTP 403 — ${MASQUE} non vérifié`);
  assert.deepEqual(sansAdresse({ email: "a@b.fr", to: ["x@y.io"], inscrit: "c@d.com", lang: "fr", note: "écrire à e@f.org", n: 3 }),
    { email: MASQUE, to: [MASQUE], inscrit: MASQUE, lang: "fr", note: `écrire à ${MASQUE}`, n: 3 });
  // Une clé d'adresse part entière, même quand sa valeur échappe au motif (sans domaine).
  assert.deepEqual(sansAdresse({ email: "jean.dupont@intranet", inscrit: "Jean Dupont" }), { email: MASQUE, inscrit: MASQUE });
  // `to` peut désigner une page ou une étape : utile au diagnostic, il reste lisible.
  assert.deepEqual(sansAdresse({ to: "/dashboard/calendrier", etape: "paiement", paquet: "zod@3.23.8" }),
    { to: "/dashboard/calendrier", etape: "paiement", paquet: "zod@3.23.8" });
  assert.equal(sansAdresse(null), null);
  assert.equal(sansAdresse("rien de personnel"), "rien de personnel");
  // Chaque point d'écriture du journal passe par le masque, sauf ceux qui n'écrivent que
  // des textes fixes ou des causes de la base (relus le 08/11/2026).
  const SANS_ADRESSE_POSSIBLE = new Set(["src/app/api/csp-report/route.ts", "src/lib/intervals/refusSynchro.ts", "src/app/api/workouts/log/route.ts"]);
  const points = ["src/lib/email/envoyer.ts", "src/app/api/auth/confirmation/route.ts", "src/app/api/log-error/route.ts",
    "src/lib/journal/echecServeur.ts", "src/app/api/webhooks/intervals/route.ts", "src/app/api/intervals/oauth/callback/route.ts",
    "src/lib/billing/revenuecat.ts", "src/lib/ai/rappelPremiumServeur.ts"];
  for (const f of points) {
    const src = codeNu(f);
    const i = src.search(/from\("error_logs"\)\s*\.insert\(/);
    assert.ok(i >= 0, `${f} n'écrit plus dans le journal : liste à revoir`);
    const ecrit = src.slice(i, i + 500);
    assert.match(ecrit, /message: sansAdresse\(/, `${f} écrit son message sans masquer les adresses`);
    // `meta` porte souvent `{ email }`, `{ to }` ou un corps d'erreur qui répète l'adresse.
    if (/\bmeta\b/.test(ecrit)) assert.match(ecrit, /meta: sansAdresse\(/, `${f} écrit son meta sans masquer les adresses`);
  }
  assert.ok(!/Accusé d'inscription non envoyé à \$\{clean\}/.test(codeNu("src/app/api/newsletter/subscribe/route.ts")), "l'inscription recopie de nouveau l'adresse");
  void SANS_ADRESSE_POSSIBLE;
});

// ── 6. Stripe (latent tant que Stripe n'a pas de clé en production) ─────────────
test("le webhook Stripe redemande l'événement quand la base ne répond pas", () => {
  const src = codeNu("src/app/api/stripe/webhook/route.ts");
  assert.match(src, /if \(error\) return \{ id: null, panne: /, "une lecture ratée vaut de nouveau « aucun athlète » (200, jamais réémis)");
  assert.equal([...src.matchAll(/if \(lu\.panne\) \{ echecs\.push\(lu\.panne\); break; \}/g)].length, 2, "une branche d'abonnement ignore la panne de lecture");
  assert.match(src, /if \(eQui\) \{ echecs\.push\(/, "l'échec de paiement ignore la panne de lecture");
  assert.match(src, /if \(eLigne\) \{ echecs\.push\(/, "l'état précédent illisible est écrasé par des champs vides");
  const chk = codeNu("src/app/api/stripe/checkout/route.ts");
  const iGarde = chk.search(/if \(eProfil \|\| !profile\) \{\s*return NextResponse\.json\(/);
  assert.ok(iGarde > 0 && iGarde < chk.indexOf("stripe.customers.create("), "un profil illisible crée de nouveau un client Stripe (et un essai offert)");
});

test("la rétractation garde un remboursement réussi même si l'arrêt échoue", () => {
  const src = codeNu("src/app/api/stripe/retractation/route.ts");
  const iRemb = src.indexOf("await stripe.refunds.create(");
  const iArret = src.indexOf("await stripe.subscriptions.cancel(subId");
  const entre = src.slice(iRemb, iArret);
  assert.ok(iRemb > 0 && iArret > iRemb && /\} catch \(e\) \{\s*erreurRemboursement = /.test(entre), "remboursement et arrêt partagent de nouveau un seul try : un remboursement réussi serait annoncé « à faire »");
  assert.ok(!/rembourseCentimes = null;/.test(src.slice(iRemb)), "un échec efface de nouveau le montant déjà remboursé");
  assert.match(src, /ne PAS rembourser à nouveau/, "l'éditeur n'est plus prévenu qu'un remboursement est déjà fait");
  assert.match(src, /if \(erreurStripe\) \{\s*await journaliserEchec\(admin,/, "une rétractation à finir à la main n'atteint pas le journal");
});

testAsync("le rappel légal de reconduction ne repart pas sur une panne", async () => {
  const { envoyerRappelsReconduction } = await import("../src/lib/billing/reconduction");
  const echeance = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
  const etat = { statut: "active", periodeFin: echeance, annuleALaFin: false, echecPaiement: false, intervalle: "an" };
  // 1. Lecture « déjà envoyé ? » en panne : rien n'est envoyé ni posé.
  // ⚠️ DES FIXTURES COMPLÈTES : sans profil ni clé d'envoi, la fonction s'arrêtait d'elle-même
  // (« pas d'adresse », « RESEND_API_KEY absente ») et le test passait sans rien prouver —
  // deux mutations le sont restées vertes avant qu'il ne soit corrigé.
  const PROFIL = { email: "abonne@exemple.fr", preferred_language: "fr", subscription_tier: "premium" };
  const scenario = (o: { deja?: Rep; verrou?: Rep }) => fauxClient((op) => {
    if (op.table === "notifications" && op.action === "insert") return o.verrou ?? { data: { id: "r1" } };
    if (op.table === "notifications" && op.action === "delete") return {};
    if (op.table === "notifications" && op.action === "select" && op.filtres.some((f) => f.includes("rappel_reconduction"))) return o.deja ?? { data: null };
    if (op.table === "notifications" && op.action === "select") return { data: [{ user_id: "u1", data: etat }] };
    if (op.table === "profiles") return { data: PROFIL };
    return { data: null };
  });
  const avant = globalThis.fetch, cleAvant = process.env.RESEND_API_KEY;
  let appels = 0;
  globalThis.fetch = (async () => { appels++; return new Response(JSON.stringify({ id: "e1" }), { status: 200 }); }) as typeof fetch;
  process.env.RESEND_API_KEY = "re_test_factice";
  try {
    // 0. Témoin : tout répond, le rappel part une fois, verrou posé.
    const ok = scenario({});
    const r0 = await envoyerRappelsReconduction(ok.client, new Date());
    assert.equal(r0.envoyes, 1, "le cas normal n'envoie plus rien : le test ne prouverait plus rien");
    assert.equal(appels, 1);
    // 1. Lecture « déjà envoyé ? » en panne : rien n'est envoyé ni posé.
    appels = 0;
    const panne = scenario({ deja: { error: { message: "timeout" } } });
    const r1 = await envoyerRappelsReconduction(panne.client, new Date());
    assert.equal(r1.envoyes, 0, "un rappel est parti sans savoir s'il l'était déjà");
    assert.equal(appels, 0, "un e-mail est parti sur une lecture ratée");
    assert.equal(panne.ops.filter((o) => o.table === "notifications" && o.action === "insert").length, 0, "un verrou a été posé sur une lecture ratée");
    // 2. Verrou impossible à poser : rien n'est envoyé (avant, l'envoi partait puis se répétait).
    appels = 0;
    const verrou = scenario({ verrou: { error: { message: "permission denied" } } });
    const r2 = await envoyerRappelsReconduction(verrou.client, new Date());
    assert.equal(r2.envoyes, 0);
    assert.equal(appels, 0, "l'e-mail est parti alors que le verrou n'a pas pu être posé");
  } finally {
    globalThis.fetch = avant;
    if (cleAvant === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = cleAvant;
  }
});

test("la comptabilité ne s'affiche pas sur des réglages ou un journal d'accès illisibles", () => {
  const src = codeNu("src/app/api/admin/compta/route.ts");
  assert.match(src, /if \(reg\.error\) return NextResponse\.json\([\s\S]{0,80}status: 500/, "des réglages illisibles donnent un résultat faux sans un mot");
  assert.match(src, /if \(acc\.error\) return NextResponse\.json\([\s\S]{0,80}status: 500/, "un journal d'accès illisible se lit « personne n'a consulté »");
});

// ── 7. Défauts moyens : ce que le coureur voit ──────────────────────────────────
test("une panne ne se lit plus comme « personne », « pas en favori » ou « aucun parcours »", () => {
  const follow = codeNu("src/app/api/social/follow/route.ts");
  assert.match(follow, /if \(eAthletes \|\| eSuivis\) \{\s*return NextResponse\.json\([\s\S]{0,120}status: 503/,
    "des suivis illisibles affichent « Suivre » pour des gens suivis, et le clic retire le suivi");
  assert.match(codeNu("src/app/api/races/favori/route.ts"), /if \(eLecture\) return NextResponse\.json\([\s\S]{0,80}status: 503/, "le retrait d'un favori répond « fait » sans rien supprimer");
  assert.match(codeNu("src/app/api/routes/route.ts"), /if \(repli\.error\) return NextResponse\.json\([\s\S]{0,80}status: 503/, "des parcours illisibles deviennent « aucun parcours »");
  const trail = codeNu("src/components/trail/TrailBuilder.tsx");
  const i = trail.indexOf("const handleDeleteRoute");
  const corps = trail.slice(i, trail.indexOf("}, [d]);", i));
  assert.match(corps, /supprime = res\.ok;/, "la suppression d'un parcours ne lit plus la réponse");
  assert.ok(corps.indexOf("if (!supprime)") < corps.indexOf('toast.success(d["t.deleted"])'), "« supprimé » s'affiche avant de savoir");
  assert.equal(readFileSync("src/components/trail/trailI18n.ts", "utf8").split('"t.delErr":').length - 1, 5, "le message d'échec manque dans une langue");
});

test("le badge, le pass PPS et la messagerie attendent la réponse avant de l'annoncer", () => {
  const quiz = codeNu("src/components/cours/CoursQuiz.tsx");
  assert.match(quiz, /\.then\(\(r\) => \{ if \(r\.ok\) setBadge\(true\); \}\)/, "le badge est annoncé avant d'être enregistré");
  assert.ok(!/setBadge\(true\);\s*fetch\("\/api\/cours\/badge"/.test(quiz), "le badge est de nouveau posé avant l'appel");
  const pps = codeNu("src/components/pps/PpsVerifier.tsx");
  assert.match(pps, /if \(!res\?\.ok\) \{ setEtat\("echec"\); return; \}/, "« Enregistré » s'affiche sur un refus");
  assert.equal(readFileSync("src/lib/pps/ppsI18n.ts", "utf8").split("echecEnregistrement: \"").length - 1, 5, "le message d'échec du PPS manque dans une langue");
  const msg = codeNu("src/app/api/messages/route.ts");
  assert.match(msg, /if \(eLiens\) return NextResponse\.json\([\s\S]{0,100}status: 503/, "une panne répond « vous ne pouvez pas écrire » (403)");
  assert.match(msg, /if \(eNoms\) return NextResponse\.json\([\s\S]{0,100}status: 503/, "« Un athlète » est de nouveau figé dans un message sur une panne");
});

test("l'assistant ne pose aucun diagnostic sur un état de compte illisible", () => {
  const src = codeNu("src/app/api/ai/support/route.ts");
  assert.match(src, /const etatIllisible = \[profRes, woRes, lastWoRes, csRes, stateRes, objRes, wlRes\]\.some\(\(r\) => r\.error\);/, "une lecture ratée n'est plus repérée");
  assert.match(src, /const constats = etatIllisible \? \[\] : diagnoseAccount\(state\);/, "un profil illisible devient « montre non connectée » dans la réponse");
});

// ── 8. Vie privée ───────────────────────────────────────────────────────────────
test("la déconnexion des Réglages vide l'appareil comme les autres", () => {
  const reglages = codeNu("src/components/settings/SettingsView.tsx");
  assert.match(reglages, /const signOut = async \(\) => \{ await deconnexion\(\);/, "le bouton « Déconnexion » des Réglages laisse séances, tracés et brouillons sur l'appareil");
  assert.match(reglages, /if \(j\.ok \|\| j\.donneesEffacees\) \{ if \(!j\.ok\) toast\.error\(j\.error\); await deconnexion\(\);/, "la suppression du compte laisse les données sur l'appareil");
  assert.ok(!/await sb\.auth\.signOut\(\)/.test(reglages), "un signOut sans ménage est revenu");
  const dec = codeNu("src/lib/auth/deconnexion.ts");
  assert.match(dec, /const perso = \/\^\(rte:draft:\|cours-\)\/;/, "les brouillons ou les révisions restent après la déconnexion");
  // Mais JAMAIS les parcours locaux : quand la sauvegarde en ligne a échoué, ils n'existent
  // que là, et les effacer les détruirait sans retour (relecture du 08/11/2026).
  assert.ok(!/trail_routes/.test(dec.slice(dec.indexOf("const perso"), dec.indexOf("const perso") + 80)), "la déconnexion détruit de nouveau les parcours enregistrés seulement dans ce navigateur");
  assert.match(dec, /sessionStorage\.clear\(\);/);
});

test("seul le prénom part au modèle, et un compte privé ne s'ouvre pas sur une panne", () => {
  const ctx = codeNu("src/lib/ai/coachContext.ts");
  assert.match(ctx, /const prenomSeul = String\(p\?\.full_name \?\? ""\)\.trim\(\)\.split\(\/\\s\+\/\)\[0\] \|\| "Athlète";/, "le nom complet repart au modèle");
  assert.ok(!/- \$\{p\?\.full_name \?\? "Athlète"\} ·/.test(ctx), "le nom complet est de nouveau écrit dans l'invite");
  const inter = codeNu("src/app/api/social/interact/route.ts");
  assert.match(inter, /if \(\(eAuteur && eAuteur\.code !== "42703"\) \|\| eSuis \|\| eSuit\) \{\s*return NextResponse\.json\([\s\S]{0,120}status: 503/,
    "une panne ouvre de nouveau les commentaires d'un compte privé (repli « public »)");
  assert.match(inter, /if \(error\) return NextResponse\.json\(\{ error: "Commentaires momentanément illisibles\." \}, \{ status: 503 \}\);/, "des commentaires illisibles deviennent « aucun commentaire »");
});

// ── 9. Crons et administration ──────────────────────────────────────────────────
testAsync("un refus qui dure ne s'écrit qu'une fois par jour au journal", async () => {
  const { journaliserEchecUneFois } = await import("../src/lib/journal/echecServeur");
  const deja = fauxClient((op) => (op.table === "error_logs" && op.action === "select" ? { data: [{ id: 1 }] } : {}));
  await journaliserEchecUneFois(deja.client, { source: "sync-cron", userId: "u1", message: "Synchronisation refusée : Intervals.icu 401" });
  assert.equal(auJournal(deja.ops).length, 0, "le même refus se réécrit à chaque passage");
  const neuf = fauxClient((op) => (op.action === "select" ? { data: [] } : {}));
  await journaliserEchecUneFois(neuf.client, { source: "sync-cron", userId: "u1", message: "Synchronisation refusée : Intervals.icu 401" });
  assert.equal(auJournal(neuf.ops).length, 1, "un refus nouveau n'est pas journalisé");
  const aveugle = fauxClient((op) => (op.action === "select" ? { error: { message: "timeout" } } : {}));
  await journaliserEchecUneFois(aveugle.client, { source: "sync-cron", userId: "u1", message: "x" });
  assert.equal(auJournal(aveugle.ops).length, 1, "une lecture ratée du journal fait taire l'échec");
});

test("les crons disent leurs échecs, et ne repartent pas d'un état illisible", () => {
  const sync = codeNu("src/app/api/cron/sync-all/route.ts");
  assert.match(sync, /if \(r\.error && !estErreurTransitoire\(r\.error, r\.status \?\? null\)\) \{\s*await journaliserEchecUneFois\(/, "le refus d'un athlète n'atteint pas le journal, ou se trie sur le texte seul");
  assert.match(codeNu("src/lib/intervals/syncAndCoach.ts"), /error: s\.error, status: s\.status \?\? null \}/, "le statut HTTP se perd de nouveau en route");
  const nuit = codeNu("src/app/api/cron/auto-coach/route.ts");
  assert.match(nuit, /if \(!r\.processed && r\.reason && !ETATS_NORMAUX\.has\(r\.reason\)\) \{\s*await journaliserEchecUneFois\(/, "le coach de nuit échoue de nouveau en silence");
  for (const f of ["src/app/api/cron/races-liens/route.ts", "src/app/api/cron/races-types/route.ts"]) {
    assert.match(codeNu(f), /if \(eEtat\) return NextResponse\.json\([\s\S]{0,80}status: 500/, `${f} repart de zéro sur un état illisible et double sa ligne d'état`);
  }
  assert.match(codeNu("src/app/api/cron/races-types/route.ts"), /else \{ refusees\+\+; if \(erreurs\.length < 5\) erreurs\.push\(`\$\{c\.name\} \(type → /, "une correction de type refusée est de nouveau tue");
  assert.match(codeNu("src/app/api/cron/races-maintenance/route.ts"), /if \(eVisites\) await journaliserEchecUneFois\(/, "la purge des visites (CNIL) échoue en silence");
  assert.match(codeNu("src/app/api/admin/read-messages/route.ts"), /if \(error\) return NextResponse\.json\(\{ error: error\.message \}, \{ status: 500 \}\);/);
  assert.match(codeNu("src/app/api/admin/broadcast/route.ts"), /if \(eSubs\) return NextResponse\.json\(/, "une panne se lit « 0 abonné »");
});

// ── 10. Relecture du 08/11/2026 au soir ─────────────────────────────────────────
test("après une suppression de compte, la résiliation Stripe ne fait pas réémettre en boucle", () => {
  const src = codeNu("src/app/api/stripe/webhook/route.ts");
  const i = src.indexOf('case "customer.subscription.deleted"');
  const branche = src.slice(i, src.indexOf("case ", i + 10));
  assert.match(branche, /\.eq\("id", userId\)\.select\("id"\);/, "la fin d'accès ne sait plus si le profil existe encore");
  assert.match(branche, /if \(!\(touches \?\? \[\]\)\.length\) break;/, "un compte supprimé fait de nouveau échouer l'événement (500, réémis pendant des jours)");
  assert.match(src, /if \(echecs\.length\) \{\s*await signalerReemission\(admin, event, echecs\);/, "les échecs du webhook ne vont de nouveau qu'à la console");
  const signale = src.slice(src.indexOf("async function signalerReemission"));
  assert.match(signale.slice(0, 600), /await journaliserEchecUneFois\(admin, \{ source: "stripe"/, "la réémission demandée n'est plus écrite au journal");
  const dernier = codeNu("src/app/api/account/delete/route.ts");
  assert.match(dernier, /deleteUser\(user\.id\);\s*if \(error\) \{\s*await journaliserEchec\(admin,/, "l'échec du dernier pas (identifiant de connexion) n'est pas journalisé");
  assert.match(dernier, /if \(error\) \{[\s\S]{0,400}error: DONNEES_EFFACEES, donneesEffacees: true/, "l'échec du dernier pas dit de nouveau « ton compte existe » alors que les données sont effacées");
  assert.match(codeNu("src/components/settings/SettingsView.tsx"), /if \(j\.ok \|\| j\.donneesEffacees\) \{/, "données effacées : l'écran laisse l'athlète connecté à un compte sans profil");
});

test("un parcours resté dans le navigateur se supprime sans passer par le serveur", () => {
  // Relecture du 08/11/2026 : un parcours du repli local a pour id `Date.now()`, pas un UUID.
  // Demandé au serveur, Postgres le refusait (500) et l'écran disait « Suppression impossible ».
  const tb = codeNu("src/components/trail/TrailBuilder.tsx");
  const supp = tb.slice(tb.indexOf("const handleDeleteRoute"), tb.indexOf("const handleDeleteRoute") + 1400);
  assert.match(supp, /let supprime = !enLigne;/, "un parcours local n'est plus supprimable : il attend une réponse du serveur qui ne le connaît pas");
  assert.match(supp, /if \(enLigne\) \{\s*try \{\s*const res = await fetch\(/, "l'id local repart au serveur");
  const route = codeNu("src/app/api/routes/route.ts");
  const del = route.slice(route.indexOf("export async function DELETE"));
  assert.ok(/status: 404/.test(del) && del.search(/status: 404/) < del.search(/\.from\("user_routes"\)/), "un id qui n'est pas un UUID part de nouveau à Postgres (500, lu comme une panne)");
});

test("3e relecture : abonnement d'un compte supprimé, Stripe absent, journal sans répétition", () => {
  // L'état d'abonnement d'un profil effacé viole la clé étrangère (23503) : pas de 500, qui
  // ferait réémettre l'événement pendant trois jours pour rien.
  const wh = codeNu("src/app/api/stripe/webhook/route.ts");
  assert.match(wh, /if \(error\?\.code === "23503"\) \{ await orphelin\([^)]*\); return; \}\s*if \(error\) echecs\.push\(`état d'abonnement/, "l'état d'abonnement d'un compte supprimé fait de nouveau réémettre l'événement");
  // Sans clé Stripe, l'abonnement ne s'arrête pas d'ici : la résiliation à faire est écrite.
  const compte = codeNu("src/app/api/account/delete/route.ts");
  assert.match(compte, /if \(abonnement && !stripeConfigured\) \{\s*await journaliserEchec\(admin, \{[\s\S]{0,300}à résilier à la main/, "un abonnement est de nouveau sauté sans trace quand Stripe n'est pas configuré");
  assert.ok(compte.search(/abonnement && !stripeConfigured/) < compte.search(/from\("profiles"\)\.delete\(\)/), "la trace de la résiliation à faire arrive après l'effacement du profil");
  // Les fonctions appelées à chaque synchro ou à chaque question n'écrivent qu'une ligne par jour.
  const coach = codeNu("src/lib/ai/autoCoach.ts");
  assert.match(coach, /await journaliserEchecUneFois\(admin, \{ source: "coach-auto", userId, message: `Profil illisible/, "un profil illisible s'écrit de nouveau toutes les 2 min");
  assert.match(coach, /await journaliserEchecUneFois\(admin, \{ source: "coach-auto", userId, message: `VMA illisible/, "une VMA illisible s'écrit de nouveau toutes les 2 min");
  assert.match(codeNu("src/app/api/ai/support/route.ts"), /await journaliserEchecUneFois\(null, \{ source: "support"/, "l'assistant écrit de nouveau une ligne par question pendant une panne");
});

test("les écrans disent une panne au lieu d'afficher un faux vide", () => {
  const amis = codeNu("src/components/social/AjouterAmis.tsx");
  assert.match(amis, /if \(!r\.ok\) \{ toast\.error\(d\.indispo\); return; \}/, "une panne se lit « personne à suggérer »");
  assert.match(amis, /r\.status === 404 \? d\.introuvable : d\.indispo/, "une panne se lit « athlète introuvable »");
  assert.equal(readFileSync("src/components/social/AjouterAmis.tsx", "utf8").split("indispo: \"").length - 1, 5, "le message manque dans une langue");
  const club = codeNu("src/components/social/SocialHub.tsx");
  // 3e relecture du 08/11/2026 : `setItems((x) => x ?? [])` affichait encore « aucun
  // commentaire — sois le premier » sous le message de panne.
  assert.match(club, /if \(!r\?\.ok\) \{ setPanne\(true\); toast\.error\(t\("club\.commentIndispo"\)\); return; \}/, "une panne n'est plus retenue");
  assert.ok(!/setItems\(\(x\) => x \?\? \[\]\)/.test(club), "une panne se lit de nouveau « aucun commentaire — sois le premier »");
  assert.match(club, /items === null \? \(\s*panne \? <p[^>]*>\{t\("club\.commentIndispo"\)\}<\/p>/, "sans liste, la panne n'est plus dite à la place des commentaires");
  assert.ok(club.indexOf('if (!r?.ok) { const j = await r?.json()') < club.indexOf('setText(""); void load();'), "un commentaire refusé disparaît sans un mot");
  const trail = codeNu("src/components/trail/TrailBuilder.tsx");
  assert.match(trail, /\} else \{\s*toast\.error\(d\["t\.loadErr"\]\);\s*\}/, "des parcours en ligne illisibles basculent en silence sur ce navigateur");
  assert.equal(readFileSync("src/components/trail/trailI18n.ts", "utf8").split('"t.loadErr":').length - 1, 5);
});

test("le cron de l'heure de départ ne marque pas « cherchée » une course qu'il n'a pas cherchée", () => {
  const src = codeNu("src/app/api/cron/heure-depart/route.ts");
  assert.match(src, /if \(!memeCourse\) \{[\s\S]{0,300}continue;\s*\}/, "une course modifiée pendant la recherche est marquée « cherchée aujourd'hui »");
  assert.match(src, /if \(majBase\.heureDepart\) trouvees--;/, "une heure non posée est comptée « trouvée »");
  assert.match(src, /\} else if \(majBase\.heureDepart\) \{\s*trouvees--;/, "une heure saisie entre-temps (la nôtre non posée) est comptée « trouvée »");
});

// ── Lot 3 (08/11/2026, soir) ────────────────────────────────────────────────────
test("lot 3 : un cache d'IA illisible ne paie pas le modèle et ne crée pas de doublon", () => {
  for (const [f, source] of [["src/app/api/ai/ajustement/route.ts", "ia-ajustement"], ["src/app/api/ai/bilan/route.ts", "ia-bilan"]] as const) {
    const src = codeNu(f);
    const lu = src.search(/const \{ data: memos, error: eCache \} = await admin/);
    // La ligne la plus récente, jamais `maybeSingle` : un doublon ferait une erreur à vie.
    assert.match(src, /\.order\("created_at", \{ ascending: false \}\)\.limit\(1\);\s*const memo = memos\?\.\[0\] \?\? null;/, `${f} : le cache est de nouveau lu par maybeSingle (un doublon = « indisponible » pour toujours)`);
    const arret = src.search(/if \(eCache\) \{[\s\S]{0,400}status: 503/);
    const modele = src.search(/generateContent\(/);
    assert.ok(lu > 0 && arret > lu, `${f} : un cache illisible passe de nouveau pour une absence`);
    assert.ok(modele > arret, `${f} : le modèle est appelé avant de savoir si le cache est lisible`);
    assert.match(src, new RegExp(`if \\(eMemo\\) await journaliserEchecUneFois\\(admin, \\{ source: "${source}"`), `${f} : une mémorisation ratée ne va de nouveau qu'à la console`);
  }
});

test("lot 3 : l'import des traces dit une panne au lieu de « terminé » ou « montre non connectée »", () => {
  const src = codeNu("src/app/api/tracks/import/route.ts");
  assert.match(src, /if \(eProfil\) return NextResponse\.json\([\s\S]{0,120}status: 503/, "une panne du profil se lit « connecte d'abord ta montre »");
  assert.match(src, /if \(eSeances\) return NextResponse\.json\([\s\S]{0,120}status: 503/, "des séances illisibles se lisent « import terminé »");
  assert.match(src, /if \(eTraces\) return NextResponse\.json\([\s\S]{0,120}status: 503/, "des traces illisibles relancent tout le lot chez intervals.icu");
  assert.match(src, /\.order\("workout_id"\)\.range\(page \* 1000, page \* 1000 \+ 999\)/, "les traces faites ne sont plus lues par pages : au-delà de 1 000, elles repartent");
});

testAsync("lot 3 : le catalogue existant se lit EN ENTIER, par pages, et une panne n'est pas « vide »", async () => {
  const faux = (pages: (number | "panne")[]) => {
    const vues: { ordre?: string; de?: number }[] = [];
    let k = 0;
    const client = {
      from: () => ({ select: () => ({ order: (col: string) => ({ range: async (de: number) => {
        vues.push({ ordre: col, de });
        const p = pages[k++];
        if (p === "panne") return { data: null, error: { message: "délai dépassé", code: "57014" } };
        return { data: Array.from({ length: p ?? 0 }, (_, i) => ({ name: `c${de + i}`, date: "2026-05-01" })), error: null };
      } }) }) }),
    };
    return { client: client as unknown as SupabaseClient, vues };
  };
  const plein = faux([1000, 1000, 1000, 412]);
  const r = await coursesExistantes(plein.client);
  assert.ok("courses" in r, "un catalogue lisible est rendu comme une erreur");
  assert.equal((r as { courses: unknown[] }).courses.length, 3412, "des pages manquent : leurs courses seraient réinsérées");
  assert.deepEqual(plein.vues.map((v) => v.de), [0, 1000, 2000, 3000]);
  assert.ok(plein.vues.every((v) => v.ordre === "id"), "l'ordre n'est plus total (`id`) : des lignes sautent d'une page à l'autre");
  const panne = await coursesExistantes(faux([1000, "panne"]).client);
  assert.ok("erreur" in panne, "une page illisible donne de nouveau un catalogue raccourci");
  for (const f of ["src/app/api/races/seed/route.ts", "src/app/api/races/seed-full/route.ts"]) {
    const src = codeNu(f);
    assert.match(src, /const lues = await coursesExistantes\(createAdminClient\(\)\);\s*if \("erreur" in lues\) return NextResponse\.json\([\s\S]{0,140}status: 500/, `${f} : l'existant n'est plus lu en entier, ou une panne n'arrête plus l'import`);
    assert.ok(!/select\("name,date"\);/.test(src), `${f} : la lecture plafonnée à 1 000 lignes est revenue`);
  }
});

test("lot 3 : la synchro du catalogue n'invente ni distance ni région, et ne double pas l'existant", () => {
  const src = codeNu("src/app/api/races/sync/route.ts");
  assert.ok(!/\|\| "ile-de-france"/.test(src), "une course sans département connu est de nouveau rangée en Île-de-France");
  assert.ok(!/getDefaultDistance|\|\| 10;/.test(src), "une distance par défaut est de nouveau écrite comme la distance réelle");
  // `road_10k` est aussi le type PAR DÉFAUT d'une course sans distance lue : il ne donne rien.
  assert.match(src, /const DISTANCE_DU_TYPE: Record<string, number> = \{ semi: 21\.097, marathon: 42\.195 \};/, "un type sans distance définie (trail, ultra, 10 km par défaut) donne de nouveau une distance");
  assert.match(src, /const demi = \/semi\|demi\|1\\\/2\|half\/\.test\(text\);/, "« demi-marathon » ou « 1/2 marathon » n'est plus reconnu comme un semi");
  assert.match(src, /if \(maxKm >= 42 \|\| \(text\.includes\("marathon"\) && !demi && !\/relais\|ekiden\/\.test\(text\)\)\) return "marathon";/, "un semi ou un relais sans distance écrite redevient un marathon (42,195 km inventés)");
  assert.match(src, /if \(maxKm >= 20 \|\| demi\) return "semi";/, "un demi-marathon n'est plus classé semi");
  assert.match(src, /distancesText: contentText\.match\(\/\\d\+\(\?:\[\.,\]\\d\+\)\?\\s\*km\/gi\)/, "« 21,1 km » est de nouveau lu « 1 km »");
  assert.ok(!/"provence-alpes-cote-azur"/.test(src), "la synchro écrit de nouveau l'ancienne variante de la région PACA");
  assert.match(src, /const deptNum = departementDuCodePostal\(postal\)\?\.code \?\?/, "la Corse et l'outre-mer retombent en « région inconnue »");
  assert.match(src, /if \(!r\.region\) \{ sansRegion\+\+; continue; \}/, "une course sans région est de nouveau importée");
  assert.match(src, /if \(d == null\) \{ sansDistance\+\+; continue; \}/, "une course sans distance est de nouveau importée");
  assert.match(src, /\.select\("name,date"\)\s*\.order\("id"\)/, "la pagination de l'existant n'a plus d'ordre total : des doublons repartent");
  assert.match(src, /if \(eExistantes\) \{[\s\S]{0,400}status: 500/, "une page illisible arrête de nouveau la lecture comme une fin de table");
  const seed = codeNu("src/app/api/races/seed/route.ts");
  assert.match(seed, /name: "Diagonale des Fous \(Grand Raid\)", type: "ultra", region: "la-reunion"/, "la Diagonale des Fous est de nouveau rangée hors de La Réunion");
  assert.match(seed, /\.\.\.r,\s*time_limits: \[\],/, "des barrières horaires saisies à la main repartent au catalogue");
});

test("lot 3 : un parcours partagé n'affiche ni mesure inventée ni identité complète", () => {
  const src = codeNu("src/app/api/community/routes/route.ts");
  assert.ok(!/\|\| 0\)/.test(src), "`|| 0` écrit de nouveau une mesure absente comme une mesure");
  assert.match(src, /if \(!fini\(distance_km\) \|\| distance_km <= 0 \|\| !fini\(duration_min\) \|\| !fini\(elevation_gain_m\)\) \{\s*return NextResponse\.json\([\s\S]{0,200}status: 400/, "un parcours sans mesures est de nouveau publié");
  assert.ok(!/\.select\("\*"\)/.test(src), "la liste publique renvoie de nouveau toutes les colonnes, identifiant des comptes compris");
  assert.ok(!/user_id, author_name/.test(src.slice(0, src.indexOf("export async function POST"))), "la liste publique renvoie de nouveau l'identifiant des comptes");
  assert.match(src, /author = String\(prof\.full_name\)\.trim\(\)\.split\(\/\\s\+\/\)\[0\]/, "le nom complet de l'auteur est de nouveau publié");
  assert.match(src, /if \(error\.code === "42P01"\) return NextResponse\.json\(\{ routes: \[\] \}\);\s*return NextResponse\.json\([\s\S]{0,80}status: 503/, "une panne se lit de nouveau « aucun parcours partagé »");
});

test("lot 3 : l'appariement des segments ne date plus un passage au hasard et lit ses erreurs", () => {
  const src = codeNu("src/app/api/segments/match/route.ts");
  assert.ok(!/\?\? new Date\(\)\.toISOString\(\)/.test(src), "un passage sans séance connue est de nouveau daté du jour");
  assert.match(src, /if \(!date\) \{ sansDate\+\+; continue; \}/, "un passage sans date est de nouveau enregistré");
  for (const e of ["eTraces", "eSegments", "eSeances"]) assert.match(src, new RegExp(`if \\(${e}\\) return NextResponse\\.json\\([\\s\\S]{0,80}status: 503`), `${e} : une panne se lit de nouveau comme une absence`);
  assert.match(src, /\.in\("id", \(tracks as/, "toutes les séances du compte sont de nouveau lues (plafond de 1 000)");
});

test("lot 3 : modération, déconnexion de la montre, lettre, alertes et analyse coach disent leurs pannes", () => {
  const avis = codeNu("src/app/api/admin/avis/route.ts");
  assert.match(avis, /if \(eLigne\) return NextResponse\.json\([\s\S]{0,100}status: 503/, "une panne se lit « avis introuvable »");
  assert.match(avis, /if \(error\) return NextResponse\.json\(\{ ok: false, error: "Avis momentanément illisibles/, "une panne se lit « aucun avis à modérer »");
  const cred = codeNu("src/app/api/intervals/credentials/route.ts");
  const del = cred.slice(cred.indexOf("export async function DELETE"));
  assert.match(del, /if \(eLecture && eLecture\.code !== "PGRST116"\) return NextResponse\.json\([\s\S]{0,140}status: 503/, "un profil illisible laisse de nouveau effacer le jeton sans pouvoir le rendre");
  assert.match(del, /!\(await revoquer\(jetonDe\(String\(profile!\.intervals_api_key\)\)\)\)\) \{\s*await journaliserEchec\(/, "une révocation refusée chez intervals.icu repasse sous silence");
  assert.match(codeNu("src/app/api/account/delete/route.ts"), /!\(await revoquer\(jetonDe\(String\(jeton\)\)\)\)\) \{\s*\/?\/?[^\n]*\n?\s*await journaliserEchec\(admin,/, "une révocation refusée à la suppression du compte repasse sous silence");
  assert.ok(del.search(/if \(error\) return NextResponse\.json\(\{ error: "Déconnexion impossible/) < del.search(/await revoquer\(/), "le jeton est de nouveau révoqué AVANT l'effacement : un échec laisse un jeton mort en base");
  assert.match(codeNu("src/app/api/newsletter/subscribe/route.ts"), /\} catch \(e\) \{\s*await journaliserEchec\(null, \{ source: "newsletter"/, "la cause d'une inscription ratée est de nouveau avalée");
  assert.match(codeNu("src/app/api/webhooks/intervals/route.ts"), /await journaliser\(x\.userId \?\? null, `Suite d'une alerte en échec/, "la suite d'une alerte (traces, replanification, montre) rate de nouveau sans trace");
  const an = codeNu("src/app/api/admin/analyze-session/route.ts");
  assert.match(an, /const enPanne = lectures\.filter\(\(\[, r\]\) => r\.error && r\.error\.code !== "PGRST116"\)/, "une lecture en panne passe de nouveau pour une donnée absente");
  const arretPanne = an.search(/if \(enPanne\.length\) return/);
  assert.ok(arretPanne > 0 && arretPanne < an.search(/gem\("gemini-2\.5-flash", \[analysisSystem/), "l'analyse est demandée au modèle avant de savoir si ses données sont lisibles");
  assert.match(an, /if \(eAnalyse\) await journaliserEchec\(admin,/, "une analyse non conservée ne va de nouveau qu'à la console");
  // Deux plans actifs avec `.single()` = PGRST116, toléré comme « absent » : l'analyse partait
  // sans objectif. Le plus récent, et zéro ligne n'est pas une erreur (relecture du 08/11/2026).
  assert.match(an, /from\("training_plans"\)[^\n]*\.eq\("is_active", true\)\.order\("created_at", \{ ascending: false \}\)\.limit\(1\)\.maybeSingle\(\)/, "deux plans actifs font de nouveau analyser sans objectif");
  assert.match(an, /\.eq\("type", "race_objective"\)\.order\("created_at", \{ ascending: false \}\)\.limit\(1\)\.maybeSingle\(\)/, "deux objectifs font de nouveau analyser sans objectif");
});

test("lot 3 : les pièces jointes d'un athlète ne s'ouvrent au coach que depuis l'appareil de confiance", () => {
  // 3e relecture du 08/11/2026 : `estCoach = estAdmin(…)` ouvrait les pièces privées de tous les
  // comptes (photos au Kiné) à une session admin ouverte sur n'importe quel appareil.
  assert.match(codeNu("src/app/api/messages/piece/route.ts"), /const estCoach = estAdmin\(user\.email\) && !\(await appareilRefuse\(user\.id\)\);/, "le coach ouvre de nouveau les pièces des athlètes sans appareil de confiance");
});

test("lot 3 : le dépôt public ne porte plus les lieux de séances réelles", () => {
  // Une liste BLANCHE de noms génériques : une liste noire recopierait elle-même les lieux
  // dans le dépôt public (relecture du 08/11/2026).
  const noms = (JSON.parse(readFileSync("tests/fixtures/activities.json", "utf8")) as { name: string }[]).map((a) => a.name);
  const generiques = new Set(["Randonnée", "Randonnée en vallée", "Randonnée en montagne", "Course à pied"]);
  assert.deepEqual(noms.filter((n) => !generiques.has(n)), [], "le fichier de test publie de nouveau le nom réel d'une séance (souvent un lieu)");
  assert.ok(!/cypriendumez@outlook\.fr/.test(readFileSync("docs/intervals-icu-dependance.md", "utf8")), "la documentation publie de nouveau l'adresse personnelle");
});

// ── Légalité (09/11/2026) : 18 ans minimum, plus de « kiné IA » ─────────────────────
test("Pacevo est réservé aux majeurs : la règle, l'inscription et les textes légaux", () => {
  assert.equal(AGE_MINIMUM, 18);
  for (const [v, attendu] of [[18, true], ["18", true], [" 18 ", true], [45, true], [17, false], ["17", false], [15, false], ["", false], [null, false], ["abc", false], [150, false],
    // Ce qui est contrôlé est ce qui est écrit (relecture du 09/11/2026) : « 1e2 » valait 100
    // pour le contrôle et 1 en base ; « 18.9 » passait et 18 s'écrivait.
    ["1e2", false], ["18.9", false], [18.5, false], ["0x20", false]] as const) {
    assert.equal(estMajeur(v), attendu, `estMajeur(${JSON.stringify(v)})`);
  }
  assert.equal(ageEntier("1e2"), null);
  assert.equal(ageEntier(" 42 "), 42);
  for (const f of ["src/app/onboarding/page.tsx", "src/components/profile/ProfileSettings.tsx"]) {
    const src = codeNu(f);
    assert.match(src, /age: ageEntier\((profile|form)\.age\),/, `${f} écrit de nouveau une autre valeur que celle qu'il contrôle`);
    assert.ok(!/age: parseInt\(/.test(src), `${f} écrit de nouveau l'âge par parseInt`);
  }
  const ob = codeNu("src/app/onboarding/page.tsx");
  assert.match(ob, /\[!!profile\.age && !estMajeur\(profile\.age\), `\$\{cid\}-age`, tr\("ageMin"\)\]/, "l'inscription accepte de nouveau un âge de moins de 18 ans");
  assert.match(ob, /min=\{AGE_MINIMUM\}/, "le champ de l'âge descend de nouveau sous 18 ans");
  assert.equal(readFileSync("src/app/onboarding/onboardingI18n.ts", "utf8").split("ageMin: \"").length - 1, 5, "le message des 18 ans manque dans une langue");
  const legal = readFileSync("src/app/legalI18n.ts", "utf8");
  assert.ok(!/15 ans|aged 15|ab 15 Jahren|unter 15|15 años|15 anos/.test(legal), "les textes légaux acceptent de nouveau les 15-17 ans");
  assert.equal((legal.match(/\(18 ans ou plus\)|\(18 or over\)|\(ab 18 Jahren\)|\(18 años o más\)|\(18 anos ou mais\)/g) ?? []).length, 10, "CGU et confidentialité ne disent pas « 18 ans » dans les 5 langues (2 × 5)");
});

test("le « kiné IA » est SUPPRIMÉ partout : routes, écran, vitrine, cours, aide, consignes des IA", () => {
  assert.equal(KINE_IA_ACTIF, false, "le kiné IA est rallumé : il faut un avis juridique, un autre fournisseur et un autre cadre, pas ce booléen");
  // Les deux routes ne font plus que refuser : ni consigne, ni appel au modèle, ni écriture.
  for (const f of ["src/app/api/ai/physio/route.ts", "src/app/api/health/protocole/route.ts"]) {
    const src = codeNu(f);
    assert.match(src, /return NextResponse\.json\(\{ error: KINE_IA_RETIRE \}, \{ status: 410 \}\);/, `${f} répond de nouveau autre chose que « retiré »`);
    assert.ok(!/generateContent|systemPrompt|\.insert\(|\.upsert\(|exigeAcces/.test(src), `${f} appelle de nouveau le modèle ou écrit en base`);
    assert.ok(!/Léa Moreau|kinésithérapeute du sport|diagnostic différentiel/i.test(readFileSync(f, "utf8")), `${f} publie de nouveau la consigne de la « kinésithérapeute »`);
  }
  // L'écran : plus de consultation, plus de photo, plus de protocole ; la déclaration sans IA.
  const hc = codeNu("src/components/health/HealthCenter.tsx");
  assert.ok(!/api\/ai\/physio|api\/health\/protocole|api\/health\/consultation|createElement\("canvas"\)|protocolFor\(/.test(hc), "l'écran Santé appelle de nouveau la consultation, envoie une photo ou prescrit un protocole");
  assert.ok(!/kiné du sport|sports physio|Sportphysio/i.test(readFileSync("src/components/health/HealthCenter.tsx", "utf8")), "l'écran se présente de nouveau comme un kiné");
  assert.match(hc, /fetch\("\/api\/health\/declarer"/, "la douleur ne peut plus être déclarée sans l'IA");
  assert.match(hc, /disabled=\{declEnCours \|\| painLevel < SEUIL_DOULEUR_DECLAREE\}/, "une gêne sous le seuil peut de nouveau être déclarée");
  for (const k of ["k.declarer", "k.seuil", "k.avisTitre", "k.avis", "k.alerte"]) assert.equal(hc.split(`"${k}": "`).length - 1, 5, `${k} manque dans une langue`);
  const ongletsEtTitres = [...hc.matchAll(/"(tab\.kine|h\.subtitle|k\.hint)": "([^"]*)"/g)].map((m) => m[2]).join(" | ");
  assert.ok(!/[Kk]in[ée]|[Pp]hysio|[Ff]isio/.test(ongletsEtTitres), `l'onglet ou son titre parle encore de kiné : ${ongletsEtTitres.slice(0, 160)}`);
  // La page ne relit plus la consultation.
  assert.ok(!/"kine_chat"/.test(codeNu("src/app/dashboard/health/page.tsx")), "la page Santé relit de nouveau la consultation");
  // La déclaration sans IA : ouverte à tous, seuil, et son échec est dit.
  const decl = codeNu("src/app/api/health/declarer/route.ts");
  assert.ok(!/exigeAcces|generateContent/.test(decl), "déclarer une douleur exige de nouveau un abonnement ou appelle un modèle");
  assert.match(decl, /if \(painLevel < SEUIL_DOULEUR_DECLAREE\) \{\s*return NextResponse\.json\([\s\S]{0,200}status: 422/, "une gêne sous le seuil est de nouveau enregistrée");
  assert.match(decl, /if \(!ok\) return NextResponse\.json\([\s\S]{0,120}status: 503/, "une douleur non enregistrée se tait de nouveau");
  // Plus aucune promesse de « kiné IA » là où un coureur la lit.
  const visibles = ["src/components/landing/landingI18n.ts", "src/data/cours/fr.ts", "src/data/cours/en.ts", "src/data/cours/de.ts", "src/data/cours/es.ts", "src/data/cours/pt.ts", "src/app/legalI18n.ts"];
  for (const f of visibles) assert.ok(!/[Kk]in[ée] ?IA|AI [Pp]hysio|KI-Physio|[Ff]isio IA|fisioterapeuta IA|Léa Moreau|regarde tes photos/.test(readFileSync(f, "utf8")), `${f} promet encore un kiné IA`);
  const aide = readFileSync("src/data/helpKb.ts", "utf8");
  assert.ok(!/\["(Kiné IA|AI Physio|KI-Physio|Fisio IA)"/.test(aide), "l'aide nomme encore un onglet « kiné IA »");
  // L'aide alimente l'assistant : hors de la phrase qui dit le retrait, aucune promesse de
  // consultation, de photo, de bilan ni de protocole (2e relecture du 09/11/2026).
  // (Les deux phrases qui disent le retrait ne contiennent aucune de ces promesses.)
  assert.ok(!/vraie consultation|photos acceptées|Nouvelle consultation|un BILAN|programme le protocole/.test(aide), "l'aide promet encore une consultation, une photo, un bilan ou un protocole");
  const fiche = aide.split("\n").find((l) => l.includes('path: "/dashboard/health"')) ?? "";
  const quoi = /what: "((?:[^"\\]|\\.)*)"/.exec(fiche)?.[1] ?? "";
  assert.ok(/a été retirée le 09\/11\/2026/.test(quoi) && /« Enregistrer cette douleur »/.test(quoi), "la description de la fiche Santé ne dit plus la déclaration ni le retrait");
  assert.ok(!/"protocole"|"bilan"|"exercices"/.test(fiche), "la fiche Santé remonte de nouveau sur « protocole », « bilan » ou « exercices »");
  // Les autres IA : orientation seule, aucun conseil de santé (conditions du modèle).
  const cours = readFileSync("src/app/api/ai/cours/route.ts", "utf8"), support = readFileSync("src/app/api/ai/support/route.ts", "utf8");
  assert.ok(!/premiers réflexes \(réduire la charge\)|le Kiné IA y mène une vraie consultation/.test(cours), "l'IA des cours donne de nouveau des conseils face à une douleur");
  assert.match(cours, /tu ne donnes AUCUN conseil de santé/, "l'IA des cours n'a plus la consigne d'orientation seule");
  assert.ok(!/ce qu'un non-médecin peut honnêtement\s+dire|renvoie vers Santé › Kiné IA/.test(support), "l'assistant donne de nouveau des conseils face à une douleur");
  assert.match(support, /AUCUN conseil de santé/, "l'assistant n'a plus la consigne d'orientation seule");
  assert.ok(!/prévention des blessures|signal d'alerte|la réponse est le repos|santé du coureur/.test(cours), "la consigne des cours donne de nouveau un conseil ou une compétence de santé");
  // Une déclaration replanifie tout de suite, comme « ça va mieux / ça empire ».
  const replan = decl.search(/if \(!eCreds\) \{\s*await autoCoachForUser\(admin, \{/);
  assert.ok(replan > decl.search(/if \(!ok\) return/), "la déclaration ne replanifie plus : l'écran promet un plan allégé qui ne bouge pas");
});

testAsync("une douleur se déclare à partir de 4/10, et une seconde plus forte le même jour relève le niveau", async () => {
  assert.equal(SEUIL_DOULEUR_DECLAREE, 4);
  const ligne = { id: "p1", data: { zone: "Genou gauche", slot: "face:kneeL", level: 3, date: "2026-11-09" } };
  const { client, ops } = fauxClient((op) => op.table === "notifications" && op.action === "select" ? { data: [ligne] } : { data: null, error: null });
  const decl = { userId: "u", zone: "Genou gauche", zoneKey: "face:kneeL", painLevel: 8, today: "2026-11-09" };
  assert.equal(await enregistrerDouleurDeclaree(client, decl, client), true);
  const maj = ops.filter((o) => o.table === "notifications" && o.action === "update");
  assert.equal(maj.length, 1, "une douleur plus forte le même jour n'est pas prise en compte (« 3 puis 8 » reste à 3)");
  assert.equal((maj[0].valeur as { data: { level: number } }).data.level, 8);
  assert.ok(!ops.some((o) => o.action === "insert" && o.table === "notifications"), "une seconde ligne est créée pour la même zone le même jour");
  // Une déclaration plus faible ne baisse pas le niveau du jour (« ça va mieux » a son bouton).
  const f2 = fauxClient((op) => op.table === "notifications" && op.action === "select" ? { data: [{ ...ligne, data: { ...ligne.data, level: 8 } }] } : { data: null, error: null });
  assert.equal(await enregistrerDouleurDeclaree(f2.client, { ...decl, painLevel: 5 }, f2.client), true);
  assert.ok(!f2.ops.some((o) => o.action === "update" || o.action === "insert"), "une déclaration plus faible baisse le niveau du jour");
  // Déclarée « passée » puis revenue le même jour : rouverte, elle pèse de nouveau sur le plan.
  const f3 = fauxClient((op) => op.table === "notifications" && op.action === "select" ? { data: [{ ...ligne, data: { ...ligne.data, level: 8, etat: "resolu" } }] } : { data: null, error: null });
  assert.equal(await enregistrerDouleurDeclaree(f3.client, { ...decl, painLevel: 5 }, f3.client), true);
  const rouverte = f3.ops.filter((o) => o.action === "update")[0]?.valeur as { data: { etat: string; level: number } } | undefined;
  assert.ok(rouverte, "une douleur passée qui revient n'est pas rouverte (elle ne pèse plus, l'écran dit pourtant « enregistrée »)");
  assert.equal(rouverte!.data.etat, "actif");
  assert.equal(rouverte!.data.level, 5, "la douleur rouverte ne repart pas à l'intensité déclarée");
});

test("l'âge ne descend pas sous 18 ans dans les Réglages non plus", () => {
  const src = codeNu("src/components/profile/ProfileSettings.tsx");
  const garde = src.search(/if \(form\.age\.trim\(\) && !estMajeur\(form\.age\)\) \{ toast\.error\(tr\("t\.ageMin"\)\); return; \}/);
  assert.ok(garde > 0 && garde < src.search(/age: ageEntier\(form\.age\)/), "les Réglages enregistrent de nouveau un âge de moins de 18 ans");
  assert.equal(readFileSync("src/components/profile/ProfileSettings.tsx", "utf8").split('"t.ageMin": "').length - 1, 5, "le message des 18 ans manque dans une langue");
});

enAttente.then(() => {
  console.log(`\n${passed} test(s) passé(s), ${fails.length} échec(s)`);
  if (fails.length) { for (const f of fails) console.log("  ✗ " + f); process.exit(1); }
});
