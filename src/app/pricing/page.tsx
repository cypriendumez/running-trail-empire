"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE TARIFS — elle partage DÉSORMAIS le dictionnaire de la page d'accueil.
//
//  Elle avait le sien (`pricingI18n.ts`), et les deux avaient divergé au point de
//  ne plus vendre le même produit : trois paliers ici contre trois autres là, et
//  une liste de fonctionnalités qui n'existent pour la plupart nulle part —
//  « Guardian Mode », « Nutrition Lab », « Posture Lab (IA Vision caméra) »,
//  « API Access (Terra / Webhooks) », « Dashboard équipe », « Life Stress Sync »,
//  « Score Bio-Compat ». Deux vitrines pour un seul produit, c'est deux fois plus
//  d'occasions de promettre ce qu'on n'a pas.
//
//  Un seul dictionnaire, donc : celui de la landing. Changer un prix ou une
//  fonctionnalité à un endroit les change aux deux.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section, SectionHeading } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { LANDING } from "@/components/landing/landingI18n";

/** En CENTIMES, identiques à `TARIFS` (lib/stripe/client.ts) — un test l'exige.
 *  Ce module ne peut pas être importé ici : il tire le SDK Stripe et la clé secrète. */
const PRIX = {
  essentiel: { mois: 999, an: 9990 },
  complet: { mois: 1999, an: 19990 },
} as const;

const euros = (centimes: number, lang: string) =>
  (centimes / 100).toLocaleString(lang, { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export default function PricingPage() {
  const { lang } = useT();
  const P = (LANDING[lang] ?? LANDING.fr).pricing;
  const [periode, setPeriode] = useState<"mois" | "an">("mois");
  const [loading, setLoading] = useState<string | null>(null);

  async function souscrire(formule: "essentiel" | "complet") {
    setLoading(formule);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Une périodicité seule ne désigne plus un tarif : il y a deux formules.
        body: JSON.stringify({ formule, periode }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      // Le message du serveur est affiché TEL QUEL : c'est lui qui sait pourquoi
      // ça a échoué — paiement pas encore ouvert, session expirée, tarif inconnu.
      else toast.error(data.error || "Erreur lors de la création du paiement");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <SiteHeader />

      <Section>
        <Container>
          <SectionHeading eyebrow={P.eyebrow} title={P.title} subtitle={P.subtitle} />

          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-1">
              {(["mois", "an"] as const).map((p) => (
                <button key={p} onClick={() => setPeriode(p)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    periode === p ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
                  {p === "mois" ? P.mois : P.an}
                  {p === "an" && <span className={`ml-2 text-[11px] font-bold ${periode === "an" ? "text-[#34d399]" : "text-[#059669]"}`}>{P.economie}</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-zinc-500">{P.essai}</p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-6 md:grid-cols-2">
            {P.plans.map((plan) => {
              const centimes = PRIX[plan.cle][periode];
              const grand = periode === "an" ? Math.round(centimes / 12) : centimes;
              const vedette = plan.cle === "complet";
              return (
                <div key={plan.cle}
                  className={`relative flex flex-col rounded-3xl p-8 ${vedette ? "bg-zinc-950 text-white ring-2 ring-[#059669]" : "bg-white ring-1 ring-inset ring-zinc-200"}`}>
                  {plan.badge && (
                    <span className="absolute -top-3 left-8 rounded-full bg-[#10b981] px-3 py-1 text-[11px] font-bold text-[#04120c]">
                      {plan.badge}
                    </span>
                  )}
                  <div className={`text-sm font-semibold ${vedette ? "text-white/50" : "text-zinc-400"}`}>{plan.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{euros(grand, lang)}</span>
                    <span className={`text-sm ${vedette ? "text-white/40" : "text-zinc-400"}`}>{P.parMois}</span>
                  </div>
                  <div className={`mt-1 h-5 text-xs ${vedette ? "text-white/40" : "text-zinc-400"}`}>
                    {periode === "an" ? `${euros(centimes, lang)} / ${P.an.toLowerCase()}` : ""}
                  </div>
                  <p className={`mt-4 text-sm ${vedette ? "text-white/70" : "text-zinc-500"}`}>{plan.pitch}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-sm ${vedette ? "text-white/75" : "text-zinc-600"}`}>
                        <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${vedette ? "text-[#34d399]" : "text-[#059669]"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => souscrire(plan.cle)} disabled={loading !== null}
                    className={btnClass(vedette ? "secondary" : "primary", "md", "mt-8 w-full disabled:opacity-60")}>
                    {loading === plan.cle ? <Loader2 className="h-4 w-4 animate-spin" /> : plan.cta}
                  </button>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-zinc-500">{P.apres}</p>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
