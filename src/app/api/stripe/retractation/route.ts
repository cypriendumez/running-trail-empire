export const dynamic = "force-dynamic";
/**
 * LA FONCTION DE RÉTRACTATION — ce que déclenche « Renoncer au contrat ici ».
 *
 * ⚠️ OBLIGATOIRE DEPUIS LE 19/06/2026 pour tout contrat conclu en ligne (ordonnance
 * n° 2026-2, décret n° 2026-3, art. L221-21 du code de la consommation) : l'abonné renonce
 * aussi facilement qu'il s'est abonné, il confirme, et reçoit SANS RETARD un accusé de
 * réception sur un support durable. Le délai et le prorata se calculent dans
 * `lib/billing/retractation`, la même source que l'écran.
 *
 * ⚠️ L'ORDRE EST DÉCIDÉ PAR LE DROIT, PAS PAR STRIPE :
 *  1. on ENREGISTRE la demande : c'est elle qui fait foi, pas le remboursement ;
 *  2. on tente le remboursement et l'arrêt chez Stripe ;
 *  3. on envoie l'accusé QUOI QU'IL ARRIVE. Une panne de Stripe ne doit jamais priver
 *     l'abonné de sa preuve. Dans ce cas, l'éditeur est prévenu pour rembourser à la main
 *     dans les 14 jours.
 */
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, stripeConfigured } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fenetreRetractation, montantRembourse, TYPE_RETRACTATION } from "@/lib/billing/retractation";
import { emailAccuseRetractation } from "@/lib/billing/emailsAbonnement";
import { envoyerEmail } from "@/lib/email/envoyer";
import { emailEditeur } from "@/lib/admin/acces";
import { EDITEUR } from "@/lib/brand/editeur";

type Profil = {
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  email?: string | null;
  full_name?: string | null;
  preferred_language?: string | null;
  subscription_tier?: string | null;
};

