/**
 * LA VEILLE PENDANT UNE COURSE — partage de position et détection de choc.
 *
 * ⚠️ CE QUE CE MODULE NE FAIT PAS, ET QU'AUCUNE APPLICATION WEB NE PEUT FAIRE.
 * Le navigateur ne lit l'accéléromètre que pendant que la page est AU PREMIER PLAN,
 * écran allumé : iOS gèle le JavaScript au verrouillage. Cette veille ne couvre donc
 * qu'une séance enregistrée avec l'écran allumé (le verrou d'écran est déjà posé par
 * l'écran « Enregistrer »), et l'interface le dit mot pour mot. La détection d'incident
 * d'une montre (Garmin, Apple) reste la référence — elle, tourne dans le matériel.
 *
 * Ce qui EST vrai ici : un choc violent suivi d'une immobilité anormale déclenche un
 * compte à rebours ; sans réponse, l'athlète est amené à prévenir son contact d'un geste,
 * avec sa position et le lien de suivi. Pacevo n'appelle personne à sa place.
 */

/** Une mesure : l'intensité de l'accélération (en g, gravité comprise) et l'instant (ms). */
export type Mesure = { g: number; t: number };

/**
 * Seuils — choisis FRANCS, pas sensibles. Une fausse alerte qui réveille un proche coûte
 * plus cher, en confiance, qu'un choc manqué : le téléphone reste dans la poche et
 * l'athlète peut toujours appeler lui-même.
 *  · une foulée de course culmine vers 1,5–2,5 g ; un vrai impact dépasse 3 g ;
 *  · au repos, le module vaut 1 g (la gravité) : « immobile » = écart < 0,35 g ;
 *  · 8 s d'immobilité après le choc, et 25 s de fenêtre au-delà desquelles on oublie
 *    (on s'est relevé et on est reparti).
 */
export const CHOC_G = 3.2;
export const IMMOBILE_G = 0.35;
export const IMMOBILE_MS = 8000;
export const FENETRE_MS = 25000;

export type EtatVeille =
  | { phase: "calme" }
  | { phase: "choc"; depuis: number; g: number }
  | { phase: "alerte"; depuis: number; g: number };

/**
 * Fait avancer l'état avec une mesure. Pure : même entrée, même sortie, aucun effet.
 * Seule l'interface peut sortir de `alerte` (l'athlète répond, ou le délai expire).
 */
export function avancer(etat: EtatVeille, m: Mesure): EtatVeille {
  if (etat.phase === "alerte") return etat;
  const immobile = Math.abs(m.g - 1) <= IMMOBILE_G;
  if (etat.phase === "calme") {
    return m.g >= CHOC_G ? { phase: "choc", depuis: m.t, g: m.g } : etat;
  }
  // phase « choc »
  if (m.g >= CHOC_G) return { phase: "choc", depuis: m.t, g: Math.max(etat.g, m.g) }; // on tombe encore
  if (!immobile) return { phase: "calme" };                                            // on bouge : tout va bien
  if (m.t - etat.depuis >= IMMOBILE_MS) return { phase: "alerte", depuis: etat.depuis, g: etat.g };
  if (m.t - etat.depuis > FENETRE_MS) return { phase: "calme" };
  return etat;
}

/** Rejoue une séquence entière — utilisé par les tests. */
export function analyser(mesures: Mesure[]): EtatVeille {
  return mesures.reduce<EtatVeille>(avancer, { phase: "calme" });
}

/** L'intensité d'un événement `devicemotion`, en g (1 au repos). */
export function intensite(acc: { x?: number | null; y?: number | null; z?: number | null } | null | undefined): number {
  const x = Number(acc?.x ?? 0), y = Number(acc?.y ?? 0), z = Number(acc?.z ?? 0);
  const n = Math.sqrt(x * x + y * y + z * z) / 9.80665;
  return Number.isFinite(n) ? n : 1;
}

/** Le lien de suivi en direct d'une session — même forme que le partage de la Carte. */
export function lienSuivi(origine: string, id: string): string {
  return `${origine.replace(/\/+$/, "")}/suivre/${id}`;
}

/**
 * Un identifiant de session de partage : court, aléatoire, sans information sur l'athlète.
 * ⚠️ Il figure dans un lien qui ouvre la position en direct SANS compte : il doit être
 * imprévisible. `crypto.getRandomValues` quand il existe, `Math.random` en dernier
 * recours (vieux navigateur) — jamais l'identifiant de l'athlète, ni l'horodatage seul.
 */
export function idPartage(rnd: Crypto | null = typeof crypto !== "undefined" ? crypto : null): string {
  const n = 9;
  const abc = "abcdefghijklmnopqrstuvwxyz0123456789";
  if (rnd?.getRandomValues) {
    const buf = new Uint32Array(n);
    rnd.getRandomValues(buf);
    return [...buf].map((v) => abc[v % abc.length]).join("");
  }
  return Array.from({ length: n }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
}

/**
 * Le message envoyé au proche — lu par quelqu'un qui ne connaît pas Pacevo, peut-être
 * en pleine nuit : qui, quoi, où, et quoi faire. Pas de jargon, pas de marque en avant.
 */
export function messageAlerte(
  prenom: string | null,
  lien: string | null,
  pos: { lat: number; lng: number } | null,
  textes: { alerte: string; position: string; suivi: string; secours: string },
): string {
  const qui = (prenom || "").trim();
  return [
    textes.alerte.replace("{nom}", qui || "—"),
    pos ? `${textes.position} https://www.google.com/maps?q=${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}` : null,
    lien ? `${textes.suivi} ${lien}` : null,
    textes.secours,
  ].filter(Boolean).join("\n");
}

/** Le message « je pars courir », envoyé au départ : position de départ + lien de suivi. */
export function messageDepart(
  prenom: string | null,
  lien: string,
  textes: { depart: string; suivi: string },
): string {
  const qui = (prenom || "").trim();
  return [textes.depart.replace("{nom}", qui || "—"), `${textes.suivi} ${lien}`].join("\n");
}

/** Le lien `sms:` prêt à ouvrir l'application de messages, corps pré-rempli. */
export function lienSms(tel: string, corps: string): string {
  const num = tel.replace(/[^0-9+]/g, "");
  // `&body=` sur Android, `?body=` sur iOS : `?` puis `&` fonctionne des deux côtés
  // quand il n'y a qu'un paramètre — c'est la forme retenue par la plupart des apps.
  return `sms:${num}?&body=${encodeURIComponent(corps.slice(0, 600))}`;
}
