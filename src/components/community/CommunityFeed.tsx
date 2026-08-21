"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  Newspaper, ExternalLink, RefreshCw,
  Footprints, Mountain, Flame, Medal, Watch, Mail, type LucideIcon,
} from "lucide-react";
import { NewsletterSignup } from "@/components/NewsletterSignup";

type Item = { title: string; source: string; link: string; date: string; domain?: string; favicon?: string };
type Cat = "all" | "running" | "trail" | "ultra" | "marathon" | "gear";
const CATS: Cat[] = ["all", "running", "trail", "ultra", "marathon", "gear"];

// i18n local de la page (5 langues) — la page naît traduite.
const L: Record<string, Record<string, string>> = {
  fr: { title: "Communauté & Actualité", subtitle: "Toute l'actu running & trail, en direct des médias spécialisés.", all: "Tout", running: "Running", trail: "Trail", ultra: "Ultra", marathon: "Marathon", gear: "Matériel", read: "Lire", loading: "Chargement de l'actu…", empty: "Aucune actualité pour le moment.", via: "Revue de presse : titre, éditeur et lien. Aucun article ni photo n'est reproduit — clique pour lire chez la source.", refresh: "Actualiser" },
  en: { title: "Community & News", subtitle: "All the running & trail news, live from specialist media.", all: "All", running: "Running", trail: "Trail", ultra: "Ultra", marathon: "Marathon", gear: "Gear", read: "Read", loading: "Loading news…", empty: "No news right now.", via: "Press review: headline, publisher and link. No article or photo is reproduced — click to read at the source.", refresh: "Refresh" },
  de: { title: "Community & News", subtitle: "Alle Lauf- & Trail-News, live aus den Fachmedien.", all: "Alle", running: "Laufen", trail: "Trail", ultra: "Ultra", marathon: "Marathon", gear: "Ausrüstung", read: "Lesen", loading: "News werden geladen…", empty: "Aktuell keine News.", via: "Pressespiegel: Titel, Verlag und Link. Kein Artikel und kein Foto wird wiedergegeben — zum Lesen auf die Quelle klicken.", refresh: "Aktualisieren" },
  es: { title: "Comunidad y Actualidad", subtitle: "Toda la actualidad de running y trail, en directo de los medios especializados.", all: "Todo", running: "Running", trail: "Trail", ultra: "Ultra", marathon: "Maratón", gear: "Material", read: "Leer", loading: "Cargando noticias…", empty: "No hay noticias por ahora.", via: "Revista de prensa: titular, editor y enlace. No se reproduce ningún artículo ni foto — haz clic para leer en la fuente.", refresh: "Actualizar" },
  pt: { title: "Comunidade e Atualidade", subtitle: "Todas as notícias de corrida e trail, ao vivo da mídia especializada.", all: "Tudo", running: "Corrida", trail: "Trail", ultra: "Ultra", marathon: "Maratona", gear: "Material", read: "Ler", loading: "A carregar notícias…", empty: "Nenhuma notícia por agora.", via: "Revista de imprensa: título, editor e ligação. Nenhum artigo ou foto é reproduzido — clica para ler na fonte.", refresh: "Atualizar" },
};
const LOCALE: Record<string, string> = { fr: "fr-FR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT" };

// Habillage par catégorie : un dégradé + une icône en lien avec le thème de l'article.
const THEME: Record<Cat, { grad: string; icon: LucideIcon }> = {
  all: { grad: "from-zinc-600 to-zinc-800", icon: Newspaper },
  running: { grad: "from-emerald-500 to-teal-600", icon: Footprints },
  trail: { grad: "from-lime-600 via-emerald-600 to-emerald-700", icon: Mountain },
  ultra: { grad: "from-orange-500 to-red-600", icon: Flame },
  marathon: { grad: "from-sky-500 to-indigo-600", icon: Medal },
  gear: { grad: "from-violet-500 to-fuchsia-600", icon: Watch },
};

