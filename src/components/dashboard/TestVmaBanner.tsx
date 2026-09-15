"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Loader2, Check, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { vmaFrom6min } from "@/lib/running/fitness";

/**
 * ENREGISTRER SON TEST VMA — le point de sortie du verrou.
 *
 * Tant qu'aucune VMA n'est mesurée, le coach ne prescrit QUE le test 6 min (voir
 * lib/ai/autoCoach → prescrireTestVma) et le plan complet reste fermé. Ce bandeau donne à
 * l'athlète le moyen de fermer la boucle : il fait le test (montre ou téléphone), saisit la
 * distance parcourue en 6 min, sa VMA est calculée et le plan complet se débloque.
 *
 * ⚠️ Le serveur RECALCULE la VMA depuis la distance (/api/vma) : l'aperçu ci-dessous n'est
 * qu'un confort d'affichage, il ne fait pas foi.
 *
 * Ne s'affiche que si `measured` est faux — l'état est calculé côté serveur (présence d'une
 * ligne performance_baselines), donc aucun appel réseau au montage.
 */
const T: Record<string, {
  eyebrow: string; titre: string; intro: string; how: string;
  distLabel: string; place: string; preview: string; connais: string; masquer: string;
  vmaLabel: string; valider: string; envoi: string; merci: string; erreur: string; hors: string;
}> = {
  fr: {
    eyebrow: "Première étape", titre: "Fais ton test VMA",
    intro: "C'est la seule séance pour l'instant : ta VMA calibre toutes tes allures. Fais-la quand tu veux, puis entre ta distance ci-dessous — ton plan complet se débloque aussitôt.",
    how: "Échauffe-toi 15 min facile, cours 6 min À FOND sur du plat (une piste est idéale), retour au calme. Pas de montre ? Lance un enregistrement de 6 min dans « Enregistrer ».",
    distLabel: "Distance parcourue en 6 min", place: "ex : 1650", preview: "VMA ≈ {v} km/h",
    connais: "Je connais déjà ma VMA", masquer: "J'ai fait le test 6 min",
    vmaLabel: "Ta VMA (km/h)", valider: "Débloquer mon plan", envoi: "Enregistrement…",
    merci: "VMA enregistrée — ton plan complet arrive.", erreur: "Une erreur est survenue.",
    hors: "Distance inhabituelle : vérifie ta saisie (en mètres).",
  },
  en: {
    eyebrow: "First step", titre: "Do your vVO2max test",
    intro: "It's the only session for now: your vVO2max calibrates every pace. Do it whenever, then enter your distance below — your full plan unlocks right away.",
    how: "Warm up 15 min easy, run 6 min ALL OUT on flat ground (a track is ideal), cool down. No watch? Start a 6-min recording in \"Record\".",
    distLabel: "Distance covered in 6 min", place: "e.g. 1650", preview: "vVO2max ≈ {v} km/h",
    connais: "I already know my vVO2max", masquer: "I did the 6-min test",
    vmaLabel: "Your vVO2max (km/h)", valider: "Unlock my plan", envoi: "Saving…",
    merci: "Saved — your full plan is on its way.", erreur: "Something went wrong.",
    hors: "Unusual distance: check your entry (in metres).",
  },
  de: {
    eyebrow: "Erster Schritt", titre: "Mach deinen vVO2max-Test",
    intro: "Vorerst die einzige Einheit: Deine vVO2max kalibriert jedes Tempo. Mach ihn, wann du willst, und trag deine Distanz unten ein — dein voller Plan wird sofort freigeschaltet.",
    how: "15 Min locker einlaufen, 6 Min VOLL auf flachem Grund (eine Bahn ist ideal), auslaufen. Keine Uhr? Starte in „Aufzeichnen“ eine 6-Min-Aufnahme.",
    distLabel: "In 6 Min zurückgelegte Distanz", place: "z. B. 1650", preview: "vVO2max ≈ {v} km/h",
    connais: "Ich kenne meine vVO2max bereits", masquer: "Ich habe den 6-Min-Test gemacht",
    vmaLabel: "Deine vVO2max (km/h)", valider: "Plan freischalten", envoi: "Speichern…",
    merci: "Gespeichert — dein voller Plan kommt.", erreur: "Ein Fehler ist aufgetreten.",
    hors: "Ungewöhnliche Distanz: prüfe deine Eingabe (in Metern).",
  },
  es: {
    eyebrow: "Primer paso", titre: "Haz tu test de VAM",
    intro: "Es la única sesión por ahora: tu VAM calibra todos tus ritmos. Hazla cuando quieras y luego introduce tu distancia abajo — tu plan completo se desbloquea al instante.",
    how: "Calienta 15 min suave, corre 6 min A TOPE en llano (una pista es ideal), vuelta a la calma. ¿Sin reloj? Inicia una grabación de 6 min en «Grabar».",
    distLabel: "Distancia recorrida en 6 min", place: "ej: 1650", preview: "VAM ≈ {v} km/h",
    connais: "Ya conozco mi VAM", masquer: "Hice el test de 6 min",
    vmaLabel: "Tu VAM (km/h)", valider: "Desbloquear mi plan", envoi: "Guardando…",
    merci: "Guardado — tu plan completo está en camino.", erreur: "Se ha producido un error.",
    hors: "Distancia inusual: revisa lo que has introducido (en metros).",
  },
  pt: {
    eyebrow: "Primeiro passo", titre: "Faz o teu teste de VAM",
    intro: "É a única sessão por agora: a tua VAM calibra todos os ritmos. Fá-la quando quiseres e depois insere a tua distância abaixo — o teu plano completo desbloqueia logo.",
    how: "Aquece 15 min leve, corre 6 min NO MÁXIMO em plano (uma pista é ideal), volta à calma. Sem relógio? Inicia uma gravação de 6 min em «Gravar».",
    distLabel: "Distância percorrida em 6 min", place: "ex: 1650", preview: "VAM ≈ {v} km/h",
    connais: "Já conheço a minha VAM", masquer: "Fiz o teste de 6 min",
    vmaLabel: "A tua VAM (km/h)", valider: "Desbloquear o meu plano", envoi: "A guardar…",
    merci: "Guardado — o teu plano completo está a chegar.", erreur: "Ocorreu um erro.",
    hors: "Distância invulgar: verifica o que inseriste (em metros).",
  },
};

