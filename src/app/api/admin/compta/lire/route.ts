export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estAdmin } from "@/lib/admin/acces";
import { generateContent } from "@/lib/ai/gemini";
import { CONSIGNE_LECTURE, interpreterLecture, jsonDeLaReponse } from "@/lib/compta/lecture";
import { validerFichier, TYPES_OK } from "@/lib/compta/pieces";

/**
 * LIT UNE FACTURE OU UN TICKET ET PROPOSE UNE ÉCRITURE — sans jamais l'enregistrer.
 *
 * ⚠️ CETTE ROUTE N'ÉCRIT RIEN EN BASE, ET C'EST VOLONTAIRE. Un total mal lu deviendrait
 * une ligne comptable fausse, impossible à distinguer d'une ligne juste une fois
 * enregistrée. Elle renvoie une proposition ; le formulaire l'affiche ; l'éditeur valide.
 *
 * ⚠️ L'IMAGE N'EST PAS CONSERVÉE ICI. Le fichier arrive, part au modèle, et disparaît.
 * C'est le dépôt dans l'espace privé qui conserve la pièce — une seule copie, un seul
 * endroit, un seul contrôle d'accès.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const fichier = form?.get("fichier");
  if (!(fichier instanceof File)) return NextResponse.json({ ok: false, erreurs: ["Aucun fichier reçu."] }, { status: 400 });

  const erreurs = validerFichier(fichier.type, fichier.size);
  if (erreurs.length) return NextResponse.json({ ok: false, erreurs }, { status: 400 });

  const b64 = Buffer.from(await fichier.arrayBuffer()).toString("base64");
  const res = await generateContent(
    [{ role: "user", parts: [{ text: CONSIGNE_LECTURE }, { inline_data: { mime_type: fichier.type, data: b64 } }] }],
    // ⚠️ Température au plus bas : on ne veut aucune créativité sur un montant. Et pas de
    // budget de réflexion — il se facture comme de la SORTIE, huit fois le prix de
    // l'entrée, pour une tâche de lecture qui n'en a pas besoin.
    { temperature: 0, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
  );

  if (!res.ok) {
    // ⚠️ On ne renvoie PAS une proposition vide : elle se lirait comme « rien n'est
    // lisible sur ta facture », alors que c'est le service qui n'a pas répondu.
    return NextResponse.json({ ok: false, erreurs: [`Lecture impossible : ${res.error}`] }, { status: 502 });
  }

  const brut = jsonDeLaReponse(res.text ?? "");
  if (brut === null) return NextResponse.json({ ok: false, erreurs: ["Réponse illisible — saisis l'écriture à la main."] }, { status: 502 });

  return NextResponse.json({ ok: true, suggestion: interpreterLecture(brut), formats: Object.keys(TYPES_OK).length });
}
