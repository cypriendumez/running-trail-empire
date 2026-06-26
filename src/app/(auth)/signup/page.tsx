"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";

export default function SignupPage() {
  const { lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).signup;
  const [step, setStep] = useState<"account" | "verify">("account");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error(L.pwMismatch); return; }
    if (form.password.length < 8) { toast.error(L.pwShort); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setStep("verify");
  }

  async function resendConfirmation() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: form.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding` },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(L.resent);
  }

  if (step === "verify") {
    const [pre, post] = L.verifyText.split("{email}");
    return (
      <AuthShell>
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-3">{L.verifyTitle}</h1>
          <p className="text-zinc-500 mb-8">
            {pre}<strong className="text-zinc-900">{form.email}</strong>{post}
          </p>
          <Link href="/login" className="btn-brand justify-center inline-flex w-full">
            {L.goLogin}
          </Link>
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={loading}
            className="mt-4 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {L.resend}
          </button>
        </div>
      </AuthShell>
    );
  }

  const passwordStrength = getPasswordStrength(form.password);
  const inputCls = "w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-zinc-400";

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{L.name}</label>
            <input type="text" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder={L.namePh} required className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{L.email}</label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="marie@exemple.com" required className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{L.password}</label>
            <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder={L.passwordPh} required className={inputCls} />
            {form.password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= passwordStrength
                        ? passwordStrength <= 1 ? "bg-red-400" : passwordStrength <= 2 ? "bg-orange-400" : passwordStrength <= 3 ? "bg-yellow-400" : "bg-emerald-500"
                        : "bg-zinc-200"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700 block mb-1.5">{L.confirm}</label>
            <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder={L.confirmPh} required className={inputCls} />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-zinc-500">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
            <span>
              {L.consentPre}
              <Link href="/terms" className="text-emerald-600 hover:underline">{L.cgu}</Link>
              {L.consentMid}
              <Link href="/confidentialite" className="text-emerald-600 hover:underline">{L.privacy}</Link>
              {L.consentPost}
            </span>
          </label>

          <button type="submit" disabled={loading} className="btn-brand w-full justify-center py-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {L.submit}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-5">
          {L.footPre}
          <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">{L.cgu}</Link>
          {L.footMid}
          <Link href="/confidentialite" className="text-zinc-600 hover:text-zinc-900">{L.privacy}</Link>
        </p>

        <p className="text-center text-sm text-zinc-500 mt-4">
          {L.haveAccount}{" "}
          <Link href="/login" className="text-emerald-600 font-medium hover:text-emerald-700">
            {L.login}
          </Link>
        </p>
    </AuthShell>
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
