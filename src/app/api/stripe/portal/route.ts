export const dynamic = "force-dynamic";
/**
 * PORTAIL CLIENT STRIPE.
 *
 * Il n'existait pas : un athlète pouvait s'abonner, mais ni changer de moyen de
 * paiement, ni consulter ses factures, ni RÉSILIER. Outre le fait que c'est le premier
 * motif de litige bancaire, la résiliation en ligne est une obligation légale en Europe
 * dès lors que la souscription s'est faite en ligne — et c'est aussi ce que Stripe exige
 * pour valider un compte.
 *
 * Le portail est hébergé par Stripe : aucune donnée bancaire ne transite par nous.
 */
import { NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    if (!stripeConfigured) return NextResponse.json({ error: "Paiement non configuré" }, { status: 503 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("stripe_customer_id").eq("id", user.id).single();
    const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (!customerId) return NextResponse.json({ error: "Aucun abonnement à gérer" }, { status: 400 });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe] portail client :", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
