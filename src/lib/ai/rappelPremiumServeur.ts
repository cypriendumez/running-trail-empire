// ─────────────────────────────────────────────────────────────────────────────
//  LE CALCUL DU RAPPEL « PREMIUM AURAIT CHANGÉ TON PLAN » (comparaison : lib/coach/rappelPremium).
//
//  Appelé par le coach autonome pour un compte dont le plan lit l'essentiel (Starter,
//  `rappelPremiumPour`), juste après la publication de son plan. Il bâtit le contexte
//  COMPLET — VFC, dérive cardiaque, foulée —, en tire la semaine avec le même moteur, et
//  range l'écart dans `notifications` (type `rappel_premium`, une ligne par athlète, aucune
//  migration). Aucun modèle, aucun jeton : `buildAthleteContext` et `buildWeekPlan` sont
//  déterministes.
//
//  ⚠️ PAS À CHAQUE PASSAGE. Le coach repasse jusqu'à toutes les dix minutes : une seconde
//  lecture complète à chaque fois doublerait sa charge pour une réponse identique. Le rappel
//  garde l'EMPREINTE de tout ce dont l'écart dépend — le jour, ce que Starter a lu (son
//  briefing), la semaine qu'il en a tirée et celle que l'athlète voit, et la dernière VFC
//  mesurée : la seule entrée que Starter ne voit pas et qui bouge sans nouvelle séance (la
//  foulée et la dérive arrivent avec une séance, qui change déjà le briefing). Tant qu'elle
//  ne change pas, rien n'est relu. Elle change au moins une fois par jour civil.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAthleteContext, type AthleteContext } from "@/lib/ai/coachContext";
import { buildWeekPlan, type PlanDay } from "@/lib/ai/autoPlan";
import { COLONNES_VFC, serieVfc } from "@/lib/health/vfc";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { ecartPremium, textesRappel, TYPE_RAPPEL_PREMIUM, VERSION_RAPPEL, type DonneesRappel } from "@/lib/coach/rappelPremium";

export type IssueRappel = "inchange" | "ecrit" | "echec";

const compacte = (s: readonly PlanDay[]) => s.map((d) => [d.date, d.moment ?? "", d.type, d.title, d.detail]);

/** L'empreinte des entrées de l'écart. Le numéro de version y entre : changer la
 *  comparaison invalide d'un coup tous les rappels déjà calculés. */
export function empreinteRappel(o: {
  jour: string; depuis: string; semaine: readonly PlanDay[]; affichee: readonly PlanDay[]; briefing: string; vfc: unknown;
}): string {
  const materiau = JSON.stringify({ v: VERSION_RAPPEL, ...o, semaine: compacte(o.semaine), affichee: compacte(o.affichee) });
  return createHash("sha256").update(materiau).digest("hex").slice(0, 32);
}

/** Un échec du rappel ne fait jamais échouer le coach, mais il se lit dans /admin › Bugs. */
async function journaliser(admin: SupabaseClient, userId: string, message: string): Promise<void> {
  try {
    const { error } = await admin.from("error_logs").insert({
      user_id: userId, source: "rappel-premium", url: "/dashboard/calendrier", message: message.slice(0, 2000),
    });
    if (error) console.error("[rappel premium]", message, "— journal non écrit :", error.message);
  } catch {
    console.error("[rappel premium]", message);
  }
}

/**
 * Recalcule le rappel si ses entrées ont changé, et l'enregistre. Ne lève JAMAIS : le plan
 * de l'athlète est déjà publié, un rappel manqué ne doit rien lui coûter.
 */
