/**
 * QUEL LIEN POUR S'INSCRIRE, ET OÙ TROUVER LE CLASSEMENT — une seule décision, trois écrans
 * (liste des courses, carte, page publique).
 *
 * Demandé par Cyprien le 28/09/2026 : « les liens pour s'inscrire directement, et voir les
 * classements après les courses juste en cliquant ». Mesuré le même jour : 78 % des liens
 * « S'inscrire » menaient à une fiche de CALENDRIER (finishers.com). Les fiches de la
 * source donnent pourtant souvent le site de l'organisateur, parfois son lien
 * d'inscription, et pour certaines le classement complet chez le chronométreur
 * (resultats-live.com…) — stockés par la migration 032.
 *
 * ⚠️ ON NE FAIT PAS PASSER UNE RECHERCHE POUR UN CLASSEMENT. Quand le lien du classement
 * n'est pas connu, le bouton dit « Chercher les classements » et ouvre une recherche
 * pré-remplie ; il ne prétend pas afficher un résultat qu'il n'a pas.
 */
export type LiensDetail = {
  registration_url?: string | null;
  inscription_url?: string | null;
  site_officiel?: string | null;
  resultats_url?: string | null;
  resultats_annee?: number | null;
};

const http = (u: string | null | undefined) => (typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

/** Le meilleur lien d'inscription : direct, sinon le site officiel, sinon la fiche du calendrier. */
export function lienInscription(d: LiensDetail | null | undefined): { url: string; sorte: "inscription" | "officiel" | "fiche" } | null {
  const direct = http(d?.inscription_url);
  if (direct) return { url: direct, sorte: "inscription" };
  const site = http(d?.site_officiel);
  if (site) return { url: site, sorte: "officiel" };
  const fiche = http(d?.registration_url);
  return fiche ? { url: fiche, sorte: "fiche" } : null;
}

/** Le site officiel, quand il est différent du lien d'inscription déjà proposé. */
export function lienSiteOfficiel(d: LiensDetail | null | undefined): string | null {
  const site = http(d?.site_officiel);
  const insc = lienInscription(d);
  return site && insc?.url !== site ? site : null;
}

/**
 * Le classement : direct quand on le connaît, sinon une RECHERCHE nommée comme telle.
 * La recherche ne transporte que le nom et la ville de la course — rien de l'athlète.
 */
export function lienClassement(
  d: LiensDetail | null | undefined, course: { name?: string | null; city?: string | null },
): { url: string; direct: boolean; annee: number | null } | null {
  const direct = http(d?.resultats_url);
  if (direct) return { url: direct, direct: true, annee: typeof d?.resultats_annee === "number" ? d.resultats_annee : null };
  const nom = String(course.name ?? "").trim();
  if (!nom) return null;
  const q = `classement ${nom}${course.city ? ` ${course.city}` : ""}`;
  return { url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, direct: false, annee: null };
}

/** « 09:30 » → « 9 h 30 » ; `null` si l'heure n'est pas lisible. */
export function heureLisible(h: string | null | undefined): string | null {
  const m = String(h ?? "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${hh} h ${String(mm).padStart(2, "0")}`;
}
