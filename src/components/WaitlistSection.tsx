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
    <section id="liste-attente" className="relative overflow-hidden bg-zinc-950 py-20 text-white sm:py-24 scroll-mt-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.18),transparent)]" />
      <div className="relative mx-auto max-w-2xl px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">{L.eyebrow}</p>
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{L.title}</h2>
        <p className="mt-4 text-zinc-300">{L.subtitle}</p>

        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {injecte(L.offer)}
        </div>

        <div className="mx-auto mt-8 max-w-md">
          <NewsletterSignup variant="dark" />
          <p className="mt-3 text-xs text-zinc-500">{L.note}</p>
        </div>

        <ul className="mx-auto mt-8 flex max-w-md flex-col gap-2 text-left text-sm text-zinc-300">
          {[L.b1, L.b2, L.b3].map((b, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {injecte(b)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
