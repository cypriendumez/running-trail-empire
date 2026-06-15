"use client";

import { useState } from "react";
import { Dumbbell, PlayCircle, Repeat, User, Home, Building2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

// Le texte affiché est porté par des clés renfo.* (cf. translations.ts).
// `yt` (requête de recherche YouTube) et `emoji` restent littéraux : ce ne sont pas des textes d'interface.
type Ex = { nameK: string; emoji: string; doseK: string; cueK: string; yt: string };
type Block = { groupK: string; color: string; introK: string; ex: Ex[] };
type Program = { id: string; labelK: string; icon: typeof User; introK: string; blocks: Block[] };

const PROGRAMS: Program[] = [
  {
    id: "none", labelK: "renfo.prog.none.label", icon: User, introK: "renfo.prog.none.intro",
    blocks: [
      { groupK: "renfo.none.b1.group", color: "#7c3aed", introK: "renfo.none.b1.intro", ex: [
        { nameK: "renfo.none.b1.e1.name", emoji: "🧱", doseK: "renfo.none.b1.e1.dose", cueK: "renfo.none.b1.e1.cue", yt: "planche gainage technique" },
        { nameK: "renfo.none.b1.e2.name", emoji: "↔️", doseK: "renfo.none.b1.e2.dose", cueK: "renfo.none.b1.e2.cue", yt: "gainage lateral technique" },
        { nameK: "renfo.none.b1.e3.name", emoji: "🐞", doseK: "renfo.none.b1.e3.dose", cueK: "renfo.none.b1.e3.cue", yt: "dead bug exercice" },
        { nameK: "renfo.none.b1.e4.name", emoji: "🧗", doseK: "renfo.none.b1.e4.dose", cueK: "renfo.none.b1.e4.cue", yt: "mountain climbers technique" },
      ] },
      { groupK: "renfo.none.b2.group", color: "#059669", introK: "renfo.none.b2.intro", ex: [
        { nameK: "renfo.none.b2.e1.name", emoji: "🌉", doseK: "renfo.none.b2.e1.dose", cueK: "renfo.none.b2.e1.cue", yt: "pont fessier technique" },
        { nameK: "renfo.none.b2.e2.name", emoji: "🦵", doseK: "renfo.none.b2.e2.dose", cueK: "renfo.none.b2.e2.cue", yt: "pont fessier une jambe" },
        { nameK: "renfo.none.b2.e3.name", emoji: "🚶", doseK: "renfo.none.b2.e3.dose", cueK: "renfo.none.b2.e3.cue", yt: "fentes avant technique course" },
        { nameK: "renfo.none.b2.e4.name", emoji: "⬇️", doseK: "renfo.none.b2.e4.dose", cueK: "renfo.none.b2.e4.cue", yt: "squat poids du corps technique" },
      ] },
      { groupK: "renfo.none.b3.group", color: "#ea580c", introK: "renfo.none.b3.intro", ex: [
        { nameK: "renfo.none.b3.e1.name", emoji: "🦶", doseK: "renfo.none.b3.e1.dose", cueK: "renfo.none.b3.e1.cue", yt: "extensions mollets coureur" },
        { nameK: "renfo.none.b3.e2.name", emoji: "⚙️", doseK: "renfo.none.b3.e2.dose", cueK: "renfo.none.b3.e2.cue", yt: "excentrique tendon achille" },
      ] },
      { groupK: "renfo.none.b4.group", color: "#0284c7", introK: "renfo.none.b4.intro", ex: [
        { nameK: "renfo.none.b4.e1.name", emoji: "🧍", doseK: "renfo.none.b4.e1.dose", cueK: "renfo.none.b4.e1.cue", yt: "proprioception cheville coureur" },
        { nameK: "renfo.none.b4.e2.name", emoji: "🦘", doseK: "renfo.none.b4.e2.dose", cueK: "renfo.none.b4.e2.cue", yt: "squat jump technique" },
      ] },
    ],
  },
  {
    id: "home", labelK: "renfo.prog.home.label", icon: Home, introK: "renfo.prog.home.intro",
    blocks: [
      { groupK: "renfo.home.b1.group", color: "#7c3aed", introK: "renfo.home.b1.intro", ex: [
        { nameK: "renfo.home.b1.e1.name", emoji: "🎯", doseK: "renfo.home.b1.e1.dose", cueK: "renfo.home.b1.e1.cue", yt: "pallof press elastique" },
        { nameK: "renfo.home.b1.e2.name", emoji: "🧱", doseK: "renfo.home.b1.e2.dose", cueK: "renfo.home.b1.e2.cue", yt: "planche lestee" },
        { nameK: "renfo.home.b1.e3.name", emoji: "🔄", doseK: "renfo.home.b1.e3.dose", cueK: "renfo.home.b1.e3.cue", yt: "russian twist halteres" },
      ] },
      { groupK: "renfo.home.b2.group", color: "#059669", introK: "renfo.home.b2.intro", ex: [
        { nameK: "renfo.home.b2.e1.name", emoji: "🏋️", doseK: "renfo.home.b2.e1.dose", cueK: "renfo.home.b2.e1.cue", yt: "squat gobelet halteres technique" },
        { nameK: "renfo.home.b2.e2.name", emoji: "⚙️", doseK: "renfo.home.b2.e2.dose", cueK: "renfo.home.b2.e2.cue", yt: "souleve de terre roumain halteres" },
        { nameK: "renfo.home.b2.e3.name", emoji: "🚶", doseK: "renfo.home.b2.e3.dose", cueK: "renfo.home.b2.e3.cue", yt: "fentes halteres technique" },
        { nameK: "renfo.home.b2.e4.name", emoji: "🦵", doseK: "renfo.home.b2.e4.dose", cueK: "renfo.home.b2.e4.cue", yt: "abduction hanche elastique fessier moyen" },
        { nameK: "renfo.home.b2.e5.name", emoji: "🌉", doseK: "renfo.home.b2.e5.dose", cueK: "renfo.home.b2.e5.cue", yt: "hip thrust halteres maison" },
      ] },
      { groupK: "renfo.home.b3.group", color: "#ea580c", introK: "renfo.home.b3.intro", ex: [
        { nameK: "renfo.home.b3.e1.name", emoji: "🦶", doseK: "renfo.home.b3.e1.dose", cueK: "renfo.home.b3.e1.cue", yt: "extension mollets halteres" },
        { nameK: "renfo.home.b3.e2.name", emoji: "🪢", doseK: "renfo.home.b3.e2.dose", cueK: "renfo.home.b3.e2.cue", yt: "tirage elastique dos posture" },
      ] },
      { groupK: "renfo.home.b4.group", color: "#0284c7", introK: "", ex: [
        { nameK: "renfo.home.b4.e1.name", emoji: "🦘", doseK: "renfo.home.b4.e1.dose", cueK: "renfo.home.b4.e1.cue", yt: "fente sautee jump lunge" },
        { nameK: "renfo.home.b4.e2.name", emoji: "🧍", doseK: "renfo.home.b4.e2.dose", cueK: "renfo.home.b4.e2.cue", yt: "proprioception unipodal halteres" },
      ] },
    ],
  },
  {
    id: "gym", labelK: "renfo.prog.gym.label", icon: Building2, introK: "renfo.prog.gym.intro",
    blocks: [
      { groupK: "renfo.gym.b1.group", color: "#059669", introK: "renfo.gym.b1.intro", ex: [
        { nameK: "renfo.gym.b1.e1.name", emoji: "🏋️", doseK: "renfo.gym.b1.e1.dose", cueK: "renfo.gym.b1.e1.cue", yt: "squat barre technique securite" },
        { nameK: "renfo.gym.b1.e2.name", emoji: "🌉", doseK: "renfo.gym.b1.e2.dose", cueK: "renfo.gym.b1.e2.cue", yt: "hip thrust barre technique" },
        { nameK: "renfo.gym.b1.e3.name", emoji: "🦵", doseK: "renfo.gym.b1.e3.dose", cueK: "renfo.gym.b1.e3.cue", yt: "fentes bulgares technique" },
        { nameK: "renfo.gym.b1.e4.name", emoji: "🦿", doseK: "renfo.gym.b1.e4.dose", cueK: "renfo.gym.b1.e4.cue", yt: "presse a cuisses technique" },
      ] },
      { groupK: "renfo.gym.b2.group", color: "#7c3aed", introK: "renfo.gym.b2.intro", ex: [
        { nameK: "renfo.gym.b2.e1.name", emoji: "⚙️", doseK: "renfo.gym.b2.e1.dose", cueK: "renfo.gym.b2.e1.cue", yt: "souleve de terre roumain barre technique" },
        { nameK: "renfo.gym.b2.e2.name", emoji: "🔧", doseK: "renfo.gym.b2.e2.dose", cueK: "renfo.gym.b2.e2.cue", yt: "leg curl machine technique" },
      ] },
      { groupK: "renfo.gym.b3.group", color: "#ea580c", introK: "", ex: [
        { nameK: "renfo.gym.b3.e1.name", emoji: "🦶", doseK: "renfo.gym.b3.e1.dose", cueK: "renfo.gym.b3.e1.cue", yt: "extension mollets machine" },
        { nameK: "renfo.gym.b3.e2.name", emoji: "🪑", doseK: "renfo.gym.b3.e2.dose", cueK: "renfo.gym.b3.e2.cue", yt: "mollets assis soleaire machine" },
      ] },
      { groupK: "renfo.gym.b4.group", color: "#0284c7", introK: "", ex: [
        { nameK: "renfo.gym.b4.e1.name", emoji: "🎯", doseK: "renfo.gym.b4.e1.dose", cueK: "renfo.gym.b4.e1.cue", yt: "pallof press poulie" },
        { nameK: "renfo.gym.b4.e2.name", emoji: "📦", doseK: "renfo.gym.b4.e2.dose", cueK: "renfo.gym.b4.e2.cue", yt: "box jump technique" },
        { nameK: "renfo.gym.b4.e3.name", emoji: "🔵", doseK: "renfo.gym.b4.e3.dose", cueK: "renfo.gym.b4.e3.cue", yt: "bosu equilibre proprioception" },
      ] },
    ],
  },
];

export function RenfoGuide() {
  const { t } = useT();
  const [eq, setEq] = useState<string>("none");
  const prog = PROGRAMS.find((p) => p.id === eq) ?? PROGRAMS[0];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-violet-50 p-4 ring-1 ring-violet-100">
        <Dumbbell className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-600" />
        <div className="text-sm text-violet-900">
          <b>{t("renfo.banner.title")}</b> {t("renfo.banner.body")}
        </div>
      </div>

      {/* Sélecteur de matériel */}
      <div className="grid grid-cols-3 gap-2">
        {PROGRAMS.map((p) => {
          const active = p.id === eq;
          return (
            <button key={p.id} onClick={() => setEq(p.id)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${active ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300" : "border-zinc-200 bg-white hover:border-violet-200 hover:bg-violet-50/40"}`}>
              <p.icon className={`h-5 w-5 ${active ? "text-violet-600" : "text-zinc-400"}`} />
              <span className={`text-[12px] font-semibold leading-tight ${active ? "text-violet-700" : "text-zinc-600"}`}>{t(p.labelK)}</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm italic text-zinc-500">{t(prog.introK)}</p>

      {prog.blocks.map((b) => (
        <div key={b.groupK} className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
            <h3 className="font-bold text-zinc-900">{t(b.groupK)}</h3>
          </div>
          {b.introK && <p className="mb-3 text-xs text-zinc-500">{t(b.introK)}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {b.ex.map((e) => (
              <div key={e.nameK} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-zinc-900"><span>{e.emoji}</span>{t(e.nameK)}</div>
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-zinc-600 ring-1 ring-zinc-200"><Repeat className="h-3 w-3" />{t(e.doseK)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">{t(e.cueK)}</p>
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.yt)}`} target="_blank" rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-600 hover:text-violet-700">
                  <PlayCircle className="h-4 w-4" /> {t("renfo.demo")}
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
