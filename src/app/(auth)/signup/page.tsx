"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<"account" | "verify">("account");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setStep("verify");
  }

  if (step === "verify") {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-3">Vérifiez votre email</h1>
          <p className="text-zinc-500 mb-8">
            Nous avons envoyé un lien de confirmation à{" "}
            <strong className="text-zinc-900">{form.email}</strong>
          </p>
          <Link href="/login" className="btn-brand justify-center inline-flex">
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-10 h-10 bg-zinc-900 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <span className="font-bold text-zinc-900">Running & Trail Empire</span>
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">Créer un compte</h1>
          <p className="text-zinc-500 text-sm mt-1">30 jours gratuits · Pas de carte bancaire</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">Prénom & Nom</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => update("fullName", e.target.value)}
              placeholder="Marie Dupont"
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                         placeholder:text-zinc-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="marie@exemple.com"
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                         placeholder:text-zinc-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="Minimum 8 caractères"
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                         placeholder:text-zinc-400"
            />
            {form.password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= passwordStrength
                        ? passwordStrength <= 1
                          ? "bg-red-400"
                          : passwordStrength <= 2
                          ? "bg-orange-400"
                          : passwordStrength <= 3
                          ? "bg-yellow-400"
                          : "bg-green-500"
                        : "bg-zinc-200"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              placeholder="Répétez le mot de passe"
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
                         placeholder:text-zinc-400"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-brand w-full justify-center py-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Créer mon compte
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-5">
          En créant un compte vous acceptez nos{" "}
          <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">CGU</Link>
          {" "}et notre{" "}
          <Link href="/privacy" className="text-zinc-600 hover:text-zinc-900">Politique de confidentialité</Link>
        </p>

        <p className="text-center text-sm text-zinc-500 mt-4">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-green-600 font-medium hover:text-green-700">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}
