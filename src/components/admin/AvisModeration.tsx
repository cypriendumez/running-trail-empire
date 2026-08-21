"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";

type Ligne = { id: string; note: number; texte: string; auteur: string; at: string; publie: boolean };

/**
 * MODÉRER LES AVIS — publier ou retirer, jamais réécrire.
 *
 * ⚠️ IL N'Y A PAS DE CHAMP D'ÉDITION SUR CET ÉCRAN, ET C'EST VOULU. La page publique
 * promet « publiés tels qu'ils sont écrits, sans les retoucher » ; un champ modifiable
 * ici rendrait la promesse invérifiable. On ne touche qu'au drapeau.
 *
 * ⚠️ Les avis sont triés par DATE, pas par note. Un écran qui présenterait les 5 étoiles
 * en premier inviterait à ne publier que ceux-là — ce que la directive (UE) 2019/2161
 * interdit explicitement.
 */
export function AvisModeration({ initial }: { initial: Ligne[] }) {
  const [lignes, setLignes] = useState(initial);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function bascule(id: string, publie: boolean) {
    setEnCours(id);
    try {
      const r = await fetch("/api/admin/avis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, publie }),
      });
      if (r.ok) setLignes((l) => l.map((x) => (x.id === id ? { ...x, publie } : x)));
    } finally { setEnCours(null); }
  }

  const attente = lignes.filter((l) => !l.publie).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Avis</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {lignes.length} avis · {attente} en attente. La relecture ne sert qu&apos;à écarter
          l&apos;insulte et le spam : ne jamais retenir un avis parce que la note est basse.
        </p>
      </div>

      {!lignes.length && <p className="rounded-2xl bg-zinc-50 p-6 text-sm text-zinc-500">Aucun avis pour l&apos;instant.</p>}

      {lignes.map((l) => (
        <div key={l.id} className={`rounded-2xl p-5 ring-1 ring-inset ${l.publie ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-zinc-200"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-zinc-900">{l.auteur}</span>
              <span className="ml-2 text-xs text-zinc-400">{l.at.slice(0, 10)}</span>
              <span className="ml-2 text-amber-500">{"★".repeat(l.note)}<span className="text-zinc-300">{"★".repeat(5 - l.note)}</span></span>
            </div>
            <button
              onClick={() => bascule(l.id, !l.publie)} disabled={enCours === l.id}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-40 ${l.publie ? "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50" : "bg-zinc-900 text-white hover:bg-zinc-800"}`}
            >
              {enCours === l.id && <Loader2 className="h-3 w-3 animate-spin" />}
              {l.publie ? "Retirer" : "Publier"}
            </button>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-600">{l.texte}</p>
        </div>
      ))}
    </div>
  );
}
