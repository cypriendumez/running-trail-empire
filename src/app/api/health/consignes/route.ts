export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { TYPE_CONSIGNES, validerConsignes } from "@/lib/health/consignesKine";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { journaliserEchec } from "@/lib/journal/echecServeur";

/**
 * LES CONSIGNES DE TON KINÉSITHÉRAPEUTE (Santé, 10/11/2026).
 *
 * POST { dureeMaxMin, sansIntensite, seancesMaxSemaine, jusquAu } enregistre les consignes ;
 * POST { retirer: true } les retire. Une ligne `consignes_kine` par coureur (`notifications`).
 * Pacevo ne décide rien : le coureur recopie ce que son professionnel lui a dit, et le plan
 * déterministe s'y tient (lib/health/consignesKine, coachContext, autoPlan).
 *
 * ⚠️ On n'écrit que sur SA ligne (filtre `user_id` en plus de la RLS) ; chaque `error` est lu
 * et l'échec journalisé ; le plan est relancé tout de suite (sinon l'écran et la montre
 * gardent l'ancien plan jusqu'à la nuit).
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const retirer = corps.retirer === true;
  const jour = aujourdhui(FUSEAU_DEFAUT);
  const valide = retirer ? null : validerConsignes(corps, jour);
  if (valide && !valide.ok) return NextResponse.json({ ok: false, error: valide.motif }, { status: 400 });

  const journal = (message: string) => journaliserEchec(null, { source: "consignes-kine", userId: user.id, url: "/api/health/consignes", message });
  // La plus récente : un double clic aurait pu en créer deux, et `maybeSingle` échouerait.
  const { data: lignes, error: eLecture } = await supabase.from("notifications").select("id")
    .eq("user_id", user.id).eq("type", TYPE_CONSIGNES).order("created_at", { ascending: false }).limit(1);
  const existante = ((lignes ?? []) as { id: string }[])[0] ?? null;
  if (eLecture) {
    await journal(`Consignes illisibles : ${eLecture.code ?? "?"} ${eLecture.message}`);
    return NextResponse.json({ ok: false, error: "lecture" }, { status: 500 });
  }

  if (retirer) {
    if (existante?.id) {
      // Toutes ses lignes de consignes, doublons compris : « retirer » ne doit en laisser aucune.
      const { error } = await supabase.from("notifications").delete().eq("user_id", user.id).eq("type", TYPE_CONSIGNES);
      if (error) {
        await journal(`Consignes non retirées : ${error.code ?? "?"} ${error.message}`);
        return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
      }
    }
  } else if (valide?.ok) {
    const ligne = { title: "Consignes du kinésithérapeute", body: "", data: valide.consignes };
    const { error } = existante?.id
      ? await supabase.from("notifications").update(ligne).eq("id", existante.id).eq("user_id", user.id).eq("type", TYPE_CONSIGNES)
      : await supabase.from("notifications").insert({ ...ligne, user_id: user.id, type: TYPE_CONSIGNES });
    if (error) {
      await journal(`Consignes non enregistrées : ${error.code ?? "?"} ${error.message}`);
      return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
    }
  }

  // Le plan tient compte des consignes tout de suite (même chemin que /api/health/douleur).
  const admin = createAdminClient();
  const { data: creds, error: eCreds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  if (eCreds) {
    await journal(`Replanification non lancée, identifiants illisibles : ${eCreds.code ?? "?"} ${eCreds.message}`);
  } else {
    await autoCoachForUser(admin, {
      userId: user.id,
      athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
      apiKey: (creds?.intervals_api_key as string | null) ?? null,
      notify: false,
    }).catch((e) => journal(`Replanification en échec après des consignes : ${e instanceof Error ? e.message : String(e)}`));
  }
  return NextResponse.json({ ok: true, consignes: valide?.ok ? valide.consignes : null });
}
