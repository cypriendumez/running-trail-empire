"use client";

import { useState } from "react";
import { Laptop, Loader2, Check, ShieldAlert } from "lucide-react";

/**
 * L'ÉCRAN QUI RÉCLAME LE CODE D'APPAREIL.
 *
 * ⚠️ Il ne s'affiche que si le serveur a REFUSÉ l'appareil courant. Tant que la protection
 * n'est pas configurée, un simple bandeau prévient sans jamais bloquer : enfermer
 * l'éditeur dehors de son propre espace serait pire que le risque qu'on écarte.
 */
export function AppareilGate({ configure, reconnu, motif }: { configure: boolean; reconnu: boolean; motif?: string }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function autoriser() {
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/appareil", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !j.ok) { setErr((j.erreurs ?? ["Code refusé."])[0]); return; }
    window.location.reload();
  }

  if (configure && !reconnu) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <Laptop className="h-8 w-8 text-zinc-900" />
          <h1 className="mt-4 text-lg font-bold text-zinc-900">Cet appareil n&apos;est pas reconnu</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {motif ? `${motif} ` : ""}Ton mot de passe ne suffit pas à ouvrir l&apos;espace coach : il donne accès aux
            factures de tes clients et à ton chiffre d&apos;affaires. Saisis le code d&apos;autorisation pour rendre
            cette machine de confiance.
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value)} type="password" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void autoriser(); }}
            placeholder="Code d'autorisation"
            className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm" />
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          <button onClick={() => void autoriser()} disabled={busy || !code}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Autoriser cet appareil
          </button>
          <p className="mt-3 text-xs text-zinc-400">
            Chaque tentative, réussie ou non, est enregistrée avec son adresse et son appareil.
          </p>
        </div>
      </div>
    );
  }

  if (!configure) {
    return (
      <div className="mx-8 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <b>Ton espace coach n&apos;est protégé que par un mot de passe.</b> Il ouvre les factures de tes clients et
          ton chiffre d&apos;affaires depuis n&apos;importe quelle machine où ta session est ouverte. Pose
          <code className="mx-1 rounded bg-amber-100 px-1">ADMIN_DEVICE_SECRET</code> et
          <code className="mx-1 rounded bg-amber-100 px-1">ADMIN_DEVICE_CODE</code> sur l&apos;hébergement pour
          n&apos;autoriser que tes appareils.
        </span>
      </div>
    );
  }

  return null;
}
