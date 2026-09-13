"use client";

import { useState , useId } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";

export default function ForgotPasswordPage() {
  // Chaque libellé est relié à son champ : sans cela, un lecteur d'écran annonce
  // le placeholder — ou rien — à la place du texte affiché.
  const cid = useId();
  const { t, lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).forgot;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // ⚠️ PAR NOTRE ROUTE, PAS `supabase.auth.resetPasswordForEmail()`. Ce dernier envoie le
    // gabarit anglais sans logo du tableau de bord Supabase — tombé dans les indésirables le
    // 13/09/2026. Notre route génère un lien `recovery` et expédie NOTRE e-mail (logo,
    // français, expéditeur unique). Elle répond toujours « ok » : on ne dit pas si l'adresse
    // a un compte (anti-annuaire), donc l'écran de confirmation s'affiche dans tous les cas.
    await fetch("/api/auth/reset", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), lang }),
    }).catch(() => null);
    setLoading(false);
    setSent(true);
  }

  const [sentPre, sentPost] = L.sent.split("{email}");

  return (
    <AuthShell>
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <Logo size={40} />
            <Wordmark className="text-xl" />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">{L.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">{L.subtitle}</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <MailCheck className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-700">{sentPre}<b>{email}</b>{sentPost}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={`${cid}-c0`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.email}</label>
              <input id={`${cid}-c0`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("auth.emailPh")}
                required
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           placeholder:text-zinc-400 transition-shadow"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-brand w-full justify-center py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {L.submit}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500 mt-6">
          <Link href="/login" className="inline-flex items-center gap-1 text-emerald-600 font-medium hover:text-emerald-700">
            <ArrowLeft className="w-3.5 h-3.5" /> {L.back}
          </Link>
        </p>
    </AuthShell>
  );
}
