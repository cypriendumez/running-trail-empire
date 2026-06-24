"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section, SectionHeading } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PRICING } from "./pricingI18n";

export default function PricingPage() {
  const { lang } = useT();
  const P = PRICING[lang] ?? PRICING.fr;
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
          <SectionHeading eyebrow={P.eyebrow} title={P.title} subtitle={P.subtitle} />

          {/* Toggle facturation */}
          <div className="mx-auto mt-8 flex w-fit items-center gap-1 rounded-full bg-zinc-100 p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              {P.monthly}
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${billing === "yearly" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              {P.yearly}
              <span className="rounded-full bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-bold text-[#047857]">−{yearlyDiscount}%</span>
            </button>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {/* Gratuit */}
            <div className="flex flex-col rounded-3xl bg-white p-8 ring-1 ring-inset ring-zinc-200">
              <div className="text-sm font-semibold text-zinc-400">{P.free.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">0€</span>
                <span className="text-sm text-zinc-400">{P.forever}</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {P.free.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#059669]" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={btnClass("primary", "md", "mt-8 w-full")}>{P.free.cta}</Link>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col rounded-3xl bg-zinc-950 p-8 text-white ring-2 ring-[#059669]">
              <span className="absolute -top-3 left-8 rounded-full bg-[#10b981] px-3 py-1 text-[11px] font-bold text-[#04120c]">{P.pro.badge}</span>
              <div className="text-sm font-semibold text-white/50">{P.pro.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{billing === "monthly" ? "10€" : "6,67€"}</span>
                <span className="text-sm text-white/40">{P.perMonth}</span>
              </div>
              {billing === "yearly" && <p className="mt-1 text-xs text-white/40">{P.billedYearly}</p>}
              <ul className="mt-7 flex-1 space-y-3">
                {P.pro.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/75">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#34d399]" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => subscribe(billing)} disabled={loading !== null} className={btnClass("secondary", "md", "mt-8 w-full")}>
                {loading === billing && <Loader2 className="h-4 w-4 animate-spin" />}
                {billing === "monthly" ? P.pro.ctaTrial : P.pro.ctaYearly}
              </button>
            </div>

            {/* Elite */}
            <div className="flex flex-col rounded-3xl bg-white p-8 ring-1 ring-inset ring-zinc-200">
              <div className="text-sm font-semibold text-zinc-400">{P.elite.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{P.custom}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">{P.eliteSub}</p>
              <ul className="mt-7 flex-1 space-y-3">
                {P.elite.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                    <Check className="h-4 w-4 flex-shrink-0 text-[#059669]" /> {f}
                  </li>
                ))}
              </ul>
              <a href="mailto:cypriendumez@outlook.fr?subject=Pacevo%20Elite" className={btnClass("secondary", "md", "mt-8 w-full")}>{P.elite.cta}</a>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-zinc-400">{P.securedNote}</p>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
