"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuthDict } from "@/components/auth/authI18n";
import { deconnexion } from "@/lib/auth/deconnexion";
import { aal2Exige, codeRefuse, sessionCoupee } from "@/lib/auth/mfaNavigateur";

/**
 * DOUBLE AUTHENTIFICATION, FACULTATIVE (choix de Cyprien, 08/11/2026) — dans Réglages → Sécurité.
 *
 * Activer : `mfa.enroll` (TOTP) → QR code à scanner → code à 6 chiffres → `mfa.challengeAndVerify`.
 * Le facteur n'est actif qu'une fois ce premier code vérifié ; la session passe alors en `aal2`.
 * Désactiver : `mfa.unenroll`, que GoTrue n'accepte que d'une session `aal2` — un mot de passe volé
 * ne suffit donc pas à la retirer.
 *
 * ⚠️ LA CLÉ SECRÈTE N'EST PAS AFFICHÉE D'OFFICE (leçon du 23/08/2026 : la clé TOTP de l'admin a
 * fuité dans une capture d'écran). Le QR code suffit dans presque tous les cas ; la clé ne s'affiche
 * qu'à la demande, avec l'avertissement.
 */
type Enrolement = { id: string; qr: string; cle: string };

export function DeuxFacteurs({ L, lang }: { L: AuthDict["deuxFacteurs"]; lang: string }) {
  const cid = useId();
  // id du facteur vérifié ; `null` = pas de double authentification ; `undefined` = lecture en cours ;
  // `false` = lecture IMPOSSIBLE — surtout pas « Désactivée » (relecture du 08/11/2026 : un compte
  // protégé se serait vu dire « non protégé », un faux état sur la sécurité du compte).
  const [actif, setActif] = useState<string | null | undefined | false>(undefined);
  const [enrolement, setEnrolement] = useState<Enrolement | null>(null);
  const [voirCle, setVoirCle] = useState(false);
  const [code, setCode] = useState("");
  const [occupe, setOccupe] = useState(false);

  // Session COUPÉE ailleurs (retrait de la double authentification depuis un autre appareil,
  // 09/11/2026) : rien ne peut aboutir ici, retour à la connexion — voir `sessionCoupee`.
  const versConnexion = async () => { await deconnexion(); window.location.assign("/login"); };
  /** Un échec d'appel : session coupée → connexion ; sinon le message, et le bouton se libère. */
  const echec = async (e: unknown) => {
    setOccupe(false);
    if (sessionCoupee(e)) { await versConnexion(); return; }
    toast.error(L.erreur);
  };

  async function relire() {
    setActif(undefined);
    const { data, error } = await createClient().auth.mfa.listFactors();
    if (error && sessionCoupee(error)) { await versConnexion(); return; }
    setActif(error ? false : (data?.totp?.[0]?.id ?? null));
  }
  useEffect(() => { void relire(); }, []);

  async function activer() {
    setOccupe(true);
    const sb = createClient();
    // Un enrôlement abandonné (QR jamais validé) bloque le suivant : on le retire d'abord.
    // Chaque erreur est lue : sinon `enroll` échouerait ensuite avec un message sans cause.
    const { data: liste, error: eListe } = await sb.auth.mfa.listFactors();
    if (eListe) { await echec(eListe); return; }
    for (const f of liste?.all ?? []) {
      if (f.factor_type !== "totp" || f.status !== "unverified") continue;
      const { error: eRetrait } = await sb.auth.mfa.unenroll({ factorId: f.id });
      if (eRetrait) { await echec(eRetrait); return; }
    }
    const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `Pacevo ${new Date().toISOString().slice(0, 16)}` });
    if (error) { await echec(error); return; }
    setOccupe(false);
    if (data?.type !== "totp") { toast.error(L.erreur); return; }
    setEnrolement({ id: data.id, qr: data.totp.qr_code, cle: data.totp.secret });
    setVoirCle(false);
    setCode("");
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolement || !/^\d{6}$/.test(code)) { toast.error(L.codeFaux); return; }
    setOccupe(true);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolement.id, code });
    setOccupe(false);
    if (error && sessionCoupee(error)) { await versConnexion(); return; }
    // « Code incorrect » seulement quand le CODE est refusé : une panne l'affichait aussi.
    if (error) { setCode(""); toast.error(codeRefuse(error) ? L.codeFaux : L.erreur); return; }
    setEnrolement(null);
    toast.success(L.activee);
    // L'avis par e-mail au titulaire (`/api/auth/2fa/activee`) : si quelqu'un d'autre l'a activée
    // depuis CET écran avec son téléphone, le titulaire le sait (une activation par appel direct à
    // GoTrue n'en déclenche aucun : voir `avertirActivation`). Sans attendre : l'activation est faite.
    void fetch("/api/auth/2fa/activee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) }).catch(() => null);
    await relire();
  }

  async function annuler() {
    if (enrolement) await createClient().auth.mfa.unenroll({ factorId: enrolement.id });
    setEnrolement(null);
  }

  async function desactiver() {
    if (!actif || !window.confirm(L.confirmDesactiver)) return;
    setOccupe(true);
    const { error } = await createClient().auth.mfa.unenroll({ factorId: actif });
    setOccupe(false);
    if (error && sessionCoupee(error)) { await versConnexion(); return; }
    // GoTrue refuse depuis une session `aal1` (`insufficient_aal`) : session ouverte avant l'activation.
    if (error) { toast.error(aal2Exige(error) ? L.reconnexion : L.erreur, { duration: 8000 }); return; }
    toast.success(L.desactivee);
    await relire();
  }

  if (actif === undefined) return <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />;

  if (actif === false) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-zinc-700">
        <span>{L.illisible}</span>
        <button type="button" onClick={() => void relire()} className="font-medium text-emerald-700 hover:text-emerald-900">{L.reessayer}</button>
      </div>
    );
  }

  if (enrolement) {
    return (
      <form onSubmit={valider} className="max-w-sm space-y-4">
        <p className="text-sm text-zinc-700">{L.etape1}</p>
        {/* QR en data:image/svg+xml, fourni par GoTrue : aucune requête externe (img-src data:). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrolement.qr} alt={L.etape1} width={176} height={176} className="rounded-xl border border-zinc-200 bg-white p-2" />
        {voirCle ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>{L.cleAide}</p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-900">{enrolement.cle}</p>
          </div>
        ) : (
          <button type="button" onClick={() => setVoirCle(true)} className="text-xs font-medium text-emerald-700 hover:text-emerald-900">{L.afficherCle}</button>
        )}
        <div>
          <label htmlFor={`${cid}-code`} className="mb-1 block text-[13px] font-semibold text-zinc-600">{L.etape2}</label>
          <input id={`${cid}-code`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder={L.code}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={occupe || code.length !== 6} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {L.valider}
          </button>
          <button type="button" onClick={annuler} className="rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">{L.annuler}</button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${actif ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-700"}`}>
        {actif ? L.etatActive : L.etatInactive}
      </span>
      {actif ? (
        <button type="button" onClick={desactiver} disabled={occupe} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />} {L.desactiver}
        </button>
      ) : (
        <button type="button" onClick={activer} disabled={occupe} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {L.activer}
        </button>
      )}
    </div>
  );
}
