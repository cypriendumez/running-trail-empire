import type { SupabaseClient } from "@supabase/supabase-js";
import type { AthleteContext } from "@/lib/ai/coachContext";
import { COACH_SYSTEM } from "@/lib/ai/coachContext";
import { generateContent, budget } from "@/lib/ai/gemini";
import type { Lang } from "@/lib/i18n/base";
import {
  joursARelire, empreinte, inviteRelecture, validerConseils, decisionRelecture,
  type EtatRelecture, type JourPlan,
} from "@/lib/ai/relectureSemaine";

/** Au-delà, le plan part sans conseil : il ne doit JAMAIS attendre le modèle. */
export const DELAI_MAX_MS = 8000;

/**
 * Relecture Premium des séances clés (voir `relectureSemaine`). Renvoie l'état à mémoriser
 * dans `auto_coach_state.data.relecture`, conseils compris — ou `null` s'il n'y a rien à
 * relire. Ne lève JAMAIS : une panne du modèle donne un plan sans conseil, pas pas de plan.
 */
export async function relireSemaine(
  admin: SupabaseClient,
  o: { userId: string; ctx: AthleteContext; week: readonly JourPlan[]; from: string; lang: Lang },
): Promise<EtatRelecture | null> {
  try {
    const jours = joursARelire(o.week, o.from);
    if (!jours.length) return null;
    const emp = empreinte(jours, o.lang);
    const { data: st, error } = await admin.from("notifications").select("data")
      .eq("user_id", o.userId).eq("type", "auto_coach_state").maybeSingle();
    if (error) console.error("[coach avancé] état illisible :", error.message);
    const prec = ((st?.data ?? null) as { relecture?: EtatRelecture } | null)?.relecture ?? null;
    const appelsDuJour = prec && prec.jour === o.from ? prec.appels : 0;

    const decision = decisionRelecture(prec, o.from, emp);
    if (decision === "reutiliser") return prec;
    if (decision === "plafond") return { jour: o.from, empreinte: emp, appels: appelsDuJour, conseils: [] };

    const appel = generateContent(
      [{ role: "user", parts: [{ text: inviteRelecture({ systeme: COACH_SYSTEM, contexte: o.ctx.text, jours, lang: o.lang, aujourdhui: o.from }) }] }],
      { temperature: 0.4, responseMimeType: "application/json", ...budget(256, 700) },
    );
    const delai = new Promise<null>((ok) => setTimeout(() => ok(null), DELAI_MAX_MS));
    const r = await Promise.race([appel, delai]);
    // Un échec compte comme un appel (il a coûté), mais l'empreinte reste VIDE : la
    // prochaine republication retentera, dans la limite du plafond du jour.
    if (!r || !r.ok) {
      console.error("[coach avancé] relecture sans réponse :", r ? r.status : "délai dépassé");
      return { jour: o.from, empreinte: "", appels: appelsDuJour + 1, conseils: [] };
    }
    if (r.usage) console.info("[coach avancé] jetons", JSON.stringify(r.usage));
    const source = `${o.ctx.text}\n${jours.map((d) => `${d.title} ${d.detail} ${d.why}`).join("\n")}`;
    const motifs: string[] = [];
    const conseils = validerConseils(r.text, jours, o.lang, source, motifs);
    // Un conseil écarté l'est EN SILENCE pour l'athlète — pas pour nous : sans ce journal,
    // « aucun conseil » ne se distingue pas d'un modèle qui invente des chiffres.
    if (motifs.length) console.warn("[coach avancé] conseils écartés :", motifs.join(" · "));
    return { jour: o.from, empreinte: emp, appels: appelsDuJour + 1, conseils };
  } catch (e) {
    console.error("[coach avancé] relecture abandonnée :", e instanceof Error ? e.message : String(e));
    return null;
  }
}
