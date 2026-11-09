/**
 * MÉMOIRE DU JOURNAL DES TRACÉS, PAR INSTANCE (09/11/2026).
 *
 * Décide, AVANT tout `await`, si une ligne d'`error_logs` doit partir. `journaliserEchecUneFois`
 * déduplique sur 24 h par un « lire puis écrire » : des recherches SIMULTANÉES sur des parcours
 * différents (une panne d'Overpass touche tous les clics) passaient toutes le « lire » avant le
 * premier « écrire » — N lignes identiques. Et le plafond des lignes « Tracé incomplet » comptait les
 * APPELS : un même parcours redit toutes les 10 min mangeait la place des autres (relecture
 * « échecs muets » du 09/11/2026). L'horloge est passée en argument : tout est éprouvé par les tests.
 */
export class MemoireJournal {
  /** Parcours incomplets déjà listés : clé → instant (une ligne par parcours et par jour). */
  private listes = new Map<string, number>();
  private fenetre = { debut: Number.NEGATIVE_INFINITY, n: 0, synthese: false };
  /** Messages constants (pannes, synthèse, catalogue illisible) : message → instant du dernier envoi. */
  private envois = new Map<string, number>();

  constructor(readonly maxParHeure = 20, readonly heureMs = 60 * 60_000, readonly jourMs = 24 * 60 * 60_000) {}

  /**
   * Un parcours incomplet : « lister » (sa propre ligne), « synthese » (la ligne de synthèse, une fois
   * par fenêtre d'une heure), ou « rien » (déjà listé aujourd'hui, ou synthèse déjà écrite).
   * Seules les lignes réellement à écrire consomment le plafond.
   */
  incomplet(cle: string, maintenant: number): "lister" | "synthese" | "rien" {
    const vu = this.listes.get(cle);
    if (vu !== undefined && maintenant - vu < this.jourMs) return "rien";
    if (maintenant - this.fenetre.debut >= this.heureMs) this.fenetre = { debut: maintenant, n: 0, synthese: false };
    if (this.fenetre.n < this.maxParHeure) {
      this.fenetre.n++;
      if (this.listes.size > 5000) for (const [k, t] of this.listes) if (maintenant - t >= this.jourMs) this.listes.delete(k);
      this.listes.set(cle, maintenant);
      return "lister";
    }
    if (this.fenetre.synthese) return "rien";
    this.fenetre.synthese = true;
    return "synthese";
  }

  /** Un message constant : vrai s'il n'est pas parti depuis `fenetreMs` (garde synchrone). */
  uneFois(message: string, maintenant: number, fenetreMs = this.heureMs): boolean {
    const t = this.envois.get(message);
    if (t !== undefined && maintenant - t < fenetreMs) return false;
    if (this.envois.size > 500) this.envois.clear();
    this.envois.set(message, maintenant);
    return true;
  }
}
