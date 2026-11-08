"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ShieldOff } from "lucide-react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";

/**
 * RETRAIT DE LA DOUBLE AUTHENTIFICATION — on arrive ici par le lien de l'e-mail « J'ai perdu mon
 * téléphone » (`/auth/confirm?type=recovery&next=/verification-2fa/retrait`). Un clic, et la route
 * `/api/auth/2fa/retirer` vérifie que la session vient bien d'un lien e-mail récent avant de retirer
 * les facteurs. Rien n'est retiré à l'ouverture de la page : il faut le geste.
 */
export default function RetraitDeuxFacteurs() {
  const router = useRouter();
  const { lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).deuxFacteurs;
  const [etat, setEtat] = useState<"repos" | "encours" | "expire">("repos");

  async function retirer() {
    setEtat("encours");
    const r = await fetch("/api/auth/2fa/retirer", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j?.ok) {
      toast.success(L.rFait, { duration: 8000 });
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    // 401 (aucune session) ou 403 (session qui ne vient pas d'un lien récent) : le lien ne vaut plus.
    if (r?.status === 401 || r?.status === 403) { setEtat("expire"); return; }
    setEtat("repos");
    toast.error(L.erreur);
  }

  return (
    <AuthShell>
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2.5 mb-6">
          <Logo size={40} />
          <Wordmark className="text-xl" />
        </div>
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldOff className="w-6 h-6 text-amber-700" />
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">{L.rTitre}</h1>
        <p className="text-zinc-600 text-sm mt-3 leading-relaxed">{L.rTexte}</p>
      </div>
      {etat === "expire" ? (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-zinc-700">
          {L.rLienExpire}{" "}
          <Link href="/login" className="font-medium text-emerald-700 hover:text-emerald-900">{(AUTH[lang] ?? AUTH.fr).login.submit}</Link>
        </p>
      ) : (
        <button type="button" onClick={retirer} disabled={etat === "encours"} className="btn-brand w-full justify-center py-3">
          {etat === "encours" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {L.rBouton}
        </button>
      )}
    </AuthShell>
  );
}
