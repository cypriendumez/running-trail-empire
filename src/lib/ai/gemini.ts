// ─────────────────────────────────────────────────────────────────────────────
//  Appel Gemini robuste : réessais + bascule de modèle.
//  Quand le modèle principal est saturé (503 « high demand ») ou throttlé (429),
//  on réessaie avec un court backoff, puis on bascule sur un modèle de secours.
//  Garantit que le coach / kiné IA répond presque toujours.
// ─────────────────────────────────────────────────────────────────────────────

import {
  markExhausted, selectModels, isDailyQuotaError, emptyQuotaMemory,
  PROBE_INTERVAL_MS, type QuotaMark, type QuotaMemory,
} from "./quotaMemory";


/**
 * Modèles réputés à court de quota JOURNALIER, et jusqu'à quand.
 *
 * En mémoire, et c'est un choix : ce marqueur est une AIDE, jamais une source de
 * vérité. S'il disparaît (instance Vercel recyclée), on retombe simplement sur le
 * comportement d'avant — un aller-retour perdu. À l'inverse, le cache de séance est
 * en base parce que l'y oublier ferait resservir une recommandation périmée : une
 * erreur de contenu, autrement plus grave qu'une erreur de vitesse.
 *
 * L'état est GLOBAL au processus, et non par utilisateur, parce que le quota l'est :
 * Google le compte par PROJET. Un athlète qui épuise le quota le referme pour tous.
 */
const quota: QuotaMemory = emptyQuotaMemory();

/** Réservé aux tests : repartir d'une mémoire vierge. */
export function __resetQuotaMemory(): void { quota.marks.clear(); quota.nextProbeAt = 0; }
/** Réservé aux tests : inspecter les marqueurs posés (copie, non modifiable). */
export function __quotaMemory(): Map<string, QuotaMark> { return new Map(quota.marks); }
/** Réservé aux tests : forcer un marqueur, notamment pour déclencher une sonde. */
export function __setQuotaMark(model: string, mark: QuotaMark): void { quota.marks.set(model, mark); }

/**
 * Chaîne de repli : du meilleur au plus disponible.
 *
 * `gemini-2.0-flash` RETIRÉ (08/08/2026). Google l'annonce arrêté depuis le 1ᵉʳ juin 2026
 * et il n'apparaît plus dans le tableau de bord des limites du projet — donc son quota
 * journalier est inconnu, voire nul. Chaque tentative vers lui coûtait un aller-retour
 * réseau pour rien, sur un palier gratuit où le plafond est de 20 requêtes par jour et
 * par modèle : un gaspillage de 5 % de la capacité quotidienne à chaque question.
 *
 * ⚠️ POURQUOI ON GARDE DEUX MODÈLES, ET PAS UN SEUL.
 * Les quotas sont comptés PAR MODÈLE : 20 requêtes/jour sur 2.5-flash ET 20 sur
 * flash-lite. Basculer vers le second quand le premier est épuisé ne consomme donc rien
 * de plus — cela DOUBLE la capacité réelle (40/jour au lieu de 20). Réduire la chaîne à
 * un seul modèle la diviserait par deux. Ne pas « optimiser » dans ce sens.
 *
 * `GEMINI_MODELS` permet de changer l'ordre ou la liste sans redéploiement — utile pour
 * ajouter un modèle le jour du passage au palier payant, ou en retirer un qui déraille.
 */
const DEFAULT_MODELS = (process.env.GEMINI_MODELS ?? "gemini-2.5-flash,gemini-2.5-flash-lite")
  .split(",").map((m) => m.trim()).filter(Boolean);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GeminiResult =
  | { ok: true; text: string; model: string;
      /** Sources réellement consultées quand l'appel utilisait la recherche web.
       *  Vide sans recherche. Sert à VÉRIFIER une réponse plutôt qu'à la croire. */
      sources?: string[] }
  /** `dailyExhausted` : plus AUCUN modèle n'a de quota jusqu'à minuit au Pacifique.
   *  Permet à l'appelant de dire « revenez demain » plutôt que « réessayez ». */
  | { ok: false; error: string; status: number; dailyExhausted?: boolean };

type GenConfig = Record<string, unknown>;

/**
 * Génère du texte avec Gemini, en réessayant et en basculant de modèle si besoin.
 * @param contents  tableau `contents` au format Gemini
 * @param generationConfig  config de génération (temperature, maxOutputTokens, …)
 */
