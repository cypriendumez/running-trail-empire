export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateContent } from "@/lib/ai/gemini";
import { exigeAcces } from "@/lib/billing/guard";


/**
 * Lit le JSON du modèle, ou `null` s'il n'y en a pas d'exploitable.
 *
 * Un objet SANS AUCUN des champs attendus n'est pas exploitable non plus : il
 * s'afficherait comme une analyse dont tous les indicateurs seraient vides.
 */
export function analyserJson(brut: string): Record<string, unknown> | null {
  const CHAMPS = ["mental_fatigue", "motivation_score", "stress_level", "sentiment", "keywords", "ai_insights"];
  let objet: unknown = null;
  try { objet = JSON.parse(brut); }
  catch {
    const m = String(brut ?? "").match(/\{[\s\S]*\}/);
    if (m) { try { objet = JSON.parse(m[0]); } catch { return null; } }
  }
  if (!objet || typeof objet !== "object" || Array.isArray(objet)) return null;
  const o = objet as Record<string, unknown>;
  return CHAMPS.some((c) => o[c] !== undefined) ? o : null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── VERROU D'ABONNEMENT ──────────────────────────────────────────────────
  // Cette route fait PARLER un modèle : c'est exactement ce que la formule Complet
  // facture, parce que c'est la seule partie du produit dont le coût grandit avec
  // le nombre d'athlètes. Masquer le bouton côté interface ne suffirait pas — la
  // route resterait appelable à la main, et c'est l'appel qui coûte.
  const refus = await exigeAcces(supabase, user.id, "journal");
  if (refus) return refus.reponse;

  const { text } = await req.json() as { text: string };
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const prompt = `Analyse ce texte de journal post-entraînement d'un coureur et extrait les indicateurs psychologiques.

TEXTE:
"${text}"

Retourne UNIQUEMENT du JSON valide:
{
  "mental_fatigue": <0-10, 0=aucune fatigue, 10=épuisement total>,
  "motivation_score": <0-10, 0=démotivé, 10=très motivé>,
  "stress_level": <0-10, 0=aucun stress, 10=stress extrême>,
  "sentiment": "positive" | "neutral" | "negative",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3"],
  "ai_insights": "Conseil court et bienveillant basé sur l'état détecté (1-2 phrases max)"
}`;

  // ⚠️ CLIENT PARTAGÉ, et plus un `fetch` vers une URL bâtie à la main. Cette route
  // écrivait le nom du modèle DANS son URL : elle échappait à la mémoire de quota (elle
  // continuait donc d'appeler Google après épuisement) et à la bascule de modèle. Google
  // a déjà retiré `gemini-2.0-flash` ; le jour où `2.5` suivra, une URL codée en dur
  // tomberait en silence.
  const r = await generateContent(
    [{ role: "user", parts: [{ text: prompt }] }],
    // ⚠️ `thinkingBudget: 0` EXPLICITE. Sans `thinkingConfig`, Gemini 2.5 raisonne par
    // défaut avec un budget dynamique — pris SUR ces 500 jetons. Le JSON revenait alors
    // coupé, donc illisible. Ici il n'y a rien à raisonner : on extrait des champs.
    { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  // ⚠️ UNE ANALYSE VIDE N'EST PAS UNE ANALYSE. Mesuré en production le 02/09/2026 sur
  // le compte de l'éditeur : cette route a répondu HTTP 200 avec `{}`. Le journal
  // affichait donc une analyse « réussie » sans un seul indicateur, et l'entrée
  // partait en base ainsi. Un JSON coupé n'a pas d'accolade fermante, la reprise par
  // expression régulière ne trouvait rien, et le `{}` de repli passait pour un succès.
  const analysis = analyserJson(r.text);
  if (!analysis) {
    return NextResponse.json(
      { error: "L'analyse n'a pas abouti — réessaie dans un instant." },
      { status: 502 },
    );
  }

  return NextResponse.json({ analysis });
}
