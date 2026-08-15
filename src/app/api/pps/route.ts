// ─────────────────────────────────────────────────────────────────────────────
//  ÉTAT DU PPS DE L'ATHLÈTE — lecture et écriture.
//
//  Stocké dans `notifications` (type `pps_status`), comme `user_settings`,
//  `race_objective` ou `auto_coach_state` : c'est le fourre-tout typé déjà utilisé
//  partout dans ce projet. AUCUNE migration n'est donc nécessaire — et une migration
//  qui n'est pas appliquée est un défaut silencieux de plus.
//
//  ⚠️ On n'enregistre QUE ce que l'athlète déclare : une date, un numéro facultatif,
//  et le fait qu'il soit licencié. Rien n'est vérifié auprès de la fédération (il
//  n'existe pas d'API pour cela) et l'interface le dit à chaque affichage.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PpsStatus } from "@/lib/pps/status";

export const dynamic = "force-dynamic";
const TYPE = "pps_status";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const { data } = await sb.from("notifications").select("data").eq("user_id", user.id).eq("type", TYPE).maybeSingle();
  return NextResponse.json({ status: (data?.data ?? null) as PpsStatus | null });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<PpsStatus>;
  // Une date malformée est REFUSÉE, pas rattrapée : un « 2026-13-45 » silencieusement
  // corrigé produirait une échéance fausse, et c'est exactement ce qu'on cherche à
  // éviter — l'athlète croirait son pass valide le jour de sa course.
  const obtainedAt = body.obtainedAt ?? null;
  if (obtainedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(obtainedAt)) {
    return NextResponse.json({ error: "date invalide" }, { status: 400 });
  }
  // Une date dans le futur n'a pas de sens pour une délivrance : elle décalerait
  // l'expiration d'autant et rendrait le verdict optimiste.
  if (obtainedAt && obtainedAt > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "date dans le futur" }, { status: 400 });
  }

  const status: PpsStatus = {
    obtainedAt,
    number: typeof body.number === "string" ? body.number.trim().slice(0, 40) || null : null,
    licensed: body.licensed === true,
  };

  const { data: existing } = await sb.from("notifications").select("id").eq("user_id", user.id).eq("type", TYPE).maybeSingle();
  const row = { user_id: user.id, type: TYPE, title: "PPS", body: "", data: status, read: true };
  const { error } = existing?.id
    ? await sb.from("notifications").update({ data: status }).eq("id", existing.id)
    : await sb.from("notifications").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status });
}
