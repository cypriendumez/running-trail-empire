export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validerBilan, noteProtocole, datesProtocole } from "@/lib/health/bilan";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";

/**
 * POST { zone?, exercices } → six notes de calendrier (deux semaines, un jour sur deux)
 * portant le protocole du kiné IA. Même forme que les notes saisies à la main
 * (`client_note`, lues par le calendrier) : l'athlète les voit, les déplace, les efface.
 *
 * ⚠️ LES EXERCICES REPASSENT PAR `validerBilan` : ils viennent du navigateur, pas du
 * modèle — un appel direct pourrait y mettre n'importe quoi, et une note de calendrier
 * s'affiche telle quelle.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const corps = await req.json().catch(() => ({})) as { zone?: unknown; exercices?: unknown };
  const bilan = validerBilan({ exercices: corps.exercices, hypotheses: [], charge: "", reprise: "" });
  if (!bilan || bilan.exercices.length === 0) return NextResponse.json({ error: "Aucun exercice valide" }, { status: 400 });
  const zone = typeof corps.zone === "string" ? corps.zone.slice(0, 60) : null;

  const texte = noteProtocole(zone, bilan.exercices);
  const dates = datesProtocole(aujourdhui(FUSEAU_DEFAUT));
  const ts = new Date().toISOString();
  const lignes = dates.map((date) => ({
    user_id: user.id, type: "client_note", title: "Protocole kiné",
    body: texte.slice(0, 200),
    data: { date, text: texte, ts, origine: "kine" },
  }));
  const { error } = await sb.from("notifications").insert(lignes);
  if (error) return NextResponse.json({ error: "Le calendrier n'a pas pu être écrit" }, { status: 500 });
  return NextResponse.json({ ok: true, n: lignes.length, dates });
}
