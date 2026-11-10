/**
 * LA LOGIQUE DE L'ÉTAPE MONTRE, SANS ÉCRAN (12/10/2026).
 *
 * Sortie d'EtapeMontre pour être passée au crible (tests/connexion-montre.crash.test.ts) :
 * ce que vaut la clé saisie, quel message montrer quand la route refuse, et quoi dire après
 * la première synchronisation. PARTAGÉE avec la page Sync Montre depuis le 12/10/2026 : les
 * deux portes d'entrée appliquent exactement les mêmes règles.
 */

export type EtatCle = { valide: boolean; indice: "mdp" | "format" | null };

/**
 * La clé API saisie. Une vraie clé intervals.icu fait 25 caractères, minuscules et chiffres
 * (relevé le 12/10/2026) ; on accepte de 16 à 64 lettres ou chiffres. Les espaces et les
 * retours à la ligne autour (copier-coller) sont ignorés ; au milieu, la clé est fausse.
 */
export function etatCle(saisie: string): EtatCle {
  const c = (saisie ?? "").trim();
  if (c === "") return { valide: false, indice: null };
  // Court avec une majuscule ou un signe : c'est presque toujours le mot de passe du compte.
  if (c.length < 20 && /[A-Z!?@#$%^&*]/.test(c)) return { valide: false, indice: "mdp" };
  if (!/^[a-z0-9]{16,64}$/i.test(c)) return { valide: false, indice: "format" };
  return { valide: true, indice: null };
}

/** La clé de dictionnaire du message d'un refus de `/api/intervals/credentials`, ou `null`. */
export function cleMessageErreur(code: unknown): "mErrCle" | "mErrIndispo" | null {
  if (code === "cle_refusee") return "mErrCle";
  if (code === "indisponible" || code === "reponse_invalide") return "mErrIndispo";
  return null;
}

/**
 * L'ÉTAPE AVANCE SEULE AU RETOUR D'intervals.icu (09/11/2026).
 *
 * Constaté avec le frère de Cyprien : il clique « Créer mon compte gratuit », crée son compte
 * et relie sa COROS dans l'onglet d'intervals.icu, revient sur Pacevo… et retrouve la MÊME
 * question (« Créer mon compte / J'ai déjà un compte »), comme si rien ne s'était passé.
 *
 * ⚠️ Pacevo ne voit RIEN de ce qui se passe chez intervals.icu avant l'autorisation de
 * l'étape 3 : c'est elle qui crée le lien. Ce qu'on sait, en revanche, c'est que l'athlète
 * est parti par NOTRE bouton et qu'il revient. On avance donc d'un cran à ce retour — et
 * « Revoir » permet de rouvrir l'étape.
 *
 * @param sous        l'étape ouverte au moment du retour
 * @param etapeDepart l'étape dont le bouton a ouvert intervals.icu
 * @returns l'étape à ouvrir : la suivante, ou la même si l'athlète a changé d'étape entre-temps
 */
export function etapeAuRetour(sous: number, etapeDepart: number): number {
  if (!Number.isInteger(sous) || !Number.isInteger(etapeDepart)) return sous;
  // Seules les deux premières étapes mènent quelque part : la troisième EST la connexion.
  if (etapeDepart < 0 || etapeDepart > 1) return sous;
  return sous === etapeDepart ? etapeDepart + 1 : sous;
}

export type Verdict = "attente" | "ok" | "vide";

/**
 * CE QUE DIT L'ÉCRAN APRÈS LA PREMIÈRE SYNCHRONISATION.
 *
 * ⚠️ « Activités détectées — tout est prêt » s'affichait dès qu'une synchronisation
 * RÉUSSISSAIT, même vide : la condition était `synced.workouts >= 0`, vraie pour zéro
 * séance. Le porteur d'Apple Watch dont l'app Companion n'a encore rien envoyé — le cas
 * NORMAL juste après l'avoir installée — lisait « tout est prêt » devant un tableau vide.
 *
 *  · `ok`      : au moins une séance des 7 derniers jours est arrivée ;
 *  · `vide`    : la synchronisation a marché, mais rien n'est encore arrivé ;
 *  · `attente` : pas encore de réponse exploitable (on réessaie).
 */
export function verdictSuivi(statut: unknown, synchro: unknown): Verdict {
  const s = statut as { configured?: unknown } | null | undefined;
  if (!s || typeof s !== "object" || s.configured !== true) return "attente";
  const r = synchro as { fetched?: { activities?: unknown } | null; synced?: unknown } | null | undefined;
  if (!r || typeof r !== "object") return "attente";
  const n = r.fetched && typeof r.fetched === "object" ? r.fetched.activities : undefined;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return "attente";
  if (n > 0) return "ok";
  return r.synced && typeof r.synced === "object" ? "vide" : "attente";
}