export async function POST(req: Request) {
  if (!stripeConfigured) return NextResponse.json({ error: "Paiement non configuré" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const corps = await req.json().catch(() => ({})) as { nom?: unknown; confirmation?: unknown };
  const nom = typeof corps.nom === "string" ? corps.nom.trim().slice(0, 120) : "";
  // La confirmation est l'étape que la loi impose entre le bouton et l'envoi : sans elle,
  // un clic égaré mettrait fin à un abonnement.
  if (nom.length < 2 || corps.confirmation !== true) {
    return NextResponse.json({ error: "Indique ton nom et confirme ta rétractation." }, { status: 400 });
  }

  const { data } = await supabase.from("profiles")
    .select("stripe_subscription_id, stripe_customer_id, email, full_name, preferred_language, subscription_tier")
    .eq("id", user.id).single();
  const profil = (data ?? {}) as Profil;
  const subId = profil.stripe_subscription_id;
  const email = profil.email || user.email || "";
  if (!subId) return NextResponse.json({ error: "Aucun abonnement en cours." }, { status: 400 });

  const admin = createAdminClient();

  // ⚠️ UNE DEMANDE, UNE SEULE FOIS. Un double clic ou un rechargement ne doit ni rembourser
  // deux fois ni envoyer deux accusés : on rend le résultat déjà enregistré.
  const { data: deja } = await admin.from("notifications").select("data")
    .eq("user_id", user.id).eq("type", TYPE_RETRACTATION).eq("data->>abonnement", subId).maybeSingle();
  if (deja?.data) {
    const d = deja.data as { recueLe?: string; rembourseCentimes?: number | null };
    return NextResponse.json({ ok: true, deja: true, recueLe: d.recueLe ?? null, rembourseCentimes: d.rembourseCentimes ?? null, email });
  }

  let sub: Stripe.Subscription;
  try {
    sub = await stripe.subscriptions.retrieve(subId);
  } catch (e) {
    console.error("[retractation] abonnement illisible chez Stripe :", (e as Error).message);
    return NextResponse.json({ error: `Impossible de lire ton abonnement pour le moment. Réessaie, ou écris-nous à ${EDITEUR.email}.` }, { status: 502 });
  }
  const client = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (profil.stripe_customer_id && client !== profil.stripe_customer_id) {
    return NextResponse.json({ error: "Cet abonnement ne t'appartient pas." }, { status: 403 });
  }

  const recueLe = new Date();
  const souscritLe = new Date(sub.created * 1000);
  const fenetre = fenetreRetractation(souscritLe.toISOString(), recueLe);
  if (!fenetre.ouverte) {
    return NextResponse.json({
      error: "Le délai de 14 jours est dépassé. Tu peux toujours résilier depuis ton espace de facturation : ton accès restera ouvert jusqu'à la fin de la période payée.",
      dernierJour: fenetre.dernierJour,
    }, { status: 409 });
  }

  // 1. LA TRACE. Si on ne peut pas l'écrire, on ne fait rien d'autre : sans elle, ni
  //    preuve ni protection contre un second remboursement.
  const trace = {
    abonnement: subId, nom, email, recueLe: recueLe.toISOString(), souscritLe: souscritLe.toISOString(),
    formule: profil.subscription_tier ?? "", statut: "recue", rembourseCentimes: null as number | null,
  };
  const { data: ligne, error: eTrace } = await admin.from("notifications")
    .insert({ user_id: user.id, type: TYPE_RETRACTATION, title: "rétractation", body: "", data: trace })
    .select("id").single();
  if (eTrace || !ligne) {
    console.error("[retractation] trace non enregistrée :", eTrace?.message);
    return NextResponse.json({ error: `Ta demande n'a pas pu être enregistrée. Réessaie dans un instant, ou écris-nous à ${EDITEUR.email}.` }, { status: 500 });
  }

  // 2. REMBOURSEMENT AU PRORATA, PUIS ARRÊT IMMÉDIAT.
  let rembourseCentimes: number | null = null;
  let erreurStripe: string | null = null;
  try {
    const factures = await stripe.invoices.list({ subscription: subId, status: "paid", limit: 1 });
    const inv = factures.data[0] as (Stripe.Invoice & { payment_intent?: string | { id: string } | null; charge?: string | { id: string } | null }) | undefined;
    const paye = inv?.amount_paid ?? 0;
    if (!inv || paye <= 0) {
      rembourseCentimes = 0; // Essai gratuit en cours : rien n'a été prélevé.
    } else {
      const periode = inv.lines?.data?.[0]?.period;
      const debut = new Date((periode?.start ?? inv.period_start) * 1000);
      const fin = new Date((periode?.end ?? inv.period_end) * 1000);
      const aRendre = montantRembourse(paye, debut, fin, recueLe);
      if (aRendre > 0) {
        const pi = typeof inv.payment_intent === "string" ? inv.payment_intent : inv.payment_intent?.id;
        const ch = typeof inv.charge === "string" ? inv.charge : inv.charge?.id;
        if (!pi && !ch) throw new Error(`facture ${inv.id} sans paiement remboursable`);
        await stripe.refunds.create(
          { ...(pi ? { payment_intent: pi } : { charge: ch as string }), amount: aRendre, reason: "requested_by_customer",
            metadata: { motif: "retractation", supabase_user_id: user.id } },
          // La même clé à chaque tentative : Stripe ne rembourse jamais deux fois.
          { idempotencyKey: `retractation-${subId}` },
        );
      }
      rembourseCentimes = aRendre;
    }
    await stripe.subscriptions.cancel(subId, { prorate: false, cancellation_details: { comment: "Rétractation (14 jours)" } });
  } catch (e) {
    erreurStripe = (e as Error).message;
    rembourseCentimes = null;
    console.error("[retractation] remboursement ou arrêt à faire à la main :", erreurStripe);
  }

  // La demande est déjà enregistrée (statut « recue ») : si cette mise à jour échoue, la
  // preuve reste, seul le statut est en retard. On le dit dans le journal, sans bloquer
  // l'accusé de réception.
  const { error: eStatut } = await admin.from("notifications").update({
    data: { ...trace, statut: erreurStripe ? "a_traiter" : "traitee", rembourseCentimes, erreur: erreurStripe },
  }).eq("id", ligne.id);
  if (eStatut) console.error("[retractation] statut de la demande non mis à jour :", eStatut.message);

  // 3. L'ACCUSÉ DE RÉCEPTION, quoi qu'il soit arrivé chez Stripe.
  const m = emailAccuseRetractation({
    lang: profil.preferred_language ?? "fr", nom, email, recueLe, souscritLe,
    formule: profil.subscription_tier ?? "", rembourseCentimes,
  });
  const envoi = email
    ? await envoyerEmail("retractation", { to: [email], subject: m.objet, text: m.texte, html: m.html, reply_to: EDITEUR.email },
        { userId: user.id, url: "/api/stripe/retractation" })
    : { ok: false as const, erreur: "aucune adresse" };

  const dest = emailEditeur();
  if (dest) {
    const action = erreurStripe
      ? `⚠️ À TRAITER À LA MAIN dans les 14 jours : rembourser la part non utilisée et arrêter l'abonnement ${subId}. Erreur Stripe : ${erreurStripe}`
      : `Remboursé automatiquement : ${((rembourseCentimes ?? 0) / 100).toFixed(2)} €. Abonnement ${subId} arrêté.`;
    await envoyerEmail("retractation-editeur", {
      to: [dest], subject: `Rétractation : ${email}`,
      text: `${nom} (${email}) a renoncé à son abonnement le ${recueLe.toISOString()}.\n${action}\nAccusé de réception : ${envoi.ok ? "envoyé" : `NON ENVOYÉ (${envoi.erreur}) — à renvoyer`}.`,
    }, { userId: user.id, url: "/api/stripe/retractation" });
  }

  return NextResponse.json({ ok: true, recueLe: recueLe.toISOString(), rembourseCentimes, email, accuse: envoi.ok });
}
