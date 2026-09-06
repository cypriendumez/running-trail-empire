export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifierTitre, verifierDescription, type Refus } from "@/lib/activities/renommage";
import { COLONNES_EDITION, colonnesEditionPresentes } from "@/lib/activities/colonnes";

/**
 * Renommer une sortie et lui écrire une description — ce que fait Strava.
 *
 * ⚠️ POURQUOI DES COLONNES À PART, et pas `workouts.title` : la synchro intervals.icu
 * RÉÉCRIT `title` à chaque passage (toutes les 10 minutes). Un renommage posé dans
 * `title` aurait donc disparu tout seul, sans erreur nulle part — le pire des défauts.
 * `title_custom` et `description` ne sont écrits QUE par cette route.
 */
const MESSAGE: Record<Refus["motif"], (r: Refus) => string> = {
  vide: () => "Un nom vide remet le nom d'origine : ce n'est pas une erreur, mais il n'y a rien à enregistrer.",
  trop_long: (r) => `Trop long : ${"max" in r ? r.max : 0} caractères au maximum.`,
  grossierete: (r) => `Refusé : « ${"mot" in r ? r.mot : "?"} » n'a pas sa place ici.`,
  sans_lettre: () => "Un nom doit contenir des lettres, pas seulement des symboles.",
  repetition: () => "Trop de caractères identiques à la suite.",
  lien: () => "Les liens et adresses e-mail ne sont pas acceptés dans une sortie.",
};

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const raw = await req.json().catch(() => ({})) as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return NextResponse.json({ error: "Séance manquante" }, { status: 400 });

  // La colonne peut ne pas exister (migration non passée) : on le DIT, au lieu de
  // laisser l'écriture échouer avec un message PostgreSQL illisible.
  const dispo = await colonnesEditionPresentes(sb);
  if (!dispo) {
    return NextResponse.json(
      { error: "La modification des sorties n'est pas encore activée sur ce serveur.", motif: "colonnes_absentes" },
      { status: 503 },
    );
  }

  // PROPRIÉTÉ : on ne se repose pas sur la seule RLS. Une lecture explicite dit la
  // différence entre « pas à toi » (403) et « n'existe pas » (404) — et surtout, elle
  // empêche d'écrire chez quelqu'un d'autre si une politique venait à se relâcher.
  const { data: seance, error: eLecture } = await sb
    .from("workouts").select("id, user_id").eq("id", id).maybeSingle();
  if (eLecture) return NextResponse.json({ error: "Séance illisible" }, { status: 500 });
  if (!seance) return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  if (seance.user_id !== user.id) return NextResponse.json({ error: "Cette séance n'est pas la tienne" }, { status: 403 });

  const patch: Record<string, string | null> = {};

  if ("titre" in raw) {
    const v = verifierTitre(raw.titre);
    // Un titre vide n'est pas un refus : c'est le retour au nom d'origine.
    if (!v.ok && v.motif !== "vide") return NextResponse.json({ error: MESSAGE[v.motif](v), motif: v.motif }, { status: 422 });
    patch[COLONNES_EDITION.titre] = v.ok ? v.valeur : null;
  }
  if ("description" in raw) {
    const v = verifierDescription(raw.description);
    if (!v.ok) return NextResponse.json({ error: MESSAGE[v.motif](v), motif: v.motif }, { status: 422 });
    patch[COLONNES_EDITION.description] = v.valeur || null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  // Supabase RETOURNE son erreur, il ne la lève pas : sans cette lecture, la route
  // répondrait « enregistré » sur une écriture qui n'a rien écrit.
  const { error } = await sb.from("workouts").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Enregistrement impossible", detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...patch });
}
