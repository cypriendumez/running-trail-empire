import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions générales (CGU / CGV) | Pacevo",
  description: "Conditions générales d'utilisation et de vente de Pacevo.",
};

// Page PUBLIQUE (CGU + conditions d'abonnement). ⚠️ Adapte les montants/durées à ton offre réelle.
export default function TermsPage() {
  const MAJ = "10 juin 2026";
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-zinc-800">
      <a href="/" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">← Retour</a>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">Conditions générales d&apos;utilisation et de vente</h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : {MAJ}</p>

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed">
        <Section title="1. Objet">
          <p>Les présentes conditions régissent l&apos;accès et l&apos;utilisation de l&apos;application
            <b> Pacevo</b> (« l&apos;Application »), éditée par Cyprien Dumez
            (voir <a href="/mentions-legales" className="font-semibold text-emerald-600">mentions légales</a>),
            ainsi que les abonnements payants éventuels. En créant un compte, tu acceptes ces conditions.</p>
        </Section>

        <Section title="2. Compte">
          <p>Tu dois fournir des informations exactes et garder ton mot de passe confidentiel. L&apos;Application
            est réservée aux personnes de 15 ans ou plus (ou avec accord parental). Tu es responsable de
            l&apos;activité réalisée depuis ton compte.</p>
        </Section>

        <Section title="3. Le service">
          <p>L&apos;Application propose un accompagnement à la course/au trail : suivi des séances, analyses et
            plans d&apos;entraînement générés par intelligence artificielle, allures/zones, objectifs de course,
            fonctionnalités de club (ligues, badges, défis), enregistrement GPS et comparateur de produits.</p>
        </Section>

        <Section title="4. Avertissement santé (important)">
          <p>Les analyses, plans et conseils fournis par l&apos;Application sont <b>informatifs</b> et
            <b> ne constituent pas un avis médical</b>. Pacevo <b>n&apos;est pas un dispositif
            médical</b>. Consulte un médecin avant de reprendre ou d&apos;intensifier une activité physique, et
            arrête-toi en cas de douleur ou de malaise. Tu pratiques sous ta seule responsabilité.</p>
        </Section>

        <Section title="5. Abonnements, prix et paiement">
          <Ul items={[
            "Une période d'essai gratuite peut être proposée à l'inscription.",
            "Les abonnements payants (mensuel / annuel) sont indiqués toutes taxes comprises sur la page d'offres ; le paiement est traité par notre prestataire Stripe.",
            "L'abonnement est reconductible automatiquement à échéance, sauf résiliation avant le renouvellement.",
            "Tu peux résilier à tout moment depuis tes paramètres ; l'accès reste actif jusqu'à la fin de la période payée.",
          ]} />
        </Section>

        <Section title="6. Droit de rétractation">
          <p>Conformément au Code de la consommation, tu disposes d&apos;un délai de <b>14 jours</b> pour te
            rétracter d&apos;un achat à distance. Toutefois, pour un contenu/service numérique dont l&apos;exécution
            commence immédiatement avec ton accord, tu <b>renonces expressément</b> à ce droit une fois le service
            pleinement exécuté. La période d&apos;essai gratuite te permet de tester sans engagement.</p>
        </Section>

        <Section title="7. Comparateur de prix et liens d'affiliation">
          <p>Les prix des produits tiers sont fournis à titre indicatif (via des flux d&apos;affiliation ou des
            données publiques) et peuvent ne pas être à jour ; seul le prix affiché sur le site marchand au moment
            de l&apos;achat fait foi. Pacevo n&apos;est pas vendeur de ces produits et peut
            percevoir une commission d&apos;affiliation, sans surcoût pour toi.</p>
        </Section>

        <Section title="8. Propriété intellectuelle">
          <p>L&apos;Application, son contenu et son code sont protégés. Tu bénéficies d&apos;un droit
            d&apos;utilisation personnel et non exclusif. Tu conserves la propriété de tes données d&apos;entraînement.</p>
        </Section>

        <Section title="9. Responsabilité">
          <p>L&apos;Application est fournie « en l&apos;état ». Nous ne garantissons pas l&apos;absence
            d&apos;interruption ou d&apos;erreur, ni l&apos;exactitude des données de tiers (montres, marchands).
            Notre responsabilité ne saurait être engagée pour les conséquences de l&apos;activité sportive ou
            d&apos;une utilisation non conforme.</p>
        </Section>

        <Section title="10. Données personnelles">
          <p>Le traitement de tes données est décrit dans la{" "}
            <a href="/confidentialite" className="font-semibold text-emerald-600 hover:text-emerald-700">politique de confidentialité</a>.</p>
        </Section>

        <Section title="11. Droit applicable et médiation">
          <p>Les présentes conditions sont soumises au droit français. En cas de litige, tu peux recourir
            gratuitement à un médiateur de la consommation ou à la plateforme européenne de règlement en ligne des
            litiges. Contact : <b>cypriendumez@outlook.fr</b>.</p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-lg font-bold text-zinc-900">{title}</h2>
      <div className="space-y-2 text-zinc-700">{children}</div>
    </section>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-zinc-700">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}
