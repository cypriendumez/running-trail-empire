"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";
import { cheminSur } from "@/lib/social/amisLiens";
import { deconnexion } from "@/lib/auth/deconnexion";

/**
 * L'ACCORD AUX DONNÉES DE SANTÉ, POUR TOUT COMPTE QUI N'EN A PAS D'ENREGISTRÉ.
 *
 * On y arrive après « Continuer avec Google » depuis la CONNEXION (un compte neuf, qui n'a
 * jamais vu la case de l'inscription), et pour les comptes créés avant le 11/10/2026, date
 * à laquelle l'accord a commencé à être conservé. Voir `lib/auth/consentement`.
 *
 * Même phrase que la case de l'inscription, jamais pré-cochée : un accord explicite est un
 * geste. Refuser = se déconnecter — sans cet accord, il n'y a pas de coaching possible.
 */
export default function ConsentementPage() {
  const cid = useId();
  const router = useRouter();
  const { lang } = useT();
  const D = AUTH[lang] ?? AUTH.fr;
  const L = D.consentement;
  const S = D.signup;
  const [accord, setAccord] = useState(false);
  const [loading, setLoading] = useState(false);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!accord) return;
    setLoading(true);
    const r = await fetch("/api/auth/consentement", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accord: true }),
    }).catch(() => null);
    if (r?.status === 401) { router.push("/login"); return; }
    if (!r?.ok) { setLoading(false); toast.error(L.erreur); return; }
    // `?next=` : un chemin SUR le site (jamais une adresse externe).
    router.push(cheminSur(new URLSearchParams(window.location.search).get("next")));
    router.refresh();
  }

  async function refuser() {
    await deconnexion();
    router.push("/");
  }

  return (
    <AuthShell>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2.5 mb-6">
          <Logo size={40} />
          <Wordmark className="text-xl" />
        </div>
        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">{L.title}</h1>
        <p className="text-zinc-600 text-sm mt-3 leading-relaxed">{L.intro}</p>
      </div>

      <form onSubmit={valider} className="space-y-5">
        <label htmlFor={`${cid}-accord`} className="flex items-start gap-2.5 text-sm text-zinc-700">
          <input id={`${cid}-accord`} type="checkbox" required checked={accord} onChange={(e) => setAccord(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
          <span>
            {S.consentPre}
            <Link href="/terms" className="text-emerald-700 hover:underline">{S.cgu}</Link>
            {S.consentMid}
            <Link href="/confidentialite" className="text-emerald-700 hover:underline">{S.privacy}</Link>
            {S.consentPost}
          </span>
        </label>
        <button type="submit" disabled={!accord || loading} className="btn-brand w-full justify-center py-3 disabled:opacity-60">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {L.submit}
        </button>
      </form>

      <p className="text-center mt-6">
        <button type="button" onClick={refuser} className="text-sm text-zinc-600 hover:text-zinc-900 underline underline-offset-2">
          {L.logout}
        </button>
      </p>
    </AuthShell>
  );
}
