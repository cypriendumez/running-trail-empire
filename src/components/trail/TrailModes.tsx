"use client";
import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { TrailBuilderLazy } from "./TrailBuilderLazy";

/**
 * DEUX MODES POUR LE MÊME ONGLET : construire, ou regarder le terrain.
 *
 * ⚠️ LE CONSTRUCTEUR N'EST PAS TOUCHÉ. Il fait 1 500 lignes qui fonctionnent — tracé au
 * clic, accrochage aux sentiers, profil altimétrique, export GPX. Y greffer du relief
 * aurait cassé un outil qui marche pour ajouter une vue. La vue relief est donc un mode
 * À CÔTÉ, chargé seulement quand on l'ouvre : MapLibre et son moteur de terrain pèsent
 * lourd, et l'immense majorité des visites vient pour construire une trace.
 */
const Relief3D = dynamic(() => import("./Relief3D").then((m) => m.Relief3D), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
    </div>
  ),
});

export function TrailModes({ centre, textes }: {
  centre?: { lat: number; lon: number } | null;
  textes: Record<string, string>;
}) {
  const [mode, setMode] = useState<"construire" | "relief">("construire");
  /**
   * ⚠️ LA TRACE VIT ICI, PAS DANS LE CONSTRUCTEUR. Les deux modes sont montés
   * séparément — garder deux moteurs cartographiques vivants en même temps serait
   * ruineux — donc la trace disparaîtrait au changement d'onglet si le constructeur la
   * gardait pour lui. Elle remonte, et la vue relief la reçoit telle quelle.
   */
  const [trace, setTrace] = useState<{ lat: number; lon: number }[]>([]);
  // `useCallback` : sans lui, une nouvelle fonction à chaque rendu relancerait l'effet de
  // remontée du constructeur en boucle.
  const recevoir = useCallback((points: { lat: number; lon: number }[]) => setTrace(points), []);

  /**
   * ⚠️ MAPLIBRE EST PRÉCHARGÉ PENDANT QU'ON CONSTRUIT (22/09/2026). Le module et son
   * moteur de terrain pèsent ~1 Mo : chargés AU CLIC sur « Vue relief », ils faisaient
   * attendre deux à trois secondes devant un rond qui tourne, alors que les tuiles, une
   * fois le code là, arrivent en 0,7 s (mesuré). On le télécharge en tâche de fond dès
   * que le navigateur est inactif — donc sans retarder le constructeur, qui est ce que
   * l'athlète regarde. `requestIdleCallback` n'existe pas sur Safari : repli sur un
   * délai. Le module reste hors du paquet initial : c'est un préchargement, pas un
   * import statique.
   */
  useEffect(() => {
    if (mode !== "construire") return;
    const precharger = () => { void import("./Relief3D"); };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) { const id = w.requestIdleCallback(precharger, { timeout: 4000 }); return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id); }
    const t = setTimeout(precharger, 2500);
    return () => clearTimeout(t);
  }, [mode]);
  const t = (k: string) => textes[k] ?? k;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
          {(["construire", "relief"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${mode === m ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-700"}`}>
              {m === "construire" ? t("mode.construire") : t("relief.titre")}
            </button>
          ))}
        </div>
        {mode === "relief" && (
          <p className="hidden max-w-sm text-right text-xs text-zinc-500 sm:block">
            {trace.length > 1 ? t("relief.avecTrace") : t("relief.sous")}
          </p>
        )}
      </div>

      {/* Les deux modes sont MONTÉS séparément : garder le constructeur vivant sous la vue
          relief ferait tourner deux moteurs cartographiques en même temps. */}
      {mode === "construire"
        ? <TrailBuilderLazy centre={centre} onTrace={recevoir} />
        : <Relief3D centre={centre} trace={trace} textes={textes} />}
    </div>
  );
}
