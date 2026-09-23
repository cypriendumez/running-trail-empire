export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { autoCoachForUser } from "@/lib/ai/autoCoach";
import { etatValide } from "@/lib/health/douleurs";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

/**
 * « ÇA VA MIEUX », « ÇA EMPIRE », « C'EST PASSÉ ».
 *
 * ⚠️ UNE DOULEUR DÉCLARÉE NE POUVAIT PAS ÊTRE RETIRÉE. Elle s'écrivait depuis le kiné IA
 * et ne s'éteignait QUE par péremption, au bout de 14 jours. Entre-temps elle retirait de
 * l'intensité à chaque replanification (`qualityBudget`) et le kiné la ressortait à chaque
 * consultation. Cyprien en avait déclaré une POUR TESTER l'application le 22/09/2026 :
 * son plan a été allégé pendant deux semaines sur une douleur qui n'existait pas.
 *
 * ⚠️ ON N'ÉCRIT QUE SUR SES PROPRES LIGNES. Le filtre `user_id` n'est pas une optimisation :
 * sans lui, l'identifiant d'une ligne suffirait à modifier le dossier de santé d'un autre.
 * La RLS protège déjà, mais une route qui s'appuie UNIQUEMENT sur elle est une route dont
 * la sécurité dépend d'une politique écrite ailleurs.
 *
 * ⚠️ ON NE SUPPRIME RIEN. « C'est passé » écrit un état ; l'historique reste, parce que
 * c'est lui qui permet au kiné de dire « ça allait mieux la dernière fois ».
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "non_connecte" }, { status: 401 });

  const { id, etat } = (await req.json().catch(() => ({}))) as { id?: unknown; etat?: unknown };
  const ligne = String(id ?? "").trim();
  const valide = etatValide(etat);
  if (!ligne || !valide) {
    return NextResponse.json({ ok: false, error: "requete_invalide" }, { status: 400 });
  }

  // On relit la ligne pour fusionner son `data` : un `update` qui réécrirait l'objet
  // entier perdrait la zone, le niveau et la date — tout ce qui fait la déclaration.
  const { data: avant, error: erreurLecture } = await supabase
    .from("notifications").select("data")
    .eq("id", ligne).eq("user_id", user.id).eq("type", "pain_report")
    .maybeSingle();
  if (erreurLecture) {
    console.error("[santé] douleur illisible :", erreurLecture.message);
    return NextResponse.json({ ok: false, error: "lecture" }, { status: 500 });
  }
  if (!avant) return NextResponse.json({ ok: false, error: "introuvable" }, { status: 404 });

  const fusion = { ...((avant.data ?? {}) as Record<string, unknown>), etat: valide, majA: aujourdhui(FUSEAU_DEFAUT) };
  // ⚠️ SUPABASE RETOURNE SES ERREURS, IL NE LES LÈVE PAS. Un `try/catch` autour de cette
  // écriture ne rattraperait rien : c'est `error` qu'il faut lire, sinon l'écran affiche
  // un succès pour une mise à jour qui n'a jamais eu lieu.
  const { error } = await supabase.from("notifications")
    .update({ data: fusion }).eq("id", ligne).eq("user_id", user.id).eq("type", "pain_report");
  if (error) {
    console.error("[santé] état de douleur non enregistré :", error.message);
    return NextResponse.json({ ok: false, error: "ecriture" }, { status: 500 });
  }
  // ══ LE COACH DOIT LE PRENDRE EN COMPTE TOUT DE SUITE ═══════════════════════════
  // ⚠️ LE MOTIF DE LA SÉANCE EST UN TEXTE FIGÉ, pas un calcul : il est écrit dans
  // `coach_session.data.why` au moment où le plan est produit. Sans replanification, un
  // athlète qui déclare « c'est passé » verrait son tableau de bord continuer d'afficher
  // « aujourd'hui ton corps demande de la récupération : douleur en cours » — et il
  // conclurait, à raison, que son geste n'a servi à rien. Mesuré en production le
  // 23/09/2026, juste après avoir éteint la douleur.
  //
  // Même motif que `/api/vma` : best effort, le cron de nuit rattrape un échec. Le plan
  // est DÉTERMINISTE (`autoPlan`), donc cette régénération ne consomme aucun appel d'IA.
  const admin = createAdminClient();
  const { data: creds } = await admin.from("profiles")
    .select("intervals_athlete_id, intervals_api_key").eq("id", user.id).maybeSingle();
  await autoCoachForUser(admin, {
    userId: user.id,
    athleteId: (creds?.intervals_athlete_id as string | null) ?? null,
    apiKey: (creds?.intervals_api_key as string | null) ?? null,
    notify: false, // l'athlète vient d'agir : il n'a pas besoin qu'on l'en prévienne par e-mail
  }).catch((e) => console.error("[santé] replanification après changement de douleur :", e));

  return NextResponse.json({ ok: true, etat: valide });
}
