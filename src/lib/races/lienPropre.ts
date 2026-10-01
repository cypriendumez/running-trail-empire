/**
 * UN LIEN DE CLASSEMENT PROPRE — ce qui s'ouvre sous « Classement 2025 » (30/09/2026).
 *
 * Inventaire des 1 131 liens de classement en base, le 30/09/2026 :
 *   - `&amp;` et `&#038;` jamais décodés (9 liens) : « ?id=318&amp;general=1 » envoie un
 *     paramètre « amp;general » que le chronométreur ignore ;
 *   - deux boutons « Partager sur LinkedIn » pris pour le classement ;
 *   - la fiche d'UN coureur (livetrail « coureur.php?rech=2728 » : le vainqueur 2025 du
 *     Grand Raid) — et, remplacée par l'année, celle d'un autre coureur en 2024 ;
 *   - des classements filtrés sur un seul sexe (« sexe=F », « gender=MALE ») ;
 *   - un blog tiers qui résume les podiums (dicodusport.fr), un article « Bug résultats ».
 *
 * Une seule porte, appliquée à l'écriture (fiches, sites officiels), à l'affichage et dans
 * l'e-mail « tes résultats sont en ligne ». Sans import : elle part aussi dans le navigateur.
 */

/** « &amp; », « &#038; », « &#x26; » → « & » (même doublement encodé). */
export function decodeEntitesUrl(u: string): string {
  let s = u, avant;
  do { avant = s; s = s.replace(/&(?:amp|#0*38|#x0*26);/gi, "&"); } while (s !== avant);
  return s;
}

/** Boutons de partage : ils mènent à un formulaire de publication, jamais à un classement. */
const PARTAGE = /(^|\.)(linkedin\.com|twitter\.com|x\.com|wa\.me|whatsapp\.com|t\.me|reddit\.com|pinterest\.[a-z.]+)$/i;
/** Sites éditoriaux tiers : un résumé du podium n'est pas le classement. */
const EDITORIAUX = /(^|\.)(dicodusport\.fr)$/i;
/**
 * Filtres qui réduisent le classement à un sexe : la CLÉ et la VALEUR le disent ensemble.
 * « genre=trail » (le type de course, en français) n'est pas touché, ni « sexe= » (vide).
 */
const FILTRE_SEXE = /^(sexe|sex|gender|genre)$/i;
const VALEUR_SEXE = /^(f|m|h|w|x|female|male|femme|femmes|homme|hommes|women|men|woman|man|masculin|feminin|f%C3%A9minin|féminin)$/i;

export function lienClassementPropre(url: unknown): string | null {
  if (typeof url !== "string") return null;
  let u: URL;
  try { u = new URL(decodeEntitesUrl(url.trim())); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const hote = u.hostname.toLowerCase();
  if (PARTAGE.test(hote) || (/(^|\.)facebook\.com$/.test(hote) && /^\/sharer/i.test(u.pathname))) return null;
  if (EDITORIAUX.test(hote)) return null;
  if (/(^|[/_-])bugs?([/_.-]|$)/i.test(u.pathname)) return null;
  // livetrail (anciennes éditions) : la fiche d'un coureur → le classement de l'édition.
  if (/(^|\.)livetrail\.net$/.test(hote) && /\/coureur\.php$/i.test(u.pathname)) {
    u.pathname = u.pathname.replace(/coureur\.php$/i, "classement.php");
    u.search = "";
  }
  // Retire les filtres de sexe en gardant le reste de la requête TEL QUEL (pas de réencodage).
  if (u.search) {
    const garde = u.search.slice(1).split("&").filter((p) => {
      const [cle, valeur = ""] = p.split("=");
      let c = cle; try { c = decodeURIComponent(cle); } catch { /* clé mal encodée : gardée */ }
      return !(FILTRE_SEXE.test(c) && VALEUR_SEXE.test(valeur));
    });
    u.search = garde.length ? `?${garde.join("&")}` : "";
  }
  return u.toString();
}
