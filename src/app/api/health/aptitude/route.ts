export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { TYPE_APTITUDE, validerAptitude, lireAptitude, avisAttendu } from "@/lib/health/aptitude";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { journaliserEchec } from "@/lib/journal/echecServeur";

/**
 * LE QUESTIONNAIRE D'APTITUDE (Santé, lot 3, 10/11/2026).
 *
 * POST { oui: ["poitrine", …] } enregistre les situations cochées (liste vide = aucune) ;
 * POST { avisMedecin: true } enregistre que le coureur a vu un médecin qui l'autorise à reprendre
 * l'intensité. Une ligne `aptitude` par coureur (`notifications`), réécrite. Le plan est relancé.
 *
 * ⚠️ Chaque `error` est lu et l'échec journalisé ; `autoCoachForUser` RETOURNE ses refus :
 * l'écran ne dit « plan mis à jour » que s'il l'a été.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const jour = aujourdhui(FUSEAU_DEFAUT);
  const journal = (message: string) => journaliserEchec(null, { source: "aptitude", userId: user.id, url: "/api/health/aptitude", message });

  const { data: lignes, error: eLecture } = await supabase.from("notifications").select("id, data")
    .eq("user_id", user.id).eq("type", TYPE_APTITUDE).order("created_at", { ascending: false }).limit(1);
  if (eLecture) {
    await journal(`Questionnaire d'aptitude illisible : ${eLecture.code ?? "?"} ${eLecture.message}`);
    return NextResponse.json({ ok: false, error: "lecture" }, { status: 500 });
  }
  const existante = ((lignes ?? []) as { id: string; data?: unknown }[])[0] ?? null;

  let aptitude;
  if (corps.avisMedecin === true) {
    // L'avis ne vaut que pour un questionnaire déjà rempli.
    const avant = lireAptitude(existante?.data);
    if (!avant) return NextResponse.json({ ok: false, error: "sans_questionnaire" }, { status: 400 });
    aptitude = { ...avant, avisMedecin: jour };
  } else {
    const v = validerAptitude(corps, jour);
    if (!v.ok) return NextResponse.json({ ok: false, error: "valeurs" }, { status: 400 });
    aptitude = v.aptitude;
  }

  const ligne = { title: "Questionnaire d'aptitude", body: "", data: aptitude };
  const { error } = existante?.id
    ? await supabase.from("notifications").update(ligne).eq("id", existante.id).eq("user_id", user.id).eq("type", TYPE_APTITUDE)
    : await supabase.from("notifications").insert({ ...ligne, user_id: user.id, type: TYPE_APTITUDE });
  if (error) {
    await journal(`Questionnaire d'aptitude non enregistré : ${error.code ?? "?"} ${error.message}`);
    return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
  }

  let replanifie = false;
  const admin = createAdminClient();
  const { data: creds, error: eCreds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  if (eCreds) {
    await journal(`Replanification non lancée, identifiants illisibles : ${eCreds.code ?? "?"} ${eCreds.message}`);
  } else {
    const res = await autoCoachForUser(admin, {
      userId: user.id,
      athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
      apiKey: (creds?.intervals_api_key as string | null) ?? null,
      notify: false,
    }).catch(async (e) => {
      await journal(`Replanification en échec après le questionnaire d'aptitude : ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });
    replanifie = res?.processed === true;
    if (res && !res.processed && res.reason !== "essai_expire") {
      await journal(`Replanification refusée après le questionnaire d'aptitude : ${res.reason ?? "raison inconnue"}`);
    }
  }
  return NextResponse.json({ ok: true, replanifie, attente: avisAttendu(aptitude) });
}
