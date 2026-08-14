"use client";
// ─────────────────────────────────────────────────────────────────────────────
//  CLUBS & DÉFIS.
//
//  Un club est un groupe DURABLE (le club d'athlé, les collègues) ; un défi est une
//  compétition BORNÉE dans le temps. Deux objets voisins mais distincts, d'où deux
//  onglets plutôt qu'une liste mélangée où l'on ne saurait plus ce qui expire.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Target, Plus, Check, MapPin, Loader2 } from "lucide-react";
import { metricLabel, metricUnit, type Metric } from "@/lib/challenges/progress";

export type ClubVue = {
  id: string; name: string; description: string | null; city: string | null;
  visibility: string; member_count: number; joined: boolean; role: string | null;
};

export type DefiVue = {
  id: string; name: string; description: string | null; metric: Metric; target: number;
  starts_on: string; ends_on: string; clubName: string | null;
  value: number; ratio: number; done: boolean; joined: boolean;
  daysLeft: number | null; notStarted: boolean;
};

const nb = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));

export function ClubsHub({ clubs, defis }: { clubs: ClubVue[]; defis: DefiVue[] }) {
  const [tab, setTab] = useState<"defis" | "clubs">("defis");
  const [form, setForm] = useState(false);

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">Clubs &amp; Défis</h1>
          <p className="mt-1 text-sm text-zinc-500">Cours en groupe, et donne-toi des objectifs datés.</p>
        </div>
        <button onClick={() => setForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
          <Plus className="h-4 w-4" />
          {tab === "defis" ? "Créer un défi" : "Créer un club"}
        </button>
      </header>

      <div className="mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {([["defis", `Défis${defis.length ? ` · ${defis.length}` : ""}`], ["clubs", `Clubs${clubs.length ? ` · ${clubs.length}` : ""}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setForm(false); }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === k ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {form && (tab === "defis" ? <FormDefi clubs={clubs} onDone={() => setForm(false)} /> : <FormClub onDone={() => setForm(false)} />)}

      {tab === "defis"
        ? (defis.length ? <div className="space-y-3">{defis.map((d) => <CarteDefi key={d.id} d={d} />)}</div> : <Vide quoi="défi" />)
        : (clubs.length ? <div className="space-y-3">{clubs.map((c) => <CarteClub key={c.id} c={c} />)}</div> : <Vide quoi="club" />)}
    </div>
  );
}

function Vide({ quoi }: { quoi: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <p className="font-semibold text-zinc-900">Aucun {quoi} pour l&apos;instant</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
        Crée le premier avec le bouton en haut de page.
      </p>
    </div>
  );
}

function CarteDefi({ d }: { d: DefiVue }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(d.joined);

  async function toggle() {
    setBusy(true);
    const r = await fetch("/api/challenges", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: d.id }),
    });
    if (r.ok) { setJoined((v) => !v); router.refresh(); }
    setBusy(false);
  }

  // Trois états bien distincts. « 0 jour restant » sur un défi clos pousserait à
  // sortir courir pour rien ; « 0 % » sur un défi à venir ressemblerait à un échec.
  const etat = d.notStarted ? "À venir"
    : d.daysLeft == null ? "Terminé"
    : d.daysLeft === 0 ? "Dernier jour"
    : `${d.daysLeft} j restants`;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="flex items-start gap-3 p-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          d.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
          <Target className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-zinc-900">{d.name}</h2>
            {d.done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Réussi</span>}
            {d.clubName && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">{d.clubName}</span>}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {metricLabel(d.metric)} · objectif {nb(d.target)} {metricUnit(d.metric)} · {etat}
          </p>
          {d.description && <p className="mt-1 text-sm text-zinc-600">{d.description}</p>}
        </div>
        <button onClick={toggle} disabled={busy}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            joined ? "border border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600"
                   : "bg-emerald-600 text-white hover:bg-emerald-700"} disabled:opacity-40`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : joined ? "Inscrit" : "Participer"}
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          {/* La valeur RÉELLE, jamais plafonnée : 150 km sur un défi de 100 doit
              s'afficher 150, même si la barre, elle, est pleine. */}
          <span className="font-bold text-zinc-900">{nb(d.value)} {metricUnit(d.metric)}</span>
          <span className="text-zinc-400">{Math.round(d.ratio * 100)} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className={`h-full rounded-full ${d.done ? "bg-emerald-500" : "bg-zinc-400"}`}
            style={{ width: `${d.ratio * 100}%` }} />
        </div>
      </div>
    </article>
  );
}

function CarteClub({ c }: { c: ClubVue }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(c.joined);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/clubs", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId: c.id }),
    });
    const j = await r.json();
    if (r.ok) { setJoined((v) => !v); router.refresh(); } else setErr(j.error ?? "Action impossible");
    setBusy(false);
  }

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-zinc-900">{c.name}</h2>
            {c.role === "owner" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Propriétaire</span>}
            {c.visibility === "private" && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">Privé</span>}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
            {c.member_count} membre{c.member_count > 1 ? "s" : ""}
            {c.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
          </p>
          {c.description && <p className="mt-1 text-sm text-zinc-600">{c.description}</p>}
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
        <button onClick={toggle} disabled={busy || c.role === "owner"}
          title={c.role === "owner" ? "Le propriétaire ne peut pas quitter son club" : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            joined ? "border border-zinc-200 text-zinc-600" : "bg-emerald-600 text-white hover:bg-emerald-700"} disabled:opacity-40`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : joined ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" />Membre</span> : "Rejoindre"}
        </button>
      </div>
    </article>
  );
}

