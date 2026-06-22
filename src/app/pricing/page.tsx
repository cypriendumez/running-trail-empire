"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, Zap, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/Logo";

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
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Erreur lors de la création du paiement");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  const yearlyDiscount = Math.round((1 - 80 / (10 * 12)) * 100);

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
            <Logo size={36} />
          </Link>
          <h1 className="text-5xl font-bold text-zinc-900 mb-4">Tarification simple</h1>
          <p className="text-xl text-zinc-500">Sans engagement. Annulez quand vous voulez.</p>
          <div className="flex items-center justify-center gap-2 mt-6 p-1 bg-zinc-100 rounded-2xl w-fit mx-auto">
            <button onClick={() => setBilling("monthly")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${billing === "monthly" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}`}>
              Mensuel
            </button>
            <button onClick={() => setBilling("yearly")}
              className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${billing === "yearly" ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500"}`}>
              Annuel
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                -{yearlyDiscount}%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="bento-card flex flex-col">
            <div className="mb-6">
              <div className="w-10 h-10 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                <span className="text-lg">🌱</span>
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Gratuit</h2>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-zinc-900">0€</span>
                <span className="text-zinc-400">pour toujours</span>
              </div>
            </div>
            <ul className="flex-1 space-y-3 mb-8">
              {["Dashboard basique", "5 séances/mois", "Hub courses France (lecture)", "Mode Ludique", "1 parcours Trail Builder"].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-secondary justify-center">Commencer gratuitement</Link>
          </div>

          {/* Pro */}
          <div className="bento-card flex flex-col ring-2 ring-green-500 shadow-glow relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
              ⭐ POPULAIRE
            </div>
            <div className="mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Pro</h2>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-zinc-900">
                  {billing === "monthly" ? "10€" : "6.67€"}
                </span>
                <span className="text-zinc-400">/mois</span>
                {billing === "yearly" && (
                  <span className="text-sm text-zinc-400">· 80€/an</span>
                )}
              </div>
            </div>
            <ul className="flex-1 space-y-3 mb-8">
              {[
                "Tout le gratuit",
                "Plans IA illimités",
                "Trail Builder complet + Mapbox",
                "Analyse biomécanique avancée",
                "Sync Garmin / Coros / Strava",
                "Guardian Mode",
                "Shopping Hub + Score Bio-Compat",
                "Ligues & Gamification",
                "Nutrition Lab",
                "Coaching IA (ChatGPT-4o)",
                "Ghost Runner",
                "Smart Journaling",
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button onClick={() => subscribe(billing)} disabled={loading !== null}
              className="btn-brand justify-center py-3">
              {loading === billing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {billing === "monthly" ? "Essai 30 jours gratuits" : "S'abonner (80€/an)"}
            </button>
          </div>

          {/* Elite */}
          <div className="bento-card flex flex-col">
            <div className="mb-6">
              <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4">
                <Crown className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="text-xl font-bold text-zinc-900">Elite</h2>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-zinc-900">Sur mesure</span>
              </div>
              <p className="text-sm text-zinc-400 mt-1">Clubs & athlètes pro</p>
            </div>
            <ul className="flex-1 space-y-3 mb-8">
              {[
                "Tout Pro",
                "Posture Lab (IA Vision caméra)",
                "IA Tapering avancé (TSB +15)",
                "API Access (Terra / Webhooks)",
                "Dashboard équipe",
                "Rapport mensuel PDF",
                "Support prioritaire",
                "Intégration Google Agenda",
                "Life Stress Sync",
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-600">
                  <Sparkles className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <a href="mailto:contact@running-trail-empire.com" className="btn-secondary justify-center">
              Nous contacter
            </a>
          </div>
        </div>

        <p className="text-center text-sm text-zinc-400 mt-8">
          Paiement sécurisé par Stripe · Données hébergées en Europe · RGPD conforme
        </p>
      </div>
    </div>
  );
}
