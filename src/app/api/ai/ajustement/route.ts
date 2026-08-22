export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigeAcces } from "@/lib/billing/guard";
import { generateContent } from "@/lib/ai/gemini";
import {
  contraintesDe, validerAjustement, empreintePlan, CONSIGNE_AJUSTEMENT,
  type JourPlan, type Ajustement,
} from "@/lib/ai/ajustement";

/**
 * UN AJUSTEMENT PROPOSÉ, JAMAIS APPLIQUÉ.
 *
 * Le plan de sept jours reste déterministe — c'est lui qui fait foi. Cette route
 * demande à un modèle s'il voit UN déplacement qui vaudrait la peine, et le confronte
 * aux mêmes bornes que le plan avant de le montrer.
 *
 * ── CE QUI LA REND RENTABLE ─────────────────────────────────────────────────
 * ⚠️ À LA DEMANDE, JAMAIS AU FIL DE L'EAU. Le plan se replanifie toutes les dix minutes
 * (workflow GitHub Actions) : brancher un appel de modèle sur cette cadence coûterait,
 * par athlète, cent quarante appels par jour. La route n'est appelée que si l'athlète
 * ouvre son plan.
 *
 * ⚠️ MÉMORISÉE PAR EMPREINTE DU PLAN. Tant que ni les séances ni le budget qualité ne
 * bougent, la réponse est resservie sans rien dépenser. Ouvrir son calendrier cinq fois
 * dans la journée coûte un appel, pas cinq.
 *
 * ⚠️ SORTIE COURTE. La sortie coûte huit fois l'entrée : c'est `maxOutputTokens` qui
 * décide de la facture. Deux phrases suffisent, on en autorise 700 jetons — de quoi
 * absorber le raisonnement interne de Gemini 2.5 sans laisser la porte ouverte.
 *
 * Et le plafond par palier (0 / 10 / 30 par jour) s'applique via `exigeAcces` : le
 * plafond de dépense par athlète existe déjà, il n'est pas réinventé ici.
 */

const TYPE_CACHE = "ai_ajustement";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Cette route fait PARLER un modèle : c'est la capacité facturée. Masquer le bouton
  // ne suffirait pas, la route resterait appelable — et c'est l'appel qui coûte.
  const refus = await exigeAcces(supabase, user.id, "ia");
  if (refus) return refus.reponse;

  const { week, qBudget, raisons, lang } = (await req.json().catch(() => ({}))) as {
    week?: JourPlan[]; qBudget?: number; raisons?: string[]; lang?: string;
  };
  if (!Array.isArray(week) || !week.length || typeof qBudget !== "number") {
    return NextResponse.json({ ok: false, error: "Plan attendu" }, { status: 400 });
  }

  const admin = createAdminClient();
  const empreinte = empreintePlan(week, qBudget);

  // ── 1. Déjà répondu pour CE plan ? ─────────────────────────────────────────
  const { data: memo } = await admin
    .from("notifications").select("id, data")
    .eq("user_id", user.id).eq("type", TYPE_CACHE).maybeSingle();
  const cache = memo?.data as { empreinte?: string; ajustement?: Ajustement } | null;
  if (cache?.empreinte === empreinte && cache.ajustement) {
    return NextResponse.json({ ok: true, ajustement: cache.ajustement, memorise: true });
  }

  // ── 2. Demander ────────────────────────────────────────────────────────────
  const c = contraintesDe(week, qBudget, Array.isArray(raisons) ? raisons : []);
  const contexte = [
    `Langue de la réponse : ${lang ?? "fr"}`,
    `Budget qualité de la semaine : ${c.qBudget}`,
    c.raisons.length ? `Motifs d'allègement : ${c.raisons.join(" ; ")}` : "Aucun allègement en cours.",
    "Plan :",
    ...week.map((d) => `  ${d.date} — ${d.type} : ${d.title}`),
  ].join("\n");

  const res = await generateContent(
    [{ role: "user", parts: [{ text: `${CONSIGNE_AJUSTEMENT}\n\n${contexte}` }] }],
    { temperature: 0.3, maxOutputTokens: 700 },
  );
  if (!res.ok) return NextResponse.json({ ok: false, error: "Modèle indisponible" }, { status: 503 });

  let brut: unknown = null;
  try {
    const j = res.text.match(/\{[\s\S]*\}/);
    brut = j ? JSON.parse(j[0]) : null;
  } catch { brut = null; }

  // ── 3. VALIDER contre les mêmes bornes que le plan ─────────────────────────
  // ⚠️ C'est ici que l'ajout reste sûr. Une proposition qui rouvrirait l'intensité sur
  // un budget nul est REFUSÉE avant tout affichage : on ne rend pas par la fenêtre ce
  // que le plan déterministe ferme par la porte.
  const v = validerAjustement(brut, c);
  if (!v.ok) return NextResponse.json({ ok: false, error: "Proposition écartée", motif: v.motif }, { status: 422 });

  // ── 4. Mémoriser pour ce plan ──────────────────────────────────────────────
  const donnees = { empreinte, ajustement: v.ajustement, at: new Date().toISOString() };
  if (memo?.id) await admin.from("notifications").update({ data: donnees }).eq("id", memo.id);
  else await admin.from("notifications").insert({ user_id: user.id, type: TYPE_CACHE, title: "ajustement", body: "", data: donnees });

  return NextResponse.json({ ok: true, ajustement: v.ajustement, memorise: false });
}
