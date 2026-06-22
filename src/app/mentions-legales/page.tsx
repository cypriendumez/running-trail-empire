import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales | Pacevo",
  description: "Mentions légales de Pacevo (éditeur, hébergeur, contact).",
};

// Page PUBLIQUE. ⚠️ Remplace les [À RENSEIGNER] par tes informations réelles avant publication
// (statut juridique + SIREN si tu es immatriculé, hébergeur réel de l'app).
export default function MentionsLegalesPage() {
  const MAJ = "10 juin 2026";
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-zinc-800">
      <a href="/" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">← Retour</a>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">Mentions légales</h1>
      <p className="mt-2 text-sm text-zinc-500">Dernière mise à jour : {MAJ}</p>

      <div className="mt-8 space-y-7 text-[15px] leading-relaxed">
        <Section title="1. Éditeur du site">
          <p>Le site et l&apos;application <b>Pacevo</b> sont édités par :</p>
          <Ul items={[
            "Cyprien Dumez",
            "Statut juridique : [À RENSEIGNER : particulier / micro-entrepreneur / société — et n° SIREN/SIRET si immatriculé]",
            "Adresse : 28 avenue Pasteur, 59130 Lambersart, France",
            "E-mail : cypriendumez@outlook.fr",
          ]} />
          <p className="mt-2 text-sm text-zinc-500">Numéro de TVA intracommunautaire : [À RENSEIGNER si assujetti].</p>
        </Section>

        <Section title="2. Directeur de la publication">
          <p>Cyprien Dumez.</p>
        </Section>

        <Section title="3. Hébergement">
          <p>L&apos;application est hébergée par :</p>
          <Ul items={[
            "Application : [À RENSEIGNER : hébergeur réel, ex. Railway Corporation, États-Unis, ou Vercel Inc.]",
            "Base de données : Supabase — hébergée dans l'Union européenne (Francfort, eu-central-1).",
          ]} />
        </Section>

        <Section title="4. Propriété intellectuelle">
          <p>Le nom, le logo, les textes, l&apos;interface et le code de Pacevo sont protégés.
            Toute reproduction non autorisée est interdite. Les marques, noms de produits et photos de produits
            tiers appartiennent à leurs propriétaires respectifs ; ils sont, le cas échéant, utilisés dans le
            cadre de programmes d&apos;affiliation officiels (citation nominative à des fins de comparaison).</p>
        </Section>

        <Section title="5. Liens d'affiliation">
          <p>Certains liens vers des marchands (chaussures, montres, vêtements…) sont des <b>liens d&apos;affiliation</b> :
            une commission peut être perçue en cas d&apos;achat, sans surcoût pour toi. Les prix affichés sont
            indicatifs et peuvent évoluer ; seul le prix sur le site marchand fait foi.</p>
        </Section>

        <Section title="6. Données personnelles">
          <p>Le traitement de tes données est décrit dans notre{" "}
            <a href="/confidentialite" className="font-semibold text-emerald-600 hover:text-emerald-700">politique de confidentialité</a>.</p>
        </Section>

        <Section title="7. Contact">
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
