"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section, SectionHeading } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";

const FREE = ["Dashboard basique", "5 séances IA / mois", "Hub courses France (lecture)", "Mode Ludique", "1 parcours Trail Builder"];
const PRO = [
  "Tout le gratuit", "Plans IA illimités", "Trail Builder complet + Mapbox",
  "Analyse biomécanique avancée", "Sync Garmin / Coros / Strava", "Guardian Mode",
  "Shopping Hub + Score Bio-Compat", "Ligues & Gamification", "Nutrition Lab",
  "Coaching IA", "Ghost Runner", "Smart Journaling",
];
const ELITE = [
  "Tout le Pro", "Posture Lab (IA Vision caméra)", "IA Tapering avancé (TSB +15)",
  "API Access (Terra / Webhooks)", "Dashboard équipe", "Rapport mensuel PDF",
  "Support prioritaire", "Intégration Google Agenda", "Life Stress Sync",
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(plan: "monthly" | "yearly") {
    setLoading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else toast.error("Erreur lors de la création du paiement");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const yearlyDiscount = Math.round((1 - 80 / (10 * 12)) * 100);

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <SiteHeader />

      <Section>
        <Container>
          <SectionHeading
            eyebrow="Tarification"
            title="Simple et transparent"
            subtitle="Commence gratuitement. Passe au Pro quand tu es prêt à performer. Sans engagement, annulable à tout moment."
          />

          {/* Toggle facturation */}
          <div className="mx-auto mt-8 flex w-fit items-center gap-1 rounded-full bg-zinc-100 p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${billing === "yearly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              Annuel
              <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-bold text-[#047857]">−{yearlyDiscount}%</span>
            </button>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {/* Gratuit */}
            <div className="flex flex-col rounded-3xl bg-white p-8 ring-1 ring-inset ring-zinc-200">
              <div className="text-sm font-semibold text-zinc-400">Gratuit</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">0€</span>
                <span className="text-sm text-zinc-400">pour toujours</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {FREE.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#059669]" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={btnClass("primary", "md", "mt-8 w-full")}>Commencer gratuitement</Link>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-3xl bg-zinc-950 p-8 text-white ring-2 ring-[#059669]">
              <span className="absolute -top-3 left-8 rounded-full bg-[#10b981] px-3 py-1 text-[11px] font-bold text-[#04120c]">Populaire</span>
              <div className="text-sm font-semibold text-white/50">Pro</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{billing === "monthly" ? "10€" : "6,67€"}</span>
                <span className="text-sm text-white/40">/mois</span>
              </div>
              {billing === "yearly" && <p className="mt-1 text-xs text-white/40">facturé 80€ par an</p>}
              <ul className="mt-7 flex-1 space-y-3">
                {PRO.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/75">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#34d399]" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => subscribe(billing)} disabled={loading !== null} className={btnClass("secondary", "md", "mt-8 w-full")}>
                {loading === billing && <Loader2 className="h-4 w-4 animate-spin" />}
                {billing === "monthly" ? "Essai 30 jours gratuit" : "S'abonner (80€/an)"}
              </button>
            </div>

            {/* Elite */}
            <div className="flex flex-col rounded-3xl bg-white p-8 ring-1 ring-inset ring-zinc-200">
              <div className="text-sm font-semibold text-zinc-400">Elite</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">Sur mesure</span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">Clubs &amp; athlètes pro</p>
              <ul className="mt-7 flex-1 space-y-3">
                {ELITE.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#059669]" /> {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:cypriendumez@outlook.fr?subject=Pacevo%20Elite" className={btnClass("secondary", "md", "mt-8 w-full")}>Nous contacter</a>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-zinc-400">
            Paiement sécurisé par Stripe · Données hébergées en Europe · Conforme RGPD
          </p>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
