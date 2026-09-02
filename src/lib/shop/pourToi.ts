/**
 * « EST-CE LA CHAUSSURE POUR MOI ? » — la seule question qu'un comparateur de prix ne
 * sait pas traiter.
 *
 * Un comparateur classique connaît le produit. Pacevo connaît le COUREUR : son volume
 * réel, sa sortie longue, son objectif et sa date, sa VMA, sa rotation et l'usure de
 * chaque paire. Ce module confronte les deux et rend un avis argumenté, jamais une note
 * seule — une note sans motif ne se discute pas et ne s'apprend pas.
 *
 * ⚠️ RÈGLE ABSOLUE : CE QU'ON IGNORE SE DIT. Un athlète sans historique ne reçoit pas un
 * avis moyen déguisé en avis personnel ; il reçoit les critères généraux du modèle et la
 * mention explicite de ce qui manque pour trancher. C'est la même règle que partout dans
 * l'app : quand la donnée manque, on le dit, on ne la fabrique pas.
 *
 * ⚠️ ON REND DES CLÉS, PAS DES PHRASES — voir `description.ts` pour le pourquoi.
 */
import type { Modele } from "./modele";
import { usageDe } from "./usage";
import type { Bout } from "@/components/shop/shopI18n";

export type ProfilAthlete = {
  /** Volume hebdomadaire réellement couru, en km (médiane des semaines courues). */
  volumeHebdoKm?: number | null;
  /** Plus longue sortie des dernières semaines, en km. */
  sortieLongueKm?: number | null;
  /** Part des séances faites en trail, entre 0 et 1. */
  partTrail?: number | null;
  /** VMA effective, en km/h. */
  vma?: number | null;
  /** Objectif : distance de la course visée et nombre de semaines qui en séparent. */
  objectifKm?: number | null;
  semainesAvantCourse?: number | null;
  /** Drop des chaussures actuellement en rotation, en mm. */
  dropsEnRotation?: number[];
  /** Paires actives et leur usure : sert à repérer un manque dans la rotation. */
  rotation?: { marque: string; modele: string; km: number; maxKm: number; terrain?: string }[];
};

export type Avis = {
  score: number;                 // 0–100, et seulement à titre de tri
  verdict: string;               // clé de texte
  pour: Bout[];
  contre: Bout[];
  /** Ce qui n'a pas pu être pris en compte, faute de donnée. */
  inconnu: Bout[];
};

/**
 * LES PAIRES À REMPLACER — et rien d'autre.
 *
 * Le seuil est à 85 % : un amorti se tasse AVANT que la semelle ne paraisse usée, et un
 * remplacement se prépare, il ne se subit pas.
 *
 * ⚠️ UNE PAIRE À 0 KM NE PEUT PAS DÉCLENCHER CE BANDEAU — et ce n'est pas grâce à un
 * garde-fou. J'avais écrit `r.km > 0 && …` en croyant protéger contre le zéro qui signifie
 * « kilométrage non renseigné » ; la mutation a montré que cette condition était
 * INATTEIGNABLE : un ratio de 0 est déjà sous le seuil de 85 %. Un garde qu'aucune
 * mutation ne peut faire tomber n'est pas une protection, c'est du bruit qui fait croire
 * qu'un cas est traité. Le vrai risque du zéro — un badge « Bon état » affiché sur une
 * paire dont on ignore tout — se joue dans le garage, où il est traité explicitement.
 */
export const SEUIL_USURE = 0.85;

export function paireAremplacer(rotation: ProfilAthlete["rotation"]): { marque: string; modele: string; km: number; maxKm: number; terrain?: string } | null {
  const candidates = (rotation ?? []).filter((r) => r.maxKm > 0 && r.km / r.maxKm >= SEUIL_USURE);
  // La plus avancée d'abord : c'est celle qui presse.
  return candidates.sort((a, b) => b.km / b.maxKm - a.km / a.maxKm)[0] ?? null;
}

/** Les usages qui supposent qu'on court vite le jour J. */
const USAGES_RAPIDES = new Set(["competition", "tempo"]);

/**
 * ⚠️ 15 km/h DE VMA, PAS UN SEUIL ARBITRAIRE. Une plaque carbone travaille par flexion :
 * elle ne rend au coureur que ce qu'il lui donne en vitesse et en force d'appui. Sous
 * une allure de compétition d'environ 4 min 30/km — soit une VMA de l'ordre de 15 km/h —
 * la littérature ne montre plus de gain d'économie de course, et la rigidité se paie en
 * fatigue du pied. Ce n'est pas un jugement sur le coureur : c'est une question de
 * mécanique.
 */
export const VMA_PLAQUE = 15;

