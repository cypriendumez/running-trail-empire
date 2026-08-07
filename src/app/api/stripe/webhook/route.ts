export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import type Stripe from "stripe";


export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // Sans secret, la signature ne peut pas être vérifiée : on REFUSE. Accepter
  // « faute de mieux » reviendrait à laisser n'importe qui offrir un abonnement Pro.
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  /**
   * Retrouve l'athlète derrière un abonnement.
   *
   * Les métadonnées ne sont posées qu'au moment du paiement initial. Un abonnement créé
   * ou modifié AUTREMENT — depuis le tableau de bord Stripe, via le portail client, ou
   * lors d'un changement de formule — n'en porte aucune : le code faisait alors
   * `if (!userId) break;` et l'abonnement était encaissé sans que le compte passe en Pro.
   * Un paiement perdu, sans la moindre erreur nulle part.
   * On retombe donc sur l'identifiant client Stripe, qui est stocké sur le profil.
   */
  const findUser = async (sub: Stripe.Subscription): Promise<string | null> => {
    const fromMeta = sub.metadata?.supabase_user_id;
    if (fromMeta) return fromMeta;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (!customerId) return null;
    const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await findUser(sub);
      if (!userId) { console.error("[stripe] abonnement sans athlète identifiable", sub.id); break; }
      await admin.from("profiles").update({
        // `trialing` donne droit au Pro : ne retenir que `active` coupait l'accès pendant
        // la période d'essai, à un moment où l'athlète découvre justement le produit.
        subscription_tier: ["active", "trialing"].includes(sub.status) ? "pro" : "free",
        stripe_subscription_id: sub.id,
      }).eq("id", userId);
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await findUser(sub);
      if (!userId) { console.error("[stripe] résiliation sans athlète identifiable", sub.id); break; }
      await admin.from("profiles").update({
        subscription_tier: "free",
        stripe_subscription_id: null,
      }).eq("id", userId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
