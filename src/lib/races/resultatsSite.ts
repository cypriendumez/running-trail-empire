/**
 * LE LIEN « RÉSULTATS » D'UN SITE OFFICIEL — pour que « Classement » s'ouvre en un clic.
 *
 * Demandé par Cyprien le 28/09/2026 : « voir les classements après les courses juste en
 * cliquant sur le lien qui affiche directement ». Mesuré le même jour sur 1 590 fiches
 * finishers : 38 citent le classement du chronométreur. Pour les autres, le site officiel
 * est connu (2 291 formats), et son menu porte presque toujours « Résultats ».
 *
 * Tout ce qui DÉCIDE est ici, pur et testé ; `scripts/resultats-sites.ts` lit les pages.
 *
 * ⚠️ UN LIEN « RÉSULTATS » N'EST PAS FORCÉMENT UN CLASSEMENT : « résultats du tirage au
 * sort », « résultats du concours photo ». On écarte ces sens-là, et on préfère un
 * chronométreur connu (le classement lui-même) à une page du site.
 *
 * ⚠️ L'ANNÉE N'EST DITE QUE SI ON LA LIT. « Classement 2026 » sur une page qui ne va que
 * jusqu'à 2024 serait faux : sans année dans le lien ou son texte, l'année reste inconnue.
 */

/** Plateformes de chronométrage : un lien vers elles EST le classement. */
export const CHRONOMETREURS = [
  "timeto.com", "sportinnovation.fr", "protiming.fr", "chrono-start.com", "klikego.com", "njuko.net", "ipitos.com",
  "l-chrono.com", "top-chrono.fr", "espace-competition.com", "breizhchrono.com", "chronowest.fr", "sportips.fr",
  "wiclax.com", "acn-timing.com", "yaka-inscription.com", "chronosports.fr", "chronometrage.com", "resultats-live.com",
  "livetrail.net", "livetrail.run", "sporkrono.fr", "chrono-course.fr", "g-live.fr", "nikrome.com", "athle.fr",
  "chronorace.be", "racetimer.fr", "active-timing.fr", "3wsport.com", "mychrono.fr", "chronopro.net", "endurance-chrono.com",
] as const;

const SENS_ECARTES = /tirage|loterie|concours|photo|vid[ée]o|newsletter|partenaire|sondage|quiz|jeu\b|b[ée]n[ée]vole|recherche/i;
const SENS_RESULTATS = /r[ée]sultat|classement|results?\b|ranking/i;
// klikego, njuko… chronomètrent ET vendent les dossards : leur lien « S'inscrire » n'est pas un classement.
const SENS_INSCRIPTION = /inscri|register|registration|dossard|billet|ticket|engagement|r[ée]server/i;

export type LienResultats = { url: string; annee: number | null; texte: string; chronometreur: boolean };

const sansBalises = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&")
  .replace(/&eacute;/g, "é").replace(/&#233;/g, "é").replace(/\s+/g, " ").trim();

/** L'année la plus récente lue dans un texte (2010 → année en cours), ou `null`. */
export function anneeDe(texte: string, anneeCourante: number): number | null {
  const ans = (texte.match(/(?<!\d)20[1-3]\d(?!\d)/g) ?? []).map(Number).filter((a) => a >= 2010 && a <= anneeCourante);
  return ans.length ? Math.max(...ans) : null;
}

const decode = (u: string) => { try { return decodeURIComponent(u); } catch { return u; } };

export const estChronometreur = (url: string) => {
  const h = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  return CHRONOMETREURS.some((c) => h === c || h.endsWith(`.${c}`));
};

/**
 * Le meilleur lien de résultats d'une page, ou `null`. Préférence : un chronométreur,
 * puis l'année la plus récente, puis un libellé court (un menu, pas une phrase).
 */
export function lienResultats(html: string, base: string, anneeCourante: number): LienResultats | null {
  const cands: (LienResultats & { score: number })[] = [];
  const re = /<a\b[^>]*?href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (let m; (m = re.exec(html));) {
    const texte = sansBalises(m[2]).slice(0, 120);
    let url: string;
    try { url = new URL(m[1].replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    if (!/^https?:\/\//i.test(url)) continue;
    const chrono = estChronometreur(url);
    const dit = `${texte} ${decode(url)}`;
    if (!SENS_RESULTATS.test(dit) && !(chrono && /live/i.test(url))) continue;
    if (SENS_ECARTES.test(texte) || SENS_INSCRIPTION.test(texte)) continue;
    const annee = anneeDe(dit, anneeCourante);
    const score = (chrono ? 100 : 0) + (annee ? annee - 2000 : 0) + (texte.length > 0 && texte.length <= 40 ? 5 : 0);
    cands.push({ url, annee, texte, chronometreur: chrono, score });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  const { score: _s, ...meilleur } = cands[0];
  return meilleur;
}

/**
 * Le robots.txt autorise-t-il cette page à un robot quelconque ? Lecture volontairement
 * PRUDENTE : groupe `*` (ou le nôtre), règle la plus longue ; au moindre doute, non.
 */
export function robotsAutorise(robots: string | null, chemin: string, agent = "pacevobot"): boolean {
  if (robots == null) return true;   // pas de robots.txt (404) : tout est permis
  const groupes: { agents: string[]; regles: { permis: boolean; motif: string }[] }[] = [];
  let courant: (typeof groupes)[number] | null = null, dernierEtaitAgent = false;
  for (const brut of robots.split(/\r?\n/)) {
    const l = brut.replace(/#.*/, "").trim();
    const m = l.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if (!m) continue;
    const cle = m[1].toLowerCase(), val = m[2].trim();
    if (cle === "user-agent") {
      if (!courant || !dernierEtaitAgent) { courant = { agents: [], regles: [] }; groupes.push(courant); }
      courant.agents.push(val.toLowerCase()); dernierEtaitAgent = true;
    } else if (courant) {
      dernierEtaitAgent = false;
      if (val || cle === "allow") courant.regles.push({ permis: cle === "allow", motif: val });
    }
  }
  const pour = groupes.find((g) => g.agents.includes(agent)) ?? groupes.find((g) => g.agents.includes("*"));
  if (!pour) return true;
  const colle = (motif: string) => {
    const rx = new RegExp("^" + motif.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    return rx.test(chemin);
  };
  const applicables = pour.regles.filter((r) => r.motif !== "" && colle(r.motif)).sort((a, b) => b.motif.length - a.motif.length);
  return applicables.length ? applicables[0].permis : true;
}
