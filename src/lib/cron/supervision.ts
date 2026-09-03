/**
 * EST-CE QUE LA MACHINE TOURNE VRAIMENT ?
 *
 * ⚠️ CONSTAT DU 03/09/2026 : huit tâches automatisées, AUCUNE ne laisse de trace, et
 * l'administration n'en dit rien. Il a fallu interroger l'API de GitHub à la main pour
 * découvrir que `sync-coach`, déclaré deux fois par heure (48 par jour), n'avait tourné
 * que 6 FOIS EN 24 HEURES — GitHub étrangle les planifications. Le même examen a montré
 * que la newsletter avait échoué le 31/08 sans que personne le sache, et l'historique du
 * dépôt garde la trace de deux tâches qui n'avaient JAMAIS tourné.
 *
 * ⚠️ ON NE S'AUTO-DÉCLARE PAS EN BONNE SANTÉ. Une tâche qui écrirait elle-même « j'ai
 * tourné » ne peut rien dire le jour où elle ne tourne pas — c'est exactement le cas
 * qu'on veut détecter. On interroge donc GitHub, qui sait ce qu'il a lancé, plutôt que
 * de croire un battement de cœur que la panne emporterait avec elle.
 */

export type Etat = "à l'heure" | "en retard" | "en échec" | "jamais lancée";

export type Tache = {
  /** Le nom du fichier, sans extension : c'est la clé chez GitHub. */
  fichier: string;
  /** Ce que le fichier déclare, en clair. */
  cadence: string;
  /** Exécutions attendues par jour, d'après la déclaration. */
  parJour: number;
  /** À quoi elle sert, en une ligne — pour qu'un lecteur non initié comprenne. */
  role: string;
};

/**
 * ⚠️ CE TABLEAU EST VÉRIFIÉ CONTRE LES FICHIERS `.github/workflows/*.yml` PAR UN TEST.
 * Recopié à la main, il aurait dérivé au premier changement de cadence, et la
 * supervision aurait comparé le réel à une attente imaginaire.
 */
export const TACHES: Tache[] = [
  { fichier: "sync-coach", cadence: "2×/heure", parJour: 48, role: "Importe les séances de la montre et replanifie" },
  { fichier: "races-liens", cadence: "3×/jour", parJour: 3, role: "Vérifie les liens d'inscription des courses" },
  { fichier: "races-types", cadence: "2×/jour", parJour: 2, role: "Corrige le type des courses (trail, marathon…)" },
  { fichier: "heure-depart", cadence: "1×/jour", parJour: 1, role: "Renseigne l'heure de départ des courses" },
  { fichier: "races-maintenance", cadence: "1×/jour", parJour: 1, role: "Entretien du catalogue de courses" },
  { fichier: "newsletter-weekly", cadence: "1×/semaine (lundi)", parJour: 1 / 7, role: "Résumé d'actualité et plan de la semaine" },
];

export type Execution = { created_at: string; conclusion: string | null; html_url?: string };

export type Constat = {
  tache: Tache;
  etat: Etat;
  /** Exécutions observées sur les dernières 24 h (7 jours pour une tâche hebdomadaire). */
  observees: number;
  attendues: number;
  derniere: string | null;
  /** Heures écoulées depuis la dernière exécution, `null` si aucune. */
  ilYaHeures: number | null;
  echecs: number;
};

/**
 * Ce qu'on peut dire d'une tâche, à partir de ce que GitHub a réellement lancé.
 *
 * ⚠️ « JAMAIS LANCÉE » N'EST PAS « EN RETARD ». Une tâche sans aucune exécution est un
 * défaut d'un autre ordre — elle n'a jamais fonctionné, souvent parce que son fichier
 * n'a pas été pris en compte. Les confondre reviendrait à ranger une panne totale parmi
 * les petits retards.
 */
export function constater(tache: Tache, runs: Execution[], maintenant: Date): Constat {
  const valides = runs
    .filter((r) => !Number.isNaN(new Date(r.created_at).getTime()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (valides.length === 0) {
    return { tache, etat: "jamais lancée", observees: 0, attendues: Math.round(tache.parJour) || 1,
      derniere: null, ilYaHeures: null, echecs: 0 };
  }

  // Une tâche hebdomadaire se juge sur sept jours ; une tâche horaire sur vingt-quatre
  // heures. Comparer une cadence hebdomadaire à une fenêtre d'un jour la déclarerait
  // toujours en retard.
  const fenetreHeures = tache.parJour < 1 ? 24 * 7 : 24;
  const limite = maintenant.getTime() - fenetreHeures * 3600000;
  const recentes = valides.filter((r) => new Date(r.created_at).getTime() >= limite);
  const attendues = Math.max(1, Math.round(tache.parJour * (fenetreHeures / 24)));

  const derniere = valides[0]!;
  const ilYaHeures = (maintenant.getTime() - new Date(derniere.created_at).getTime()) / 3600000;
  const echecs = recentes.filter((r) => r.conclusion && r.conclusion !== "success").length;

  // La dernière exécution a échoué : c'est le constat le plus grave, il prime.
  if (derniere.conclusion && derniere.conclusion !== "success") {
    return { tache, etat: "en échec", observees: recentes.length, attendues, derniere: derniere.created_at, ilYaHeures, echecs };
  }
  // ⚠️ « EN RETARD » SE JUGE SUR LE TEMPS ÉCOULÉ, PAS SUR LE COMPTE. GitHub étrangle les
  // planifications : `sync-coach` n'obtient que 6 exécutions sur 48, et le déclarer en
  // panne chaque jour rendrait l'écran inutile — on cesserait de le lire. Ce qui compte,
  // c'est qu'elle ait tourné dans un délai raisonnable : trois fois l'intervalle déclaré,
  // et jamais moins de six heures.
  const intervalleHeures = 24 / Math.max(tache.parJour, 1 / 7);
  // ⚠️ PAS « TROIS FOIS L'INTERVALLE ». Ce réglage, essayé d'abord, déclarait « à
  // l'heure » une newsletter hebdomadaire muette depuis TROIS SEMAINES : trois fois
  // 168 heures fait 21 jours. Une marge proportionnelle doit rester proportionnelle,
  // mais la moitié suffit ; les six heures fixes absorbent l'étranglement de GitHub sur
  // les tâches fréquentes, où l'intervalle déclaré est de trente minutes.
  const tolerance = intervalleHeures * 1.5 + 6;
  const etat: Etat = ilYaHeures > tolerance ? "en retard" : "à l'heure";
  return { tache, etat, observees: recentes.length, attendues, derniere: derniere.created_at, ilYaHeures, echecs };
}

/** Le constat le plus grave de l'ensemble — ce qu'on montre en tête d'écran. */
export function pire(constats: Constat[]): Etat {
  const ordre: Etat[] = ["jamais lancée", "en échec", "en retard", "à l'heure"];
  for (const e of ordre) if (constats.some((c) => c.etat === e)) return e;
  return "à l'heure";
}
