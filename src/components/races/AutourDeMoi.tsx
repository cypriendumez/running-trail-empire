"use client";

import { useState } from "react";
import { Loader2, LocateFixed, X } from "lucide-react";
import { RAYONS_KM, RAYON_DEFAUT_KM, type Point, type Proximite } from "@/lib/races/proximite";
import { fillR } from "./racesI18n";

/**
 * Le filtre « Autour de moi » — le même bouton dans la liste et sur la carte des courses.
 *
 * ⚠️ LA POSITION N'EST DEMANDÉE QU'AU CLIC. Jamais à l'ouverture de la page : une demande
 * d'autorisation qui surgit sans geste de l'athlète se refuse par réflexe, et un refus est
 * mémorisé par le navigateur — on perdrait la position pour toutes les visites suivantes.
 *
 * ⚠️ UN REFUS N'EST PAS UNE IMPASSE. Si le navigateur ne donne rien, on part du départ de
 * la dernière sortie GPS (`profiles.last_lat/lon`, arrondi au km) — et on le DIT, pour que
 * l'athlète sache autour de quoi la liste est triée.
 */
export function AutourDeMoi({ valeur, onChange, positionEntrainement, d, compact = false }: {
  valeur: Proximite | null;
  onChange: (p: Proximite | null) => void;
  positionEntrainement: Point | null;
  d: Record<string, string>;
  compact?: boolean;
}) {
  const [enCours, setEnCours] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const localiser = () => {
    const rayonKm = valeur?.rayonKm ?? RAYON_DEFAUT_KM;
    const repli = (motif: "refus" | "indispo") => {
      setEnCours(false);
      if (positionEntrainement) {
        onChange({ centre: positionEntrainement, source: "entrainement", rayonKm });
        setInfo(motif === "refus" ? d["near.deniedFallback"] : null);
      } else setInfo(d["near.denied"]);
    };
    setInfo(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) return repli("indispo");
    setEnCours(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEnCours(false);
        onChange({ centre: { lat: pos.coords.latitude, lon: pos.coords.longitude }, source: "gps", rayonKm });
      },
      (err) => repli(err.code === err.PERMISSION_DENIED ? "refus" : "indispo"),
      // Une précision de quartier suffit à trier des courses : pas de GPS haute précision,
      // qui est lent et vide la batterie ; une position de moins de 10 min est réutilisée.
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };

  if (!valeur) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={localiser} disabled={enCours}
          className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60 ${compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}>
          {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          {enCours ? d["near.locating"] : d["near.btn"]}
        </button>
        {info && <p role="status" className="max-w-xs text-xs text-amber-700">{info}</p>}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1">
      {/* ⚠️ `max-w-full` + libellé tronquable : à 375 px, « Autour de ta dernière sortie »
          et son rayon débordaient de la carte des filtres (vérifié à l'écran le 28/09/2026). */}
      <div className={`flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 font-semibold text-white ${compact ? "py-0.5 pl-2 pr-1 text-xs" : "py-1 pl-2.5 pr-1 text-sm"}`}>
        <LocateFixed className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="min-w-0 truncate">{valeur.source === "gps" ? d["near.gps"] : d["near.training"]}</span>
        <select aria-label={d["near.radius"]} value={valeur.rayonKm}
          onChange={(e) => onChange({ ...valeur, rayonKm: Number(e.target.value) })}
          className="flex-shrink-0 cursor-pointer rounded-md bg-emerald-700 px-1.5 py-0.5 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/60">
          {RAYONS_KM.map((r) => <option key={r} value={r}>{fillR("{n} km", { n: r })}</option>)}
        </select>
        <button type="button" onClick={() => { onChange(null); setInfo(null); }} aria-label={d["near.clear"]} title={d["near.clear"]}
          className="flex-shrink-0 rounded-md p-0.5 text-white/80 hover:bg-emerald-700 hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {info && <p role="status" className="max-w-xs text-xs text-amber-700">{info}</p>}
    </div>
  );
}
