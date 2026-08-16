export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { stripe, priceIdDe, estFormule, estPeriode, stripeConfigured } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    if (!stripeConfigured) {
      return NextResponse.json({ error: "Le paiement n'est pas encore ouvert. Reviens très bientôt." }, { status: 503 });
    }
    // Deux formules × deux périodicités. L'ancien contrat n'acceptait que
    // « monthly » / « yearly » : une périodicité seule ne suffit plus à désigner un
    // tarif depuis qu'il y a deux formules.
    const { formule, periode } = await req.json() as { formule?: unknown; periode?: unknown };
    if (!estFormule(formule) || !estPeriode(periode)) {
      return NextResponse.json({ error: "Formule ou périodicité inconnue" }, { status: 400 });
    }
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("stripe_customer_id, email, full_name").eq("id", user.id).single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? user.email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      // PAS de `payment_method_types: ["card"]`. Le figer sur la carte privait l'athlète
      // des moyens de paiement locaux (SEPA, iDEAL, Bancontact…), qui coûtent nettement
      // moins cher en commission ET convertissent mieux dans leur pays d'origine.
      // Sans ce champ, Stripe propose automatiquement ceux qui sont activés sur le compte
      // et pertinents pour le pays de l'acheteur.
      line_items: [{ price: priceIdDe(formule, periode), quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancelled=true`,
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      // TVA automatique : indispensable pour vendre un abonnement numérique dans toute
      // l'Union (la TVA est due dans le pays de l'ACHETEUR), mais elle exige que Stripe
      // Tax soit activé sur le compte — sans quoi la session est REFUSÉE. On l'active
      // donc par variable d'environnement, pour ne pas casser une première mise en route.
      ...(process.env.STRIPE_TAX_ENABLED === "true"
        ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" as const, name: "auto" as const } }
        : {}),
      // Évite de créer deux abonnements si l'athlète double-clique ou recharge la page.
      client_reference_id: user.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
