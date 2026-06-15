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

        // Transitoire (saturation / throttle / erreur serveur) → backoff puis réessai.
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
