// ─────────────────────────────────────────────────────────────────────────────
//  Appel Gemini robuste : réessais + bascule de modèle.
//  Quand le modèle principal est saturé (503 « high demand ») ou throttlé (429),
//  on réessaie avec un court backoff, puis on bascule sur un modèle de secours.
//  Garantit que le coach / kiné IA répond presque toujours.
// ─────────────────────────────────────────────────────────────────────────────

const KEY = process.env.GEMINI_API_KEY;

// Du meilleur au plus dispo : on dégrade proprement si saturation.
const DEFAULT_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; status: number };

type GenConfig = Record<string, unknown>;

/**
 * Génère du texte avec Gemini, en réessayant et en basculant de modèle si besoin.
 * @param contents  tableau `contents` au format Gemini
 * @param generationConfig  config de génération (temperature, maxOutputTokens, …)
 */
export async function generateContent(
  contents: unknown,
  generationConfig: GenConfig,
  opts: { models?: string[]; retriesPerModel?: number } = {},
): Promise<GeminiResult> {
  if (!KEY) return { ok: false, error: "Clé IA manquante (configuration serveur).", status: 500 };

  const models = opts.models ?? DEFAULT_MODELS;
  const retries = opts.retriesPerModel ?? 1;
  let lastStatus = 503;
  let lastErr = "Service IA momentanément indisponible.";

  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents, generationConfig }),
          },
        );

        if (res.ok) {
          const data = await res.json();
          const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
            .map((p: { text?: string }) => p?.text ?? "")
            .join("")
            .trim();
          if (text) return { ok: true, text, model };
          // Réponse vide (filtre de sécurité, etc.) → on tente le modèle suivant.
          lastErr = "Réponse vide du modèle.";
          lastStatus = 502;
          break;
        }

        lastStatus = res.status;
        lastErr = (await res.text().catch(() => "")).slice(0, 160) || `HTTP ${res.status}`;

        // ── QUOTA JOURNALIER : ne JAMAIS réessayer le même modèle ──────────────
        //
        // Un 429 recouvre deux situations opposées. Le plafond PAR MINUTE se dissipe en
        // quelques secondes : réessayer a du sens. Le plafond PAR JOUR, lui, ne se libère
        // qu'à minuit heure du Pacifique — chaque réessai est alors une requête consommée
        // pour rien, qui creuse le trou qu'elle prétend combler.
        //
        // Coût mesuré de l'ancien comportement : 3 modèles × 2 tentatives = jusqu'à
        // 6 requêtes brûlées par question d'utilisateur une fois le quota atteint, contre
        // 3 nécessaires. On garde la bascule VERS UN AUTRE modèle (il a son propre quota
        // journalier, c'est le seul recours utile), on supprime le réessai inutile.
        const dailyExhausted = res.status === 429 && /PerDay|per day/i.test(lastErr);
        if (dailyExhausted) break; // modèle suivant, sans insister

        // Transitoire (saturation par minute / erreur serveur) → backoff puis réessai.
        if (res.status === 429 || res.status >= 500) {
          if (attempt < retries) {
            await sleep(450 * (attempt + 1) + Math.floor(Math.random() * 300));
            continue;
          }
          break; // réessais épuisés → modèle suivant
        }
        // Erreur cliente (400/403…) : inutile d'insister sur ce modèle.
        break;
      } catch (e) {
        lastStatus = 502;
        lastErr = (e as Error).message;
        if (attempt < retries) {
          await sleep(450 * (attempt + 1));
          continue;
        }
      }
    }
  }

  return { ok: false, error: lastErr, status: lastStatus };
}
