/**
 * ENREGISTRER UNE COURSE SANS RÉSEAU — ce qui vit sur le téléphone, et comment ça repart.
 *
 * Cyprien, 21/09/2026 : « que les personnes puissent enregistrer leurs courses malgré le
 * fait qu'il n'y ait pas de 4G, comme sur Strava ». État des lieux : le GPS n'a pas besoin
 * du réseau, mais l'écran « Enregistrer » envoyait la course en UN SEUL `fetch` à
 * l'arrivée — sans réseau, un message d'erreur et le tracé n'existait plus qu'en mémoire.
 *
 * Trois choses, toutes locales (localStorage, ~5 Mo ; une course de 2 h à un point par
 * seconde pèse ~300 Ko) :
 *   · LA COURSE EN COURS est écrite pendant l'effort (toutes les 5 s) : une appli tuée par
 *     le système ne perd plus rien, on la retrouve à la réouverture ;
 *   · LA FILE D'ATTENTE reçoit les courses terminées que le réseau a refusées ; elles sont
 *     renvoyées dès que le réseau revient (`online`) ou à la prochaine ouverture ;
 *   · le tout est PUR ici (pas de DOM), donc éprouvable.
 *
 * ⚠️ Le stockage peut LEVER (navigation privée, quota) : chaque accès est enveloppé, une
 * course ne doit jamais faire planter l'écran qui l'enregistre.
 */
/** Un point du tracé, tel que l'écran « Enregistrer » le tient : [latitude, longitude]. */
export type PointTrace = [number, number];

export type CourseEnCours = {
  demarreeA: number;          // horodatage ms
  elapsedSec: number;
  km: number;
  elevation: number;
  track: PointTrace[];
  misAJourA: number;
};

export type CourseEnAttente = {
  id: string;                 // identifiant local, stable entre deux tentatives
  creeeA: number;
  corps: {
    title: string; distanceKm: number; durationSeconds: number;
    elevationGain?: number; track?: PointTrace[]; type: string;
  };
  tentatives: number;
};

export const CLE_EN_COURS = "pacevo.course.encours";
export const CLE_ATTENTE = "pacevo.courses.attente";
/** Sous ce seuil, on n'enregistre rien (même règle que l'écran). */
export const KM_MIN = 0.1;
export const SEC_MIN = 30;
/** Fréquence d'écriture de la course en cours. */
export const INTERVALLE_SAUVEGARDE_MS = 5000;

type Stockage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const lire = <T,>(st: Stockage | null | undefined, cle: string): T | null => {
  try { const brut = st?.getItem(cle); return brut ? (JSON.parse(brut) as T) : null; } catch { return null; }
};
const ecrire = (st: Stockage | null | undefined, cle: string, v: unknown): boolean => {
  try { st?.setItem(cle, JSON.stringify(v)); return true; } catch { return false; }
};

// ── La course en cours ─────────────────────────────────────────────────────────
export const sauverEnCours = (st: Stockage | null | undefined, c: CourseEnCours): boolean => ecrire(st, CLE_EN_COURS, c);
export const lireEnCours = (st: Stockage | null | undefined): CourseEnCours | null => {
  const c = lire<CourseEnCours>(st, CLE_EN_COURS);
  return c && Array.isArray(c.track) && typeof c.km === "number" ? c : null;
};
export const effacerEnCours = (st: Stockage | null | undefined): void => { try { st?.removeItem(CLE_EN_COURS); } catch { /* rien à effacer */ } };

/** Une course retrouvée vaut-elle d'être proposée à l'enregistrement ? */
export const vautEnregistrement = (c: Pick<CourseEnCours, "km" | "elapsedSec">): boolean =>
  c.km >= KM_MIN && c.elapsedSec >= SEC_MIN;

// ── La file d'attente ──────────────────────────────────────────────────────────
export const lireAttente = (st: Stockage | null | undefined): CourseEnAttente[] => {
  const l = lire<CourseEnAttente[]>(st, CLE_ATTENTE);
  return Array.isArray(l) ? l.filter((c) => c && c.id && c.corps) : [];
};

export const mettreEnAttente = (st: Stockage | null | undefined, corps: CourseEnAttente["corps"], maintenant = Date.now()): CourseEnAttente => {
  const course: CourseEnAttente = { id: `${maintenant}-${Math.random().toString(36).slice(2, 8)}`, creeeA: maintenant, corps, tentatives: 0 };
  ecrire(st, CLE_ATTENTE, [...lireAttente(st), course]);
  return course;
};

export const retirerAttente = (st: Stockage | null | undefined, id: string): void => {
  ecrire(st, CLE_ATTENTE, lireAttente(st).filter((c) => c.id !== id));
};

/**
 * Renvoie la file, une course à la fois, dans l'ordre. `envoyer` renvoie vrai si le serveur
 * a ACCEPTÉ (réponse ok). Une réponse refusée (4xx : course invalide) sort la course de la
 * file après 3 tentatives — la garder pour toujours bloquerait les suivantes ; une panne
 * réseau (exception) arrête le tour sans rien retirer, on réessaiera.
 */
export async function envoyerAttente(
  st: Stockage | null | undefined,
  envoyer: (corps: CourseEnAttente["corps"]) => Promise<{ ok: boolean; refusee?: boolean }>,
): Promise<{ envoyees: number; restantes: number }> {
  let envoyees = 0;
  for (const c of lireAttente(st)) {
    let r: { ok: boolean; refusee?: boolean };
    try { r = await envoyer(c.corps); }
    catch { break; } // réseau absent : on garde tout, on réessaiera
    if (r.ok) { retirerAttente(st, c.id); envoyees++; continue; }
    // Refusée par le serveur : on compte, et on abandonne à la 3e.
    const maj = lireAttente(st).map((x) => (x.id === c.id ? { ...x, tentatives: x.tentatives + 1 } : x))
      .filter((x) => x.tentatives < 3);
    ecrire(st, CLE_ATTENTE, maj);
  }
  return { envoyees, restantes: lireAttente(st).length };
}
