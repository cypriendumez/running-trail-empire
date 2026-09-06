"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  RENOMMER SA SORTIE, ET LUI ÉCRIRE UNE DESCRIPTION.
//
//  La montre nomme tout « Rouen Course à pied » : quinze sorties, quinze fois le même
//  titre. Ici l'athlète reprend la main, comme sur Strava.
//
//  Deux partis pris :
//   • le champ vide REMET le nom de la montre, il ne le supprime pas — c'est la seule
//     façon de revenir en arrière sans avoir noté l'ancien nom ;
//   • un refus du serveur s'affiche TEL QUEL, avec sa raison. Un « erreur » générique
//     sur un champ modéré pousse à réessayer au hasard.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { TITRE_MAX, DESCRIPTION_MAX } from "@/lib/activities/renommage";

type Props = {
  id: string;
  titreAffiche: string;
  /** Nom donné par l'athlète, s'il en a donné un. Vide = celui de la montre s'applique. */
  titrePerso: string;
  description: string;
  textes: {
    modifier: string; nom: string; descr: string; enregistrer: string; annuler: string;
    aide: string; placeholderNom: string; placeholderDescr: string; echec: string;
  };
};

export function EditerSortie({ id, titreAffiche, titrePerso, description, textes }: Props) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState(titrePerso);
  const [descr, setDescr] = useState(description);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    setEnCours(true); setErreur(null);
    try {
      const r = await fetch("/api/workouts/renommer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, titre, description: descr }),
      });
      const j = await r.json().catch(() => ({})) as { error?: string };
      // ⚠️ `fetch` ne LÈVE pas sur un 4xx/5xx : sans ce test, un refus de modération
      // s'afficherait comme un enregistrement réussi.
      if (!r.ok) { setErreur(j.error || textes.echec); return; }
      setOuvert(false);
      router.refresh();
    } catch {
      setErreur(textes.echec);
    } finally {
      setEnCours(false);
    }
  }

  if (!ouvert) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4">
        <button type="button" onClick={() => setOuvert(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50">
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          {textes.modifier}
        </button>
        {description && <p className="mt-3 whitespace-pre-line text-sm text-zinc-700">{description}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-600" htmlFor="sortie-nom">
          {textes.nom}
        </label>
        <input id="sortie-nom" value={titre} maxLength={TITRE_MAX} placeholder={titreAffiche || textes.placeholderNom}
          onChange={(e) => setTitre(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500" />
        <p className="mt-1 text-xs text-zinc-500">{textes.aide}</p>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-zinc-600" htmlFor="sortie-descr">
          {textes.descr}
        </label>
        <textarea id="sortie-descr" value={descr} maxLength={DESCRIPTION_MAX} rows={4} placeholder={textes.placeholderDescr}
          onChange={(e) => setDescr(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500" />

        {erreur && (
          <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            {erreur}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={enregistrer} disabled={enCours}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
            {textes.enregistrer}
          </button>
          <button type="button" onClick={() => { setOuvert(false); setErreur(null); setTitre(titrePerso); setDescr(description); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
            <X className="h-4 w-4" aria-hidden="true" />
            {textes.annuler}
          </button>
        </div>
      </div>
    </div>
  );
}
