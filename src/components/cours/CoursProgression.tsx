"use client";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

/**
 * LA PROGRESSION DU LECTEUR — « 4/15 chapitres lus », et un bouton par chapitre.
 *
 * Elle vit dans le navigateur (localStorage, clé `pacevo.cours.lus`) : une convenance
 * par appareil, pas une donnée de compte — on ne fait pas voyager « j'ai lu le chapitre
 * 3 » jusqu'à la base pour ça. Rendue vide au serveur, remplie au montage : sinon le
 * serveur (0 lu) et le navigateur (4 lus) écriraient deux textes différents (React #418).
 *
 * Deux composants partagent l'état par un événement DOM, comme la bulle d'aide : la
 * barre du haut et les boutons des chapitres ne se connaissent pas.
 */
const CLE = "pacevo.cours.lus";
const EVENEMENT = "pacevo:cours-lus";

function lire(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLE) ?? "[]") as string[]); } catch { return new Set(); }
}
function ecrire(lus: Set<string>) {
  try { localStorage.setItem(CLE, JSON.stringify([...lus])); } catch { /* stockage indisponible : la progression ne survit pas au rechargement, rien de plus */ }
  window.dispatchEvent(new CustomEvent(EVENEMENT));
}
function useLus(): Set<string> {
  const [lus, setLus] = useState<Set<string>>(new Set());
  useEffect(() => {
    setLus(lire());
    const h = () => setLus(lire());
    window.addEventListener(EVENEMENT, h);
    return () => window.removeEventListener(EVENEMENT, h);
  }, []);
  return lus;
}

/** La barre du héros : « n/total chapitres lus ». */
export function CoursBarreProgression({ ids, gabarit }: { ids: string[]; gabarit: string }) {
  const lus = useLus();
  const n = ids.filter((id) => lus.has(id)).length;
  const pct = ids.length ? Math.round((n / ids.length) * 100) : 0;
  return (
    <div className="mt-3 max-w-md" aria-live="polite">
      <div className="flex items-center justify-between text-[12px] font-semibold text-white/85">
        <span>{gabarit.replace("{n}", String(n)).replace("{total}", String(ids.length))}</span>
        <span className="tabular-nums">{pct} %</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full bg-amber-300 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Le bouton d'un chapitre : « Marquer comme lu » ⇄ « Chapitre lu ». */
export function CoursMarquerLu({ id, libelles }: { id: string; libelles: { marquer: string; marque: string } }) {
  const lus = useLus();
  const lu = lus.has(id);
  const basculer = () => { const s = lire(); if (s.has(id)) s.delete(id); else s.add(id); ecrire(s); };
  return (
    <button type="button" onClick={basculer} aria-pressed={lu}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        lu ? "bg-emerald-600 text-white" : "border border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 hover:text-emerald-700"}`}>
      <CheckCircle2 className="h-3.5 w-3.5" />
      {lu ? libelles.marque : libelles.marquer}
    </button>
  );
}

/** Les puces du sommaire sur téléphone : une rangée qui défile, la section lue en vert. */
export function CoursSommaireMobile({ items }: { items: { id: string; title: string; color: string }[] }) {
  const lus = useLus();
  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] lg:hidden" role="navigation">
      <div className="flex w-max gap-2 pb-1">
        {items.map((i) => (
          <a key={i.id} href={`#${i.id}`}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${
              lus.has(i.id) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-white text-zinc-700"}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.color }} />
            {i.title.replace(/^(\d+) · /, "$1 · ")}
          </a>
        ))}
      </div>
    </div>
  );
}
