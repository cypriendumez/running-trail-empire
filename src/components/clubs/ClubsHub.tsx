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
import { useT } from "@/lib/i18n/LanguageProvider";
import { jourCivil } from "@/lib/time/fuseau";
import { useFuseau } from "@/lib/time/FuseauProvider";

export type ClubVue = {
  id: string; name: string; description: string | null; city: string | null;
  visibility: string; member_count: number; joined: boolean; role: string | null;
};

export type DefiVue = {
  id: string; name: string; description: string | null; metric: Metric; target: number;
  starts_on: string; ends_on: string; clubName: string | null;
  value: number; ratio: number; done: boolean; joined: boolean;
  daysLeft: number | null; notStarted: boolean;
  classement: { userId: string; name: string; value: number; rank: number; done: boolean }[];
  moi: string;
};

const nb = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ","));

export function ClubsHub({ clubs, defis }: { clubs: ClubVue[]; defis: DefiVue[] }) {
  const { t } = useT();
  const [tab, setTab] = useState<"defis" | "clubs">("defis");
  const [form, setForm] = useState(false);

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900">{t("clubs.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("clubs.sub")}</p>
        </div>
        <button onClick={() => setForm((v) => !v)}
          className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
          <Plus className="h-4 w-4" />
          {tab === "defis" ? t("clubs.newDefi") : t("clubs.newClub")}
        </button>
      </header>

      <div className="mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1">
        {([["defis", `${t("clubs.tab.defis")}${defis.length ? ` · ${defis.length}` : ""}`], ["clubs", `${t("clubs.tab.clubs")}${clubs.length ? ` · ${clubs.length}` : ""}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setForm(false); }}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === k ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {form && (tab === "defis" ? <FormDefi clubs={clubs} onDone={() => setForm(false)} /> : <FormClub onDone={() => setForm(false)} />)}

      {tab === "defis"
        ? (defis.length ? <div className="space-y-3">{defis.map((d) => <CarteDefi key={d.id} d={d} />)}</div> : <Vide titre={t("clubs.empty.defi")} />)
        : (clubs.length ? <div className="space-y-3">{clubs.map((c) => <CarteClub key={c.id} c={c} />)}</div> : <Vide titre={t("clubs.empty.club")} />)}
    </div>
  );
}

// La phrase vide se construisait par CONCATÉNATION (« Aucun » + « défi » + « pour
// l'instant ») : un montage qui ne survit pas à la traduction, l'allemand et l'espagnol
// n'accordant ni ne plaçant les mots dans cet ordre. On passe la phrase entière.
function Vide({ titre }: { titre: string }) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
      <p className="font-semibold text-zinc-900">{titre}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
        {t("clubs.empty.sub")}
      </p>
    </div>
  );
}

function CarteDefi({ d }: { d: DefiVue }) {
  const { t, lang } = useT();
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
  const etat = d.notStarted ? t("clubs.state.soon")
    : d.daysLeft == null ? t("clubs.state.over")
    : d.daysLeft === 0 ? t("clubs.state.lastDay")
    : t("clubs.state.left", { n: d.daysLeft });

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
            {d.done && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{t("clubs.done")}</span>}
            {d.clubName && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">{d.clubName}</span>}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {metricLabel(d.metric, lang)} · {t("clubs.goal")} {nb(d.target)} {metricUnit(d.metric, lang)} · {etat}
          </p>
          {d.description && <p className="mt-1 text-sm text-zinc-600">{d.description}</p>}
        </div>
        <button onClick={toggle} disabled={busy}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            joined ? "border border-zinc-200 text-zinc-600 hover:border-red-200 hover:text-red-600"
                   : "bg-emerald-600 text-white hover:bg-emerald-700"} disabled:opacity-40`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : joined ? t("clubs.joined") : t("clubs.join")}
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          {/* La valeur RÉELLE, jamais plafonnée : 150 km sur un défi de 100 doit
              s'afficher 150, même si la barre, elle, est pleine. */}
          <span className="font-bold text-zinc-900">{nb(d.value)} {metricUnit(d.metric, lang)}</span>
          <span className="text-zinc-400">{Math.round(d.ratio * 100)} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
          <div className={`h-full rounded-full ${d.done ? "bg-emerald-500" : "bg-zinc-400"}`}
            style={{ width: `${d.ratio * 100}%` }} />
        </div>
      </div>

      {/* Classement — affiché seulement s'il y a QUELQU'UN. Un tableau à une ligne
          annonçant « 1er sur 1 » serait exact mais ridicule ; on le tait tant qu'il
          n'y a pas d'adversaire, et on le dit franchement. */}
      {d.classement.length > 1 ? (
        <div className="border-t border-zinc-100">
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {t("clubs.ranking", { n: d.classement.length })}
          </div>
          <div className="divide-y divide-zinc-50">
            {d.classement.slice(0, 8).map((l) => (
              <div key={l.userId} className={`flex items-center gap-3 px-4 py-2 text-sm ${
                l.userId === d.moi ? "bg-emerald-50/60" : ""}`}>
                <span className="w-6 shrink-0 text-center font-bold text-zinc-400">{l.rank}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-800">
                  {l.name}{l.userId === d.moi && <span className="ml-1 text-xs text-emerald-600">{t("clubs.you")}</span>}
                </span>
                {l.done && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                <span className="shrink-0 tabular-nums font-semibold text-zinc-900">
                  {nb(l.value)} <span className="text-xs font-normal text-zinc-400">{metricUnit(d.metric, lang)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : d.joined && (
        <p className="border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-400">
          {t("clubs.alone")}
        </p>
      )}
    </article>
  );
}

function CarteClub({ c }: { c: ClubVue }) {
  const { t } = useT();
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
    if (r.ok) { setJoined((v) => !v); router.refresh(); } else setErr(j.error ?? t("clubs.err.action"));
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
            {c.role === "owner" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{t("clubs.owner")}</span>}
            {c.visibility === "private" && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500">{t("clubs.private")}</span>}
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
            {c.member_count > 1 ? t("clubs.members", { n: c.member_count }) : t("clubs.member1", { n: c.member_count })}
            {c.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
          </p>
          {c.description && <p className="mt-1 text-sm text-zinc-600">{c.description}</p>}
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
        <button onClick={toggle} disabled={busy || c.role === "owner"}
          title={c.role === "owner" ? t("clubs.ownerCantLeave") : undefined}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
            joined ? "border border-zinc-200 text-zinc-600" : "bg-emerald-600 text-white hover:bg-emerald-700"} disabled:opacity-40`}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : joined ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" />{t("clubs.memberBtn")}</span> : t("clubs.joinClub")}
        </button>
      </div>
    </article>
  );
}

function FormClub({ onDone }: { onDone: () => void }) {
  const { t } = useT();
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
    if (!r.ok) { setErr(j.error ?? t("clubs.err.create")); setBusy(false); return; }
    onDone(); router.refresh(); setBusy(false);
  }

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("clubs.f.name")} autoFocus
        className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("clubs.f.city")}
        className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder={t("clubs.f.desc")}
        className="w-full resize-none rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <label className="flex items-center gap-2 text-xs text-zinc-600">
        <input type="checkbox" checked={prive} onChange={(e) => setPrive(e.target.checked)} />
        {t("clubs.f.private")}
      </label>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-xs text-zinc-500">{t("club.cancel")}</button>
        <button onClick={creer} disabled={busy || name.trim().length < 2}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? t("clubs.creating") : t("clubs.createClub")}
        </button>
      </div>
    </div>
  );
}

function FormDefi({ clubs, onDone }: { clubs: ClubVue[]; onDone: () => void }) {
  const fuseau = useFuseau();
  const { t, lang } = useT();
  const router = useRouter();
  // ⚠️ Jour de l'athlète, pas jour UTC — voir lib/time/fuseau.
  const aujourdhui = jourCivil(new Date(), fuseau);
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
    if (!r.ok) { setErr(j.error ?? t("clubs.err.create")); setBusy(false); return; }
    onDone(); router.refresh(); setBusy(false);
  }

  return (
    <div className="mb-5 space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("clubs.f.defiName")} autoFocus
        className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
      <div className="grid gap-3 sm:grid-cols-2">
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}
          className="rounded-xl border border-zinc-200 p-3 text-sm outline-none">
          {(["distance", "elevation", "sessions", "longest_run"] as Metric[]).map((m) => (
            <option key={m} value={m}>{metricLabel(m, lang)}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input value={target} onChange={(e) => setTarget(e.target.value)} type="number" min="1"
            className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none focus:border-emerald-400" />
          <span className="shrink-0 text-xs text-zinc-500">{metricUnit(metric, lang)}</span>
        </div>
        <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)}
          className="rounded-xl border border-zinc-200 p-3 text-sm outline-none" />
        <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)}
          className="rounded-xl border border-zinc-200 p-3 text-sm outline-none" />
      </div>
      {clubs.some((c) => c.joined) && (
        <select value={clubId} onChange={(e) => setClubId(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 p-3 text-sm outline-none">
          <option value="">{t("clubs.openAll")}</option>
          {clubs.filter((c) => c.joined).map((c) => <option key={c.id} value={c.id}>{t("clubs.reserved", { name: c.name })}</option>)}
        </select>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="rounded-lg px-3 py-1.5 text-xs text-zinc-500">{t("club.cancel")}</button>
        <button onClick={creer} disabled={busy || name.trim().length < 2 || !(Number(target) > 0)}
          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
          {busy ? t("clubs.creating") : t("clubs.createDefi")}
        </button>
      </div>
    </div>
  );
}
