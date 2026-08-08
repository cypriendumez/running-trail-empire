// ─────────────────────────────────────────────────────────────────────────────
//  REPLI SANS IA — le support doit répondre même quand le modèle est indisponible.
//
//  DÉFAUT RÉEL, MESURÉ. Toute l'IA de l'app (coach, kiné, cours, support) tape sur UNE
//  seule clé Gemini en palier gratuit, plafonnée à la journée. 120 questions ont suffi à
//  épuiser le quota des TROIS modèles simultanément :
//      GenerateRequestsPerDayPerProjectPerModel-FreeTier → HTTP 429
//  La bascule de modèle de `generateContent` n'y change rien : elle les épuise l'un après
//  l'autre. Ce jour-là, chaque utilisateur lit « l'assistant est momentanément
//  indisponible » — autrement dit, il n'y a plus de support du tout.
//
//  Ce module répond sans aucun appel réseau, par correspondance de mots-clés sur la base
//  de connaissances. La réponse est moins bien tournée qu'une réponse du modèle ; elle est
//  en revanche EXACTE par construction, puisqu'elle ne fait que citer la base.
//
//  Il sert aussi de raccourci : sur une question fréquente, la réponse arrive en 0 ms.
// ─────────────────────────────────────────────────────────────────────────────
import { HELP_PAGES, HELP_PROBLEMS } from "@/data/helpKb";
import { PROBLEM_KEYS, PROBLEM_T } from "@/data/helpProblemsI18n";

/** Normalise pour comparer : minuscules, sans accents, sans ponctuation. */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Mots trop courants pour discriminer quoi que ce soit — ils feraient tout matcher. */
const STOP = new Set(norm(
  "le la les un une des du de a au aux et ou ou est sont ne pas plus je tu il elle on nous vous ils mon ma mes ton ta tes son sa ses ce cet cette dans sur pour avec sans que qui quoi comment pourquoi ou quand mais donc car y en si me te se lui leur pas rien tout tous toute jamais deja encore the a an is are do does i you my your it to of in on for with how why what where when can cant not and or wie was wo warum ich mein kann nicht und oder der die das den dem ein eine como que donde por para mi puedo no y o el la los las onde porque meu posso nao e ou os as",
).split(" "));

const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Meilleure réponse trouvable sans IA. `null` si rien ne correspond franchement —
 * mieux vaut avouer qu'on n'a pas compris que servir une réponse hors sujet.
 */
export function fallbackAnswer(question: string, lang = "fr"): string | null {
  const qw = words(question);
  if (!qw.length) return null;

  let best: { score: number; text: string } | null = null;

  // 1. Problèmes fréquents — ce sont les vraies questions de support.
  for (const p of HELP_PROBLEMS) {
    const target = words(`${p.q} ${p.a}`);
    // Synonymes déclarés (toutes langues) : sans eux, « la synchronisation ne marche
    // pas » ne correspondait à rien, faute du mot « synchronisation » dans les questions.
    const keys = (PROBLEM_KEYS[p.q] ?? []).map(norm);
    const hits = qw.filter((w) => target.includes(w)).length;
    const keyHits = qw.filter((w) => keys.includes(w)).length;
    const qHits = qw.filter((w) => words(p.q).includes(w)).length;
    const score = hits + qHits * 2 + keyHits * 3;
    if (score >= 3 && (!best || score > best.score)) {
      best = { score, text: PROBLEM_T[p.q]?.[lang] ?? p.a };
    }
  }

  // 2. Pages — pour un « où se trouve … ».
  for (const page of HELP_PAGES) {
    const nameHits = qw.filter((w) => words(page.name).includes(w)).length;
    const whatHits = qw.filter((w) => words(page.what).includes(w)).length;
    const keyHits = qw.filter((w) => (page.keys ?? []).map(norm).includes(w)).length;
    const score = nameHits * 3 + keyHits * 3 + whatHits;
    if (score >= 3 && (!best || score > best.score)) {
      // Le chemin de clics est ce qui rend la réponse actionnable : sans lui, on répond
      // « c'est dans Santé » à quelqu'un qui cherche justement où cliquer.
      const how = page.how ? `\n\n➜ ${page.how}` : "";
      best = { score, text: `**${page.name}** — ${page.what}${how}` };
    }
  }

  return best?.text ?? null;
}

/** Message servi quand l'IA est indisponible ET qu'aucune correspondance n'est trouvée.
 *  Il DIT que l'assistant est dégradé plutôt que de laisser croire à une réponse complète. */
export const FALLBACK_MISS: Record<string, string> = {
  fr: "L'assistant intelligent est momentanément indisponible et je n'ai pas trouvé de réponse toute prête à ta question. Écris au coach depuis la Messagerie — il te répondra directement.",
  en: "The smart assistant is temporarily unavailable and I found no ready-made answer to your question. Write to your coach from Messages — he will reply directly.",
  de: "Der intelligente Assistent ist vorübergehend nicht verfügbar und ich habe keine vorgefertigte Antwort gefunden. Schreib deinem Coach über Nachrichten — er antwortet dir direkt.",
  es: "El asistente inteligente no está disponible por ahora y no he encontrado una respuesta preparada. Escribe a tu entrenador desde Mensajería — te responderá directamente.",
  pt: "O assistente inteligente está indisponível de momento e não encontrei uma resposta pronta. Escreve ao teu treinador a partir das Mensagens — ele responde diretamente.",
};

/** Bandeau ajouté devant une réponse de repli : l'utilisateur doit savoir qu'il lit une
 *  fiche de la base, pas une réponse adaptée à son compte. */
export const FALLBACK_PREFIX: Record<string, string> = {
  fr: "⚡ Réponse rapide (assistant intelligent momentanément indisponible) :\n\n",
  en: "⚡ Quick answer (smart assistant temporarily unavailable):\n\n",
  de: "⚡ Schnelle Antwort (intelligenter Assistent vorübergehend nicht verfügbar):\n\n",
  es: "⚡ Respuesta rápida (asistente inteligente no disponible por ahora):\n\n",
  pt: "⚡ Resposta rápida (assistente inteligente indisponível de momento):\n\n",
};
