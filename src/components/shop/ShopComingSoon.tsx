"use client";
/**
 * Écran d'attente de la boutique.
 *
 * Il remplace le catalogue tant qu'aucune offre RÉELLE n'a été importée. Le choix est
 * délibéré : mieux vaut dire honnêtement « pas encore » que montrer des prix inventés
 * sous le nom d'enseignes existantes. C'est la même règle que celle appliquée au coach
 * toute la journée — quand la donnée manque, on le dit, on ne la fabrique pas.
 */
import { ShoppingBag, BadgeCheck, Scale, Link2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

const T: Record<string, Record<string, string>> = {
  fr: {
    title: "La boutique arrive bientôt",
    lead: "Nous préférons ne rien afficher plutôt que des prix approximatifs. Les offres seront importées directement depuis les flux officiels des marchands — vrais prix, vraie disponibilité, mis à jour chaque jour.",
    p1: "Prix et stocks issus des flux officiels des enseignes",
    p2: "Comparaison entre marchands sur le même modèle",
    p3: "Liens partenaires signalés, sans surcoût pour toi",
    note: "Aucun prix ne sera affiché tant qu'il ne provient pas directement d'un marchand.",
  },
  en: {
    title: "The shop is coming",
    lead: "We would rather show nothing than approximate prices. Offers will be imported straight from merchants' official feeds — real prices, real stock, refreshed daily.",
    p1: "Prices and stock from official retailer feeds",
    p2: "Compare merchants on the same model",
    p3: "Affiliate links clearly flagged, at no extra cost to you",
    note: "No price will be shown unless it comes straight from a merchant.",
  },
  de: {
    title: "Der Shop kommt bald",
    lead: "Lieber nichts anzeigen als ungefähre Preise. Die Angebote stammen künftig direkt aus den offiziellen Händler-Feeds — echte Preise, echte Verfügbarkeit, täglich aktualisiert.",
    p1: "Preise und Bestände aus offiziellen Händler-Feeds",
    p2: "Händlervergleich für dasselbe Modell",
    p3: "Partnerlinks gekennzeichnet, ohne Aufpreis für dich",
    note: "Es wird kein Preis angezeigt, der nicht direkt von einem Händler stammt.",
  },
  es: {
    title: "La tienda llega pronto",
    lead: "Preferimos no mostrar nada antes que precios aproximados. Las ofertas se importarán directamente de los feeds oficiales de las tiendas: precios reales, stock real, actualizados a diario.",
    p1: "Precios y stock desde los feeds oficiales de las tiendas",
    p2: "Comparación entre comercios para el mismo modelo",
    p3: "Enlaces de afiliación señalados, sin coste adicional para ti",
    note: "No se mostrará ningún precio que no venga directamente de un comercio.",
  },
  pt: {
    title: "A loja está a chegar",
    lead: "Preferimos não mostrar nada a mostrar preços aproximados. As ofertas serão importadas diretamente dos feeds oficiais das lojas — preços reais, stock real, atualizados diariamente.",
    p1: "Preços e stock a partir dos feeds oficiais das lojas",
    p2: "Comparação entre lojas para o mesmo modelo",
    p3: "Ligações de afiliação assinaladas, sem custo adicional para ti",
    note: "Nenhum preço será apresentado sem vir diretamente de um comerciante.",
  },
};

export function ShopComingSoon() {
  const { lang } = useT();
  const d = T[lang] ?? T.fr;
  const points = [
    { icon: BadgeCheck, text: d.p1 },
    { icon: Scale, text: d.p2 },
    { icon: Link2, text: d.p3 },
  ];
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
        <ShoppingBag className="h-7 w-7 text-emerald-600" />
      </div>
      <h1 className="text-2xl font-black tracking-tight text-zinc-900">{d.title}</h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-600">{d.lead}</p>
      <ul className="mx-auto mt-8 grid max-w-md gap-3 text-left">
        {points.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span className="text-[13px] leading-relaxed text-zinc-700">{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-[12px] leading-relaxed text-zinc-400">{d.note}</p>
    </div>
  );
}
