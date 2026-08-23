export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { stripe, priceIdDe, estFormule, estPeriode, stripeConfigured } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { joursEssaiStripe } from "@/lib/billing/access";

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

    // `created_at` et `subscription_tier` servent à calculer les jours d'essai RESTANTS :
    // sans eux, on ne peut pas distinguer un athlète qui vient de s'inscrire d'un autre
    // dont l'essai gratuit est terminé depuis un mois.
    const { data: profile } = await supabase
      .from("profiles").select("stripe_customer_id, email, full_name, created_at, subscription_tier")
      .eq("id", user.id).single();

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

    const joursEssai = joursEssaiStripe(profile);

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
      subscription_data: {
        metadata: { supabase_user_id: user.id },
        // ⚠️ LES JOURS RESTANTS, PAS SEPT. Voir `joursEssaiStripe` : l'application offre
        // déjà un essai gratuit sans carte qui démarre à l'inscription. Poser sept jours
        // ici les AJOUTAIT aux premiers — quatorze jours avant le premier euro pour qui
        // s'inscrivait et s'abonnait le même jour, sans que personne l'ait décidé.
        //
        // ⚠️ ET ON OMET LE CHAMP QUAND IL VAUT ZÉRO : Stripe REFUSE
        // `trial_period_days: 0`. Le paiement est alors immédiat, ce que le bouton de
        // /pricing annonce en changeant de libellé — sinon on retomberait exactement
        // dans le mensonge qu'on vient de corriger.
        ...(joursEssai > 0 ? {
          trial_period_days: joursEssai,
          // Sans moyen de paiement valide à la fin de l'essai, on annule plutôt que de
          // laisser traîner un impayé : l'athlète retombe sur le palier gratuit.
          trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } },
        } : {}),
      },
      // La carte est demandée dès l'inscription à l'essai — sinon rien ne se déclenche au
      // huitième jour et l'essai devient un abonnement gratuit permanent.
      payment_method_collection: "always",
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