export function evaluer(m: Modele, p: ProfilAthlete): Avis {
  const pour: Bout[] = [], contre: Bout[] = [], inconnu: Bout[] = [];
  let score = 50;
  const usage = usageDe(m);

  // ── TERRAIN ─────────────────────────────────────────────────────────────────────────
  if (p.partTrail == null) {
    inconnu.push({ cle: "shop.i.part_trail" });
  } else if (m.terrain === "trail") {
    if (p.partTrail >= 0.4) { score += 15; pour.push({ cle: "shop.a.trail_ok", params: { part: Math.round(p.partTrail * 100) } }); }
    else { score -= 15; contre.push({ cle: "shop.a.trail_ko", params: { part: Math.round((1 - p.partTrail) * 100) } }); }
  } else if (m.terrain === "route") {
    if (p.partTrail <= 0.3) { score += 15; pour.push({ cle: "shop.a.route_ok" }); }
    else { score -= 10; contre.push({ cle: "shop.a.route_ko", params: { part: Math.round(p.partTrail * 100) } }); }
  }

  // ── PLAQUE CARBONE ──────────────────────────────────────────────────────────────────
  if (m.plaqueCarbone?.valeur) {
    if (p.vma == null) inconnu.push({ cle: "shop.i.vma" });
    else if (p.vma >= VMA_PLAQUE) { score += 10; pour.push({ cle: "shop.a.plaque_ok", params: { vma: p.vma.toFixed(1) } }); }
    else { score -= 20; contre.push({ cle: "shop.a.plaque_ko", params: { vma: p.vma.toFixed(1) } }); }
    if (p.semainesAvantCourse == null || p.semainesAvantCourse > 20) contre.push({ cle: "shop.a.plaque_sans_course" });
  }

  // ── VOLUME ET AMORTI ────────────────────────────────────────────────────────────────
  const stack = m.stackTalonMm?.valeur;
  if (p.volumeHebdoKm == null) {
    inconnu.push({ cle: "shop.i.volume" });
  } else if (p.volumeHebdoKm >= 60) {
    if (usage === "quotidien" || usage === "amorti_max") { score += 12; pour.push({ cle: "shop.a.volume_ok", params: { km: Math.round(p.volumeHebdoKm) } }); }
    if (stack != null && stack < 28) { score -= 10; contre.push({ cle: "shop.a.volume_fin", params: { stack, km: Math.round(p.volumeHebdoKm) } }); }
  } else if (p.volumeHebdoKm < 25 && usage === "amorti_max") {
    score -= 5;
    contre.push({ cle: "shop.a.volume_petit", params: { km: Math.round(p.volumeHebdoKm) } });
  }

  // ── OBJECTIF ────────────────────────────────────────────────────────────────────────
  if (p.objectifKm == null) {
    inconnu.push({ cle: "shop.i.objectif" });
  } else {
    const longue = p.objectifKm >= 30;
    if (longue && usage === "trail_long") { score += 12; pour.push({ cle: "shop.a.objectif_long_ok", params: { km: p.objectifKm } }); }
    if (longue && usage === "trail_court") { score -= 8; contre.push({ cle: "shop.a.objectif_long_ko", params: { km: p.objectifKm } }); }
    if (!longue && usage && USAGES_RAPIDES.has(usage) && p.semainesAvantCourse != null && p.semainesAvantCourse <= 12) {
      score += 10; pour.push({ cle: "shop.a.echeance", params: { semaines: p.semainesAvantCourse } });
    }
  }

  // ── TRANSITION DE DROP ──────────────────────────────────────────────────────────────
  const drop = m.dropMm?.valeur;
  const drops = (p.dropsEnRotation ?? []).filter((d) => Number.isFinite(d));
  if (drop != null && drops.length) {
    const habituel = drops.reduce((a, b) => a + b, 0) / drops.length;
    const ecart = Math.abs(habituel - drop);
    if (ecart >= 4) {
      score -= 8;
      contre.push({ cle: "shop.a.drop_ecart", params: { habituel: habituel.toFixed(0), drop, ecart: ecart.toFixed(0) } });
    } else {
      pour.push({ cle: "shop.a.drop_proche", params: { habituel: habituel.toFixed(0) } });
    }
  } else if (drop != null && !drops.length) {
    inconnu.push({ cle: "shop.i.drops" });
  }

  // ── ROTATION : REMPLACER, OU COMPLÉTER ──────────────────────────────────────────────
  const usees = (p.rotation ?? []).filter((r) => r.maxKm > 0 && r.km / r.maxKm >= 0.85);
  if (usees.length) {
    score += 6;
    pour.push(usees.length === 1
      ? { cle: "shop.a.usure_une", params: { marque: usees[0].marque, modele: usees[0].modele } }
      : { cle: "shop.a.usure_plusieurs", params: { n: usees.length } });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    verdict: verdictDe(score, inconnu.length, pour.length, contre.length),
    pour, contre, inconnu,
  };
}

/**
 * ⚠️ LE VERDICT DIT AUSSI SUR QUOI IL REPOSE. Un avis fondé sur zéro donnée personnelle
 * ne doit pas se présenter comme un conseil personnalisé : c'est ce qui distingue une
 * recommandation d'un argument de vente.
 */
export function verdictDe(score: number, inconnues: number, pour: number, contre: number): string {
  if (pour === 0 && contre === 0) return "shop.v.rien";
  if (inconnues >= 3) return "shop.v.partiel";
  if (score >= 70) return "shop.v.bien";
  if (score >= 55) return "shop.v.reserves";
  if (score >= 40) return "shop.v.peu";
  return "shop.v.eviter";
}

/** Classement d'un catalogue pour un athlète : le score sert au tri, jamais à l'affichage seul. */
export function classer(liste: Modele[], p: ProfilAthlete): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of liste) m.set(x.slug, evaluer(x, p).score);
  return m;
}