export async function generateContent(
  contents: unknown,
  generationConfig: GenConfig,
  /** `tools` : passé tel quel à l'API. Sert à activer la recherche web
   *  (`[{ google_search: {} }]`), la seule façon d'obtenir une information qui n'existe
   *  ni dans notre base ni dans les connaissances figées du modèle. */
  opts: { models?: string[]; retriesPerModel?: number; tools?: unknown } = {},
): Promise<GeminiResult> {
  // Lue À L'APPEL et non au chargement du module : c'est ce qui rend la chaîne
  // testable sans réseau, et ça reste exact en serverless (l'environnement est prêt).
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "Clé IA manquante (configuration serveur).", status: 500 };

  const allModels = opts.models ?? DEFAULT_MODELS;
  const startedAt = Date.now();

  // ── Modèles encore crédibles à cette heure-ci ────────────────────────────────
  // Écarter un modèle dont le plafond journalier est connu épuisé économise un
  // aller-retour AVANT CHAQUE réponse jusqu'au soir : c'est de l'attente rendue à
  // l'athlète, pas du quota (une requête refusée ne consomme rien).
  const { models, probing } = selectModels(allModels, quota, startedAt);
  if (!models.length) {
    return {
      ok: false, status: 429, dailyExhausted: true,
      error: "Quota IA journalier atteint — il se réinitialise à minuit heure du Pacifique.",
    };
  }
  if (probing) {
    // On consomme le droit de sonde AVANT l'appel : sinon deux visites simultanées
    // sondent toutes les deux et la sonde coûte autant de requêtes qu'il y a d'onglets.
    quota.nextProbeAt = startedAt + PROBE_INTERVAL_MS;
    for (const m of models) {
      const mark = quota.marks.get(m);
      if (mark) quota.marks.set(m, { ...mark, probedAt: startedAt });
    }
  }

  const retries = opts.retriesPerModel ?? 1;
  let lastStatus = 503;
  let lastErr = "Service IA momentanément indisponible.";

  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(opts.tools ? { contents, generationConfig, tools: opts.tools } : { contents, generationConfig }),
          },
        );

        if (res.ok) {
          const data = await res.json();
          const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
            .map((p: { text?: string }) => p?.text ?? "")
            .join("")
            .trim();
          if (text) {
            // Le modèle répond : tout marqueur le concernant était périmé ou erroné.
            // C'est ce qui rattrape une détection trop zélée — la sonde a servi.
            quota.marks.delete(model);
            // Sources réellement consultées, quand la recherche web était activée. On les
            // remonte parce qu'une réponse trouvée sur le web sans source vérifiable ne
            // vaut pas mieux qu'une invention : c'est ce qui permet à l'appelant de la
            // refuser, et à l'athlète d'aller vérifier lui-même.
            const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
            const sources: string[] = chunks
              .map((c: { web?: { uri?: string; title?: string } }) => c?.web?.title || c?.web?.uri || "")
              .filter((x: string) => !!x);
            return { ok: true, text, model, sources };
          }
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
        //
        // On le MÉMORISE en plus : sans ça, la découverte se refaisait à chaque visite du
        // tableau de bord, au prix d'un aller-retour par modèle et par visite.
        if (isDailyQuotaError(res.status, lastErr)) {
          const at = Date.now();
          quota.marks.set(model, markExhausted(new Date(at)));
          // Poser le marqueur OUVRE aussi la fenêtre de sonde. Sans cette ligne, la
          // toute première requête suivant la découverte repartait sonder aussitôt :
          // on mémorisait l'épuisement sans jamais en tirer la moindre économie.
          quota.nextProbeAt = Math.max(quota.nextProbeAt, at + PROBE_INTERVAL_MS);
          break; // modèle suivant, sans insister
        }

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

  // Épuisement journalier COMPLET = tous les modèles de la chaîne sont marqués, pas
  // seulement celui qui vient d'échouer. Tant qu'un modèle garde du quota, l'appelant
  // doit pouvoir réessayer : annoncer « revenez demain » à tort serait une invention.
  const allExhausted = allModels.every((m) => quota.marks.has(m));
  return { ok: false, error: lastErr, status: lastStatus, ...(allExhausted ? { dailyExhausted: true } : {}) };
}
