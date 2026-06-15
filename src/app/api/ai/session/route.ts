export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAthleteContext, COACH_SYSTEM } from "@/lib/ai/coachContext";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Cache mémoire : 1 séance IA / utilisateur / jour → on ne rappelle pas Gemini à chaque
// rafraîchissement du dashboard (économise le quota). Réinitialisé au redémarrage serveur.
const CACHE = new Map<string, { title: string; subtitle: string; tags: string[]; why: string }>();

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `${user.id}:${today}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return NextResponse.json({ session: cached, cached: true });

  const ctx = await buildAthleteContext(supabase, user.id);
  const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long" });

  const prompt = `${COACH_SYSTEM}

VOICI L'ATHLÈTE (analyse CHAQUE ligne) :
${ctx.text}

MISSION : recommande LA séance-clé à faire AUJOURD'HUI (${jour}), parfaitement calibrée sur sa forme du jour, sa charge et son objectif de course.
- Si fatigué (VFC sous la base, sommeil bas, ou TSB très négatif) → récupération / facile.
- Si la course est proche → affûtage (fraîcheur, volume réduit, quelques rappels d'allure).
- Sinon, fais converger vers l'objectif : intègre par moments l'allure spécifique et la distance cible, en respectant le modèle polarisé et le niveau de l'athlète.
- Dose le volume sur le volume hebdomadaire réel et reste prudent si une douleur est signalée.

Réponds UNIQUEMENT par un objet JSON valide (aucun texte autour) :
{"title":"nom court de la séance","subtitle":"description concrète : structure, allure/zone, durée/distance","tags":["2 à 3 tags très courts ex Z2, 10 km, VMA, Allure marathon"],"why":"1 phrase de justification personnalisée citant une donnée clé (VFC, sommeil, charge ou objectif)"}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 600, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }),
    });
    if (!res.ok) {
      const status = res.status;
      return NextResponse.json({ error: status === 429 ? "Quota IA atteint" : `IA indisponible (${status})` }, { status: 502 });
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "Réponse IA illisible" }, { status: 502 });
    const parsed = JSON.parse(m[0]);
    if (!parsed.title || !Array.isArray(parsed.tags)) return NextResponse.json({ error: "Format IA invalide" }, { status: 502 });
    const session = {
      title: String(parsed.title).slice(0, 60),
      subtitle: String(parsed.subtitle ?? "").slice(0, 140),
      tags: parsed.tags.slice(0, 3).map((t: unknown) => String(t).slice(0, 16)),
      why: String(parsed.why ?? "").slice(0, 170),
    };
    CACHE.set(cacheKey, session);
    if (CACHE.size > 5000) CACHE.clear();
    return NextResponse.json({ session });
  } catch (e) {
    return NextResponse.json({ error: `Erreur IA: ${(e as Error).message}` }, { status: 502 });
  }
}
