"use client";

/**
 * SECTION « LISTE D'ATTENTE » (avant-lancement) de la landing.
 *
 * Elle NE réinvente rien : elle habille le formulaire de capture existant
 * (`NewsletterSignup`, qui poste déjà vers /api/newsletter/subscribe, stocke l'e-mail et
 * envoie l'accusé) d'un message de lancement + l'offre fondateur. But : bâtir une audience
 * AVANT le lancement, sans société ni paiement — on ne collecte que des e-mails.
 *
 * Les chiffres de l'offre viennent de `OFFRE_FONDATEUR` (source unique) et sont injectés
 * dans les textes traduits : jamais recopiés en dur.
 */
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { WAITLIST_I18N } from "@/components/landing/waitlistI18n";
import { OFFRE_FONDATEUR } from "@/lib/brand/waitlist";
import { NewsletterSignup } from "@/components/NewsletterSignup";

export function WaitlistSection() {
  const { lang } = useT();
  const L = WAITLIST_I18N[lang] ?? WAITLIST_I18N.fr;
  const injecte = (s: string) =>
    s.replace(/\{places\}/g, String(OFFRE_FONDATEUR.places)).replace(/\{remise\}/g, String(OFFRE_FONDATEUR.remisePct));

  return (
    // Fond VERT DE MARQUE (émeraude), pas noir : le fond sombre générique faisait « template
    // IA ». Le vert relie la section au hero (piste + pelouse) et au bouton de l'app.
    <section id="liste-attente" className="relative overflow-hidden bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 py-20 text-white sm:py-24 scroll-mt-16">
      {/* Deux lueurs douces + un voile de grain : de la profondeur, pour ne pas faire aplat. */}
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />

      <div className="relative mx-auto max-w-xl px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">{L.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{L.title}</h2>
        <p className="mt-4 text-emerald-50/90">{L.subtitle}</p>

        {/* Le formulaire dans un PANNEAU BLANC net posé sur le vert : lisible, « produit »,
            à l'opposé de la carte sombre translucide qu'on avait. */}
        <div className="mx-auto mt-8 max-w-md rounded-3xl bg-white p-6 text-left shadow-2xl shadow-emerald-900/30 sm:p-7">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
            {injecte(L.offer)}
          </div>

          <div className="mt-5">
            <NewsletterSignup variant="light" />
            <p className="mt-2.5 text-center text-xs text-zinc-400">{L.note}</p>
          </div>

          <ul className="mt-5 flex flex-col gap-2.5 border-t border-zinc-100 pt-5 text-sm text-zinc-600">
            {[L.b1, L.b2, L.b3].map((b, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-3 w-3 text-emerald-700" />
                </span>
                {injecte(b)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
