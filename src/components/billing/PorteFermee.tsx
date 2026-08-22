"use client";
import Link from "next/link";
import { Lock, ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * CE QU'ON MONTRE À LA PLACE D'UNE FONCTION RÉSERVÉE.
 *
 * ⚠️ JAMAIS UN 403 MUET, ni une page blanche. Quelqu'un qui tombe sur une porte fermée
 * sans savoir POURQUOI ni CE QU'IL LUI MANQUE ne s'abonne pas — il se demande si l'app
 * est cassée. On nomme la fonction, on nomme la formule, et on met le lien.
 *
 * ⚠️ Aucun prix n'est écrit ici : `lib/billing/prix` est la seule source affichable, et
 * une recopie avait déjà donné trois montants différents sur trois écrans.
 */
const T: Record<string, Record<string, { titre: string; texte: string }>> = {
  fr: { gpx: { titre: "Trail Builder & export GPX", texte: "Trace tes propres boucles sur carte IGN et envoie-les à ta montre en GPX. C'est dans la formule Premium." } },
  en: { gpx: { titre: "Trail Builder & GPX export", texte: "Draw your own loops on the map and send them to your watch as GPX. It's part of the Premium plan." } },
  de: { gpx: { titre: "Trail Builder & GPX-Export", texte: "Zeichne eigene Runden auf der Karte und schick sie als GPX an deine Uhr. Teil des Premium-Tarifs." } },
  es: { gpx: { titre: "Trail Builder y exportación GPX", texte: "Traza tus propios circuitos en el mapa y envíalos a tu reloj en GPX. Está en el plan Premium." } },
  pt: { gpx: { titre: "Trail Builder e exportação GPX", texte: "Desenha os teus próprios percursos no mapa e envia-os para o relógio em GPX. Faz parte do plano Premium." } },
};

const CTA: Record<string, string> = {
  fr: "Voir les formules", en: "See the plans", de: "Tarife ansehen",
  es: "Ver los planes", pt: "Ver os planos",
};

export function PorteFermee({ capacite }: { capacite: "gpx" }) {
  const { lang } = useT();
  const t = (T[lang] ?? T.fr)[capacite] ?? T.fr[capacite];
  return (
    <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-inset ring-zinc-200">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100">
        <Lock className="h-5 w-5 text-zinc-500" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-zinc-900">{t.titre}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">{t.texte}</p>
      <Link href="/pricing" className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800">
        {CTA[lang] ?? CTA.fr} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
