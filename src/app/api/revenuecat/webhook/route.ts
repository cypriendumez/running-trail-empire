export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { traiterEvenementStore } from "@/lib/billing/revenuecat";

/**
 * POST /api/revenuecat/webhook — les abonnements vendus PAR LES STORES (achat intégré dans
 * l'appli native), tels que RevenueCat les rapporte (05/11/2026).
 *
 * L'accès s'écrit au MÊME endroit que pour Stripe (`profiles.subscription_tier`, lu par
 * `lib/billing/access`) : une seule vérité, quel que soit le moyen de paiement. L'acheteur
 * est l'`app_user_id`, que l'appli fixe à l'identifiant Pacevo (lib/natif/achat).
 *
 * Sécurité : RevenueCat envoie l'en-tête `Authorization` réglé dans son tableau de bord ;
 * il doit valoir `REVENUECAT_WEBHOOK_SECRET`. Sans secret, on REFUSE : accepter « faute de
 * mieux » laisserait n'importe qui s'offrir un abonnement Premium.
 *
 * Réponses : 2xx = traité ou volontairement ignoré ; 5xx = RevenueCat réessaiera (une
 * écriture refusée par la base ne doit pas faire perdre un achat payé).
 */

function memeSecret(recu: string, attendu: string): boolean {
  const a = Buffer.from(recu.replace(/^Bearer\s+/i, "")), b = Buffer.from(attendu);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  if (!memeSecret(req.headers.get("authorization") ?? "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const corps = await req.json().catch(() => null) as { event?: Record<string, unknown> } | null;
  const ev = corps?.event;
  if (!ev) return NextResponse.json({ ok: true, ignore: "vide" });
  const r = await traiterEvenementStore(createAdminClient(), ev);
  return NextResponse.json(r.corps, { status: r.statut });
}
