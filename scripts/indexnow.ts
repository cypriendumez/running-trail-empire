/**
 * SOUMISSION DES ADRESSES AUX MOTEURS — protocole IndexNow.
 *
 *   npm run seo:soumettre            (lit le sitemap et soumet tout)
 *   npm run seo:soumettre -- --essai (affiche ce qui serait soumis, n'envoie rien)
 *
 * ⚠️ LES « PING » HISTORIQUES SONT MORTS. Vérifié le 03/09/2026 :
 * google.com/ping répond 404 (« Sitemaps ping is deprecated », annonce de juin 2023) et
 * bing.com/ping répond 410. Les recopier dans un script aurait donné l'illusion d'une
 * soumission qui ne se produit pas.
 *
 * IndexNow, lui, fonctionne sans aucun compte : la possession du domaine se prouve en
 * servant un fichier qui contient la clé. Il alimente Bing, Yandex, Seznam et Naver.
 * ⚠️ PAS GOOGLE, qui n'y participe pas : pour lui, il faut passer par la Search Console,
 * ce qui exige une connexion personnelle. Ce script ne prétend pas le remplacer.
 */
const CLE = "65fc58d6c65206ce991ebd921b3daca1";
const HOTE = "running-trail-empire-woad.vercel.app";
const BASE = `https://${HOTE}`;
/** Le protocole plafonne à 10 000 adresses par envoi. */
const LOT = 10000;

async function adressesDuSitemap(): Promise<string[]> {
  const r = await fetch(`${BASE}/sitemap.xml`, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`sitemap inaccessible (HTTP ${r.status})`);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].trim())
    // ⚠️ ON NE SOUMET QUE NOS PROPRES ADRESSES. Le protocole rejette tout l'envoi si une
    // seule adresse sort du domaine de la clé — et l'erreur ne dit pas laquelle.
    .filter((u) => u.startsWith(BASE));
}

async function principal(): Promise<void> {
  const essai = process.argv.includes("--essai");

  // La clé doit être SERVIE avant toute soumission : sans elle, le moteur refuse le lot
  // entier. On le vérifie plutôt que de le supposer.
  const kr = await fetch(`${BASE}/${CLE}.txt`).catch(() => null);
  const contenu = kr?.ok ? (await kr.text()).trim() : "";
  if (contenu !== CLE) {
    console.log(`clé non servie sur ${BASE}/${CLE}.txt (reçu : « ${contenu.slice(0, 40)} ») — déploie d'abord.`);
    process.exitCode = 1; return;
  }
  console.log("clé vérifiée en ligne ✅");

  const urls = await adressesDuSitemap();
  console.log(`${urls.length} adresse(s) dans le sitemap`);
  if (!urls.length) { console.log("rien à soumettre"); process.exitCode = 1; return; }
  if (essai) {
    console.log(`essai : RIEN n'a été envoyé. Exemples :\n  ${urls.slice(0, 3).join("\n  ")}`);
    return;
  }

  for (let i = 0; i < urls.length; i += LOT) {
    const lot = urls.slice(i, i + LOT);
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOTE, key: CLE, keyLocation: `${BASE}/${CLE}.txt`, urlList: lot }),
      signal: AbortSignal.timeout(120000),
    });
    // 200 = accepté, 202 = accepté, clé en cours de validation. Tout le reste est un refus.
    const corps = await r.text().catch(() => "");
    console.log(`lot ${i / LOT + 1} : ${lot.length} adresses → HTTP ${r.status}${corps ? " " + corps.slice(0, 120) : ""}`);
    if (r.status !== 200 && r.status !== 202) process.exitCode = 1;
  }
}

void principal();
