import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPublicLang } from "@/lib/i18n/serverLang";
import type { Lang } from "@/lib/i18n/translations";

export const metadata: Metadata = {
  title: "Contact | Pacevo",
  description: "Une question, un bug, une suggestion ? Contacte l'équipe de Pacevo.",
};

const C: Record<Lang, { title: string; sla: string; intro: string; email: string; write: string; editor: string; rgpdA: string; privacy: string; rgpdB: string; legal: string; rgpdC: string }> = {
  fr: { title: "Contact", sla: "On répond généralement sous 48 h ouvrées.", intro: "Une question sur ton entraînement, un bug à signaler, une idée de fonctionnalité, une demande presse ou un partenariat ? Écris-nous, on lit tout.", email: "E-mail", write: "Écrire un e-mail →", editor: "Éditeur", rgpdA: "Pour les questions de données personnelles (accès, rectification, suppression), consulte notre ", privacy: "politique de confidentialité", rgpdB: ". Pour les informations légales, vois les ", legal: "mentions légales", rgpdC: "." },
  en: { title: "Contact", sla: "We usually reply within 48 business hours.", intro: "A question about your training, a bug to report, a feature idea, a press or partnership request? Write to us — we read everything.", email: "Email", write: "Send an email →", editor: "Publisher", rgpdA: "For personal-data requests (access, rectification, deletion), see our ", privacy: "privacy policy", rgpdB: ". For legal information, see the ", legal: "legal notice", rgpdC: "." },
  de: { title: "Kontakt", sla: "Wir antworten in der Regel innerhalb von 48 Geschäftsstunden.", intro: "Eine Frage zu deinem Training, ein Bug, eine Funktionsidee, eine Presse- oder Partneranfrage? Schreib uns — wir lesen alles.", email: "E-Mail", write: "E-Mail schreiben →", editor: "Anbieter", rgpdA: "Für Anfragen zu personenbezogenen Daten (Auskunft, Berichtigung, Löschung) siehe unsere ", privacy: "Datenschutzerklärung", rgpdB: ". Für rechtliche Informationen siehe das ", legal: "Impressum", rgpdC: "." },
  es: { title: "Contacto", sla: "Solemos responder en 48 h hábiles.", intro: "¿Una duda sobre tu entrenamiento, un fallo que reportar, una idea de función, una petición de prensa o colaboración? Escríbenos, lo leemos todo.", email: "Correo", write: "Enviar un correo →", editor: "Editor", rgpdA: "Para cuestiones de datos personales (acceso, rectificación, supresión), consulta nuestra ", privacy: "política de privacidad", rgpdB: ". Para información legal, consulta el ", legal: "aviso legal", rgpdC: "." },
  pt: { title: "Contacto", sla: "Respondemos normalmente em 48 h úteis.", intro: "Uma dúvida sobre o teu treino, um bug para reportar, uma ideia de funcionalidade, um pedido de imprensa ou parceria? Escreve-nos — lemos tudo.", email: "E-mail", write: "Enviar um e-mail →", editor: "Editor", rgpdA: "Para questões de dados pessoais (acesso, retificação, eliminação), consulta a nossa ", privacy: "política de privacidade", rgpdB: ". Para informações legais, vê o ", legal: "aviso legal", rgpdC: "." },
};

// Page PUBLIQUE (sans connexion). Coordonnées identiques aux mentions légales / RGPD.
export default async function ContactPage() {
  const EMAIL = "cypriendumez@outlook.fr";
  const lang = await getPublicLang();
  const t = C[lang] ?? C.fr;
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-700">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{t.sla}</p>

        <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
          <p>{t.intro}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t.email}</p>
              <a href={`mailto:${EMAIL}`} className="mt-1 block font-semibold text-zinc-900 hover:text-emerald-600 break-all">{EMAIL}</a>
              <a
                href={`mailto:${EMAIL}?subject=${encodeURIComponent("Contact — Pacevo")}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
              >
                {t.write}
              </a>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{t.editor}</p>
              <p className="mt-1 font-semibold text-zinc-900">Cyprien Dumez</p>
              <p className="mt-1 text-sm text-zinc-500">28 avenue Pasteur<br />59130 Lambersart, France</p>
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-50 border border-zinc-200 p-5">
            <p className="text-sm text-zinc-600">
              {t.rgpdA}
              <a href="/confidentialite" className="font-semibold text-emerald-600 hover:text-emerald-700">{t.privacy}</a>
              {t.rgpdB}
              <a href="/mentions-legales" className="font-semibold text-emerald-600 hover:text-emerald-700">{t.legal}</a>
              {t.rgpdC}
            </p>
          </div>
        </div>
      </main>
      <SiteFooter newsletter={false} />
    </div>
  );
}
