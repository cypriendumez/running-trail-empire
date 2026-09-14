"use client";

import { useEffect, useState } from "react";
import { BarChart3, Globe, Loader2, RefreshCw, Smartphone, UserCheck } from "lucide-react";
import type { Agregat, Classement } from "@/lib/visites/agreger";

type Reponse = Agregat & { lues: number; tronque: boolean; error?: string };

// Deux entités, deux teintes fixes (validées : ΔE 16 en vision déficiente, contraste ≥ 3:1).
const COULEUR = { site: "#0284c7", app: "#059669" } as const;

const jourCourt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const jourLong = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Barres par jour, deux séries côte à côte. SVG nu : pas de bibliothèque pour dix barres. */
function Barres({ jours, cle, cleApp, legende }: { jours: Agregat["jours"]; cle: "visiteursSite" | "vuesSite"; cleApp: "visiteursApp" | "vuesApp"; legende: [string, string] }) {
  const H = 160, PAD = 24;
  const max = Math.max(1, ...jours.map((j) => Math.max(j[cle], j[cleApp])));
  const largeurJour = Math.max(6, Math.min(40, 720 / Math.max(1, jours.length)));
  const W = largeurJour * jours.length + PAD;
  const y = (v: number) => H - (v / max) * (H - 20);
  const pas = max <= 5 ? 1 : max <= 20 ? 5 : max <= 100 ? 20 : Math.ceil(max / 5 / 50) * 50;
  const lignes: number[] = [];
  for (let v = pas; v <= max; v += pas) lignes.push(v);
  const barre = Math.max(2, (largeurJour - 4) / 2 - 1);
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COULEUR.site }} /> {legende[0]}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COULEUR.app }} /> {legende[1]}</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H + 22}`} width={W} height={H + 22} className="block" role="img" aria-label="Fréquentation par jour">
          {lignes.map((v) => (
            <g key={v}>
              <line x1={PAD} x2={W} y1={y(v)} y2={y(v)} stroke="#f4f4f5" />
              <text x={PAD - 4} y={y(v) + 3} fontSize="9" fill="#a1a1aa" textAnchor="end">{v}</text>
            </g>
          ))}
          <line x1={PAD} x2={W} y1={H} y2={H} stroke="#e4e4e7" />
          {jours.map((j, i) => {
            const x0 = PAD + i * largeurJour + 2;
            const s = j[cle], a = j[cleApp];
            return (
              <g key={j.jour}>
                <title>{`${jourLong(j.jour)} — ${legende[0]} : ${s} · ${legende[1]} : ${a}`}</title>
                <rect x={x0} y={y(s)} width={barre} height={Math.max(0, H - y(s))} rx={2} fill={COULEUR.site} />
                <rect x={x0 + barre + 2} y={y(a)} width={barre} height={Math.max(0, H - y(a))} rx={2} fill={COULEUR.app} />
                {(jours.length <= 31 || i % 7 === 0) && (
                  <text x={x0 + barre + 1} y={H + 14} fontSize="9" fill="#a1a1aa" textAnchor="middle">{jours.length <= 10 ? jourCourt(j.jour) : j.jour.slice(8)}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Liste({ titre, lignes, vide, icone: Icone, formatCle }: { titre: string; lignes: Classement; vide: string; icone: typeof Globe; formatCle?: (c: string) => string }) {
  const max = Math.max(1, ...lignes.map((l) => l.vues));
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-900"><Icone className="h-4 w-4 text-zinc-400" /> {titre}</h3>
      {lignes.length === 0 ? <p className="text-xs text-zinc-400">{vide}</p> : (
        <ul className="space-y-1.5">
          {lignes.map((l) => (
            <li key={l.cle} className="text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-zinc-700" title={l.cle}>{formatCle ? formatCle(l.cle) : l.cle}</span>
                <span className="flex-shrink-0 tabular-nums text-zinc-500">{l.vues} vue{l.vues > 1 ? "s" : ""} · {l.visiteurs} vis.</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-zinc-100"><div className="h-1 rounded-full bg-zinc-300" style={{ width: `${(l.vues / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * QUI VIENT, ET OÙ — le site public d'un côté, l'application de l'autre.
 *
 * ⚠️ « Visiteurs » est un chiffre PAR JOUR (l'empreinte change chaque nuit, voir
 * `lib/visites/empreinte.ts`) : le cumul sur 30 jours compte dix fois la personne venue
 * dix jours. Seuls les « comptes actifs » sont des personnes distinctes sur la période.
 */
export function VisitesPanel() {
  const [jours, setJours] = useState<7 | 30 | 90>(30);
  const [rep, setRep] = useState<Reponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = () => {
    setChargement(true); setErreur(null);
    fetch(`/api/admin/visites?jours=${jours}`)
      .then(async (r) => { const j = await r.json() as Reponse; if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`); setRep(j); })
      .catch((e: Error) => setErreur(e.message))
      .finally(() => setChargement(false));
  };
  useEffect(charger, [jours]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = rep?.total;
  const aujourdhui = rep?.jours[rep.jours.length - 1];

  return (
    <div className="mx-auto w-full max-w-6xl p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900"><BarChart3 className="h-5 w-5 text-sky-600" /> Visites</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Mesure maison, sans cookie ni tiers : empreinte quotidienne, adresse IP jamais stockée, robots et éditeur exclus.
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
          <button onClick={charger} className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 hover:bg-zinc-50" title="Recharger">
            <RefreshCw className={`h-4 w-4 ${chargement ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {erreur && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Mesure illisible : {erreur}. {/42P01|does not exist/i.test(erreur) ? "La table « visites » n'existe pas encore : lancer la migration 028." : "Rien ne permet de dire combien de personnes sont venues."}
        </p>
      )}
      {rep?.tronque && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Lecture tronquée à {rep.lues} lignes : les chiffres sont un MINIMUM. Il est temps d&apos;agréger en base.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Comptes actifs", value: t?.comptesActifs, note: `clients distincts sur ${jours} j`, fort: true },
          { label: "Comptes actifs 7 j", value: t?.comptesActifs7j, note: "clients distincts, 7 derniers jours" },
          { label: "Visiteurs aujourd'hui", value: aujourdhui?.visiteurs, note: `${aujourdhui?.visiteursSite ?? 0} site · ${aujourdhui?.visiteursApp ?? 0} app` },
          { label: "Pages vues", value: t?.vues, note: `${t?.vuesSite ?? 0} site · ${t?.vuesApp ?? 0} app · ${t?.visiteursJours ?? 0} visiteurs·jours` },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
            <div className={`text-2xl font-bold tabular-nums ${k.fort ? "text-emerald-700" : "text-zinc-900"}`}>{chargement && !rep ? "…" : (k.value ?? "—")}</div>
            <div className="mt-0.5 text-xs font-medium text-zinc-600">{k.label}</div>
            <div className="text-[11px] text-zinc-400">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-bold text-zinc-900">Visiteurs par jour</h3>
          <span className="text-[11px] text-zinc-400">une personne = une fois par jour</span>
        </div>
        {chargement && !rep ? (
          <div className="flex items-center gap-2 py-10 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin" /> Lecture…</div>
        ) : rep ? (
          <Barres jours={rep.jours} cle="visiteursSite" cleApp="visiteursApp" legende={["Site public", "Application"]} />
        ) : null}
      </div>

      {rep && (
        <div className="grid gap-4 md:grid-cols-2">
          <Liste titre="Pages les plus vues" lignes={rep.pages} vide="Aucune page vue sur la période." icone={Globe} />
          <Liste titre="Provenance" lignes={rep.referents} vide="Aucune provenance externe (accès directs, favoris, applications)." icone={Globe} />
          <Liste titre="Appareils" lignes={rep.appareils} vide="—" icone={Smartphone} />
          <Liste titre="Pays et langues" lignes={[...rep.pays, ...rep.langues.map((l) => ({ ...l, cle: `langue ${l.cle}` }))]} vide="—" icone={UserCheck} />
        </div>
      )}
    </div>
  );
}
