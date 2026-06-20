"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    // Le lien de l'email passe par /auth/callback (échange du code → session) puis /reset-password.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  return (
    <AuthShell>
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="font-bold text-zinc-900">Running &amp; Trail Empire</span>
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Mot de passe oublié</h1>
          <p className="text-zinc-500 text-sm mt-1">On t&apos;envoie un lien pour le réinitialiser.</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
            <MailCheck className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-700">
              Si un compte existe pour <b>{email}</b>, un email de réinitialisation vient d&apos;être envoyé.
              Vérifie ta boîte de réception (et les indésirables).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                           placeholder:text-zinc-400 transition-shadow"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-brand w-full justify-center py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Envoyer le lien
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500 mt-6">
          <Link href="/login" className="inline-flex items-center gap-1 text-green-600 font-medium hover:text-green-700">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour à la connexion
          </Link>
        </p>
    </AuthShell>
  );
}
