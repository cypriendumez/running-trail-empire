/**
 * CRASH-TEST DU BRANCHEMENT DE LA MONTRE (12/10/2026).
 *
 * Demandé par Cyprien avant qu'un ami branche son Apple Watch : « fais plein de crash
 * tests, et teste avec COROS et Suunto ». Sans le matériel, on ne porte pas de COROS. On
 * jette en revanche sur CHAQUE maillon du chemin tout ce qu'un vrai client, un vrai serveur
 * ou une vraie panne peuvent produire :
 *
 *  1. LA CLÉ COLLÉE — formats réels, erreurs connues, enveloppes de copier-coller, fuzz ;
 *  2. LA RÉPONSE D'INTERVALS.ICU — statuts × corps × identifiants saisis × pannes réseau ;
 *  3. LE VERDICT après la première synchronisation (« activités détectées » ou pas) ;
 *  4. CHAQUE MARQUE × CHAQUE LANGUE — aucun texte vide, aucune variable oubliée ;
 *  5. LES DONNÉES DE CHAQUE MARQUE — qui est reconnu, quel message, quel format de séance.
 *
 * Trois défauts trouvés en l'écrivant, corrigés avant la mise en ligne :
 *  · « Activités détectées — tout est prêt » s'affichait après une synchronisation VIDE ;
 *  · un porteur d'Apple Watch relié par Intervals Companion lisait « cette montre ne peut
 *    pas recevoir de séance » (l'appareil s'appelle « Intervals Companion », pas « Apple ») ;
 *  · en cas de panne d'intervals.icu, un identifiant mal saisi était enregistré tel quel —
 *    et « .. » saisi comme identifiant envoyait la requête ailleurs dans l'API.
 *
 *   npx tsx tests/connexion-montre.crash.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compteDeLaCle } from "../src/lib/intervals/compteDeLaCle";
import { etatCle, cleMessageErreur, verdictSuivi } from "../src/app/onboarding/connexionMontre";
import { MARQUES, type Marque } from "../src/app/onboarding/marquesMontre";
import { OB } from "../src/app/onboarding/onboardingI18n";
import {
  lectureDe, estAppleWatch, viaCompanion, messageLecture, montreDe, metriquesMixtesSupportees,
  buildWorkoutDescription,
} from "../src/lib/watch/intervals";

let passes = 0; let cas = 0; const echecs: string[] = [];
async function test(nom: string, fn: () => void | Promise<void>) {
  try { await fn(); passes++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs.push(`${nom} — ${(e as Error).message}`); console.log(`  ✗ ${nom}`); }
}
// Générateur pseudo-aléatoire À GRAINE : un échec se rejoue à l'identique.
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hasard = mulberry32(20261012);
const codeNu = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map((l) => l.replace(/(^|[^:])\/\/.*$/, "$1")).join("\n");

async function main() {
  // ── 1. LA CLÉ ──────────────────────────────────────────────────────────────────
  console.log("\n1. LA CLÉ COLLÉE");
  const vraies = [
    "a1b2c3d4e5f6g7h8i9j0k1l2m",        // 25 minuscules et chiffres : le format réel relevé
    "0123456789abcdef",                 // 16, le minimum
    "z".repeat(64),                     // 64, le maximum
    "ABCDEF0123456789abcdef0123",       // majuscules, assez longue : acceptée
  ];
  const fausses = [
    "abc", "a".repeat(15), "a".repeat(65), "a".repeat(5000), "cyprien@outlook.fr", "MonMotDePasse!",
    "Passw0rd", "API_KEY:a1b2c3d4e5f6g7h8i9j0k", "a1b2c3d4 e5f6g7h8i9j0k1l2m", "a1b2c3d4-e5f6-g7h8-i9j0",
    "clé0123456789abcdef", "🙂".repeat(20), "a1b2c3d4\ne5f6g7h8i9j0k1l2m", "<script>alert(1)</script>xxxxxx",
    "'; drop table profiles; --", "i564686", "https://intervals.icu/settings",
  ];
  const enveloppes = [(k: string) => k, (k: string) => ` ${k} `, (k: string) => `\n${k}\n`, (k: string) => `\t${k}`,
    (k: string) => ` ${k} `, (k: string) => `${k}\r\n`];

  await test(`${vraies.length * enveloppes.length} vraies clés, telles qu'on les colle : toutes acceptées`, () => {
    for (const k of vraies) for (const e of enveloppes) {
      cas++; const r = etatCle(e(k));
      assert.ok(r.valide && r.indice === null, `refusée : ${JSON.stringify(e(k)).slice(0, 40)}`);
    }
  });

  await test(`${fausses.length * enveloppes.length} saisies fausses : toutes refusées, avec une aide`, () => {
    for (const k of fausses) for (const e of enveloppes) {
      cas++; const r = etatCle(e(k));
      assert.ok(!r.valide, `acceptée à tort : ${JSON.stringify(k).slice(0, 40)}`);
      assert.ok(r.indice === "mdp" || r.indice === "format", `refusée sans aide : ${JSON.stringify(k).slice(0, 40)}`);
    }
    for (const vide of ["", " ", "\n\t", " "]) { cas++; assert.deepEqual(etatCle(vide), { valide: false, indice: null }, "un champ vide ne doit pas crier"); }
  });

  await test("le mot de passe du compte est reconnu comme tel", () => {
    for (const k of ["MonMotDePasse!", "Passw0rd", "Running2026?", "azerty#123"]) {
      cas++; assert.equal(etatCle(k).indice, "mdp", k);
    }
  });

  await test("5 000 saisies au hasard : jamais d'exception, « valide » veut toujours dire 16 à 64 lettres ou chiffres", () => {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t\n!?@#$%^&*()-_=+[]{};:'\",.<>/\\|`~éàüß🙂 ";
    for (let i = 0; i < 5000; i++) {
      cas++;
      const n = Math.floor(hasard() * 90);
      let s = ""; for (let j = 0; j < n; j++) s += alphabet[Math.floor(hasard() * alphabet.length)];
      const r = etatCle(s);
      if (r.valide) assert.match(s.trim(), /^[a-z0-9]{16,64}$/i, `acceptée à tort : ${JSON.stringify(s)}`);
      else if (s.trim() !== "") assert.ok(r.indice !== null, `refus muet : ${JSON.stringify(s)}`);
    }
  });

  await test("chaque code de refus de la route a son message ; un code inconnu laisse parler la route", () => {
    cas += 7;
    assert.equal(cleMessageErreur("cle_refusee"), "mErrCle");
    assert.equal(cleMessageErreur("indisponible"), "mErrIndispo");
    assert.equal(cleMessageErreur("reponse_invalide"), "mErrIndispo");
    for (const x of [undefined, null, "", "acces_refuse"]) assert.equal(cleMessageErreur(x), null);
  });

  // ── 2. LA RÉPONSE D'INTERVALS.ICU ─────────────────────────────────────────────
  console.log("\n2. LA RÉPONSE D'INTERVALS.ICU");
  const STATUTS = [200, 201, 204, 301, 400, 401, 403, 404, 405, 408, 409, 418, 429, 500, 502, 503, 504];
  const CORPS: unknown[] = [
    { id: "i564686", name: "Paul" }, { id: "I564686", name: "Paul" }, { id: " i564686 ", name: "  " },
    { id: 564686 }, { id: "i" }, { id: "i12a" }, { id: "x564686" }, { id: "" }, {}, [], null, "texte",
    { id: "i1", name: "<img src=x onerror=alert(1)>" }, { id: "i2", name: "A".repeat(10_000) }, { id: "i3", name: 42 },
    { id: "../../admin" }, { id: "i4\n" }, "<html>502 Bad Gateway</html>",
  ];
  const SAISIS = [null, "", "   ", "i564686", "I564686", " i564686 ", "i0", "cyprien@outlook.fr", "../admin",
    "i564686/../../x", "%2e%2e", "..", ".", "0", "me", "i564686?x=1", "i564686#a", "🙂"];
  const CODES = new Set(["cle_refusee", "acces_refuse", "athlete_introuvable", "indisponible", "reponse_invalide"]);

  /** Un faux intervals.icu : répond `statut` + `corps`, et garde trace de ce qu'on lui demande. */
  function serveur(statut: number, corps: unknown, journal: { url: string; auth: string }[]): typeof fetch {
    return (async (url: string | URL | Request, init?: RequestInit) => {
      journal.push({ url: String(url), auth: String((init?.headers as Record<string, string>)?.Authorization ?? "") });
      const texte = typeof corps === "string" ? corps : JSON.stringify(corps);
      return new Response(statut === 204 ? null : texte, { status: statut });
    }) as typeof fetch;
  }

  await test(`${STATUTS.length * CORPS.length * SAISIS.length} réponses × identifiants : aucune exception, aucun faux succès`, async () => {
    const cle = "a1b2c3d4e5f6g7h8i9j0k1l2m";
    for (const statut of STATUTS) for (const corps of CORPS) for (const saisi of SAISIS) {
      cas++;
      const journal: { url: string; auth: string }[] = [];
      const r = await compteDeLaCle(cle, saisi, serveur(statut, corps, journal));
      const ctx = `HTTP ${statut} · ${JSON.stringify(corps)?.slice(0, 30)} · saisi ${JSON.stringify(saisi)}`;
      // Un identifiant saisi MAL FORMÉ est refusé avant tout appel : rien ne part sur le réseau.
      const propre = (saisi ?? "").trim().toLowerCase();
      if (propre !== "" && !/^i\d+$/.test(propre)) {
        assert.equal(journal.length, 0, `appel parti avec un identifiant douteux (${ctx})`);
        assert.equal(!r.ok && r.code, "athlete_introuvable", ctx);
        continue;
      }
      // L'adresse appelée reste DANS /api/v1/athlete/<un seul segment> : pas de traversée.
      const u = new URL(journal[0].url);
      assert.equal(u.origin + u.pathname.split("/").slice(0, 4).join("/"), "https://intervals.icu/api/v1/athlete", ctx);
      assert.equal(u.pathname.split("/").filter(Boolean).length, 4, `adresse détournée : ${journal[0].url} (${ctx})`);
      assert.equal(u.search + u.hash, "", `paramètre injecté : ${journal[0].url}`);
      assert.equal(journal[0].auth, "Basic " + Buffer.from(`API_KEY:${cle}`).toString("base64"), ctx);
      if (r.ok) {
        assert.match(r.athleteId, /^i\d+$/, `identifiant enregistré invalide : ${r.athleteId} (${ctx})`);
        assert.ok(r.nom === null || (r.nom.length > 0 && r.nom.length <= 80 && r.nom === r.nom.trim()), `nom non borné (${ctx})`);
        assert.ok([200, 201].includes(statut) || statut >= 500, `succès sur un HTTP ${statut} (${ctx})`);
      } else {
        assert.ok(CODES.has(r.code), `code inconnu ${r.code} (${ctx})`);
        assert.ok([422, 502, 503].includes(r.status), `statut renvoyé ${r.status} (${ctx})`);
        assert.ok(r.message.length > 10, ctx);
      }
      if (statut === 401) assert.equal(!r.ok && r.code, "cle_refusee", ctx);
      if (statut === 403) assert.equal(!r.ok && r.code, "acces_refuse", ctx);
      if (statut === 404) assert.equal(!r.ok && r.code, "athlete_introuvable", ctx);
      if (statut === 429 || statut === 408) assert.equal(!r.ok && r.code, "indisponible", ctx);
      if (statut >= 500) {
        if (propre !== "") assert.deepEqual(r, { ok: true, athleteId: propre, nom: null }, ctx);
        else assert.equal(!r.ok && r.code, "indisponible", `panne sans identifiant : rien ne doit être enregistré (${ctx})`);
      }
    }
  });

  await test("une bonne réponse donne l'identifiant en minuscules et le nom propre", async () => {
    cas += 3;
    assert.deepEqual(await compteDeLaCle("k".repeat(25), null, serveur(200, { id: " I564686 ", name: "  Paul  " }, [])),
      { ok: true, athleteId: "i564686", nom: "Paul" });
    const long = await compteDeLaCle("k".repeat(25), null, serveur(200, { id: "i2", name: "A".repeat(10_000) }, []));
    assert.ok(long.ok && long.nom?.length === 80, "un nom démesuré n'est pas borné");
    const sansNom = await compteDeLaCle("k".repeat(25), null, serveur(200, { id: "i3", name: 42 }, []));
    assert.ok(sansNom.ok && sansNom.nom === null);
  });

  await test("pannes réseau (coupure, délai, refus) : « indisponible », jamais une exception", async () => {
    const pannes = [new TypeError("fetch failed"), new DOMException("délai", "TimeoutError"), new DOMException("annulé", "AbortError"), new Error("ECONNRESET")];
    for (const p of pannes) for (const saisi of [null, "i564686"]) {
      cas++;
      const r = await compteDeLaCle("k".repeat(25), saisi, (async () => { throw p; }) as unknown as typeof fetch);
      assert.equal(!r.ok && r.code, "indisponible", p.message);
      assert.equal(!r.ok && r.status, 503);
    }
  });

  // ── 3. LE VERDICT APRÈS LA PREMIÈRE SYNCHRONISATION ────────────────────────────
  console.log("\n3. LE VERDICT APRÈS LA PREMIÈRE SYNCHRONISATION");
  const STATUTS_ROUTE: unknown[] = [null, undefined, {}, { configured: false }, { configured: "true" }, { configured: 1 }, { configured: true }, "x", 42, []];
  const SYNCHROS: unknown[] = [
    null, undefined, {}, { error: "Intervals.icu fetch failed (HTTP 502)" },
    { ok: false, configured: false, reason: "non_configuré", synced: { workouts: 0, hrv: 0, sleep: 0 } },
    { fetched: { activities: 0, wellness: 0 }, synced: { workouts: 0, hrv: 0, sleep: 0 } },
    { fetched: { activities: 0, wellness: 5 }, synced: { workouts: 0, hrv: 5, sleep: 5 } },
    { fetched: { activities: 0 }, synced: null }, { fetched: { activities: 3 }, synced: { workouts: 3 } },
    { fetched: { activities: 1 } }, { fetched: { activities: "3" }, synced: {} }, { fetched: { activities: -1 }, synced: {} },
    { fetched: { activities: Number.NaN }, synced: {} }, { fetched: { activities: Infinity }, synced: {} },
    { fetched: null, synced: {} }, "<html>", 0, [],
  ];

  await test(`${STATUTS_ROUTE.length * SYNCHROS.length} combinaisons : « activités détectées » seulement s'il y en a vraiment`, () => {
    for (const st of STATUTS_ROUTE) for (const sy of SYNCHROS) {
      cas++;
      const v = verdictSuivi(st, sy);
      assert.ok(["attente", "ok", "vide"].includes(v));
      const configure = !!st && typeof st === "object" && (st as { configured?: unknown }).configured === true;
      const n = (sy as { fetched?: { activities?: unknown } } | null)?.fetched?.activities;
      if (v === "ok") assert.ok(configure && typeof n === "number" && Number.isFinite(n) && n > 0, `« ok » à tort : ${JSON.stringify(st)} / ${JSON.stringify(sy)}`);
      if (v === "vide") assert.ok(configure && n === 0, `« vide » à tort : ${JSON.stringify(sy)}`);
    }
  });

  await test("LE DÉFAUT CORRIGÉ : une synchronisation réussie mais vide n'annonce plus « activités détectées »", () => {
    cas += 2;
    assert.equal(verdictSuivi({ configured: true }, { fetched: { activities: 0, wellness: 0 }, synced: { workouts: 0, hrv: 0, sleep: 0 } }), "vide");
    assert.equal(verdictSuivi({ configured: true }, { fetched: { activities: 2, wellness: 0 }, synced: { workouts: 2 } }), "ok");
  });

  await test("l'écran se sert de ce verdict, plus de l'ancienne condition toujours vraie", () => {
    const src = codeNu("src/app/onboarding/EtapeMontre.tsx");
    assert.ok(/const v = verdictSuivi\(statut, synchro\)/.test(src), "l'étape Montre ne passe plus par verdictSuivi");
    assert.ok(!/synced\?\.workouts >= 0/.test(src), "la condition « synced.workouts >= 0 » (toujours vraie) est revenue");
    assert.ok(/suivi === "vide" && \(/.test(src) && /tr\("mVideTitre"\)/.test(src), "l'état « aucune séance encore » n'est plus affiché");
  });

  // ── 4. CHAQUE MARQUE × CHAQUE LANGUE ──────────────────────────────────────────
  console.log("\n4. CHAQUE MARQUE × CHAQUE LANGUE");
  const LANGUES = ["fr", "en", "de", "es", "pt"] as const;
  /** Le même `tr` que la page : TOUTES les occurrences d'une variable sont remplacées. */
  const trDe = (lang: (typeof LANGUES)[number]) => (k: string, v?: Record<string, string | number>) => {
    let s = OB[lang][k];
    if (typeof s !== "string") throw new Error(`${lang}.${k} manque`);
    if (v) for (const key in v) s = s.split(`{${key}}`).join(String(v[key]));
    return s;
  };
  /** Tout ce que l'étape affiche pour une marque — dans l'ordre de l'écran. */
  const textesDe = (m: Marque, tr: ReturnType<typeof trDe>): string[] => {
    const communs = ["mQ", "mQAide", "mAutre", "mAutreEx", "mAucune", "wStep1", "m0Desc", "w0Create", "w0Have", "w0Tip",
      "mEtape3", "mCleOu", "mCleOuvrir", "w3KeyLabel", "w2Warn1", "w2Warn2", "w3Connect", "w3Verifying", "w3CheckTitle",
      "w3CheckSub", "w3OkTitle", "w3OkSub", "mVideTitre", "mVideSub", "w3ToTitle", "w3ToSub", "mErrCle", "mErrIndispo",
      "hKeyPwd", "hKeyFormat", "tSaveError", "wFinish", "wSkip2", "wDone", "wRedo"].map((k) => tr(k));
    communs.push(tr("mCompte", { nom: "Paul Martin" }));
    if (m.chemin === "aucun") return [...communs, tr("mAucuneTxt")];
    if (m.chemin === "companion") {
      return [...communs, tr("mEtape2Apple"), ...["mAppleIntro", "mAppleStore", "mAppleQr", "mAppleQrLabel", "mAppleDans",
        "mApple1", "mApple2", "mApple3", "mApple4", "mAppleApres", "w1Done"].map((k) => tr(k))];
    }
    const n = m.nom;
    return [...communs,
      n ? tr("mEtape2Lien", { m: n }) : tr("wStep2"),
      n ? tr("mLienOuvre", { m: n }) : tr("mLienOuvreAutre"),
      n ? tr("mCompteMarque", { m: n }) : tr("mCompteAutre"),
      n ? tr("mCoche", { m: n }) : tr("mCocheAutre"),
      tr("w1Perm1"), tr("w1Perm2"), ...(m.recoit ? [tr("w1Perm4")] : []), tr("w1Perm3"),
      ...(m.recoit ? [] : [tr("mPolar")]), tr("w1Open"), tr("w1Done")];
  };

  await test(`${MARQUES.length} marques × ${LANGUES.length} langues : aucun texte vide, aucune variable oubliée`, () => {
    for (const lang of LANGUES) for (const m of MARQUES) {
      const textes = textesDe(m, trDe(lang));
      for (const t of textes) {
        cas++;
        assert.ok(t.trim().length > 0, `${lang}/${m.id} : texte vide`);
        assert.ok(!/[{}]/.test(t), `${lang}/${m.id} : variable non remplacée — ${t}`);
        assert.ok(!/\bundefined\b|\bnull\b|\bNaN\b/.test(t), `${lang}/${m.id} : ${t}`);
      }
      if (m.nom && m.chemin === "connexion") {
        const tr = trDe(lang);
        for (const k of ["mEtape2Lien", "mLienOuvre", "mCompteMarque", "mCoche"]) {
          assert.ok(tr(k, { m: m.nom }).includes(m.nom), `${lang}/${m.id} : « ${k} » ne nomme pas la marque`);
        }
        // « ton compte {m} » cite DEUX fois la marque : les deux sont remplacées.
        assert.ok(tr("mCompteMarque", { m: m.nom }).split(m.nom).length >= 3, `${lang}/${m.id} : une seule occurrence remplacée`);
      }
    }
  });

  await test("Polar ne voit jamais la case « envoyer les entraînements » ; les autres montres, toujours", () => {
    for (const lang of LANGUES) for (const m of MARQUES.filter((x) => x.chemin === "connexion")) {
      cas++;
      const tr = trDe(lang);
      const a = textesDe(m, tr).includes(tr("w1Perm4"));
      assert.equal(a, m.recoit, `${lang}/${m.id}`);
    }
  });

  // ── 5. LES DONNÉES DE CHAQUE MARQUE ──────────────────────────────────────────
  console.log("\n5. LES DONNÉES DE CHAQUE MARQUE");
  // Ce qu'intervals.icu renvoie pour chaque marque : le réglage d'envoi du compte, et
  // l'appareil déclaré par les séances. « Intervals Companion » : relevé sur le forum
  // intervals.icu (sujet 124208, message du 03/08/2026).
  const PROFILS: { marque: string; reglages: Record<string, unknown>; appareil: string; source: string; montre: string | null; message: string }[] = [
    { marque: "Garmin", reglages: { icu_garmin_upload_workouts: true }, appareil: "Garmin Forerunner 165", source: "GARMIN_CONNECT", montre: "Garmin", message: "acc.readonly" },
    { marque: "COROS", reglages: { coros_upload_workouts: true }, appareil: "COROS PACE 3", source: "COROS", montre: "Coros", message: "acc.readonly" },
    { marque: "Suunto", reglages: { suunto_upload_workouts: true }, appareil: "Suunto Race S", source: "SUUNTO", montre: "Suunto", message: "acc.readonly" },
    { marque: "Wahoo", reglages: { wahoo_upload_workouts: true }, appareil: "ELEMNT RIVAL", source: "WAHOO", montre: "Wahoo", message: "acc.readonly" },
    { marque: "Amazfit", reglages: { zepp_upload_workouts: true }, appareil: "Amazfit T-Rex 3", source: "ZEPP", montre: "Amazfit", message: "acc.readonly" },
    { marque: "Huawei", reglages: { huawei_upload_workouts: true }, appareil: "HUAWEI WATCH GT 5", source: "HUAWEI", montre: "Huawei", message: "acc.readonly" },
    { marque: "Polar", reglages: { polar_sync_activities: true }, appareil: "Polar Vantage V3", source: "POLAR", montre: null, message: "acc.readonly" },
    { marque: "Apple (Companion)", reglages: {}, appareil: "Intervals Companion", source: "UPLOAD", montre: null, message: "acc.companion" },
    { marque: "Apple (nom de montre)", reglages: {}, appareil: "Apple Watch Ultra 2", source: "UPLOAD", montre: null, message: "acc.apple" },
    { marque: "Apple (minuscules)", reglages: {}, appareil: "apple watch series 9", source: "UPLOAD", montre: null, message: "acc.apple" },
  ];

  await test("chaque marque est reconnue comme il faut : montre prête, et message quand on lit seulement", () => {
    for (const p of PROFILS) {
      cas++;
      assert.equal(montreDe(p.reglages)?.nom ?? null, p.montre, `${p.marque} : montre prête`);
      const l = lectureDe([{ device_name: p.appareil, source: p.source, start_date_local: "2026-10-11T07:00:00" }]);
      assert.equal(messageLecture(l), p.message, `${p.marque} : message`);
    }
  });

  await test("LE DÉFAUT CORRIGÉ : l'Apple Watch reliée par Intervals Companion n'est plus « une montre qui ne peut pas recevoir »", () => {
    cas += 3;
    const l = lectureDe([{ device_name: "Intervals Companion", source: "UPLOAD" }]);
    assert.ok(viaCompanion(l));
    assert.equal(messageLecture(l), "acc.companion");
    assert.ok(!estAppleWatch(l), "estAppleWatch garde son sens : le NOM de l'appareil dit Apple");
  });

  await test("le Ghost Runner choisit son message par `messageLecture`, aux deux endroits, et le texte existe en 5 langues", () => {
    const src = codeNu("src/components/ghost-runner/GhostRunner.tsx");
    assert.equal((src.match(/tg\(messageLecture\(watchStatus\.lecture\)/g) ?? []).length, 2, "un des deux messages ne passe plus par messageLecture");
    assert.ok(!/estAppleWatch\(watchStatus\.lecture\) \? "acc\.apple" : "acc\.readonly"/.test(src), "l'ancien choix à deux messages est revenu");
    const dico = readFileSync("src/components/ghost-runner/ghostI18n.tsx", "utf8");
    assert.equal((dico.match(/"acc\.companion": "/g) ?? []).length, 5, "« acc.companion » manque dans une langue");
  });

  await test("200 activités hostiles : la lecture de l'appareil ne casse jamais", () => {
    const valeurs: unknown[] = [null, undefined, "", "   ", 42, {}, [], "Intervals Companion", "APPLE WATCH", "x".repeat(5000), "🙂", "<b>Garmin</b>"];
    for (let i = 0; i < 200; i++) {
      cas++;
      const pick = () => valeurs[Math.floor(hasard() * valeurs.length)];
      const acts = Array.from({ length: Math.floor(hasard() * 4) }, () => ({ device_name: pick(), source: pick(), start_date_local: pick() }));
      const l = lectureDe(acts as Record<string, unknown>[]);
      assert.ok(["acc.companion", "acc.apple", "acc.readonly"].includes(messageLecture(l)));
    }
  });

  // Le format de la séance envoyée : Garmin seule lit les métriques mixtes ; une Apple Watch
  // (aucun réglage d'envoi chez intervals.icu → montre inconnue) reçoit EXACTEMENT le format
  // universel tout-allure d'une COROS, que l'app Companion convertit.
  const SEANCES = [
    { title: "Footing en endurance", detail: "45 min en endurance fondamentale", type: "Endurance" },
    { title: "VMA courte", detail: "10×400 m à 3'45/km, récup 1 min", type: "VMA" },
    { title: "Seuil", detail: "3×10 min à 4'20/km, récup 2 min", type: "Seuil" },
    { title: "Sortie longue", detail: "1h40 en endurance", type: "Sortie longue" },
    { title: "Allure spécifique objectif", detail: "3×15 min à 4'30/km", type: "Spécifique" },
    { title: "Côtes", detail: "8×1 min en côte, récup descente", type: "Côtes" },
  ];

  await test("chaque marque reçoit une séance construite, et l'Apple Watch le format universel d'une COROS", () => {
    for (const s of SEANCES) {
      const coros = buildWorkoutDescription(s.title, s.detail, s.type, "Marathon de Lille", 17, 15, 10, "Coros");
      for (const montre of ["Garmin", "Coros", "Suunto", "Wahoo", "Amazfit", "Huawei", null]) {
        cas++;
        const b = buildWorkoutDescription(s.title, s.detail, s.type, "Marathon de Lille", 17, 15, 10, montre);
        assert.ok(b && b.description.trim().length > 0, `${montre ?? "Apple"} / ${s.title} : séance vide`);
        assert.equal(metriquesMixtesSupportees(montre), montre === "Garmin");
        if (montre === null) assert.equal(b!.description, coros!.description, `Apple ≠ COROS sur « ${s.title} »`);
      }
    }
  });

  console.log(`\n${passes} crash-test(s) passé(s), ${echecs.length} échec(s) · ${cas.toLocaleString("fr-FR")} cas passés au crible`);
  if (echecs.length) { for (const e of echecs) console.log("  ✗ " + e); process.exit(1); }
}
main();
