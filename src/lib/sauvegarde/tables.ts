/**
 * CE QU'UNE SAUVEGARDE A LE DROIT DE CONTENIR.
 *
 * ⚠️ LE DÉPÔT EST PUBLIC (vérifié le 03/09/2026 : l'API GitHub répond `private: false`)
 * et la sauvegarde part chez GitHub. Y placer une table de données personnelles —
 * profils, entraînements, journal intime, messages, traces GPS — serait une divulgation,
 * pas une sauvegarde. La liste ci-dessous est donc une AUTORISATION EXPLICITE, jamais
 * une exclusion : une table inconnue n'est pas sauvegardée, et c'est le bon défaut.
 *
 * ⚠️ CE QUI EST IRREMPLAÇABLE. Les 17 131 courses ont été bâties par des mois de
 * collecte, et les sources ne sont plus accessibles à cette échelle : jogging-plus
 * refuse les automates (403 mesuré), la FFA l'interdit par robots.txt, jogging-plus est
 * épuisé. Perdue, cette table NE SE RECONSTRUIT PAS. C'est elle qui justifie ce module.
 */

export type TableSauvegardee = {
  nom: string;
  /** Pourquoi elle peut être publiée — la question à se poser AVANT d'en ajouter une. */
  raison: string;
  /** Colonne d'ordre stable, indispensable pour paginer sans sauter de ligne. */
  ordre: string;
};

export const SAUVEGARDABLES: TableSauvegardee[] = [
  { nom: "races", ordre: "id",
    raison: "Catalogue public de courses françaises, déjà lisible par tous (RLS en lecture publique). Irremplaçable : les sources de collecte ne sont plus accessibles." },
  { nom: "product_offers", ordre: "id",
    raison: "Offres du comparateur d'équipement, déjà lisibles par tous. Reconstructibles, mais au prix d'une nouvelle collecte." },
];

/**
 * Les tables qui ne doivent JAMAIS sortir, nommées une par une.
 *
 * ⚠️ ON NE SE CONTENTE PAS DE L'AUTORISATION. Nommer aussi les interdites permet à un
 * test de rougir si l'une d'elles apparaissait un jour dans la liste autorisée — une
 * erreur de copie suffirait, et la divulgation serait silencieuse.
 */
export const INTERDITES = [
  "profiles", "workouts", "journal_entries", "messages", "notifications",
  "gps_traces", "sleep_data", "hrv_data", "shoes", "error_logs",
  "performance_baselines", "auto_coach_state", "discipline_scores", "segments",
];

export function estSauvegardable(nom: unknown): boolean {
  const n = String(nom ?? "").trim().toLowerCase();
  if (!n || INTERDITES.includes(n)) return false;
  return SAUVEGARDABLES.some((t) => t.nom === n);
}

/** Le nom du fichier d'une table dans l'archive. */
export function fichierDe(nom: string): string {
  return `${nom}.json`;
}

export type Manifeste = {
  /** Date de l'export, en ISO. */
  faite: string;
  /** Par table : le nombre de lignes RÉELLEMENT écrites. */
  lignes: Record<string, number>;
  /** Empreinte du contenu de chaque table, pour détecter une archive tronquée. */
  empreintes: Record<string, string>;
};

/**
 * Une archive est-elle exploitable ?
 *
 * ⚠️ UNE SAUVEGARDE QU'ON NE PEUT PAS RESTAURER N'EST PAS UNE SAUVEGARDE. On vérifie
 * donc que chaque table annoncée est présente, non vide, et que son empreinte
 * correspond — un export interrompu au milieu produit un fichier valide en JSON et
 * pourtant amputé, ce que seul le compte de lignes révèle.
 */
export function verifierManifeste(
  m: Partial<Manifeste> | null,
  empreinteReelle: (table: string) => string | null,
): { ok: boolean; problemes: string[] } {
  const problemes: string[] = [];
  if (!m || typeof m !== "object") return { ok: false, problemes: ["manifeste absent ou illisible"] };
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(m.faite ?? ""))) problemes.push("date d'export absente");
  for (const t of SAUVEGARDABLES) {
    const n = m.lignes?.[t.nom];
    if (typeof n !== "number" || n <= 0) { problemes.push(`${t.nom} : aucune ligne annoncée`); continue; }
    const attendue = m.empreintes?.[t.nom];
    const reelle = empreinteReelle(t.nom);
    if (!reelle) problemes.push(`${t.nom} : fichier absent de l'archive`);
    else if (attendue && attendue !== reelle) problemes.push(`${t.nom} : contenu différent de l'empreinte — archive tronquée ou modifiée`);
  }
  return { ok: problemes.length === 0, problemes };
}
