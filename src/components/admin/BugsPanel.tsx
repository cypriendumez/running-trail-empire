"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bug, ChevronDown, ChevronRight, Loader2, RefreshCw, Users } from "lucide-react";
import type { GroupeErreur } from "@/lib/admin/bugs";

type Reponse = { jours: number; lues: number; tronque: boolean; groupes: GroupeErreur[]; error?: string };

const TON_SOURCE: Record<string, string> = {
  "client": "bg-zinc-100 text-zinc-700",
  "client-render": "bg-red-50 text-red-700",
  "client-reseau": "bg-amber-50 text-amber-800",
  "onboarding": "bg-rose-50 text-rose-700",
  "server": "bg-violet-50 text-violet-700",
};
const LIBELLE_SOURCE: Record<string, string> = {
  "client": "erreur JS",
  "client-render": "écran planté",
  "client-reseau": "appel refusé",
  "onboarding": "inscription",
  "server": "serveur",
};

const quand = (iso: string) => {
  const h = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (h < 1) return "il y a moins d'une heure";
  if (h < 48) return `il y a ${Math.round(h)} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
const dateFr = (iso: string) => new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * LES BUGS QUE LES UTILISATEURS RENCONTRENT — enfin lisibles sans ouvrir Supabase.
 *
 * Chaque ligne est un DÉFAUT (message normalisé), pas une occurrence : « 21 fois, 2 comptes,
 * dernière fois il y a 3 h » se lit d'un coup d'œil, et la pile ne s'ouvre qu'à la demande.
 * Le bruit de développement (localhost, pages de prévisualisation) est masqué par défaut,
 * jamais effacé.
 */
export function BugsPanel() {
  const [jours, setJours] = useState<7 | 30 | 90>(30);
  const [bruit, setBruit] = useState(false);
  const [rep, setRep] = useState<Reponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = () => {
    setChargement(true); setErreur(null);
    fetch(`/api/admin/bugs?jours=${jours}&bruit=${bruit ? 1 : 0}`)
      .then(async (r) => { const j = await r.json() as Reponse; if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`); setRep(j); })
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setChargement(false));
  };
  useEffect(charger, [jours, bruit]); // eslint-disable-line react-hooks/exhaustive-deps

  const groupes = rep?.groupes ?? [];
  const occurrences = groupes.reduce((s, g) => s + g.occurrences, 0);
  const comptes = groupes.reduce((s, g) => s + g.comptes, 0);
  const recents = groupes.filter((g) => Date.now() - new Date(g.dernier).getTime() < 24 * 36e5).length;

  return (
    <div className="mx-auto w-full max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900"><Bug className="h-5 w-5 text-rose-500" /> Bugs rencontrés</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Le journal d&apos;erreurs de production, regroupé par défaut. Erreurs JS, écrans plantés, appels refusés, échecs d&apos;inscription.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-zinc-100 p-1">
            {([7, 30, 90] as const).map((j) => (
              <button key={j} onClick={() => setJours(j)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${jours === j ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                {j} j
              </button>
            ))}
          </div>
          <label htmlFor="bugs-bruit" className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
            <input id="bugs-bruit" type="checkbox" checked={bruit} onChange={(e) => setBruit(e.target.checked)} className="accent-zinc-700" /> bruit de dev
          </label>
          <button onClick={charger} className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 hover:bg-zinc-50" title="Recharger">
            <RefreshCw className={`h-4 w-4 ${chargement ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Les trois chiffres qui répondent à « est-ce que ça casse en ce moment ? » */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Défauts distincts", value: groupes.length, note: `sur ${jours} j` },
          { label: "Occurrences", value: occurrences, note: `${rep?.lues ?? 0} ligne(s) lue(s)` },
          { label: "Comptes touchés", value: comptes, note: "comptes connectés, cumul par défaut" },
          { label: "Actifs ces 24 h", value: recents, note: recents ? "à regarder" : "rien de neuf", alerte: recents > 0 },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border bg-white p-5 shadow-sm ${k.alerte ? "border-amber-200" : "border-zinc-100"}`}>
            <div className={`text-2xl font-bold tabular-nums ${k.alerte ? "text-amber-700" : "text-zinc-900"}`}>{chargement && !rep ? "…" : k.value}</div>
            <div className="mt-0.5 text-xs font-medium text-zinc-600">{k.label}</div>
            <div className="text-[11px] text-zinc-400">{k.note}</div>
          </div>
        ))}
      </div>

      {erreur && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Journal illisible : {erreur}. Rien ne permet de dire que tout va bien.
        </p>
      )}
      {rep?.tronque && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Journal tronqué à {rep.lues} lignes : les chiffres ci-dessus sont un MINIMUM.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
        {chargement && !rep ? (
          <div className="flex items-center gap-2 px-6 py-10 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Lecture du journal…</div>
        ) : groupes.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-400">
            {erreur ? "—" : `Aucune erreur enregistrée sur ${jours} jours${bruit ? "" : " (bruit de développement masqué)"}.`}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-50">
            {groupes.map((g) => {
              const open = ouvert === g.cle;
              const recent = Date.now() - new Date(g.dernier).getTime() < 24 * 36e5;
              return (
                <li key={g.cle}>
                  <button onClick={() => setOuvert(open ? null : g.cle)} className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-zinc-50">
                    <span className="mt-0.5 text-zinc-300">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {g.sources.map((s) => (
                          <span key={s} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TON_SOURCE[s] ?? "bg-zinc-100 text-zinc-600"}`}>{LIBELLE_SOURCE[s] ?? s}</span>
                        ))}
                        {recent && <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"><AlertTriangle className="h-3 w-3" /> 24 h</span>}
                        <span className="text-[11px] text-zinc-400">{g.pages[0]?.url}{g.pages.length > 1 ? ` +${g.pages.length - 1}` : ""}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[13px] text-zinc-800">{g.message}</div>
                    </div>
                    <div className="flex-shrink-0 text-right text-[11px] text-zinc-500">
                      <div className="text-sm font-bold tabular-nums text-zinc-900">{g.occurrences}×</div>
                      <div className="flex items-center justify-end gap-1"><Users className="h-3 w-3" /> {g.comptes}{g.anonymes ? ` +${g.anonymes} anon.` : ""}</div>
                      <div>{quand(g.dernier)}</div>
                    </div>
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-zinc-50 bg-zinc-50/60 px-5 py-4 text-xs">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div><div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Première fois</div><div className="text-zinc-700">{dateFr(g.premier)}</div></div>
                        <div><div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Dernière fois</div><div className="text-zinc-700">{dateFr(g.dernier)}</div></div>
                        <div><div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Navigateur (dernier)</div><div className="truncate text-zinc-700" title={g.exemple.user_agent ?? ""}>{g.exemple.user_agent ?? "—"}</div></div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Pages</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {g.pages.map((p) => <span key={p.url} className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-zinc-700 ring-1 ring-zinc-200">{p.url} <span className="text-zinc-400">×{p.n}</span></span>)}
                        </div>
                      </div>
                      {g.exemple.meta != null && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Détails</div>
                          <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-zinc-700 ring-1 ring-zinc-200">{JSON.stringify(g.exemple.meta, null, 2)}</pre>
                        </div>
                      )}
                      {g.exemple.stack && (
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">Pile (dernière occurrence)</div>
                          <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-zinc-600 ring-1 ring-zinc-200">{g.exemple.stack}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
