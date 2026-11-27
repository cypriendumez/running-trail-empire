export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adresseFlux, empreinteJeton, nouveauJeton } from "@/lib/calendrier/jeton";
import { journaliserEchec } from "@/lib/journal/echecServeur";

// /api/calendrier/abonnement — l'abonnement de calendrier du coureur connecté (Réglages → Connexions).
//   GET    → { actif, creeLe, derniereLecture } (jamais l'adresse : seule son empreinte est gardée)
//   POST   → crée l'adresse, ou la REMPLACE (l'ancienne cesse aussitôt de marcher) → { https, webcal, google }
//   DELETE → révoque : l'agenda du coureur ne reçoit plus rien.
//
// La table `calendrier_abonnements` n'a aucune politique RLS : seul le serveur (service role) la
// touche, toujours filtrée sur l'utilisateur de la SESSION, jamais sur un identifiant reçu.

const ORIGINE_FLUX = "https://pacevo.fr";

/** Table absente (migration 042 pas encore passée) : l'écran dit « indisponible », pas « erreur ». */
const tableAbsente = (e: { code?: string } | null) => e?.code === "42P01" || e?.code === "PGRST205";

async function utilisateur() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function GET() {
  const user = await utilisateur();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("calendrier_abonnements")
    .select("cree_le, derniere_lecture").eq("user_id", user.id).maybeSingle();
  if (tableAbsente(error)) return NextResponse.json({ indisponible: true });
  if (error) {
    await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: "/api/calendrier/abonnement", message: `Abonnement illisible : ${error.code ?? "?"} ${error.message}` });
    return NextResponse.json({ error: "Lecture impossible, réessaie." }, { status: 500 });
  }
  const d = data as { cree_le?: string; derniere_lecture?: string | null } | null;
  return NextResponse.json({ actif: !!d, creeLe: d?.cree_le ?? null, derniereLecture: d?.derniere_lecture ?? null });
}

export async function POST() {
  const user = await utilisateur();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const jeton = nouveauJeton();
  const { error } = await admin.from("calendrier_abonnements").upsert(
    { user_id: user.id, jeton_empreinte: empreinteJeton(jeton), cree_le: new Date().toISOString(), derniere_lecture: null },
    { onConflict: "user_id" },
  );
  if (tableAbsente(error)) return NextResponse.json({ indisponible: true }, { status: 503 });
  if (error) {
    await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: "/api/calendrier/abonnement", message: `Abonnement non créé : ${error.code ?? "?"} ${error.message}` });
    return NextResponse.json({ error: "Le lien n'a pas pu être créé, réessaie." }, { status: 500 });
  }
  // L'adresse vise TOUJOURS le site en ligne : le jeton vit dans la base unique, et un lien créé
  // depuis un aperçu Vercel ou un serveur local pointerait vers un hôte qui disparaîtra.
  return NextResponse.json({ ok: true, ...adresseFlux(ORIGINE_FLUX, jeton) });
}

export async function DELETE() {
  const user = await utilisateur();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from("calendrier_abonnements").delete().eq("user_id", user.id);
  if (error && !tableAbsente(error)) {
    await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: "/api/calendrier/abonnement", message: `Abonnement non révoqué : ${error.code ?? "?"} ${error.message}` });
    return NextResponse.json({ error: "La révocation a échoué, réessaie." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
