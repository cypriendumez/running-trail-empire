export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { enregistrerDouleurDeclaree, SEUIL_DOULEUR_DECLAREE } from "@/lib/health/douleurDeclaree";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

/**
 * POST { zone, zoneKey, painLevel } — DÉCLARER UNE DOULEUR, SANS IA (09/11/2026).
 *
 * Elle ne s'écrivait que par la consultation du « kiné IA », retirée (lib/health/kineIa). Le
 * coach en a pourtant besoin : une douleur déclarée retire de l'intensité au plan
 * (`qualityBudget`). On enregistre ce que l'athlète dit — zone et intensité —, rien de plus :
 * ni diagnostic, ni traitement. L'écran oriente vers un professionnel de santé.
 *
 * Accessible sans abonnement : signaler une douleur relève de la sécurité, pas d'une option.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => null) as { zone?: unknown; zoneKey?: unknown; painLevel?: unknown } | null;
  const zone = typeof b?.zone === "string" ? b.zone.trim().slice(0, 80) : "";
  const zoneKey = typeof b?.zoneKey === "string" && /^(face|dos):[A-Za-z0-9]{1,24}$/.test(b.zoneKey) ? b.zoneKey : null;
  const painLevel = Number(b?.painLevel);
  if (!zone || !zoneKey || !Number.isInteger(painLevel) || painLevel < 1 || painLevel > 10) {
    return NextResponse.json({ error: "Zone et intensité (1 à 10) requises." }, { status: 400 });
  }
  // Une gêne légère ne modifie pas le plan : rien n'est enregistré, et on le dit.
  if (painLevel < SEUIL_DOULEUR_DECLAREE) {
    return NextResponse.json({ error: `En dessous de ${SEUIL_DOULEUR_DECLAREE}/10, une gêne ne modifie pas ton plan : rien n'est enregistré.` }, { status: 422 });
  }
  const ok = await enregistrerDouleurDeclaree(sb, { userId: user.id, zone, zoneKey, painLevel, today: aujourdhui(FUSEAU_DEFAUT) });
  // `enregistrerDouleurDeclaree` journalise déjà son échec : ici, on le DIT à l'écran.
  if (!ok) return NextResponse.json({ error: "Douleur non enregistrée pour le moment, réessaie dans un instant." }, { status: 503 });

  // Le plan est replanifié TOUT DE SUITE, comme après « ça va mieux / ça empire »
  // (/api/health/douleur) : le motif d'une séance est un texte figé, et l'écran promet « ton plan
  // réduit l'intensité » (relecture du 09/11/2026). Au mieux : le cron de nuit rattrape un échec ;
  // le plan est déterministe, aucun appel d'IA.
  const admin = createAdminClient();
  const { data: creds, error: eCreds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  if (!eCreds) {
    await autoCoachForUser(admin, {
      userId: user.id,
      athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
      apiKey: (creds?.intervals_api_key as string | null) ?? null,
      notify: false,
    }).catch((e) => console.error("[santé] replanification après déclaration :", e));
  }
  return NextResponse.json({ ok: true });
}