function FormClub({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(""); const [city, setCity] = useState("");
  const [desc, setDesc] = useState(""); const [prive, setPrive] = useState(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function creer() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/clubs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, city, description: desc, visibility: prive ? "private" : "public" }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Création impossible"); setBusy(false); return; }
    onDone(); router.refresh(); setBusy(false);
  }

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du club" autoFocus
        className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ville (facultatif)"
        className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Description (facultatif)"
        className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input type="checkbox" checked={prive} onChange={(e) => setPrive(e.target.checked)} />
        Club privé (invisible dans l&apos;annuaire)
      </label>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-xs text-zinc-500">Annuler</button>
        <button onClick={creer} disabled={busy || name.trim().length < 2}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? "Création…" : "Créer le club"}
        </button>
      </div>
    </div>
  );
}

function FormDefi({ clubs, onDone }: { clubs: ClubVue[]; onDone: () => void }) {
  const router = useRouter();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dansUnMois = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [name, setName] = useState(""); const [metric, setMetric] = useState<Metric>("distance");
  const [target, setTarget] = useState("100");
  const [startsOn, setStartsOn] = useState(aujourdhui); const [endsOn, setEndsOn] = useState(dansUnMois);
  const [clubId, setClubId] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function creer() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/challenges", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, metric, target: Number(target), startsOn, endsOn, clubId: clubId || undefined }),
    });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? "Création impossible"); setBusy(false); return; }
    onDone(); router.refresh(); setBusy(false);
  }

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du défi — ex. 100 km en janvier" autoFocus
        className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}
          className="rounded-xl border border-zinc-200 p-3 text-sm outline-none">
          {(["distance", "elevation", "sessions", "longest_run"] as Metric[]).map((m) => (
            <option key={m} value={m}>{metricLabel(m)}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input value={target} onChange={(e) => setTarget(e.target.value)} type="number" min="1"
            className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
          <span className="shrink-0 text-xs text-zinc-500">{metricUnit(metric)}</span>
        </div>
        <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
          className="rounded-xl border border-zinc-200 p-3 text-sm outline-none" />
        <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)}
          className="rounded-xl border border-zinc-200 p-3 text-sm outline-none" />
      </div>
      {clubs.some((c) => c.joined) && (
        <select value={clubId} onChange={(e) => setClubId(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none">
          <option value="">Ouvert à tous</option>
          {clubs.filter((c) => c.joined).map((c) => <option key={c.id} value={c.id}>Réservé au club {c.name}</option>)}
        </select>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-xs text-zinc-500">Annuler</button>
        <button onClick={creer} disabled={busy || name.trim().length < 2 || !(Number(target) > 0)}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? "Création…" : "Créer le défi"}
        </button>
      </div>
    </div>
  );
}
