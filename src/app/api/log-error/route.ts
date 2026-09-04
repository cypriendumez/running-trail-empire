export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const cut = (s: unknown, n: number) => (typeof s === "string" && s ? s.slice(0, n) : null);

/**
 * ⚠️ CETTE ROUTE EST PUBLIQUE ET NON AUTHENTIFIÉE — elle doit l'être, puisqu'une erreur
 * survient souvent avant même la connexion. Mais elle ÉCRIT en base, et elle n'avait
 * aucune borne : mesuré le 03/09/2026, une seule requête anonyme y a stocké 500 Ko.
 * Le palier gratuit de Supabase plafonne à 500 Mo : mille requêtes suffisaient à
 * remplir la base, et rien n'aurait signalé l'attaque avant la panne.
 *
 * Trois bornes, aucune ne dépend d'une infrastructure supplémentaire.
 */

/** Un rapport d'erreur honnête tient largement là-dedans. */
const CORPS_MAX = 16 * 1024;
const META_MAX = 2000;

/**
 * Coupe-circuit GLOBAL, volontairement pas par adresse IP.
 *
 * ⚠️ COMPTER PAR IP AURAIT EXIGÉ DE STOCKER L'IP — une donnée personnelle, sur un site
 * français, dans une table qu'on garde. On compte donc les insertions RÉCENTES, toutes
 * origines confondues : au-delà du seuil, on cesse d'écrire jusqu'à ce que ça se calme.
 * Un afflux légitime d'erreurs est de toute façon un afflux : perdre les suivantes ne
 * coûte rien, la première suffit à diagnostiquer.
 */
const PAR_MINUTE_MAX = 60;

export async function POST(req: Request) {
  try {
    // ⚠️ ON REFUSE AVANT DE LIRE. `req.json()` sur un corps énorme le charge en mémoire :
    // la borne doit s'appliquer à l'annonce de taille, pas après coup.
    const annonce = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(annonce) && annonce > CORPS_MAX) return NextResponse.json({ ok: true });

    const brut = await req.text();
    if (brut.length > CORPS_MAX) return NextResponse.json({ ok: true });
    const body = (JSON.parse(brut || "{}") ?? {}) as Record<string, unknown>;

    const admin = createAdminClient();
    const { count } = await admin.from("error_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((count ?? 0) >= PAR_MINUTE_MAX) return NextResponse.json({ ok: true });

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();

    // `meta` échappait à toute borne : les chaînes étaient coupées, l'objet non.
    let meta: unknown = null;
    if (body.meta && typeof body.meta === "object") {
      const s = JSON.stringify(body.meta);
      meta = s.length <= META_MAX ? body.meta : { tronque: true, extrait: s.slice(0, META_MAX) };
    }

    // ⚠️ « Le refus est silencieux POUR LUI, jamais pour nous » — c'est ce que promet le
    // commentaire du bas, et ce n'était pas tenu : l'échec de cette insertion n'était
    // lu par personne. On aurait donc perdu TOUT le journal d'erreurs sans le moindre
    // signe, précisément l'outil qui sert à voir ce qui casse en production.
    const { error } = await admin.from("error_logs").insert({
      user_id: user?.id ?? null,
      source: cut(body.source, 24) ?? "client",
      message: cut(body.message, 2000) ?? "(no message)",
      stack: cut(body.stack, 6000),
      url: cut(body.url, 1000),
      user_agent: cut(req.headers.get("user-agent"), 500),
      meta,
    });
    if (error) console.error("[log-error] journal d'erreurs non écrit :", error.message);
  } catch { /* le logger d'erreurs ne doit JAMAIS lever d'erreur lui-même */ }
  // Toujours « ok » : l'appelant est une page en train de tomber, on ne lui ajoute pas
  // une seconde erreur à gérer. Le refus est silencieux POUR LUI, jamais pour nous.
  return NextResponse.json({ ok: true });
}
