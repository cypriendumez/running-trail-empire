import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | Pacevo",
  description: "Une question, un bug, une suggestion ? Contacte l'équipe de Pacevo.",
};

// Page PUBLIQUE (sans connexion). Coordonnées identiques aux mentions légales / RGPD.
export default function ContactPage() {
  const EMAIL = "cypriendumez@outlook.fr";
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-zinc-800">
      <a href="/" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">← Retour</a>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">Contact</h1>
      <p className="mt-2 text-sm text-zinc-500">On répond généralement sous 48 h ouvrées.</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <p>
          Une question sur ton entraînement, un bug à signaler, une idée de fonctionnalité, une demande presse
          ou un partenariat ? Écris-nous, on lit tout.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">E-mail</p>
            <a href={`mailto:${EMAIL}`} className="mt-1 block font-semibold text-zinc-900 hover:text-emerald-600 break-all">{EMAIL}</a>
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent("Contact — Pacevo")}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
            >
              Écrire un e-mail →
            </a>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Éditeur</p>
            <p className="mt-1 font-semibold text-zinc-900">Cyprien Dumez</p>
            <p className="mt-1 text-sm text-zinc-500">28 avenue Pasteur<br />59130 Lambersart, France</p>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-5">
          <p className="text-sm text-zinc-600">
            Pour les questions de données personnelles (accès, rectification, suppression),
            consulte notre{" "}
            <a href="/confidentialite" className="font-semibold text-emerald-600 hover:text-emerald-700">politique de confidentialité</a>.
            Pour les informations légales, vois les{" "}
            <a href="/mentions-legales" className="font-semibold text-emerald-600 hover:text-emerald-700">mentions légales</a>.
          </p>
        </div>
      </div>
    </main>
  );
}
