/**
 * OÙ MÈNE VRAIMENT LE LIEN D'INSCRIPTION.
 *
 * ⚠️ CONSTAT DU 03/09/2026, mesuré sur les 17 131 liens du catalogue : 13 450 (78 %)
 * pointent vers `finishers.com` et 3 664 (21 %) vers `jogging-plus.com`. Ce sont des
 * CALENDRIERS DE COURSES, pas les sites des organisateurs. Or les 17 153 pages
 * publiques annonçaient « S'inscrire sur le site de l'organisateur » et « Lien vers le
 * site officiel de l'organisateur » : faux sur la quasi-totalité d'entre elles, et
 * c'est une phrase que j'ai écrite.
 *
 * Nommer la destination coûte un mot et rend la promesse vraie. Le lecteur sait où il
 * va avant de cliquer, ce qui est aussi la seule façon honnête de garder sa confiance
 * quand il découvre la page suivante.
 */

/** Les destinations connues, avec le nom sous lequel elles se présentent. */
const CONNUES: Record<string, string> = {
  "finishers.com": "Finishers",
  "jogging-plus.com": "Jogging International",
  "milesrepublic.com": "Miles Republic",
  "utmb.world": "UTMB",
  "i-run.fr": "i-Run",
  "thecolorrun.fr": "The Color Run",
  "protiming.fr": "Protiming",
  "klikego.com": "Klikego",
  "njuko.com": "Njuko",
  "adeorun.com": "Adeorun",
};

/** Le domaine, sans le « www. » ni les sous-domaines connus pour ne rien distinguer. */
export function domaineDe(url: unknown): string {
  try {
    const h = new URL(String(url)).hostname.toLowerCase().replace(/^www\./, "");
    // « fr.milesrepublic.com » et « milesrepublic.com » sont le même service : on ne
    // garde que les deux derniers segments, sauf pour un suffixe composé (.co.uk).
    const bouts = h.split(".");
    if (bouts.length > 2 && !/^(co|com|org|gouv|asso)$/.test(bouts[bouts.length - 2])) {
      return bouts.slice(-2).join(".");
    }
    return h;
  } catch { return ""; }
}

/**
 * Le nom à afficher pour la destination d'un lien.
 *
 * ⚠️ UN DOMAINE INCONNU EST RENDU TEL QUEL, jamais remplacé par « l'organisateur ». Si
 * on ne sait pas qui c'est, on montre l'adresse : le lecteur juge lui-même. Inventer
 * une qualité qu'on n'a pas vérifiée est précisément le défaut qu'on corrige.
 */
export function nomDestination(url: unknown): string {
  const d = domaineDe(url);
  if (!d) return "";
  return CONNUES[d] ?? d;
}

/**
 * La destination est-elle un CALENDRIER tiers plutôt que l'organisateur ?
 *
 * Sert à choisir la phrase : on ne promet « le site de l'organisateur » que quand on
 * n'a aucune raison de croire le contraire — et même là, on nomme le domaine.
 */
export function estCalendrierTiers(url: unknown): boolean {
  return Boolean(CONNUES[domaineDe(url)]);
}

/**
 * L'organisateur RÉEL, ou rien.
 *
 * ⚠️ MESURÉ : 13 399 courses portent « finishers.com » dans leur champ « organisation ».
 * C'est la SOURCE de la donnée, pas celui qui organise l'épreuve. On l'affichait sous
 * « Organisation » et on le déclarait à Google comme `organizer` : une information
 * fausse sur 13 399 pages, et pénible pour l'agrégateur lui-même, qu'on créditait d'un
 * rôle qu'il ne tient pas.
 *
 * La règle : si la valeur ressemble au domaine du lien, ou à un domaine tout court,
 * ce n'est pas un nom d'organisateur.
 */
export function organisateurReel(valeur: unknown, lienInscription?: unknown): string {
  const v = String(valeur ?? "").trim();
  if (!v) return "";
  const nu = v.toLowerCase().replace(/^www\./, "");
  // Un nom d'organisateur ne se termine pas par une extension de domaine.
  if (/\.[a-z]{2,6}$/.test(nu) && !nu.includes(" ")) return "";
  if (nu === domaineDe(lienInscription)) return "";
  if (Object.values(CONNUES).some((n) => n.toLowerCase() === nu)) return "";
  return v;
}
