"use client";
import type { ReactNode } from "react";
import { Check, MapPin, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { GX } from "@/components/ghost-runner/ghostI18n";
import { tuileDe, type CalqueCarte, type FondCarte, type IdCalque, type IdFond } from "@/lib/courses/fondsCarte";
import { vignetteDessinee, VIGNETTE_RUES } from "@/components/ghost-runner/vignettes";

/**
 * LES COMMANDES DE CARTE COMMUNES À « ENREGISTRER » ET À « CARTE ».
 *
 * Cyprien, 27/11/2026 (onglet Carte) : « fais comme dans Enregistrer, exactement la même
 * chose ». Les boutons ronds, les vignettes et le tiroir des modèles vivaient dans
 * `GhostRunner` ; recopiés dans le constructeur de parcours, ils auraient divergé au
 * premier réglage. Ils sont donc ici, une seule fois, et les deux écrans s'en servent.
 */

/**
 * Une commande posée sur la carte : ronde, blanche, 44 px — la taille minimale d'une
 * cible tactile. « Actif » l'inverse en noir plein, pour qu'on sache d'un regard si la
 * voix parle et si la carte suit encore la position.
 */
export function BtnCarte({ actif, titre, onClick, disabled, children }: { actif?: boolean; titre: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button" onClick={onClick} title={titre} aria-label={titre} aria-pressed={!!actif} disabled={disabled}
      className={`pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full shadow-[0_8px_18px_-8px_rgba(9,9,11,0.6)] ring-1 transition-colors disabled:opacity-40 ${actif ? "bg-zinc-900 text-white ring-zinc-900" : "bg-white/95 text-zinc-600 ring-black/5 hover:bg-white"}`}
    >
      {children}
    </button>
  );
}

export const VIGNETTE_PLAN = "linear-gradient(135deg,#f2f1ed 0 36%,#bfe3a3 36% 58%,#f2f1ed 58% 66%,#9ccdf2 66%)";

/**
 * Une vignette du tiroir des modèles : l'image, le nom, et la coche de ce qui est choisi.
 * L'image passe en FOND CSS (pas d'<img>) : une tuile qui ne répond pas laisse le dégradé
 * dessous, jamais une icône d'image cassée.
 */
export function Vignette({ nom, actif, onClick, fond, etiquette, children }: { nom: string; actif: boolean; onClick: () => void; fond: string; etiquette?: string; children?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={actif} className="flex flex-col items-center gap-1.5">
      <span className={`relative h-[68px] w-[68px] overflow-hidden rounded-2xl ring-2 ring-offset-2 transition ${actif ? "ring-emerald-600" : "ring-transparent hover:ring-zinc-200"}`} style={{ background: fond }}>
        {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
        {etiquette && <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[9px] font-bold text-zinc-700">{etiquette}</span>}
        {actif && <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
      </span>
      <span className={`w-full text-center text-[11.5px] font-semibold leading-tight ${actif ? "text-emerald-700" : "text-zinc-700"}`}>{nom}</span>
    </button>
  );
}

/** Une action secondaire du bloc du bas : icône ronde + son mot, comme sur Strava. */
export function ActionCarte({ label, onClick, coche, disabled, danger, etroit, children }: { label: string; onClick: () => void; coche?: boolean; disabled?: boolean; danger?: boolean; etroit?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex flex-col items-center gap-1.5 disabled:opacity-35 ${etroit ? "w-[4.25rem]" : "w-24"}`}>
      <span className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-colors ${coche ? "bg-emerald-50 hover:bg-emerald-100" : danger ? "bg-red-50 hover:bg-red-100" : "bg-zinc-100 hover:bg-zinc-200"}`}>
        {children}
        {/* La coche dit « c'est ce qui est choisi », comme le sport chez Strava. */}
        {coche && <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white"><Check className="h-3 w-3" strokeWidth={3} /></span>}
      </span>
      <span className="w-full truncate text-center text-[12px] font-semibold text-zinc-700">{label}</span>
    </button>
  );
}

/** LE bouton : celui qu'on cherche du pouce sans regarder, au départ comme à l'arrivée. */
export function GrosBouton({ label, teinte, onClick, disabled, children }: { label: string; teinte: "emerald" | "rouge"; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  const vert = teinte === "emerald";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="-mt-3 flex w-24 flex-col items-center gap-1.5 disabled:opacity-40">
      <span className={`flex h-[76px] w-[76px] items-center justify-center rounded-full text-white transition-transform active:scale-95 ${vert ? "bg-emerald-600 shadow-[0_10px_24px_-10px_rgba(5,150,105,0.9)]" : "bg-red-600 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"}`}>
        {children}
      </span>
      <span className={`w-full truncate text-center text-[14px] font-bold ${vert ? "text-emerald-700" : "text-red-700"}`}>{label}</span>
    </button>
  );
}

/**
 * ══ LE TIROIR DES MODÈLES DE CARTE (27/11/2026) ════════════════════════════
 * Cyprien, vidéo de Strava à l'appui : « autant de modèles, en mieux, sans copier-coller ».
 * Les vignettes des FONDS sont de vraies images du quartier ; celles des CALQUES, de
 * petites cartes dessinées (la tuile d'un calque est vide là où il n'y a rien).
 * `sections` : ce que l'écran ajoute après les fonds (« Mes sorties » dans Enregistrer).
 */
export function TiroirModeles({
  fonds, calques, fondChoisi, onFond, calquesActifs, onCalque, relief3d, onRelief, reliefDispo, coin, onFermer, sections,
}: {
  fonds: FondCarte[];
  calques: CalqueCarte[];
  fondChoisi: FondCarte;
  onFond: (id: IdFond) => void;
  calquesActifs: IdCalque[];
  onCalque: (id: IdCalque) => void;
  relief3d: boolean;
  onRelief: () => void;
  reliefDispo: boolean;
  /** Le quartier montré dans les vignettes [lat, lon]. */
  coin: [number, number];
  onFermer: () => void;
  sections?: ReactNode;
}) {
  const { lang } = useT();
  const d = GX[lang] ?? GX.fr;
  const vignetteFond = (f: FondCarte) => {
    if (f.type === "vecteur") return vignetteDessinee(f.id);
    const img = `url("${tuileDe(f.urls![0], coin[0], coin[1], 14)}") center/cover`;
    return f.place === "sous-routes" ? `${VIGNETTE_RUES}, ${img}, ${VIGNETTE_PLAN}` : `${img}, ${VIGNETTE_PLAN}`;
  };
  const vignetteCalque = (c: CalqueCarte) => vignetteDessinee(c.id === "pentes-fr" ? "pentes" : c.id === "courbes-fr" ? "courbes" : c.id);
  return (
    <div className="absolute inset-x-0 bottom-0 z-[650] mx-auto max-h-[80%] max-w-xl overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_40px_-12px_rgba(9,9,11,0.5)]">
      {/* ⚠️ `z-10` : sans lui, les vignettes (positionnées) défilaient PAR-DESSUS le
          titre collé en haut — vu sur iPhone le 27/11/2026. */}
      <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-2 pt-0.5">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-200" aria-hidden />
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-bold text-zinc-900">{d["map.panneau"]}</p>
          <button type="button" onClick={onFermer} aria-label={d["map.fermer"]} className="rounded-full p-1.5 text-zinc-700 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <p className="mt-2 text-[15px] font-bold text-zinc-900">{d["map.fond"]}</p>
      <div className="mt-2.5 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
        {fonds.map((f) => (
          <Vignette key={f.id} nom={d[f.cle] ?? f.id} actif={fondChoisi.id === f.id} onClick={() => onFond(f.id)}
            etiquette={f.couverture !== "monde" ? f.couverture.toUpperCase() : undefined}
            fond={vignetteFond(f)} />
        ))}
      </div>

      {sections}

      {([["itineraires", d["map.secItineraires"]], ["relief", d["map.secRelief"]], ["affichage", d["map.secAffichage"]]] as const).map(([groupe, titre]) => {
        const liste = calques.filter((c) => c.groupe === groupe);
        const avec3d = groupe === "relief" && reliefDispo;
        if (!liste.length && !avec3d) return null;
        return (
          <div key={groupe}>
            <p className="mt-5 text-[15px] font-bold text-zinc-900">{titre}</p>
            {/* Les pentes de l'IGN ne sont dessinées qu'EN MONTAGNE : à Rouen la couche
                est vide, et sans cette phrase on la croirait en panne. */}
            {groupe === "relief" && liste.some((c) => c.id === "pentes-fr") && <p className="mt-0.5 text-[12px] text-zinc-500">{d["c.pentesAide"]}</p>}
            <div className="mt-2.5 grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
              {avec3d && (
                <Vignette nom={d["map.3d"]} actif={relief3d} onClick={onRelief} fond={vignetteDessinee("relief")}>
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-white/90 px-1 text-[11px] font-bold text-zinc-900">3D</span>
                </Vignette>
              )}
              {liste.map((c) => (
                <Vignette key={c.id} nom={d[c.cle] ?? c.id} actif={calquesActifs.includes(c.id)}
                  onClick={() => onCalque(c.id)}
                  etiquette={c.couverture !== "monde" ? c.couverture.toUpperCase() : undefined}
                  fond={vignetteCalque(c)}>
                  {c.id === "poi" && <MapPin className="h-6 w-6 text-rose-500" fill="#fecdd3" />}
                </Vignette>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
