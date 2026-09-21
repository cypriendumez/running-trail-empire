"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Map, CalendarDays, LayoutGrid, X, User, Settings, LogOut, ShieldCheck, LifeBuoy, CircleDot } from "lucide-react";
import { MedicalDisclaimer } from "@/components/layout/MedicalDisclaimer";
import { EVENEMENT_AIDE } from "@/components/support/evenement";
import { deconnexion } from "@/lib/auth/deconnexion";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/lib/i18n/LanguageProvider";
import { NAV_GROUPES, ONGLETS_MOBILE, resteMobile, estActive } from "./navigation";

/**
 * LA NAVIGATION SUR TÉLÉPHONE — une barre d'onglets en bas d'écran, façon Strava.
 *
 * Demandée par Cyprien le 21/09/2026 : Accueil · Carte · Enregistrer · Calendrier · Plus.
 * Elle remplace le tiroir latéral ouvert par un bouton ☰ (deuxième version) qui avait
 * lui-même remplacé une colonne mangeant 62 % de l'écran (première version). Un onglet
 * se voit et se touche sans rien ouvrir : c'est ce qui manquait aux deux précédentes.
 *
 * ⚠️ « PLUS » NE CONTIENT RIEN QUI SOIT ÉCRIT ICI. Son contenu est `resteMobile()` : tout
 * ce que la barre latérale du bureau connaît et qui n'a pas d'onglet. Une page ajoutée
 * à `navigation.ts` apparaît donc ici sans qu'on y pense — et c'est bien le risque
 * inverse qu'on écarte : une page atteignable sur bureau et introuvable sur téléphone.
 *
 * ⚠️ LE BOUTON CENTRAL VA AU GHOST RUNNER, parce que c'est l'écran qui ENREGISTRE une
 * course GPS (`saveRun` sur les vraies sorties). Il n'y a pas d'autre enregistreur.
 *
 * Elle est `md:hidden` : à partir de `md`, la barre latérale reprend le service.
 */
const T: Record<string, { accueil: string; carte: string; enregistrer: string; calendrier: string; plus: string; tout: string; fermer: string; aide: string }> = {
  fr: { accueil: "Accueil", carte: "Carte", enregistrer: "Enregistrer", calendrier: "Calendrier", plus: "Plus", tout: "Tout Pacevo", fermer: "Fermer", aide: "Assistant" },
  en: { accueil: "Home", carte: "Map", enregistrer: "Record", calendrier: "Calendar", plus: "More", tout: "All of Pacevo", fermer: "Close", aide: "Assistant" },
  de: { accueil: "Start", carte: "Karte", enregistrer: "Aufzeichnen", calendrier: "Kalender", plus: "Mehr", tout: "Ganz Pacevo", fermer: "Schließen", aide: "Assistent" },
  es: { accueil: "Inicio", carte: "Mapa", enregistrer: "Grabar", calendrier: "Calendario", plus: "Más", tout: "Todo Pacevo", fermer: "Cerrar", aide: "Asistente" },
  pt: { accueil: "Início", carte: "Mapa", enregistrer: "Gravar", calendrier: "Calendário", plus: "Mais", tout: "Toda a Pacevo", fermer: "Fechar", aide: "Assistente" },
};

/** Hauteur de la barre (sans la zone de sécurité) — partagée avec la cale qui la réserve. */
const HAUTEUR = "4rem";