export function TestVmaBanner({ measured }: { measured: boolean }) {
  const { lang } = useT();
  const t = T[lang] ?? T.fr;
  const router = useRouter();
  const [mode, setMode] = useState<"dist" | "vma">("dist");
  const [meters, setMeters] = useState("");
  const [vma, setVma] = useState("");
  const [etat, setEtat] = useState<"pret" | "envoi" | "merci">("pret");
  const [erreur, setErreur] = useState<string | null>(null);

  if (measured) return null;

  const apercuVma = mode === "dist" ? vmaFrom6min(parseFloat(meters)) : (parseFloat(vma) || null);
  const valeurPrete = apercuVma != null && apercuVma >= 8 && apercuVma <= 30;

  async function envoyer() {
    setEtat("envoi"); setErreur(null);
    try {
      const body = mode === "dist" ? { meters: parseFloat(meters) } : { vma_kmh: parseFloat(vma) };
      const r = await fetch("/api/vma", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErreur(j?.error ?? t.erreur); setEtat("pret"); return; }
      setEtat("merci");
      // Le plan complet vient d'être régénéré côté serveur : on rafraîchit pour l'afficher.
      router.refresh();
    } catch { setErreur(t.erreur); setEtat("pret"); }
  }

  if (etat === "merci") {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-3xl bg-emerald-50 p-5 ring-1 ring-inset ring-emerald-200">
        <Check className="h-5 w-5 flex-shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-900">{t.merci}</p>
      </div>
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-inset ring-zinc-200">
      <div className="flex items-start gap-3 border-b border-zinc-100 bg-gradient-to-br from-emerald-50 to-white px-6 py-5">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-700">
          <Gauge className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{t.eyebrow}</div>
          <h3 className="mt-0.5 text-base font-bold text-zinc-900">{t.titre}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-600">{t.intro}</p>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-xs leading-relaxed text-zinc-500">{t.how}</p>

        {mode === "dist" ? (
          <div>
            <label htmlFor="vma-meters" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t.distLabel}</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[140px]">
                <input
                  id="vma-meters" type="number" inputMode="numeric" value={meters}
                  onChange={(e) => setMeters(e.target.value)} placeholder={t.place} min={800} max={3500} step={10}
                  className="w-full rounded-2xl border-0 bg-zinc-50 py-3 pl-4 pr-12 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400">m</span>
              </div>
              {apercuVma != null && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${valeurPrete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {valeurPrete ? t.preview.replace("{v}", String(apercuVma)) : t.hors}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="vma-value" className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{t.vmaLabel}</label>
            <input
              id="vma-value" type="number" inputMode="decimal" value={vma}
              onChange={(e) => setVma(e.target.value)} placeholder="ex : 16.5" min={8} max={30} step={0.5}
              className="mt-2 w-full rounded-2xl border-0 bg-zinc-50 py-3 px-4 text-sm text-zinc-800 ring-1 ring-inset ring-zinc-200 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}

        {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => { setMode(mode === "dist" ? "vma" : "dist"); setErreur(null); }}
            className="text-xs font-semibold text-zinc-500 underline underline-offset-4 hover:text-zinc-700"
          >
            {mode === "dist" ? t.connais : t.masquer}
          </button>
          <button
            onClick={envoyer} disabled={etat === "envoi" || !valeurPrete}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {etat === "envoi" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {etat === "envoi" ? t.envoi : t.valider}
            {etat !== "envoi" && <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
