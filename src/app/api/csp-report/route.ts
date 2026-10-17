export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * COLLECTE DES VIOLATIONS CSP (report-only) — cible de `report-uri` (voir next.config.ts, M4).
 *
 * Publique et sans authentification : une violation survient dans le navigateur, souvent avant
 * toute connexion, et le navigateur l'envoie tout seul. Comme /api/log-error et /api/visite,
 * la route est BORNÉE (taille + coupe-circuit par minute, car un dépôt gratuit Supabase plafonne
 * à 500 Mo) et répond TOUJOURS 204 : un rapport ne doit jamais faire tomber quoi que ce soit.
 *
 * ⚠️ C'est un outil de MESURE, le temps d'ajuster la politique avant de l'appliquer. Un afflux
 * de rapports est attendu au début (scripts en ligne de Next sans nonce) : on garde les premiers,
 * on jette le surplus.
 */
const CORPS_MAX = 8 * 1024;
const PAR_MINUTE_MAX = 60;
const rien = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  try {
    const annonce = Number(req.headers.get("content-length") ?? 0);
    if (Number.isFinite(annonce) && annonce > CORPS_MAX) return rien();
    const brut = await req.text();
    if (brut.length > CORPS_MAX) return rien();

    const admin = createAdminClient();
    const { count } = await admin.from("error_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 60_000).toISOString());
    if ((count ?? 0) >= PAR_MINUTE_MAX) return rien();

    // Un rapport CSP : { "csp-report": { "violated-directive", "blocked-uri", "document-uri", … } }
    // (ancien format) ou un tableau de { body: … } (Reporting API). On lit au mieux.
    let r: Record<string, unknown> = {};
    try {
      const j = JSON.parse(brut || "{}");
      r = (j["csp-report"] ?? (Array.isArray(j) ? (j[0]?.body ?? j[0]) : j) ?? {}) as Record<string, unknown>;
    } catch { /* corps illisible : on journalise quand même l'extrait brut */ }

    const directive = String(r["violated-directive"] ?? r["effectiveDirective"] ?? r["effective-directive"] ?? "?").slice(0, 200);
    const bloque = String(r["blocked-uri"] ?? r["blockedURL"] ?? "?").slice(0, 500);
    const page = String(r["document-uri"] ?? r["documentURL"] ?? "").slice(0, 500);

    const { error } = await admin.from("error_logs").insert({
      user_id: null,
      source: "csp",
      message: `CSP report-only — ${directive} ← ${bloque}`.slice(0, 2000),
      url: page || null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 500) || null,
      meta: { extrait: brut.slice(0, 2000) },
    });
    if (error) console.error("[csp-report] non écrit :", error.message);
  } catch { /* un rapport ne fait jamais tomber une page */ }
  return rien();
}
