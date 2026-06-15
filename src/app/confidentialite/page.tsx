import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité | Running & Trail Empire",
  description: "Comment Running & Trail Empire collecte, utilise et protège tes données personnelles (RGPD).",
};

// Page PUBLIQUE (sans connexion) — URL à fournir à Apple App Store / Google Play.
// ⚠️ Remplace les [À COMPLÉTER] par tes informations réelles avant publication.
export default function ConfidentialitePage() {
  const MAJ = "6 juin 2026";
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-zinc-800">
      <a href="/" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">← Retour</a>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">Politique de confidentialité</h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : {MAJ}</p>

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed">
        <section>
          <p>
            La présente politique explique quelles données personnelles <b>Running &amp; Trail Empire</b>
            {" "}(« l&apos;Application ») collecte, pourquoi, et quels sont tes droits. Elle est conforme au
            Règlement Général sur la Protection des Données (RGPD).
          </p>
        </section>

        <Section title="1. Responsable du traitement">
          <p><b>Cyprien Dumez</b>, contact : <b>cypriendumez@outlook.fr</b>
            {" "}— adresse : 28 avenue Pasteur, 59130 Lambersart, France.</p>
        </Section>

        <Section title="2. Données que nous collectons">
          <Ul items={[
            "Compte : nom, e-mail, âge, sexe, poids, taille (profil sportif).",
            "Performance : VMA, fréquence cardiaque de repos/max, zones, allures de référence.",
            "Activités : distance, durée, allure, dénivelé, cadence, puissance, et — lors d'un enregistrement au téléphone — le TRACÉ GPS de ta course.",
            "Localisation (GPS) : pendant l'enregistrement d'une séance. Dans l'application mobile, la localisation peut être utilisée EN ARRIÈRE-PLAN (écran éteint) afin de continuer à enregistrer ta course — uniquement après ton consentement explicite.",
            "Bien-être / santé : variabilité de fréquence cardiaque (VFC), sommeil, fréquence cardiaque de repos, énergie corporelle (données issues de ta montre / des services connectés).",
            "Données issues de services connectés : si tu connectes intervals.icu (qui synchronise Garmin, Coros, Wahoo, Strava…), nous importons tes activités et données de bien-être.",
          ]} />
          <p className="mt-2 text-sm text-zinc-500">
            Les données de santé/fitness sont des <b>données sensibles</b> (art. 9 RGPD) : elles ne sont
            traitées qu&apos;avec ton <b>consentement explicite</b>.
          </p>
        </Section>

        <Section title="3. Pourquoi nous utilisons ces données (finalités)">
          <Ul items={[
            "Fournir le service de coaching : suivi des séances, calcul d'allures/zones, objectifs de course.",
            "Analyse par IA : générer des analyses de séances et des plans d'entraînement personnalisés.",
            "Enregistrer et afficher tes courses (distance, temps, allure, parcours).",
            "Fonctionnalités de club (ligues, badges, défis).",
            "Sécurité, prévention de la fraude et amélioration de l'application.",
          ]} />
        </Section>

        <Section title="4. Bases légales (RGPD)">
          <Ul items={[
            "Exécution du contrat : gestion de ton compte et des fonctionnalités d'entraînement.",
            "Consentement : géolocalisation (y compris en arrière-plan), traitement des données de santé, connexion de services tiers. Tu peux le retirer à tout moment.",
            "Intérêt légitime : sécurité et amélioration du service.",
          ]} />
        </Section>

        <Section title="5. Destinataires et sous-traitants">
          <p>Nous ne vendons jamais tes données. Elles peuvent être traitées par :</p>
          <Ul items={[
            "Supabase — hébergement de la base de données (Union européenne, Francfort).",
            "[À RENSEIGNER : hébergeur de l'application, ex. Railway / Vercel].",
            "Google (Gemini) et Anthropic (Claude) — analyses de séances et plans d'entraînement générés par intelligence artificielle (données d'entraînement transmises pour générer l'analyse).",
            "intervals.icu — synchronisation de tes activités et données de bien-être (si tu connectes ce service).",
            "Stripe — traitement des paiements d'abonnement.",
            "Resend — envoi des e-mails (réinitialisation de mot de passe, notifications).",
            "Ton coach : si tu es accompagné par un coach via l'application, il accède à tes données d'entraînement pour t'encadrer.",
          ]} />
        </Section>

        <Section title="6. Transferts hors Union européenne">
          <p>Tes données sont hébergées par <b>Supabase dans l&apos;Union européenne</b> (Central EU —
            Francfort, <i>eu-central-1</i>). Certains sous-traitants (ex. Google) peuvent traiter des données
            hors UE (ex. Google, Anthropic, Stripe) ; ces transferts sont encadrés par des garanties appropriées
            (clauses contractuelles types).</p>
        </Section>

        <Section title="7. Durée de conservation">
          <p>Tes données sont conservées tant que ton compte est actif. Après suppression du compte, elles sont
            effacées sous 30 jours (sauf obligation légale de conservation).</p>
        </Section>

        <Section title="8. Tes droits">
          <p>Tu disposes des droits d&apos;accès, de rectification, d&apos;effacement, de portabilité, de
            limitation et d&apos;opposition, ainsi que du droit de retirer ton consentement à tout moment.
            Pour les exercer : <b>cypriendumez@outlook.fr</b>. Tu peux aussi déposer une réclamation auprès de la
            CNIL (www.cnil.fr).</p>
          <p className="mt-2">La localisation peut être désactivée à tout moment dans les réglages de ton
            téléphone ; l&apos;enregistrement GPS s&apos;arrête alors.</p>
        </Section>

        <Section title="9. Sécurité">
          <p>Nous mettons en œuvre des mesures techniques et organisationnelles (chiffrement en transit,
            contrôle d&apos;accès) pour protéger tes données.</p>
        </Section>

        <Section title="10. Mineurs">
          <p>L&apos;application n&apos;est pas destinée aux personnes de moins de 15 ans sans le consentement
            d&apos;un titulaire de l&apos;autorité parentale.</p>
        </Section>

        <Section title="11. Cookies">
          <p>Nous utilisons uniquement les cookies strictement nécessaires au fonctionnement (session de
            connexion). Aucun cookie publicitaire de suivi.</p>
        </Section>

        <Section title="12. Contact">
          <p>Pour toute question : <b>cypriendumez@outlook.fr</b>.</p>
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
