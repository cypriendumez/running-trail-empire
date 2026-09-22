/**
 * LE BILAN STRUCTURÉ DU KINÉ IA — ce que la consultation laisse d'actionnable.
 *
 * Le modèle termine sa réponse par un bloc ```bilan (JSON) : hypothèses hiérarchisées,
 * drapeau rouge, exercices dosés, consigne de charge, critère de reprise. Ce module le
 * DÉTACHE du texte lisible et le VALIDE champ par champ : un modèle qui oublie le bloc,
 * l'écrit mal ou y glisse un champ inconnu ne casse rien — on rend le texte, sans carte.
 *
 * ⚠️ RIEN ICI N'EST CRU SUR PAROLE : chaque champ est borné (taille, nombre, valeurs
 * admises). Ce bilan alimente un bouton qui ÉCRIT dans le calendrier de l'athlète ; une
 * chaîne de 10 000 caractères ou un « exercice » qui est en fait une injonction n'ont
 * rien à y faire.
 */
export type Hypothese = { nom: string; probabilite: "haute" | "moyenne" | "faible" };
export type Exercice = { nom: string; dosage: string; frequence: string };
export type Bilan = {
  hypotheses: Hypothese[];
  urgence: boolean;
  exercices: Exercice[];
  charge: string;
  reprise: string;
};

const MAX_HYPOTHESES = 3;
const MAX_EXERCICES = 4;
const PROBAS = new Set(["haute", "moyenne", "faible"]);

const texte = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Le bloc ```bilan … ``` (ou ```json … ``` en dernier), s'il existe, et le texte sans lui. */
export function extraireBilan(reponse: string): { texte: string; bilan: Bilan | null } {
  if (typeof reponse !== "string") return { texte: "", bilan: null };
  // Le DERNIER bloc de code étiqueté bilan ou json : c'est là que l'invite le demande.
  const re = /```(?:bilan|json)\s*\n([\s\S]*?)```\s*$/i;
  const m = reponse.trim().match(re);
  if (!m) {
    /**
     * ⚠️ BLOC OUVERT ET JAMAIS REFERMÉ = RÉPONSE COUPÉE EN PLEIN BILAN. Vu en réel le
     * 22/09/2026 : l'athlète lisait `{"hypotheses":[{"nom":"Syndrome de la Bandelette`
     * à la fin de sa consultation. On coupe le fragment — il n'apporte rien et ressemble
     * à un bug — et on rend le texte clinique, qui, lui, est complet et utile.
     */
    const ouvert = reponse.trim().match(/```(?:bilan|json)\s*\n[\s\S]*$/i);
    return { texte: ouvert ? reponse.trim().slice(0, ouvert.index).trim() : reponse.trim(), bilan: null };
  }
  const sans = reponse.trim().replace(re, "").trim();
  let brut: unknown;
  try { brut = JSON.parse(m[1]); } catch { return { texte: sans, bilan: null }; }
  const bilan = validerBilan(brut);
  return { texte: sans, bilan };
}

/** Un objet quelconque → un Bilan sûr, ou null s'il n'a pas la forme. */
export function validerBilan(brut: unknown): Bilan | null {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
  const o = brut as Record<string, unknown>;
  const hypotheses: Hypothese[] = (Array.isArray(o.hypotheses) ? o.hypotheses : [])
    .map((h) => {
      const x = (h ?? {}) as Record<string, unknown>;
      const nom = texte(x.nom, 90);
      const p = typeof x.probabilite === "string" ? x.probabilite.toLowerCase() : "moyenne";
      return { nom, probabilite: (PROBAS.has(p) ? p : "moyenne") as Hypothese["probabilite"] };
    })
    .filter((h) => h.nom.length >= 3)
    .slice(0, MAX_HYPOTHESES);
  const exercices: Exercice[] = (Array.isArray(o.exercices) ? o.exercices : [])
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return { nom: texte(x.nom, 80), dosage: texte(x.dosage, 80), frequence: texte(x.frequence, 60) };
    })
    .filter((e) => e.nom.length >= 3 && e.dosage.length >= 2)
    .slice(0, MAX_EXERCICES);
  const bilan: Bilan = {
    hypotheses,
    urgence: o.urgence === true,
    exercices,
    charge: texte(o.charge, 220),
    reprise: texte(o.reprise, 220),
  };
  // Un bilan vide (ni hypothèse ni exercice ni consigne) n'est pas un bilan.
  if (!bilan.hypotheses.length && !bilan.exercices.length && !bilan.charge && !bilan.urgence) return null;
  return bilan;
}

/** Le texte d'une note de calendrier pour une séance de protocole — borné, lisible. */
export function noteProtocole(zone: string | null, exercices: Exercice[]): string {
  const entete = zone ? `Protocole kiné — ${zone}` : "Protocole kiné";
  const lignes = exercices.slice(0, MAX_EXERCICES).map((e) => `• ${e.nom} : ${e.dosage}${e.frequence ? ` (${e.frequence})` : ""}`);
  return [entete, ...lignes].join("\n").slice(0, 1000);
}

/**
 * Les dates d'un protocole de deux semaines à trois séances : J+1, J+3, J+5, J+8, J+10,
 * J+12 — un jour sur deux, jamais le jour même (la consultation vient d'avoir lieu).
 */
export function datesProtocole(aujourdhui: string): string[] {
  const base = new Date(`${aujourdhui}T12:00:00Z`);
  if (Number.isNaN(base.getTime())) return [];
  return [1, 3, 5, 8, 10, 12].map((j) => new Date(base.getTime() + j * 86400000).toISOString().slice(0, 10));
}
