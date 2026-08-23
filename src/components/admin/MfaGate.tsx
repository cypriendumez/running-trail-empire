"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck, ShieldAlert, Loader2, Check, X } from "lucide-react";

/**
 * LE SECOND FACTEUR — configuration et déverrouillage.
 *
 * ⚠️ TANT QU'AUCUN FACTEUR N'EXISTE, ON INSISTE MAIS ON LAISSE PASSER. Exiger un code à
 * quelqu'un qui n'en a jamais configuré le mettrait dehors de son propre espace, sans
 * recours. Une fois le facteur vérifié, le serveur ferme la porte : ce composant devient
 * le seul moyen de l'ouvrir.
 */
export function MfaGate({ configure, ouvert }: { configure: boolean; ouvert: boolean }) {
  const sb = createClient();
  const [phase, setPhase] = useState<"repos" | "enrole" | "verifie">("repos");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Quand le serveur a fermé la porte, on demande le code tout de suite : afficher un
  // écran vide en attendant un clic ressemblerait à une panne.
  useEffect(() => { if (configure && !ouvert) setPhase("verifie"); }, [configure, ouvert]);

  async function commencer() {
    setBusy(true); setErr("");
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Pacevo ${Date.now()}` });
    setBusy(false);
    if (error || !data) { setErr(error?.message ?? "Impossible de démarrer la configuration."); return; }
    setQr(data.totp.qr_code); setSecret(data.totp.secret); setFactorId(data.id); setPhase("enrole");
  }

  async function valider() {
    setBusy(true); setErr("");
    const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId });
    if (e1 || !ch) { setBusy(false); setErr(e1?.message ?? "Échec du défi."); return; }
    const { error: e2 } = await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (e2) { setErr("Code refusé. Vérifie l'heure de ton téléphone, puis réessaie."); return; }
    // Le niveau d'authentification est porté par le JETON : il faut une page neuve pour
    // que le serveur voie le nouveau niveau.
    window.location.reload();
  }

  async function deverrouiller() {
    setBusy(true); setErr("");
    const { data: f } = await sb.auth.mfa.listFactors();
    const totp = f?.totp?.find((x) => x.status === "verified");
    if (!totp) { setBusy(false); setErr("Aucun second facteur trouvé."); return; }
    const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: totp.id });
    if (e1 || !ch) { setBusy(false); setErr(e1?.message ?? "Échec du défi."); return; }
    const { error: e2 } = await sb.auth.mfa.verify({ factorId: totp.id, challengeId: ch.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (e2) { setErr("Code refusé. Vérifie l'heure de ton téléphone, puis réessaie."); return; }
    window.location.reload();
  }

  // ── Porte fermée : le serveur exige le code ────────────────────────────────
  if (configure && !ouvert) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] p-6">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <ShieldCheck className="h-8 w-8 text-emerald-600" />
          <h1 className="mt-4 text-lg font-bold text-zinc-900">Code de vérification</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ton mot de passe ne suffit pas à ouvrir l&apos;espace coach : il donne accès aux factures de tes clients
            et à ton chiffre d&apos;affaires.
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void deverrouiller(); }}
            placeholder="123 456" className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2 text-center text-lg tracking-widest" />
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          <button onClick={() => void deverrouiller()} disabled={busy || code.length < 6}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Déverrouiller
          </button>
        </div>
      </div>
    );
  }

  // ── Aucun facteur : on insiste, sans bloquer ───────────────────────────────
  if (!configure) {
    if (phase === "repos") {
      return (
        <div className="mx-8 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <b>Ton espace coach n&apos;est protégé que par un mot de passe.</b> Il ouvre les factures de tes clients,
            leurs données et ton chiffre d&apos;affaires — depuis n&apos;importe quel appareil où ta session est ouverte.
          </span>
          <button onClick={() => void commencer()} disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
            {busy && <Loader2 className="h-3 w-3 animate-spin" />}Activer la double authentification
          </button>
        </div>
      );
    }
    return (
      <div className="mx-8 mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Scanne ce code</h2>
            <p className="mt-1 max-w-md text-xs text-zinc-500">
              Avec Google Authenticator, 1Password, ou l&apos;app d&apos;authentification de ton téléphone. Puis saisis
              le code à 6 chiffres qu&apos;elle affiche.
            </p>
          </div>
          <button onClick={() => setPhase("repos")} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="Code à scanner" className="h-40 w-40 rounded-xl border border-zinc-100" />}
          <div>
            <p className="text-xs text-zinc-400">Ou saisis cette clé à la main :</p>
            <code className="mt-1 block break-all rounded-lg bg-zinc-50 px-2 py-1 text-xs text-zinc-700">{secret}</code>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric"
              onKeyDown={(e) => { if (e.key === "Enter") void valider(); }}
              placeholder="123 456" className="mt-3 w-40 rounded-xl border border-zinc-200 px-3 py-2 text-center tracking-widest" />
            {err && <p className="mt-2 max-w-xs text-xs text-rose-600">{err}</p>}
            <button onClick={() => void valider()} disabled={busy || code.length < 6}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Confirmer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