// Photos d'illustration par catégorie — sources LÉGALES pour usage COMMERCIAL, sans
// attribution requise : Unsplash + Pexels. Ce ne sont PAS les photos des articles
// sources (qui seraient protégées) : juste un visuel de thème.
// Plusieurs par catégorie → varié d'une carte à l'autre.
const UN = (id: string) => `https://images.unsplash.com/photo-${id}?w=640&q=70&auto=format&fit=crop`;
const PX = (id: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=640`;
// ⚠️ CE COMMENTAIRE AFFIRMAIT « ~100 photos vérifiées une par une, AUCUN logo de
// marque ». C'ÉTAIT FAUX, et deux fois : le compte réel était de 162 photos (154 Pexels
// + 8 Unsplash), et la liste « vérifiée » contenait les pires images du projet.
//
// AUDIT RÉEL — 20/08/2026. Les 162 ont été regardées, en planches-contacts de 16
// vignettes à 400 px. Ce format n'est pas un raccourci : le critère du projet est la
// PROÉMINENCE, donc ce qui ne se voit pas dans une vignette n'est, par définition, pas
// proéminent. 74 photos Pexels ont été retirées. Ce qu'elles portaient :
//
//  · des DOSSARDS LISIBLES (692, 684, 546, 403, 56224, 9664, 10286…) — donnée
//    nominative, les résultats de course étant publics ;
//  · des ATHLÈTES PROFESSIONNELS IDENTIFIABLES. Trois photos montraient Jacob
//    KIPLIMO, nom lisible sur le dossard, à l'arrivée du marathon de Lisbonne, en
//    maillot Nike. Le droit à l'image d'un athlète élite est un actif géré ;
//  · des BANDEAUX SPONSORS (EDP, LUSO, IMCUFIDE LERMA, SPOR A.Ş., « pessoal ») et
//    une banderole d'arrivée au grand logo ADIDAS (21K Buenos Aires) ;
//  · des VISAGES nets, de face, parfaitement identifiables.
//
// CE QUI RESTE — 80 photos Pexels, toutes vues : silhouettes à contre-jour, coureurs de
// dos, sujets lointains dans un paysage, jambes ou mains seules. La catégorie
// `marathon` est tombée de 38 à 4 (la photo de course EST le problème) : complétée avec
// des validées du même thème plutôt que laissée à quatre images en boucle.
//
// ⚠️ tests/photos.test.ts VÉRIFIE cette liste. Ajouter un PX() inconnu fait ROUGIR la
// suite — c'est voulu : on n'ajoute pas une photo ici sans l'avoir ouverte.
// Sources : Pexels + Unsplash (toutes deux licence usage commercial sans attribution).
const PHOTOS: Record<Cat, string[]> = {
  all: [PX(35115744), PX(2402734), PX(32798746), PX(35765666), PX(8454901), PX(37718409), UN("1504025468847-0e438279542c")],
  running: [PX(35115744), PX(35765666), PX(23857950), PX(19783892), PX(19881117), PX(5198385), PX(33378482), PX(10615641), PX(37046063), PX(37718409), PX(10516108), PX(8533790), PX(31675724), PX(30144519), PX(12698200), PX(32130258), PX(4348640), PX(7879913), PX(10615645), PX(16980804), PX(32381195), PX(4920448), PX(5319325), PX(37993134), PX(8454900), PX(4422913), PX(34730429), PX(36732202), PX(36645343), PX(16949283), PX(33491424), PX(13631464), PX(28768323), PX(30652598), PX(34210063), PX(12562821), PX(20789142), PX(12360284), PX(19439272), PX(6455591), PX(36665709), PX(35425192), PX(6455667), PX(35718700), PX(7026516), PX(35527724), PX(9563709), UN("1560052767-406e947cc273"), UN("1476480862126-209bfaa8edc8"), UN("1502904550040-7534597429ae")],
  trail: [PX(32798746), PX(32798745), PX(33284136), PX(33284135), PX(32798744), PX(35206081), PX(33874843), PX(29116008), PX(25078526), PX(30932860), PX(31805881), PX(9790261), PX(33522755), PX(32798754), PX(38074682), PX(33076361), PX(30932855), PX(32962276), PX(32798757), PX(6778610), PX(31238485), PX(30416813), PX(35684458), UN("1504025468847-0e438279542c"), UN("1486218119243-13883505764c"), UN("1454496522488-7a8e488e8606")],
  ultra: [PX(33284135), PX(25078526), PX(30932860), PX(31805881), PX(33522755), PX(38074682), PX(29116008), PX(32798754), PX(32962276), UN("1551632811-561732d1e306")],
  marathon: [PX(2402734), PX(4606708), PX(10168171), PX(19783892), PX(19881117), PX(23857950), PX(30144519), PX(32381195), PX(33378482), PX(35115744), PX(35718700), PX(37046063), PX(10516108), PX(10615641), PX(12360284), PX(28768323), PX(36645343), PX(36732202), UN("1590333748338-d629e4564ad9")],
  gear: [PX(8454904), PX(8497536), PX(3763869), PX(32145212), PX(9207813), PX(8454901), PX(8456074)],
};

// Déduit la catégorie d'un article depuis son titre → choisit une photo en LIEN avec
// le sujet (mots-clés enrichis FR + EN). Ordre = du plus spécifique au plus général.
function catOf(title: string): Cat {
  const s = title.toLowerCase();
  // Matériel d'abord (un test de chaussure peut contenir "trail" ou "marathon").
  if (/chaussure|sneaker|basket|montre|gps|cardio|capteur|\btest\b|comparatif|mat[ée]riel|[ée]quipement|gel\b|nutrition|hydratation|ravitaillement|sac\b|b[âa]ton|veste|review|garmin|coros|suunto|polar|\bshoe|gear|watch/.test(s)) return "gear";
  if (/ultra|utmb|\b100\s?km\b|\b100\s?miles\b|ultramarathon|ultra-?trail|backyard|diagonale des fous|grand raid|tor des|western states|barkley|hardrock|\b6000d\b|\b160\s?km|endurance extr/.test(s)) return "ultra";
  if (/trail|sentier|montagne|\bmont\b|kilom[èe]tre vertical|\bkv\b|verticale|skyrace|sky\s?running|d[ée]nivel[ée]|single\s?track|for[êe]t|cross\b/.test(s)) return "trail";
  if (/marathon|semi[- ]?marathon|\bsemi\b|42\s?km|42[.,]195|21\s?km|21[.,]1|record.*(marathon|route)/.test(s)) return "marathon";
  return "running";
}

// Favicon de l'éditeur (logo public) avec repli sur une initiale si l'image manque.
function Favicon({ src, name, className = "h-4 w-4" }: { src?: string; name: string; className?: string }) {
  const [ok, setOk] = useState(true);
  if (src && ok) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" onError={() => setOk(false)} className={`${className} rounded-sm object-contain`} />;
  }
  return (
    <span className={`${className} flex items-center justify-center rounded-sm bg-zinc-200 text-[9px] font-bold text-zinc-500`}>
      {(name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

export function CommunityFeed() {
  const { t, lang } = useT();
  const tr = (k: string) => L[lang]?.[k] ?? L.fr[k] ?? k;
  const [cat, setCat] = useState<Cat>("all");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const load = (c: Cat) => {
    setLoading(true);
    fetch(`/api/community/news?cat=${c}`)
      .then((r) => r.json())
      .then((j) => setItems(Array.isArray(j.items) ? j.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(cat); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cat]);

  const fmtDate = (d: string) => {
    const t = new Date(d).getTime();
    if (!t) return "";
    const h = Math.floor((Date.now() - t) / 3600000);
    if (h < 1) return "•";
    if (h < 24) return `${h} h`;
    return new Date(t).toLocaleDateString(LOCALE[lang] ?? "fr-FR", { day: "numeric", month: "short" });
  };

  const itemCat = (it: Item): Cat => (cat !== "all" ? cat : catOf(it.title));

  // Pied de carte (source + date + « Lire ») — réutilisé par la carte vedette et les cartes standard.
  const Footer = ({ it }: { it: Item }) => (
    <div className="mt-auto flex items-center gap-2 pt-3 text-xs">
      <Favicon src={it.favicon} name={it.source} className="h-4 w-4" />
      <span className="truncate font-medium text-zinc-500">{it.source}</span>
      {it.date && <><span className="text-zinc-300">·</span><span className="shrink-0 text-zinc-400">{fmtDate(it.date)}</span></>}
      <span className="ml-auto flex shrink-0 items-center gap-1 font-semibold text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100">
        {tr("read")} <ExternalLink className="h-3 w-3" />
      </span>
    </div>
  );

  const Cover = ({ c, big = false, seed = 0 }: { c: Cat; big?: boolean; seed?: number }) => {
    const Icon = THEME[c].icon;
    const pool = PHOTOS[c] ?? PHOTOS.running;
    const photo = pool[((seed % pool.length) + pool.length) % pool.length];
    return (
      <div className={`relative overflow-hidden bg-gradient-to-br ${THEME[c].grad} ${big ? "h-48 sm:h-auto sm:w-[40%]" : "h-28"}`}>
        {/* Photo représentative libre de droits (Unsplash, usage commercial OK) par catégorie */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        {/* Voile dégradé teinté : lisibilité du badge + identité couleur de la catégorie */}
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${THEME[c].grad} opacity-50 mix-blend-multiply`} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-black/10" />
        {/* reflet qui balaie au survol */}
        <div className="pointer-events-none absolute -inset-y-2 -left-1/3 w-1/3 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 group-hover:translate-x-[420%]" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/25 backdrop-blur-sm">
          <Icon className="h-3 w-3" /> {tr(c)}
        </span>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl pb-12">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl p-7 text-white shadow-[0_18px_50px_-24px_rgba(5,80,60,0.7)]" style={{ background: "linear-gradient(135deg,#064e3b 0%,#047857 45%,#0d9488 100%)" }}>
        <div className="pointer-events-none absolute -top-20 -right-12 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/20 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-50">{tr("title")}</span>
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{tr("title")}</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-white/85">{tr("subtitle")}</p>
        </div>
      </motion.div>

      {/* Encart newsletter (opt-in in-app) */}
      <div className="mt-5 overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="mb-3 flex items-start gap-3 sm:mb-0">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100"><Mail className="h-5 w-5 text-emerald-600" /></span>
          <div>
            <h3 className="font-bold text-zinc-900">{t("news.title")}</h3>
            <p className="text-sm text-zinc-500">{t("news.sub")}</p>
          </div>
        </div>
        <div className="w-full sm:max-w-sm"><NewsletterSignup /></div>
      </div>

      {/* Filtres */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {CATS.map((c) => {
          const Icon = THEME[c].icon;
          const active = cat === c;
          return (
            <button key={c} onClick={() => setCat(c)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"}`}>
              {active && <motion.span layoutId="community-cat-pill" transition={{ type: "spring", stiffness: 460, damping: 34 }} className="absolute inset-0 rounded-full bg-zinc-900" />}
              <span className="relative flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {tr(c)}</span>
            </button>
          );
        })}
        <button onClick={() => load(cat)} disabled={loading} title={tr("refresh")}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-500 ring-1 ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Liste */}
      <div className="mt-5">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="h-24 animate-pulse bg-zinc-100" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-100" />
                  <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-400"><Newspaper className="mx-auto mb-3 h-10 w-10 text-zinc-200" />{tr("empty")}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((it, i) => {
              const c = itemCat(it);
              if (i === 0) {
                // Carte vedette — pleine largeur, cover latérale, titre plus grand.
                return (
                  <motion.a key={i} href={it.link} target="_blank" rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }} whileHover={{ y: -4 }}
                    className="group flex flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white transition-[border-color,box-shadow] hover:border-emerald-300 hover:shadow-[0_18px_44px_-22px_rgba(16,185,129,0.45)] sm:col-span-2 sm:flex-row">
                    <Cover c={c} big seed={i} />
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <h2 className="text-lg font-bold leading-snug text-zinc-900 line-clamp-3 group-hover:text-emerald-700 sm:text-xl">{it.title}</h2>
                      <Footer it={it} />
                    </div>
                  </motion.a>
                );
              }
              return (
                <motion.a key={i} href={it.link} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }} whileHover={{ y: -4 }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-[border-color,box-shadow] hover:border-emerald-300 hover:shadow-[0_16px_40px_-22px_rgba(16,185,129,0.4)]">
                  <Cover c={c} seed={i} />
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="text-[15px] font-semibold leading-snug text-zinc-900 line-clamp-3 group-hover:text-emerald-700">{it.title}</h3>
                    <Footer it={it} />
                  </div>
                </motion.a>
              );
            })}
          </div>
        )}
        <p className="mt-6 text-center text-[11px] text-zinc-400">{tr("via")}</p>
      </div>
    </div>
  );
}
