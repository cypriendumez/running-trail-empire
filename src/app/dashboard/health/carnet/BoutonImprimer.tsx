"use client";

/** Ouvre l'impression du navigateur : « Enregistrer en PDF » y est proposé partout. */
export function BoutonImprimer({ libelle }: { libelle: string }) {
  return (
    <button type="button" onClick={() => window.print()}
      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 print:hidden">
      {libelle}
    </button>
  );
}
