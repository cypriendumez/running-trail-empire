"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Map, CalendarDays, LayoutGrid, X, User, Settings, LogOut, ShieldCheck, LifeBuoy, CircleDot, ChevronRight } from "lucide-react";
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

/** Une ligne de la page « Plus » : icône, libellé, chevron — 44 px, la hauteur qu'un pouce touche sans viser. */
const LIGNE = "flex min-h-[44px] items-center gap-3 px-4 py-2.5 text-[14px] font-medium";

export function MobileTabBar({ unreadMessages = 0, estEditeur, avertissement }: {
  unreadMessages?: number; estEditeur: boolean;
  /** L'avertissement médical, rendu par le layout SERVEUR (voir là-bas pourquoi). */
  avertissement?: React.ReactNode;
}) {
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
        // ⚠️ PRÉCHARGÉ EN ENTIER : sans `prefetch`, une page dynamique n'est préchargée que
        // jusqu'à son squelette (loading.tsx), et le premier appui sur un onglet attend le
        // serveur. La barre est toujours à l'écran, donc les quatre pages se préchargent
        // une fois par session (puis à l'expiration de `staleTimes`) — quatre rendus pour
        // des appuis instantanés.
        prefetch={true}
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

      {/* La page « Plus » : tout le reste, en listes par rubrique, au-dessus de la barre. */}
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

        {/* ⚠️ DES LISTES, PAS DES TUILES (Cyprien, 21/09/2026, capture « range mieux les
            différentes catégories ») : en tuiles de trois, un groupe de quatre pages laissait
            deux trous et un groupe de cinq, un trou — l'œil lisait un damier, pas des
            rubriques. Une liste se lit de haut en bas, un groupe = un bloc, sans trou quel
            que soit le nombre de pages. Même patron pour le compte, en dernier bloc. */}
        <div className="px-4 py-4">
          {NAV_GROUPES.map((g) => {
            const items = g.items.filter((it) => reste.includes(it));
            if (items.length === 0) return null;
            return (
              <section key={g.titleKey ?? "racine"} className="mb-4" aria-label={g.titleKey ? t(g.titleKey) : undefined}>
                {g.titleKey && <h2 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{t(g.titleKey)}</h2>}
                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100">
                  {items.map((it) => {
                    const actif = estActive(pathname, it.href);
                    const badge = it.href === "/dashboard/messages" ? unreadMessages : 0;
                    return (
                      <Link key={it.href} href={it.href} aria-current={actif ? "page" : undefined} className={cn(LIGNE, actif ? "bg-zinc-900 text-white" : "text-zinc-800 active:bg-zinc-100")}>
                        <it.icon className={cn("h-5 w-5 shrink-0", actif ? "text-white" : "text-zinc-500")} />
                        <span className="flex-1 truncate">{titre(it.tk)}</span>
                        {badge > 0 && (
                          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{badge > 9 ? "9+" : badge}</span>
                        )}
                        <ChevronRight className={cn("h-4 w-4 shrink-0", actif ? "text-white/70" : "text-zinc-400")} />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Le compte : mêmes entrées que le pied de la barre latérale, en dernier bloc. */}
          <section className="mb-4" aria-label={t("group.account")}>
            <h2 className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">{t("group.account")}</h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100">
              {estEditeur && (
                <Link href="/admin" className={cn(LIGNE, "bg-emerald-50 font-semibold text-emerald-700 active:bg-emerald-100")}>
                  <ShieldCheck className="h-5 w-5 shrink-0" /><span className="flex-1">Espace coach</span><ChevronRight className="h-4 w-4 shrink-0 text-emerald-400" />
                </Link>
              )}
              <Link href="/dashboard/profile" className={cn(LIGNE, "text-zinc-800 active:bg-zinc-100")}>
                <User className="h-5 w-5 shrink-0 text-zinc-500" /><span className="flex-1">{t("nav.profile")}</span><ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </Link>
              <Link href="/dashboard/settings" className={cn(LIGNE, "text-zinc-800 active:bg-zinc-100")}>
                <Settings className="h-5 w-5 shrink-0 text-zinc-500" /><span className="flex-1">{t("nav.settings")}</span><ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </Link>
              {/* ⚠️ L'ASSISTANT VIT ICI SUR TÉLÉPHONE, pas en bulle flottante : elle se posait
                  sur le contenu et sur l'onglet « Plus » (demande de Cyprien, 21/09/2026).
                  La ligne referme la page et réveille le panneau par un événement DOM :
                  les deux composants ne partagent aucun état, et n'ont pas à le faire. */}
              <button type="button" onClick={() => { setOuvert(false); window.dispatchEvent(new CustomEvent(EVENEMENT_AIDE)); }} className={cn(LIGNE, "w-full text-left text-zinc-800 active:bg-zinc-100")}>
                <LifeBuoy className="h-5 w-5 shrink-0 text-zinc-500" /><span className="flex-1">{d.aide}</span><ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
              </button>
              <button type="button" onClick={signOut} className={cn(LIGNE, "w-full text-left text-zinc-800 active:bg-red-50 active:text-red-600")}>
                <LogOut className="h-5 w-5 shrink-0 text-zinc-500" /><span className="flex-1">{t("nav.logout")}</span>
              </button>
            </div>
          </section>
        </div>

        {/* L'avertissement médical et les liens légaux : retirés du bas de chaque écran
            sur téléphone (ils prenaient ~120 px), ils restent à un geste, sur chaque page. */}
        {avertissement}
      </div>

      {/* La barre elle-même. */}
      <nav
        aria-label={d.tout}
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-zinc-200 bg-white md:hidden"
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
