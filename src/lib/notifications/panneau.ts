/**
 * CE QUI MÉRITE D'ÊTRE NOTIFIÉ — et comment le regrouper.
 *
 * ⚠️ LA TABLE `notifications` EST UN FOURRE-TOUT INTERNE, PAS UNE BOÎTE DE RÉCEPTION.
 * Elle porte les séances planifiées (`coach_session`, une ligne par séance), le ressenti
 * que l'athlète a lui-même saisi (`session_feedback`), l'état du coach automatique, les
 * quotas IA, les réglages, l'objectif, le PPS… Le panneau en affichait les 20 dernières
 * lignes telles quelles : mesuré en base le 21/09/2026, 123 lignes `coach_session`, 26
 * `session_feedback`, 22 analyses — et 2 vrais messages du coach. Cyprien : « tu en
 * envoies trop », « Ressenti séance RPE 6/10 » lui était notifié comme une nouvelle.
 *
 * Deux règles, pures et testées ici :
 *  1. LISTE BLANCHE : seuls les types qui sont une NOUVELLE pour la personne passent —
 *     un message reçu, une séance analysée, un plan mis à jour. Ce qu'elle a écrit
 *     elle-même, ou ce que la machine note pour elle-même, non.
 *  2. REGROUPEMENT : sept séances republiées le même jour = UNE entrée « Plan mis à
 *     jour » qui les nomme, pas sept notifications.
 */
export type LigneNotification = { id: string; type: string; title: string; body: string | null; read: boolean; created_at: string };

export type EntreePanneau = {
  /** Clé stable : l'identifiant de la ligne, ou `plan:<jour>` pour un regroupement. */
  cle: string;
  type: "message" | "plan" | "analyse";
  titre: string;
  corps: string | null;
  lue: boolean;
  at: string;
};

/** Les types qui sont une nouvelle POUR la personne connectée. Tout le reste est du bruit. */
export const TYPES_NOTIFIES = new Set([
  "coach_message",        // le coach a répondu à l'athlète
  "athlete_message",      // un athlète a écrit au coach (compte éditeur)
  "client_message",       // idem, forme historique
  "session_ai_analysis",  // une séance vient d'être analysée
  "seance_analyse",       // idem, forme historique
  "coach_session",        // une séance planifiée — REGROUPÉE par jour
]);

const MAX_ENTREES = 10;
const TITRES_CITES = 3;

export function construirePanneau(
  lignes: readonly LigneNotification[],
  libelles: { planMaj: string; seances: (n: number) => string },
): EntreePanneau[] {
  const entrees: EntreePanneau[] = [];
  const plans = new Map<string, LigneNotification[]>();

  for (const l of lignes) {
    if (!TYPES_NOTIFIES.has(l.type)) continue;
    if (l.type === "coach_session") {
      const jour = l.created_at.slice(0, 10);
      const g = plans.get(jour) ?? [];
      g.push(l);
      plans.set(jour, g);
      continue;
    }
    entrees.push({
      cle: l.id,
      type: /message/.test(l.type) ? "message" : "analyse",
      titre: l.title,
      corps: l.body,
      lue: l.read,
      at: l.created_at,
    });
  }

  for (const [jour, g] of plans) {
    const titres = g.map((x) => x.title).filter(Boolean);
    const cites = titres.slice(0, TITRES_CITES).join(" · ");
    const reste = titres.length - TITRES_CITES;
    entrees.push({
      cle: `plan:${jour}`,
      type: "plan",
      titre: libelles.planMaj,
      corps: `${libelles.seances(titres.length)}${cites ? ` — ${cites}` : ""}${reste > 0 ? ` · +${reste}` : ""}`,
      lue: g.every((x) => x.read),
      // L'heure de la plus récente : c'est le moment où le plan a bougé.
      at: g.map((x) => x.created_at).sort().at(-1) ?? g[0].created_at,
    });
  }

  return entrees
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, MAX_ENTREES);
}

/** Retire ce que la personne a écarté d'une croix (clés mémorisées dans ses réglages). */
export const sansMasquees = (entrees: readonly EntreePanneau[], masquees: readonly string[]): EntreePanneau[] =>
  entrees.filter((e) => !masquees.includes(e.cle));

/** Plafond du réglage : on garde les dernières clés écartées, pas un journal infini. */
export const MASQUEES_MAX = 50;
export const ajouterMasquee = (masquees: readonly string[], cle: string): string[] =>
  [...masquees.filter((c) => c !== cle), cle].slice(-MASQUEES_MAX);
