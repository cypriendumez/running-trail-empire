// ─────────────────────────────────────────────────────────────────────────────
//  SANTÉ › RÉCUPÉRATION (lot 2, 10/11/2026) — ce que l'onglet affiche, calculé côté serveur.
//
//  Forme et VFC : les MÊMES fiches que les pages Indicateurs (`ficheIndicateur`, sur les
//  données de `chargerDonnees`) — l'onglet ne peut pas contredire la page de détail.
//  Sommeil : la dernière nuit qui porte une mesure, et la moyenne des nuits MESURÉES des
//  7 derniers jours (une nuit sans durée n'est pas une nuit de 0 h). Absent = dit absent.
// ─────────────────────────────────────────────────────────────────────────────
import { ficheIndicateur, type DonneesFiche } from "@/lib/indicateurs/fiches";
import type { Fiche } from "@/lib/indicateurs/types";
import { lireBilan, type BilanMatin } from "@/lib/health/bilanMatin";

export type ResumeIndicateur = { valeur: string; unite?: string; statut?: { libelle: string; ton: string }; verdict: string; vide?: string };
export type DonneesRecup = {
  bilanJour: BilanMatin | null;
  bilans: BilanMatin[];
  forme: ResumeIndicateur | null;
  vfc: ResumeIndicateur | null;
  sommeil: { derniere: { date: string; min: number | null; score: number | null } | null; moyenneMin: number | null; nuits: number };
  fcRepos: number | null;
  panne: boolean;
};

const decale = (jour: string, n: number) => { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const positif = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

const resume = (f: Fiche): ResumeIndicateur => ({ valeur: f.valeur, unite: f.unite, statut: f.statut, verdict: f.verdict, vide: f.vide });

/** Les bilans des 14 derniers jours (un par jour, le plus récent d'abord) et celui du jour. */
export function bilansRecents(lignes: readonly { data?: unknown }[], jour: string): { bilanJour: BilanMatin | null; bilans: BilanMatin[] } {
  const depuis = decale(jour, -13);
  const vus = new Set<string>();
  const bilans: BilanMatin[] = [];
  for (const l of lignes) {
    const b = lireBilan(l.data);
    if (!b || b.date < depuis || b.date > jour || vus.has(b.date)) continue;
    vus.add(b.date); bilans.push(b);
  }
  bilans.sort((a, b) => (a.date < b.date ? 1 : -1));
  return { bilanJour: bilans.find((b) => b.date === jour) ?? null, bilans };
}

/** Le sommeil : dernière nuit mesurée, moyenne des nuits mesurées des 7 derniers jours. */
export function resumeSommeil(nuits: DonneesFiche["sommeil"], jour: string): DonneesRecup["sommeil"] {
  const mesurees = nuits.filter((n) => n.date <= jour && (positif(n.total_sleep_min) != null || positif(n.sleep_score) != null))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const d = mesurees[0];
  const semaine = mesurees.filter((n) => n.date >= decale(jour, -6) && positif(n.total_sleep_min) != null);
  return {
    derniere: d ? { date: d.date, min: positif(d.total_sleep_min), score: positif(d.sleep_score) } : null,
    moyenneMin: semaine.length ? Math.round(semaine.reduce((s, n) => s + (n.total_sleep_min as number), 0) / semaine.length) : null,
    nuits: semaine.length,
  };
}

export function donneesRecup(d: DonneesFiche & { pannes: string[] }, lignesBilan: readonly { data?: unknown }[], jour: string, bilanPanne: boolean): DonneesRecup {
  return {
    ...bilansRecents(lignesBilan, jour),
    forme: resume(ficheIndicateur("forme", d)),
    vfc: resume(ficheIndicateur("vfc", d)),
    sommeil: resumeSommeil(d.sommeil, jour),
    fcRepos: positif(d.fcRepos),
    panne: bilanPanne || d.pannes.length > 0,
  };
}
