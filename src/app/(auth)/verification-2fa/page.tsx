"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";
import { createClient } from "@/lib/supabase/client";
import { cheminSur } from "@/lib/social/amisLiens";
import { deconnexion } from "@/lib/auth/deconnexion";

/**
 * LE SECOND FACTEUR (08/11/2026) — après le mot de passe, Google ou un lien e-mail, un compte qui
 * a activé la double authentification donne ici son code à 6 chiffres. La session passe de `aal1`
 * à `aal2` (`mfa.challengeAndVerify`) ; tant que ce n'est pas fait, le serveur la traite comme
 * déconnectée (`lib/supabase/server`), et les pages renvoient vers `/login`, qui renvoie ici.
 *
 * « J'ai perdu mon téléphone » envoie un lien à l'adresse du compte (`/api/auth/2fa/perdu`) :
 * choix de Cyprien, voir `lib/auth/deuxFacteurs`.
 */
export default function VerificationDeuxFacteurs() {
  const cid = useId();
  const router = useRouter();
  const { lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).deuxFacteurs;
  const [facteur, setFacteur] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [perdu, setPerdu] = useState<"repos" | "encours" | "envoye">("repos");
  const suite = () => cheminSur(new URLSearchParams(window.location.search).get("next"));

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: niveau, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      // Panne passagère : on le DIT, sans renvoyer en silence vers la connexion (relecture du 08/11).
      if (error) { toast.error(L.erreur, { duration: 8000 }); return; }
      if (!niveau) { router.replace("/login"); return; }
      // Rien à demander (pas de second facteur, ou déjà donné) : on continue.
      if (niveau.currentLevel === "aal2" || niveau.nextLevel !== "aal2") { router.replace(suite()); return; }
      const { data, error: eFacteurs } = await supabase.auth.mfa.listFactors();
      if (eFacteurs) { toast.error(L.erreur, { duration: 8000 }); return; }
      const totp = data?.totp?.[0];
      if (!totp) { router.replace("/login"); return; }
      setFacteur(totp.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!facteur || !/^\d{6}$/.test(code)) { toast.error(L.codeFaux); return; }
    setLoading(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: facteur, code });
    if (error) { setLoading(false); setCode(""); toast.error(L.codeFaux); return; }
    router.replace(suite());
    router.refresh();
  }

  async function telephonePerdu() {
    setPerdu("encours");
    const r = await fetch("/api/auth/2fa/perdu", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j?.ok) { setPerdu("envoye"); return; }
    setPerdu("repos");
    toast.error(r?.status === 429 ? L.perduTrop : L.erreur, { duration: 8000 });
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
        <h1 className="text-2xl font-semibold text-zinc-900">{L.vTitre}</h1>
        <p className="text-zinc-600 text-sm mt-3 leading-relaxed">{L.vSousTitre}</p>
      </div>

      <form onSubmit={valider} className="space-y-4">
        <label htmlFor={`${cid}-code`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.code}</label>
        <input id={`${cid}-code`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus
          className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-center text-2xl tracking-[0.4em] font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
        <button type="submit" disabled={loading || !facteur} className="btn-brand w-full justify-center py-3">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {L.vValider}
        </button>
      </form>

      <div className="mt-6 space-y-3 text-center text-sm">
        {perdu === "envoye" ? (
          <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">{L.perduEnvoye}</p>
        ) : (
          <button type="button" onClick={telephonePerdu} disabled={perdu === "encours" || !facteur}
            className="inline-flex items-center gap-2 font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-60">
            {perdu === "encours" && <Loader2 className="w-4 h-4 animate-spin" />}
            {L.perdu}
          </button>
        )}
        <div>
          <button type="button" onClick={async () => { await deconnexion(); router.push("/login"); }} className="text-zinc-600 hover:text-zinc-900">
            {L.deconnexion}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
