export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json" },
    }),
  });

  if (!response.ok) return NextResponse.json({ error: "Gemini error" }, { status: 502 });

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    analysis = match ? JSON.parse(match[0]) : {};
  }

  return NextResponse.json({ analysis });
}
