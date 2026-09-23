export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
  return NextResponse.json({ ok: true, etat: valide });
}