export function MobileTabBar({ unreadMessages = 0, estEditeur }: { unreadMessages?: number; estEditeur: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang } = useT();
  const d = T[lang] ?? T.fr;
  const [ouvert, setOuvert] = useState(false);

  // Naviguer referme la feuille : sinon elle reste ouverte PAR-DESSUS la page demandée.
  useEffect(() => { setOuvert(false); }, [pathname]);
  // Échap aussi — un clavier externe ou un lecteur d'écran s'y attendent.
  useEffect(() => {
    if (!ouvert) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ouvert]);

  async function signOut() {
    await deconnexion();
    router.push("/login");
  }

  const [accueil, carte, enregistrer, calendrier] = ONGLETS_MOBILE;
  const reste = resteMobile();
  // « Plus » est actif quand la page courante est l'une des siennes — l'athlète doit
  // savoir où il est même quand l'onglet n'est pas la page.
  const dansPlus = reste.some((r) => estActive(pathname, r.href)) || /^\/dashboard\/(profile|settings)/.test(pathname);
  const titre = (tk: string) => t(tk);

  const Onglet = ({ href, icone: Icone, label }: { href: string; icone: typeof Home; label: string }) => {
    const actif = estActive(pathname, href);
    return (
      <Link
        href={href}
        aria-current={actif ? "page" : undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
          actif ? "text-emerald-600" : "text-zinc-500 active:text-zinc-900",
        )}
      >
        <Icone className={cn("h-6 w-6", actif && "fill-emerald-100")} strokeWidth={actif ? 2.25 : 2} />
        {label}
      </Link>
    );
  };

  return (
    <>
      {/* Cale EN FLUX : réserve sous le contenu la place de la barre fixe, sinon le pied
          de page (avertissement médical, liens légaux) finit derrière elle. */}
      <div aria-hidden className="shrink-0 md:hidden" style={{ height: `calc(${HAUTEUR} + env(safe-area-inset-bottom))` }} />

      {/* Voile : un appui à côté referme la feuille. ⚠️ Voile et feuille sont au-dessus
          de z-50, où vit la bulle d'aide : sinon elle flotte PAR-DESSUS la feuille
          ouverte (vu en local). La barre reste au-dessus du voile, comme dans Strava. */}
      {ouvert && <div onClick={() => setOuvert(false)} className="fixed inset-0 z-[55] bg-zinc-900/40 md:hidden" aria-hidden="true" />}

      {/* La feuille « Plus » : tout le reste, en tuiles, au-dessus de la barre. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={d.tout}
        hidden={!ouvert}
        // ⚠️ UNE PAGE ENTIÈRE, PAS UNE FEUILLE À 70 % (Cyprien, 21/09/2026, capture) : la
        // feuille laissait la page du dessous dépasser en haut, et son entête « Tout
        // Pacevo » flottait au milieu de l'écran. Elle couvre maintenant tout, du haut de
        // l'écran jusqu'à la barre d'onglets.
        className="fixed inset-x-0 top-0 z-[60] overflow-y-auto bg-white md:hidden"
        style={{ bottom: `calc(${HAUTEUR} + env(safe-area-inset-bottom))` }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white px-5 py-3" style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
          <span className="text-sm font-bold text-zinc-900">{d.tout}</span>
          <button type="button" onClick={() => setOuvert(false)} aria-label={d.fermer} className="rounded-full p-1.5 text-zinc-500 active:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4">
          {NAV_GROUPES.map((g) => {
            const items = g.items.filter((it) => reste.includes(it));
            if (items.length === 0) return null;
            return (
              <div key={g.titleKey ?? "racine"} className="mb-5">
                {g.titleKey && <div className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{t(g.titleKey)}</div>}
                <div className="grid grid-cols-3 gap-2">
                  {items.map((it) => {
                    const actif = estActive(pathname, it.href);
                    const badge = it.href === "/dashboard/messages" ? unreadMessages : 0;
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        aria-current={actif ? "page" : undefined}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-[11px] font-medium leading-tight",
                          actif ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-700 active:bg-zinc-100",
                        )}
                      >
                        <it.icon className="h-5 w-5" />
                        {titre(it.tk)}
                        {badge > 0 && (
                          <span className="absolute right-2 top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Le compte : mêmes entrées que le pied de la barre latérale. */}
          <div className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-4">
            {estEditeur && (
              <Link href="/admin" className="flex flex-col items-center gap-1.5 rounded-2xl bg-emerald-50 px-2 py-3 text-center text-[11px] font-semibold leading-tight text-emerald-700">
                <ShieldCheck className="h-5 w-5" />Espace coach
              </Link>
            )}
            <Link href="/dashboard/profile" className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-50 px-2 py-3 text-center text-[11px] font-medium leading-tight text-zinc-700 active:bg-zinc-100">
              <User className="h-5 w-5" />{t("nav.profile")}
            </Link>
            <Link href="/dashboard/settings" className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-50 px-2 py-3 text-center text-[11px] font-medium leading-tight text-zinc-700 active:bg-zinc-100">
              <Settings className="h-5 w-5" />{t("nav.settings")}
            </Link>
            {/* ⚠️ L'ASSISTANT VIT ICI SUR TÉLÉPHONE, pas en bulle flottante : elle se posait
                sur le contenu et sur l'onglet « Plus » (demande de Cyprien, 21/09/2026).
                La tuile referme la feuille et réveille le panneau par un événement DOM :
                les deux composants ne partagent aucun état, et n'ont pas à le faire. */}
            <button
              type="button"
              onClick={() => { setOuvert(false); window.dispatchEvent(new CustomEvent(EVENEMENT_AIDE)); }}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-50 px-2 py-3 text-center text-[11px] font-medium leading-tight text-zinc-700 active:bg-zinc-100"
            >
              <LifeBuoy className="h-5 w-5" />{d.aide}
            </button>
            <button type="button" onClick={signOut} className="flex flex-col items-center gap-1.5 rounded-2xl bg-zinc-50 px-2 py-3 text-center text-[11px] font-medium leading-tight text-zinc-700 active:bg-red-50 active:text-red-600">
              <LogOut className="h-5 w-5" />{t("nav.logout")}
            </button>
          </div>
        </div>

        {/* L'avertissement médical et les liens légaux : retirés du bas de chaque écran
            sur téléphone (ils prenaient ~120 px), ils restent à un geste, sur chaque page. */}
        <MedicalDisclaimer lang={lang} />
      </div>

      {/* La barre elle-même. */}
      <nav
        aria-label={d.tout}
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5" style={{ height: HAUTEUR }}>
          <Onglet href={accueil} icone={Home} label={d.accueil} />
          <Onglet href={carte} icone={Map} label={d.carte} />

          {/* ⚠️ « ENREGISTRER » A LA MÊME TAILLE QUE LES AUTRES. La première version le
              surélevait dans un rond noir de 56 px, façon Strava : sur l'iPhone de Cyprien
              (21/09/2026) il mordait sur la ligne Garmin au-dessus et son libellé passait
              sous la barre d'accueil du téléphone. Un onglet parmi cinq, avec le glyphe
              « enregistrer » (cercle et point) pour rester reconnaissable. */}
          <Onglet href={enregistrer} icone={CircleDot} label={d.enregistrer} />

          <Onglet href={calendrier} icone={CalendarDays} label={d.calendrier} />

          <button
            type="button"
            onClick={() => setOuvert((v) => !v)}
            aria-label={d.plus}
            aria-expanded={ouvert}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors",
              ouvert || dansPlus ? "text-emerald-600" : "text-zinc-500 active:text-zinc-900",
            )}
          >
            <LayoutGrid className="h-6 w-6" strokeWidth={ouvert || dansPlus ? 2.25 : 2} />
            {d.plus}
            {/* Un point si un message attend derrière « Plus » : la pastille de la
                messagerie ne se voit pas tant que la feuille est fermée. */}
            {unreadMessages > 0 && !ouvert && <span className="absolute right-[calc(50%-16px)] top-2.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />}
          </button>
        </div>
      </nav>
    </>
  );
}
