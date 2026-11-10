export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { TYPE_BILAN, validerBilan, effetBilan } from "@/lib/health/bilanMatin";
import { fuseauOuDefaut } from "@/lib/time/fuseau";
import { jourLocal } from "@/lib/streak/compute";
import { journaliserEchec } from "@/lib/journal/echecServeur";

/**
 * LE BILAN DU MATIN (Santé, lot 2, 10/11/2026).
 *
 * POST { fatigue, jambes, stress } (1 à 5 chacun) enregistre le bilan du JOUR de l'athlète
 * (son fuseau, cookie `pacevo_tz`, comme le tableau de bord) : une ligne `bilan_matin` par jour
 * (`notifications`), réécrite s'il le refait. La date vient du serveur, jamais du navigateur.
 * Le plan est relancé tout de suite : une fatigue ou des jambes à 4-5/5 allègent la séance dure
 * du jour (lib/health/bilanMatin).
 *
 * ⚠️ Chaque `error` est lu et l'échec journalisé ; `autoCoachForUser` RETOURNE ses refus
 * (essai expiré, contexte refusé) : l'écran ne dit « plan mis à jour » que s'il l'a été.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const fuseau = fuseauOuDefaut(decodeURIComponent((await cookies()).get("pacevo_tz")?.value ?? ""));
  const jour = jourLocal(new Date(), fuseau);
  const valide = validerBilan(await req.json().catch(() => ({})), jour);
  if (!valide.ok) return NextResponse.json({ ok: false, error: "valeurs" }, { status: 400 });

  const journal = (message: string) => journaliserEchec(null, { source: "bilan-matin", userId: user.id, url: "/api/health/bilan-matin", message });
  // Le bilan de CE jour, s'il existe déjà (la plus récente : un double clic en aurait fait deux).
  const { data: lignes, error: eLecture } = await supabase.from("notifications").select("id")
    .eq("user_id", user.id).eq("type", TYPE_BILAN).eq("data->>date", jour)
    .order("created_at", { ascending: false }).limit(1);
  if (eLecture) {
    await journal(`Bilan du matin illisible : ${eLecture.code ?? "?"} ${eLecture.message}`);
    return NextResponse.json({ ok: false, error: "lecture" }, { status: 500 });
  }
  const existante = ((lignes ?? []) as { id: string }[])[0] ?? null;
  const ligne = { title: "Bilan du matin", body: "", data: valide.bilan };
  const { error } = existante?.id
    ? await supabase.from("notifications").update(ligne).eq("id", existante.id).eq("user_id", user.id).eq("type", TYPE_BILAN)
    : await supabase.from("notifications").insert({ ...ligne, user_id: user.id, type: TYPE_BILAN });
  if (error) {
    await journal(`Bilan du matin non enregistré : ${error.code ?? "?"} ${error.message}`);
    return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
  }

  // Le plan du jour en tient compte tout de suite (même chemin que les consignes du kiné).
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
      await journal(`Replanification en échec après le bilan du matin : ${e instanceof Error ? e.message : String(e)}`);
      return null;
    });
    replanifie = res?.processed === true;
    if (res && !res.processed && res.reason !== "essai_expire") {
      await journal(`Replanification refusée après le bilan du matin : ${res.reason ?? "raison inconnue"}`);
    }
  }
  return NextResponse.json({ ok: true, replanifie, allege: effetBilan(valide.bilan).allege, bilan: valide.bilan });
}