export async function actualiserRappelPremium(admin: SupabaseClient, o: {
  userId: string;
  /** Le contexte Starter (lecture essentielle) dont la semaine vient d'être tirée. */
  ctx: AthleteContext;
  /** La semaine du moteur, AVANT les ajustements appliqués par l'athlète. */
  semaine: readonly PlanDay[];
  /** La semaine publiée, celle que le calendrier affiche. */
  affichee: readonly PlanDay[];
  depuis: string;
  /** L'instant du plan Starter : le plan complet est bâti pour le MÊME jour. */
  maintenant: Date;
}): Promise<IssueRappel> {
  try {
    const [vfcRes, ligneRes] = await Promise.all([
      admin.from("hrv_data").select(COLONNES_VFC).eq("user_id", o.userId).order("date", { ascending: false }).limit(1),
      admin.from("notifications").select("id, data").eq("user_id", o.userId).eq("type", TYPE_RAPPEL_PREMIUM)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    // Sans la ligne précédente, on ne sait ni si le calcul est à refaire, ni où l'écrire :
    // une insertion à l'aveugle laisserait deux rappels contradictoires.
    if (ligneRes.error) {
      await journaliser(admin, o.userId, `Rappel Premium illisible, non recalculé : ${ligneRes.error.message}`);
      return "echec";
    }
    const ligne = ligneRes.data as { id: string; data: Partial<DonneesRappel> | null } | null;
    const jour = aujourdhui(FUSEAU_DEFAUT, o.maintenant);
    // La dernière mesure, par la même série que le coach (une seule métrique, rMSSD ou SDNN).
    const vfc = vfcRes.error ? null : serieVfc((vfcRes.data ?? []) as { date: string; rmssd: number | null; sdnn: number | null }[]);
    const empreinte = empreinteRappel({
      jour, depuis: o.depuis, semaine: o.semaine, affichee: o.affichee, briefing: o.ctx.text,
      vfc: vfcRes.error ? `illisible ${vfcRes.error.code ?? ""}` : vfc?.lignes[0] ? [vfc.metrique, vfc.lignes[0].date, vfc.lignes[0].hrv_ms] : null,
    });
    if (ligne?.data?.v === VERSION_RAPPEL && ligne.data.empreinte === empreinte) return "inchange";

    let complet: AthleteContext;
    try {
      // La météo du plan Starter, pas une seconde lecture : voir `LectureContexte.meteo`.
      complet = await buildAthleteContext(admin as unknown as Parameters<typeof buildAthleteContext>[0], o.userId, {
        meteo: { forecast: o.ctx.forecast, altitude: o.ctx.altitude, heatAcclim: o.ctx.heatAcclim },
      });
    } catch (e) {
      // ⚠️ LE RAPPEL PRÉCÉDENT DÉCRIT L'ANCIEN PLAN. Le garder affiché sous un plan qui vient
      // d'être republié, c'est parler d'une séance qui n'existe plus.
      if (ligne?.id) {
        const { error } = await admin.from("notifications").delete().eq("id", ligne.id);
        if (error) await journaliser(admin, o.userId, `Rappel Premium périmé non effacé : ${error.message}`);
      }
      await journaliser(admin, o.userId, `Plan complet non calculé : ${e instanceof Error ? e.message : String(e)}`);
      return "echec";
    }

    const ecart = ecartPremium({
      starter: { ctx: o.ctx, semaine: o.semaine },
      premium: { ctx: complet, semaine: buildWeekPlan(complet, o.maintenant) },
      depuis: o.depuis,
      affichee: o.affichee,
    });
    const textes = ecart ? textesRappel(ecart) : null;
    // Sans écart, la ligne est écrite quand même, sans phrase : elle garde l'empreinte, et
    // le prochain passage du coach n'a rien à relire.
    const data: DonneesRappel = {
      v: VERSION_RAPPEL, jour, at: o.maintenant.toISOString(), empreinte, ecart,
      phrase: textes?.phrase ?? null, detail: textes?.detail ?? null,
    };
    const { error } = ligne?.id
      ? await admin.from("notifications").update({ data }).eq("id", ligne.id)
      : await admin.from("notifications").insert({ user_id: o.userId, type: TYPE_RAPPEL_PREMIUM, title: "rappel-premium", body: "", data });
    if (error) {
      await journaliser(admin, o.userId, `Rappel Premium non enregistré : ${error.message}`);
      return "echec";
    }
    return "ecrit";
  } catch (e) {
    await journaliser(admin, o.userId, `Rappel Premium abandonné : ${e instanceof Error ? e.message : String(e)}`);
    return "echec";
  }
}
