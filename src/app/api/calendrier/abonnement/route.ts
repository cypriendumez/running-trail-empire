export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adresseFlux, jetonRetrouve } from "@/lib/calendrier/jeton";
import { lienDuCompte, ORIGINE_FLUX, tableAbsente } from "@/lib/calendrier/abonnement";
import { journaliserEchec } from "@/lib/journal/echecServeur";

// /api/calendrier/abonnement — l'abonnement de calendrier du coureur connecté (Paramètres → Connexions).
//   GET    → { actif, derniereLecture, liens } : les liens se RECALCULENT (jeton dérivé, voir jeton.ts),
//            `null` pour un lien d'avant le 28/11/2026 qu'on ne peut plus retrouver.
//   POST   → { liens } : le lien EXISTANT s'il se recalcule, sinon un nouveau s'il n'y en a pas
//            (insert : deux appuis simultanés rendent le même) ; 409 { ancien } s'il existe un lien
//            qu'on ne sait pas retrouver ; { remplacer: true } (« Changer de lien ») seul le coupe.
//            Logique dans lib/calendrier/abonnement.ts (testée contre une fausse base).
//   DELETE → révoque : l'agenda du coureur ne reçoit plus rien.
//
// La table `calendrier_abonnements` n'a aucune politique RLS : seul le serveur (service role) la
// touche, toujours filtrée sur l'utilisateur de la SESSION, jamais sur un identifiant reçu.

const URL_ROUTE = "/api/calendrier/abonnement";

type Ligne = { cree_le?: string | null; derniere_lecture?: string | null; jeton_empreinte?: string | null };

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
    .select("cree_le, derniere_lecture, jeton_empreinte").eq("user_id", user.id).maybeSingle();
  if (tableAbsente(error)) return NextResponse.json({ indisponible: true });
  if (error) {
    await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: URL_ROUTE, message: `Abonnement illisible : ${error.code ?? "?"} ${error.message}` });
    return NextResponse.json({ error: "Lecture impossible, réessaie." }, { status: 500 });
  }
  const d = data as Ligne | null;
  if (!d) return NextResponse.json({ actif: false, derniereLecture: null, liens: null });
  let jeton: string | null;
  try { jeton = jetonRetrouve(user.id, d); }
  catch (e) {
    await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: URL_ROUTE, message: `Jeton non recalculé : ${(e as Error).message}` });
    return NextResponse.json({ error: "Lecture impossible, réessaie." }, { status: 500 });
  }
  // La réponse porte l'adresse secrète : jamais gardée en cache.
  return NextResponse.json(
    { actif: true, derniereLecture: d.derniere_lecture ?? null, liens: jeton ? adresseFlux(ORIGINE_FLUX, jeton) : null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  const user = await utilisateur();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const corps = await req.json().catch(() => ({})) as { remplacer?: unknown };
  const remplacer = corps?.remplacer === true;
  const admin = createAdminClient();
  const r = await lienDuCompte(admin, user.id, { remplacer });
  if (r.k === "liens") return NextResponse.json({ ok: true, liens: r.liens }, { headers: { "Cache-Control": "private, no-store" } });
  if (r.k === "indisponible") return NextResponse.json({ indisponible: true }, { status: 503 });
  // Un lien existe mais ne se retrouve pas : on ne l'écrase pas sans « Changer de lien » confirmé.
  if (r.k === "ancien") return NextResponse.json({ ancien: true }, { status: 409 });
  await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: URL_ROUTE, message: r.message });
  return NextResponse.json({ error: "Le lien n'a pas pu être créé, réessaie." }, { status: 500 });
}

export async function DELETE() {
  const user = await utilisateur();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from("calendrier_abonnements").delete().eq("user_id", user.id);
  if (error && !tableAbsente(error)) {
    await journaliserEchec(admin, { source: "calendrier", userId: user.id, url: URL_ROUTE, message: `Abonnement non révoqué : ${error.code ?? "?"} ${error.message}` });
    return NextResponse.json({ error: "La révocation a échoué, réessaie." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
