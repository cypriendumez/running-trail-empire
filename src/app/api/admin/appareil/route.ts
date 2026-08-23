export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";
import { COOKIE_APPAREIL, DUREE_JOURS, appareilExige, codeValide, signerAppareil } from "@/lib/admin/appareil";

/**
 * DÉCLARE L'APPAREIL COURANT COMME APPAREIL DE CONFIANCE.
 *
 * ⚠️ Cette route est le SEUL moyen d'obtenir le jeton, et elle exige deux choses à la
 * fois : une session d'administration valide ET le code d'enrôlement. L'un sans l'autre
 * ne donne rien — c'est ce qui fait du couple « mot de passe + appareil » deux barrières
 * indépendantes plutôt qu'une seule.
 *
 * ⚠️ ET CHAQUE TENTATIVE EST TRACÉE, réussie ou non. Une série d'échecs depuis une adresse
 * inconnue est exactement le signal qu'on veut voir — et qu'aucun journal ne montrerait
 * si l'on ne consignait que les succès.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!appareilExige()) {
    return NextResponse.json({ ok: false, erreurs: ["Protection par appareil non configurée sur le serveur."] }, { status: 503 });
  }

  const b = (await req.json().catch(() => ({}))) as { code?: string };
  const ok = codeValide(String(b.code ?? ""), String(process.env.ADMIN_DEVICE_CODE ?? ""));

  try {
    await createAdminClient().from("notifications").insert({
      user_id: user!.id, type: "admin_appareil", title: ok ? "Appareil autorisé" : "Code d'appareil refusé", read: true,
      data: {
        ok, le: new Date().toISOString(), par: user!.email,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        appareil: (req.headers.get("user-agent") ?? "").slice(0, 200),
      },
    });
  } catch (e) { console.error("[appareil] trace non enregistrée :", (e as Error).message); }

  if (!ok) return NextResponse.json({ ok: false, erreurs: ["Code refusé."] }, { status: 403 });

  const jeton = signerAppareil(String(process.env.ADMIN_DEVICE_SECRET), user!.id, randomUUID(), Date.now());
  const jar = await cookies();
  jar.set(COOKIE_APPAREIL, jeton, {
    // ⚠️ `httpOnly` : aucun script de la page ne peut lire ce jeton, donc une faille
    // d'injection ne l'emporte pas. `secure` : jamais en clair sur le réseau.
    // `sameSite: lax` : il n'accompagne pas les requêtes déclenchées par un autre site.
    httpOnly: true, secure: true, sameSite: "lax", path: "/",
    maxAge: DUREE_JOURS * 86400,
  });
  return NextResponse.json({ ok: true, jours: DUREE_JOURS });
}

/** Retire la confiance accordée à CET appareil. */
export async function DELETE() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  (await cookies()).delete(COOKIE_APPAREIL);
  return NextResponse.json({ ok: true });
}
