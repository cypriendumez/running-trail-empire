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
