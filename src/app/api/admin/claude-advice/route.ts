/**
 * POST /api/admin/claude-advice
 * Takes a Gemini Flash analysis + athlete profile and asks Claude to write
 * a personalized, human-voiced coaching message ready to publish.
 */
import { NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface GeminiAnalysis {
  summary?: string;
  training_load?: string;
  recovery_status?: string;
  weekly_km?: number;
  weekly_tss?: number;
  avg_hrv?: number;
  avg_sleep_score?: number;
  avg_body_battery?: number;
  biomechanics_analysis?: string;
  power_analysis?: string;
  sleep_quality_analysis?: string;
  hrv_trend?: string;
  strengths?: string[];
  areas_to_improve?: string[];
  next_week_recommendation?: string;
  risk_flags?: string[];
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("x-admin-secret");
  if (authHeader !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const { athlete_name, gemini_analysis, week_start } = await req.json() as {
    athlete_name: string;
    gemini_analysis: GeminiAnalysis;
    week_start: string;
  };

  const prompt = `Tu es un coach d'athlétisme et trail running expert de haut niveau.
Tu dois rédiger un conseil de coaching personnalisé pour l'athlète ${athlete_name || "l'athlète"} pour la semaine du ${week_start}.

L'analyse technique (générée par Gemini Flash) de la semaine est la suivante :
${JSON.stringify(gemini_analysis, null, 2)}

CONSIGNE DE RÉDACTION :
- Écris en français, ton humain et direct, comme un vrai coach qui connaît bien l'athlète
- 3-4 paragraphes maximum (200-300 mots)
- Commence par reconnaître les efforts de la semaine (pas de flatterie vide)
- Donne 1-2 points techniques précis à travailler (biomécanique, zones, récupération)
- Termine par une recommandation concrète pour la semaine à venir
- Cite des chiffres spécifiques de l'analyse (TSS, VFC, km, etc.)
- Ne mentionne PAS que tu es une IA
- Ton : professionnel, bienveillant, exigeant

IMPORTANT : Réponds UNIQUEMENT avec le texte du conseil, sans introduction ni balises JSON.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `Claude API error: ${err.slice(0, 200)}` }, { status: 502 });
  }

  const data = await response.json();
  const advice = data.content?.[0]?.text ?? "";

  return NextResponse.json({ advice, model: data.model });
}
