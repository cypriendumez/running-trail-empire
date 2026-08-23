export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe, accesDuPrice } from "@/lib/stripe/client";
import type Stripe from "stripe";
import { ecrituresDeLEvenement } from "@/lib/compta/stripe";
import { enregistrerEcritures } from "@/lib/compta/enregistrer";
import { emailEncaissement, emailAlerteCompta } from "@/lib/compta/alerte";
import { emailEditeur } from "@/lib/admin/acces";
import { TYPE_ETAT_ABO, type EtatAbonnement } from "@/lib/billing/etatAbonnement";


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

  // ── COMPTABILITÉ ───────────────────────────────────────────────────────────
  // ⚠️ AVANT le `switch`, et hors de lui. Le `switch` ne traite que le cycle de vie de
  // l'abonnement ; l'ARGENT arrive par d'autres événements (`invoice.paid`,
  // `charge.refunded`). Tant que la comptabilité vivait dans le switch, un encaissement
  // passait sans laisser la moindre trace comptable.
  await comptabiliser(event, req);

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

  /**
   * Mémorise l'état de l'abonnement pour que l'écran puisse le DIRE.
   *
   * ⚠️ ÉCRITURE PAR REMPLACEMENT COMPLET, jamais par fusion. Stripe envoie l'état
   * courant en entier à chaque notification : fusionner laisserait traîner un
   * `echecPaiement: true` d'il y a trois semaines, et l'athlète verrait une alerte de
   * paiement refusé alors que tout va bien depuis longtemps.
   *
   * Le fourre-tout `notifications` évite une migration : la donnée se reconstruit
   * intégralement à la notification suivante.
   */
  const memoriserEtat = async (userId: string, etat: EtatAbonnement): Promise<void> => {
    const { data: existant } = await admin.from("notifications").select("id")
      .eq("user_id", userId).eq("type", TYPE_ETAT_ABO).maybeSingle();
    if (existant?.id) await admin.from("notifications").update({ data: etat }).eq("id", existant.id);
    else await admin.from("notifications").insert({ user_id: userId, type: TYPE_ETAT_ABO, title: "abonnement", body: "", data: etat });
  };

  /** La fin de période, en AAAA-MM-JJ. Stripe la donne en secondes UNIX. */
  const finDe = (sub: Stripe.Subscription): string | null => {
    const t = (sub as unknown as { current_period_end?: number }).current_period_end;
    return typeof t === "number" && t > 0 ? new Date(t * 1000).toISOString().slice(0, 10) : null;
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = await findUser(sub);
      if (!userId) { console.error("[stripe] abonnement sans athlète identifiable", sub.id); break; }
      // ⚠️ La formule se lit sur le TARIF ACHETÉ. Écrire « pro » en dur donnait l'IA à
      // quelqu'un qui avait payé Essentiel : l'écart de 5 € entre les deux formules ne
      // voulait plus rien dire, et le verrou d'accès n'avait rien à verrouiller.
      const priceId = sub.items?.data?.[0]?.price?.id ?? null;
      await admin.from("profiles").update({
        // `trialing` donne droit à la formule : ne retenir que `active` coupait l'accès
        // pendant la période d'essai, au moment où l'athlète découvre justement le produit.
        subscription_tier: ["active", "trialing"].includes(sub.status) ? accesDuPrice(priceId) : "free",
        stripe_subscription_id: sub.id,
      }).eq("id", userId);
      // ⚠️ `cancel_at_period_end` est le SEUL moyen de savoir qu'une résiliation est en
      // cours : le statut reste `active` jusqu'au dernier jour. Sans ce drapeau, l'écran
      // afficherait « prochain prélèvement le 24/09 » à quelqu'un qui vient de résilier.
      await memoriserEtat(userId, {
        statut: sub.status,
        periodeFin: finDe(sub),
        annuleALaFin: sub.cancel_at_period_end === true,
        // Un abonnement redevenu actif efface l'échec précédent : Stripe ne repasse pas
        // en `active` tant que le paiement n'est pas passé.
        echecPaiement: sub.status === "past_due" || sub.status === "unpaid",
      });
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
      await memoriserEtat(userId, { statut: "canceled", periodeFin: null, annuleALaFin: false, echecPaiement: false });
      break;
    }
    /**
     * ÉCHEC DE PAIEMENT — l'événement que l'application n'écoutait PAS.
     *
     * Une carte expire, Stripe réessaie pendant quelques jours, puis résilie. Jusqu'ici,
     * l'athlète voyait son compte retomber en gratuit du jour au lendemain sans qu'aucun
     * message ne lui ait dit qu'une carte à mettre à jour en était la cause. Un abonné
     * perdu pour une raison qu'il n'a jamais connue — et un revenu perdu invisible.
     *
     * ⚠️ ON NE COUPE RIEN ICI. Le premier échec n'est pas une résiliation : Stripe
     * réessaiera. On se contente de lever le drapeau pour que l'écran l'affiche, avec le
     * lien vers le portail. C'est `customer.subscription.deleted` qui coupe, au bout.
     */
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } };
      const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription?.id;
      if (!subId) break;
      const { data } = await admin.from("profiles").select("id").eq("stripe_subscription_id", subId).maybeSingle();
      const userId = (data as { id?: string } | null)?.id;
      if (!userId) { console.error("[stripe] échec de paiement sans athlète identifiable", subId); break; }
      const { data: ligne } = await admin.from("notifications").select("id, data")
        .eq("user_id", userId).eq("type", TYPE_ETAT_ABO).maybeSingle();
      const precedent = (ligne?.data ?? {}) as Partial<EtatAbonnement>;
      await memoriserEtat(userId, {
        statut: typeof precedent.statut === "string" ? precedent.statut : "past_due",
        periodeFin: typeof precedent.periodeFin === "string" ? precedent.periodeFin : null,
        annuleALaFin: precedent.annuleALaFin === true,
        echecPaiement: true,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Enregistre l'événement au journal comptable et prévient l'éditeur.
 *
 * ⚠️ NE FAIT JAMAIS ÉCHOUER LE WEBHOOK. Si l'écriture ou l'e-mail échoue, Stripe ne doit
 * pas recevoir une erreur : il réémettrait l'événement, l'abonnement serait ré-appliqué,
 * et on risquerait le doublon qu'on cherche justement à éviter. L'accès de l'athlète et
 * la tenue du journal sont deux sujets distincts — le premier ne doit pas dépendre du
 * second.
 */
async function comptabiliser(event: Stripe.Event, req: Request): Promise<void> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

    // Les frais Stripe ne sont pas dans la facture : ils vivent sur la transaction de
    // solde du paiement. On va les chercher — et on continue sans si on ne peut pas,
    // en le DISANT dans l'écriture plutôt qu'en laissant croire que l'encaissement n'a
    // rien coûté.
    let fraisCents: number | null = null;
    if (event.type === "invoice.paid") {
      try {
        const inv = event.data.object as Stripe.Invoice & { charge?: string | { id: string } };
        const chargeId = typeof inv.charge === "string" ? inv.charge : inv.charge?.id;
        if (chargeId) {
          const ch = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
          const bt = ch.balance_transaction;
          if (bt && typeof bt !== "string") fraisCents = bt.fee ?? null;
        }
      } catch (e) {
        console.error("[compta] frais Stripe non récupérés :", (e as Error).message);
      }
    }

    const conv = ecrituresDeLEvenement(
      { id: event.id, type: event.type, data: { object: event.data.object as unknown as Record<string, unknown> } },
      fraisCents,
    );
    if (conv.ignore) return;

    const dest = emailEditeur();
    const cle = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    const envoyer = async (m: { objet: string; html: string; texte: string }) => {
      if (!cle || !from || !dest) return;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [dest], subject: m.objet, html: m.html, text: m.texte }),
        signal: AbortSignal.timeout(8000),
      });
    };

    if (conv.alerte) { await envoyer(emailAlerteCompta({ raison: conv.alerte, base })); return; }

    const res = await enregistrerEcritures(conv.ecritures);
    if (res.erreur) {
      console.error("[compta]", res.erreur);
      await envoyer(emailAlerteCompta({ raison: res.erreur, base }));
      return;
    }
    // ⚠️ On ne prévient QUE pour une écriture réellement créée. Stripe réémet ses
    // notifications : envoyer un e-mail à chaque passage annoncerait trois fois le même
    // paiement, et on finirait par ne plus les lire.
    if (res.creees > 0 && conv.ecritures.some((e) => e.sens === "entree")) {
      await envoyer(emailEncaissement({ ecritures: conv.ecritures, base }));
    }
  } catch (e) {
    console.error("[compta] échec du traitement comptable :", (e as Error).message);
  }
}
