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

  // ⚠️ UN CORPS VIDE N'EST PAS UN EFFACEMENT. Le formulaire qui vide le pass envoie
  // bien les champs, à `null` — c'est une intention. Une requête sans AUCUN champ
  // reconnu, elle, n'exprime rien : la traiter comme un effacement revenait à écraser
  // le pass d'un athlète sur une requête malformée, sans qu'il l'ait demandé et sans
  // aucune trace. Constaté en sondant les points d'entrée le 03/09/2026 : `POST {}`
  // répondait 200 et remettait tout à zéro.
  const CHAMPS = ["expiresAt", "obtainedAt", "number", "licensed"] as const;
  if (!CHAMPS.some((c) => c in (body as Record<string, unknown>))) {
    return NextResponse.json(
      { error: "Aucun champ fourni. Pour effacer le pass, envoie les champs à null." },
      { status: 400 },
    );
  }

  // Une date malformée est REFUSÉE, pas rattrapée : un « 2026-13-45 » silencieusement
  // corrigé produirait une échéance fausse, et c'est exactement ce qu'on cherche à
  // éviter — l'athlète croirait son pass valide le jour de sa course.
  const jour = /^\d{4}-\d{2}-\d{2}$/;
  const expiresAt = body.expiresAt ?? null;
  const obtainedAt = body.obtainedAt ?? null;
  for (const [nom, v] of [["expiresAt", expiresAt], ["obtainedAt", obtainedAt]] as const) {
    if (v !== null && !jour.test(v)) return NextResponse.json({ error: `${nom} invalide` }, { status: 400 });
  }
  // Une date de DÉLIVRANCE dans le futur décalerait l'expiration d'autant et rendrait le
  // verdict optimiste. L'expiration, elle, est par nature à venir : on ne la borne pas.
  if (obtainedAt && obtainedAt > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "date dans le futur" }, { status: 400 });
  }

  const status: PpsStatus = {
    expiresAt,
    obtainedAt,
    number: typeof body.number === "string" ? body.number.trim().slice(0, 40) || null : null,
    licensed: body.licensed === true,
  };

  /**
   * ⚠️ CETTE LECTURE DÉCIDE ENTRE « METTRE À JOUR » ET « INSÉRER », et son erreur
   * n'était pas lue. En échec, `existing` reste indéfini — lu comme « pas encore de
   * PPS » — et on INSÈRE une seconde ligne. Or le PPS est relu par `maybeSingle()` à
   * TROIS endroits (cette route, /dashboard/pps et /dashboard/races), et `maybeSingle`
   * ÉCHOUE dès qu'il y a deux lignes : le pass ne serait pas seulement faux, il
   * deviendrait illisible partout — y compris sur la page qui doit dire s'il sera
   * valide LE JOUR de la course. Sans autre issue qu'une intervention en base.
   */
  const { data: existing, error: eLecture } = await sb.from("notifications")
    .select("id").eq("user_id", user.id).eq("type", TYPE).maybeSingle();
  if (eLecture) return NextResponse.json({ error: "Pass santé illisible pour le moment" }, { status: 500 });
  const row = { user_id: user.id, type: TYPE, title: "PPS", body: "", data: status, read: true };
  const { error } = existing?.id
    ? await sb.from("notifications").update({ data: status }).eq("id", existing.id)
    : await sb.from("notifications").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status });
}
