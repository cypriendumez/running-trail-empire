"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, ChevronRight, Check, Menu, X,
  Bot, Heart, Map, Trophy, Ghost, Moon, CloudRain, ShoppingBag, BookOpen, Shield, Activity, Zap, Flag, Flame, Scale,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Container, Section, SectionHeading } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { LANDING, CATEGORY_CODES } from "@/components/landing/landingI18n";

// Données visuelles (non traduisibles). Les libellés viennent de LANDING[lang].
// ── PHOTOS DES PROGRAMMES ────────────────────────────────────────────────────
// Chaque programme porte une VRAIE photo (`photo` est obligatoire : le semi et le
// marathon retombaient sur un aplat dégradé, et au milieu de six photographies les deux
// cartes les plus vendeuses ressemblaient à un emplacement vide).
//
// ⚠️ ON NE STOCKE QUE L'IDENTIFIANT, PAS L'URL. Les URL étaient écrites à la main en
// `?w=600&fit=crop`, ce qui demandait à Unsplash une largeur SANS hauteur : le service
// renvoyait alors le recadrage de son choix — 600×275 pour la carte « endurance », soit
// un panoramique de ratio 2,18 pour une tuile en 3/4. Le navigateur en gardait une
// tranche centrale de 206 px de large puis l'étirait sur 699 px en écran Retina : un
// agrandissement de 3,4×, d'où le flou. Le recadrage est donc CENTRALISÉ ci-dessous, au
// format exact de la carte, et décliné en srcset pour qu'un téléphone ne télécharge pas
// l'image du grand écran.
const PROGRAMS: { key: string; category: string; photo: string }[] = [
  { key: "km10", category: "10KM", photo: "photo-1571008887538-b36bb32f4571" },
  { key: "semi", category: "SEMI", photo: "photo-1667781838690-5f32ea0ccea6" },
  { key: "marathon", category: "MARATHON", photo: "photo-1682367905664-e36b30f15b19" },
  { key: "trail", category: "TRAIL", photo: "photo-1504025468847-0e438279542c" },
  // Débuter : c'était un gros plan de pieds sur des marches, interchangeable avec
  // n'importe quelle carte de n'importe quel site de sport. Remplacé par deux coureurs
  // ensemble en plein jour — la carte doit dire « c'est accessible, et tu n'es pas
  // seul », pas montrer un détail anatomique.
  { key: "beginner", category: "BEGINNER", photo: "photo-1781726956705-038cab091bc6" },
  { key: "speed", category: "SPEED", photo: "photo-1461896836934-ffe607ba8211" },
  // Endurance : reprise DEUX fois. D'abord un coureur plié en deux, mains sur les
  // genoux — de l'épuisement, soit l'inverse du message d'une base aérobie. Puis un
  // coureur en contre-jour, dont le cadrage large ne disait rien de la notion. Un chemin
  // forestier qui file vers le fond dit ce que le texte annonce : de la DURÉE, à allure
  // facile. Les troncs verticaux tiennent en plus le format 3/4 de la carte.
  { key: "endurance", category: "ENDURANCE", photo: "photo-1646867802148-b3ccd7ebf76d" },
  // Blessure : c'était un portrait de médecin en blouse, souriant face objectif. Au
  // milieu de sept photographies de course, une photo de banque d'images posée cassait
  // la grille entière. Remplacée par des mains qui relacent une chaussure — « je repars ».
  { key: "injury", category: "INJURY", photo: "photo-1600712662084-e54770a9668e" },
  // NEUVIÈME programme. Deux raisons, et la mise en page n'est que la seconde :
  //  1. le mode perte de poids EXISTE (src/lib/weight, /api/weight,
  //     profiles.weight_mode_enabled) — il était vendu nulle part ;
  //  2. huit cartes sur trois colonnes donnent 3+3+2, donc un trou dans la dernière
  //     rangée sur tout écran large. Neuf la ferment.
  { key: "weightloss", category: "WEIGHT", photo: "photo-1480179087180-d9f0ec044897" },
];

/**
 * URL Unsplash au format EXACT de la carte (3/4 portrait).
 *
 * La hauteur est IMPOSÉE : sans elle, `fit=crop` laisse Unsplash choisir son recadrage,
 * et il rend le plus souvent un panoramique. C'est ce qui rendait les cartes floues.
 */
const photoCarte = (id: string, largeur: number) =>
  `https://images.unsplash.com/${id}?w=${largeur}&h=${Math.round((largeur * 4) / 3)}&fit=crop&q=82`;

/** Paliers du srcset : 1 colonne (mobile), 2 colonnes, puis 3 colonnes en Retina. */
const LARGEURS_CARTE = [400, 600, 900];

// Les icônes suivent l'ORDRE des dictionnaires. Elles ne sont plus posées sur une tuile
// menthe arrondie : c'est le motif le plus reconnaissable des pages « générées », et
// c'est lui qui faisait amateur bien plus que les textes.
const PILLAR_ICONS: LucideIcon[] = [Bot, Ghost, Zap];
const FEATURE_ICONS: LucideIcon[] = [Heart, Activity, CloudRain, Map, BookOpen, Flag, Flame, Scale, Trophy];

// ── CHIFFRES DU BANDEAU — chacun est VÉRIFIABLE, aucun n'est décoratif ──────
//  « 10k+ coureurs actifs », « 4,9 ★ de note moyenne » et « 98 % de satisfaction »
//  ont été retirés : la base compte UN profil, et il n'existe ni note ni enquête de
//  satisfaction — trois chiffres inventés sur quatre, affichés au-dessus de la ligne
//  de flottaison d'un site qui vend de la mesure honnête.
//
//  Ce qui reste se recompte :
//   · 14 520 courses portent une date à venir (17 027 en base, dont 2 507 passées) ;
//   · data/parcours_certifies.json contient 15 708 parcours vérifiés par le crawl ;
//   · buildWeekPlan pose 7 jours de plan glissant ;
//   · .github/workflows/sync-coach.yml tourne toutes les 10 minutes.
const STAT_VALUES = ["14 000+", "15 700", "7 j", "10 min"];
// Plateformes réellement synchronisables — chacune est justifiée dans le commentaire de
// la section « SYNCHRONISATION » plus bas. Ne rien ajouter ici sans preuve dans le code :
// une marque affichée est une promesse d'intégration.
//
// `logo` désigne un fichier de `public/brands/`. Il est OPTIONNEL À DESSEIN : un logo de
// marque est un ACTIF, pas du code, et il appartient à son titulaire. Tant que le fichier
// n'est pas là, la tuile affiche le nom — jamais une image cassée, jamais un logo redessiné
// « à peu près », qui rendrait moins bien que le mot et poserait en plus un problème de
// marque. Déposer le fichier suffit à basculer la tuile en logo, sans toucher au code.
const SYNC: { nom: string; logo?: string; passerelle?: boolean }[] = [
  { nom: "Garmin", logo: "garmin.svg" },
  { nom: "COROS", logo: "coros.png" },
  { nom: "Polar", logo: "polar.svg" },
  { nom: "Suunto", logo: "suunto.svg" },
  { nom: "Wahoo", logo: "wahoo.svg" },
  { nom: "Strava", logo: "strava.svg" },
  // Apple Watch fonctionne, mais PAS par le même chemin, et le taire serait mentir par
  // omission : les six marques ci-dessus sont des connexions OFFICIELLES d'intervals.icu,
  // en un clic. Apple n'en a pas — les données passent par une application passerelle
  // (HealthFit, Intervals Companion…) qui verse Santé dans intervals.icu. Vérifié sur le
  // forum officiel intervals.icu, où c'est la réponse constante depuis des années. D'où
  // `passerelle`, qui ajoute une astérisque et une phrase d'explication : la montre est
  // supportée, l'utilisateur sait à quoi s'attendre avant de s'inscrire.
  { nom: "Apple Watch", logo: "apple-watch.svg", passerelle: true },
];
// ── PRIX AFFICHÉS ────────────────────────────────────────────────────────────
//  En CENTIMES, et rigoureusement identiques à `TARIFS` (lib/stripe/client.ts), qui
//  est ce qui sera réellement débité. Un test vérifie l'égalité : afficher un prix
//  différent de celui qu'on prélève n'est pas un défaut d'affichage, c'est un litige.
//
//  On ne peut pas importer `TARIFS` ici : ce module tire le SDK Stripe et la clé
//  secrète, qui n'ont rien à faire dans un composant client.
const PRIX: Record<string, { mois: number; an: number }> = {
  gratuit: { mois: 0, an: 0 },
  starter: { mois: 999, an: 9990 },
  premium: { mois: 1499, an: 14990 },
};

/** « 9,99 € » dans la locale de l'athlète. */
const euros = (centimes: number, lang: string) =>
  (centimes / 100).toLocaleString(lang, { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

export default function LandingPage() {
  const { lang } = useT();
  const L = LANDING[lang] ?? LANDING.fr;
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [periode, setPeriode] = useState<"mois" | "an">("mois");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nav adaptative : transparente sur le hero, solide au scroll OU menu mobile ouvert.
  const solidNav = scrolled || menuOpen;
  // OMBRE PORTÉE SUR LE TEXTE DE LA BARRE, pas un voile plus sombre sur la photo. Le
  // bandeau du haut avait déjà été monté à 0,68 pour « Connexion », puis redescendu à 0,58
  // quand il a fallu éclaircir l'image : deux exigences qui se contredisent tant qu'on
  // traite le FOND. Une silhouette noire sur une piste rouge n'a de toute façon aucun
  // contraste stable — il change à chaque pixel, et aucun réglage de voile ne le rattrape
  // partout. L'ombre, elle, suit la lettre.
  const navOmbre = solidNav ? "" : "[text-shadow:0_1px_8px_rgba(0,0,0,0.75)]";
  const navLink = solidNav ? "hover:text-zinc-900 transition-colors" : `hover:text-white transition-colors ${navOmbre}`;

  const filtered = activeCategory === "ALL" ? PROGRAMS : PROGRAMS.filter((p) => p.category === activeCategory);
  const stats = [L.stats.races, L.stats.routes, L.stats.plan, L.stats.replan];

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">

      {/* ── NAV ── */}
      {/* LA BARRE EST UNE COUCHE, PLUS UNE VITRE. Le problème signalé n'était pas la
          lisibilité — « Connexion » se lisait — mais la COLLISION : la main levée d'une
          silhouette venait toucher le mot, et l'œil lisait un empilement accidentel. Une
          ombre portée ne corrige pas ça, elle ne fait que rendre le texte net PAR-DESSUS
          l'ombre. Ce qu'il fallait, c'est SÉPARER les deux plans.
          Un verre dépoli sombre sur toute la largeur donne à la barre son propre plan : la
          photo continue derrière, floutée et assombrie, et plus rien ne « touche » le
          texte. Elle reste transparente au sens où l'on voit la piste au travers — mais
          elle cesse d'être au même niveau qu'elle. */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solidNav ? "bg-white/90 backdrop-blur-xl border-b border-zinc-200/70" : "border-b border-white/10 bg-black/25 backdrop-blur-md"}`}>
        {/* DEUX RÉGLAGES INDÉPENDANTS, à ne pas confondre — je les avais liés à tort.

            1. `max-w-none` + padding court : la barre ne suit PLUS la largeur de contenu
               du site. Le `Container` vaut `max-w-6xl` centré (1 152 px) ; sur un écran de
               1 440 il restait 144 px de marge AVANT les 32 px de padding, et le logo
               démarrait à 176 px du bord. Une barre de navigation n'est pas du contenu :
               elle borde la page, elle part donc du bord. Le logo tombe à 32 px.

            2. Les liens restent CENTRÉS SUR LA FENÊTRE, via une grille à trois colonnes
               dont les deux extérieures ont la même largeur (`1fr`). Les coller au logo
               les faisait dépendre de la longueur des libellés : « Fonctionnalités » (FR)
               contre « Features » (EN) déplaçait tout le bloc à chaque langue. Le centre
               géométrique, lui, ne bouge pas. */}
        <Container className="grid h-16 max-w-none grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 justify-self-start" onClick={() => setMenuOpen(false)}>
            <Logo size={30} />
            <Wordmark tone={solidNav ? "dark" : "light"} className={`text-xl ${navOmbre}`} />
          </Link>
          <div className={`hidden md:flex items-center justify-center gap-7 text-sm font-medium ${solidNav ? "text-zinc-500" : "text-white/80"}`}>
            <a href="#programmes" className={navLink}>{L.nav.programs}</a>
            <a href="#features" className={navLink}>{L.nav.features}</a>
            <a href="#tarifs" className={navLink}>{L.nav.pricing}</a>
            <Link href="/blog" className={navLink}>{L.nav.blog}</Link>
            <Link href="/avis" className={navLink}>{L.nav.reviews}</Link>
          </div>
          {/* ORDRE : Connexion → Essai gratuit → Langue, comme sur les barres de nav qui
              fonctionnent (campus.coach entre autres). Le sélecteur de langue était
              coincé ENTRE les liens de navigation et les actions de compte : il coupait
              en deux un groupe qui doit se lire d'un bloc (« je me connecte / je
              m'inscris »), et donnait le premier rang à un réglage qu'on ouvre une fois
              dans sa vie. Il passe en bout de chaîne, après le bouton, où l'œil le
              trouve quand il le cherche sans le heurter quand il ne le cherche pas. */}
          <div className="flex items-center justify-self-end gap-2">
            <Link href="/login" className={`hidden sm:inline-flex rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${solidNav ? "text-zinc-600 hover:text-zinc-900" : `text-white hover:text-white ${navOmbre}`}`}>
              {L.nav.login}
            </Link>
            {/* Sur la photo, ce bouton était un rectangle BLANC PLEIN posé en haut à
                droite : il découpait un trou dans l'image et masquait l'ombre du coureur
                qui passe à cet endroit. En verre dépoli, il reste parfaitement lisible
                (bord blanc + flou) tout en laissant voir la piste au travers. Il ne
                devient plein — et sombre — qu'une fois la barre solide au défilement,
                là où il n'y a plus de photo à cacher. */}
            <Link
              href="/signup"
              // `whitespace-nowrap` : sur 375 px, la colonne de droite se resserrait
              // assez pour couper « Essai gratuit » en deux lignes, ce qui gonflait la
              // barre à 80 px de haut et écrasait tout le reste.
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-300 sm:px-4 sm:py-2 sm:text-[13px] ${
                solidNav
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "border border-white/55 bg-white/15 text-white backdrop-blur-md hover:border-white/80 hover:bg-white/25"
              }`}
            >
              {L.nav.trial} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <span aria-hidden className={`hidden sm:block h-4 w-px ${solidNav ? "bg-zinc-200" : "bg-white/25"}`} />
            <LanguageSwitcher light={!solidNav} />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              className={`md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${solidNav ? "text-zinc-700 hover:bg-zinc-100" : "text-white hover:bg-white/10"}`}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </Container>

        {/* Menu mobile */}
        {menuOpen && (
          <div className="md:hidden border-t border-zinc-200 bg-white">
            <Container className="flex flex-col py-2 text-sm font-medium text-zinc-700">
              {[
                { href: "#programmes", label: L.nav.programs },
                { href: "#features", label: L.nav.features },
                { href: "#tarifs", label: L.nav.pricing },
                { href: "/blog", label: L.nav.blog },
                { href: "/avis", label: L.nav.reviews },
                { href: "/login", label: L.nav.login },
              ].map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="py-2.5 hover:text-[#059669] transition-colors">
                  {l.label}
                </a>
              ))}
            </Container>
          </div>
        )}
      </nav>

      {/* ── HERO ── plein cadre, photo de piste immersive */}
      <section className="relative flex min-h-screen items-end overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1920&q=85&fit=crop&crop=center"
          srcSet="https://images.unsplash.com/photo-1502904550040-7534597429ae?w=750&q=80&fit=crop&crop=center 750w, https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1280&q=82&fit=crop&crop=center 1280w, https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1920&q=85&fit=crop&crop=center 1920w"
          sizes="100vw"
          alt="Piste d'athlétisme vue du dessus"
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Les trois voiles avaient été ALLÉGÉS d'un tiers (ils rendaient 0,85 + 0,60 + 0,68
            empilés, et la piste virait au brun-noir). Ils sont ici remontés de 8 points —
            un cran, pas un retour en arrière : la photo reste lisible comme photo, mais le
            texte blanc regagne la marge de contraste que l'éclaircissement lui avait prise
            sur les zones de piste les plus claires. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/24 to-transparent" />
        {/* VOILE LATÉRAL — il manquait, et c'est toute l'explication du texte « qui dépasse
            sur les coureurs ». Le hero n'avait qu'un dégradé du BAS et un bandeau du HAUT :
            au milieu de l'image, à hauteur du titre et du paragraphe, la photo était à nu.
            Les silhouettes passent précisément là. Ce voile assombrit les deux tiers
            GAUCHES, où vit le texte, et s'éteint avant les coureurs — la photo n'est pas
            retouchée, on lui pose seulement un fond de lecture.

            ⚠️ SUR MOBILE il ne peut pas s'éteindre : à 375 px le texte occupe toute la
            largeur, donc il TOMBE sur les silhouettes quoi qu'on fasse. Le voile garde
            donc un plancher (`to-black/40`) en dessous de `sm`, et ne va vers le
            transparent qu'à partir du moment où la colonne de texte s'arrête avant les
            coureurs. */}
        <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/70 via-black/50 to-black/28 sm:w-[70%] sm:via-black/38 sm:to-transparent" />
        {/* Bandeau du haut ALLÉGÉ (0,58 → 0,30) : la barre porte désormais son propre
            fond en verre dépoli, les deux se cumulaient et rendaient le haut de la photo
            inutilement noir. Il ne sert plus qu'à fondre le bas de la barre dans l'image. */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/30 to-transparent" />

        <Container className="relative z-10 pb-20 pt-28 sm:pb-24">
          {/* Le titre est désormais une LIGNE DE MARQUE identique dans les cinq langues, ce
              qui supprime la contrainte qui gouvernait cette mise en page : il fallait
              auparavant dimensionner sur le pire cas (l'allemand réclamait 872 px là où le
              français tenait dans 602), d'où un corps rabattu à 64 px. Deux mots courts et
              invariants tiennent partout — le titre peut donc reprendre la taille qu'un
              hero mérite. Le sous-titre, lui, change toujours de langue et garde sa
              largeur de lecture. */}
          <div className="max-w-xl lg:max-w-2xl">
            {/* Ombre portée sur le TEXTE plutôt qu'un voile plus sombre sur la photo : éclaircir
                l'image (demandé) et garder du contraste sont contradictoires tant qu'on
                traite le fond. L'ombre agit là où il faut — sous les lettres — et laisse la
                piste lumineuse partout ailleurs. */}
            <h1 className="text-[2.9rem] font-bold leading-[1.03] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.5)] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
              {L.hero.titleA}<br />{L.hero.titleB}
              {/* Le mot accentué porte la seconde moitié du nom (« Evo ») : on lui donne
                  le vert du wordmark et une ombre portée, sans quoi l'émeraude sur une
                  piste rouge perd son contraste dès que le soleil de la photo passe
                  derrière. */}
              {/* Plus de point final : « Pace Your Evolution » est une ligne de marque,
                  pas une phrase. Un point la referme comme une affirmation banale. */}
              <span className="text-[#34d399] [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]">{L.hero.accent}</span>
            </h1>
            {/* Largeur MESURÉE, pas choisie : à `lg:max-w-xl` la plus longue ligne finissait à
                750 px alors que la première silhouette commence vers 738. `max-w-lg` la
                ramène à 688 px — le texte s'arrête avant les coureurs, sans dépendre du
                voile pour rester lisible. */}
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.65)]">
              {L.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-zinc-900 transition-colors hover:bg-white/90">
                {L.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ── SYNCHRONISATION ── une bande dédiée plutôt qu'une ligne de texte pâle noyée
          sous le CTA, où elle passait pour une mention légale.

          ⚠️ CETTE LISTE EST VÉRIFIÉE, MARQUE PAR MARQUE, dans le code :
           · Garmin  — import ET poussée de séance (`lib/watch/intervals.ts`) ;
           · COROS, Polar, Suunto — nommés par le guide Sync Montre de l'app elle-même ;
           · Wahoo, Strava — nommés par `lib/intervals/sport.ts` et la politique de
             confidentialité, qui décrivent les sources d'intervals.icu.
          APPLE N'Y FIGURE PAS : `mobile/app.json` déclare bien l'autorisation
          `com.apple.developer.healthkit`, mais AUCUNE ligne de code n'appelle HealthKit.
          Afficher ce logo serait vendre une intégration qui n'existe pas. */}
      <Container className="pt-14 sm:pt-16">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
          {L.sync.title}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {SYNC.map((m) => (
            <span
              key={m.nom}
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-bold uppercase tracking-wide text-zinc-700 shadow-sm transition-colors hover:border-zinc-300"
            >
              {m.logo
                // eslint-disable-next-line @next/next/no-img-element
                // Hauteur ET largeur bornées : les six mots-symboles vont d'un rapport 3,1
                // (Suunto) à 6,1 (Polar). À hauteur constante, Polar paraîtrait deux fois
                // plus imposant que les autres ; à largeur constante, il serait deux fois
                // plus petit. Borner les DEUX avec `object-contain` égalise la surface
                // perçue, ce qui est le seul réglage qui compte dans une rangée.
                ? <img src={`/brands/${m.logo}`} alt={m.nom} className="h-6 w-auto max-w-[112px] object-contain" loading="lazy" />
                : m.nom}
              {m.passerelle && <span className="ml-1 -translate-y-1 text-[11px] font-semibold text-zinc-400">*</span>}
            </span>
          ))}
        </div>
        {/* La phrase que l'app dit déjà à ses propres athlètes dans l'onglet Sync Montre :
            elle répond à la question qu'un lecteur se pose en voyant six marques, et elle
            rassure plus qu'elle n'inquiète — aucun mot de passe constructeur ne transite. */}
        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-zinc-400">
          {L.sync.note}
        </p>
      </Container>

      {/* ── STATS ── */}
      <Container className="py-16 sm:py-20">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4">
          {stats.map((label, i) => (
            <div key={label} className="bg-white px-6 py-7 text-center">
              <div className="text-3xl font-bold tracking-tight">{STAT_VALUES[i]}</div>
              <div className="mt-1 text-sm text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </Container>

      {/* ── PROGRAMMES ── */}
      <Section id="programmes">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              align="left"
              eyebrow={L.programs.eyebrow}
              title={L.programs.title}
              subtitle={L.programs.subtitle}
            />
            <Link href="/signup" className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-[#059669] transition-colors">
              {L.programs.viewAll} <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            {CATEGORY_CODES.map((code) => (
              <button
                key={code}
                onClick={() => setActiveCategory(code)}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                  activeCategory === code ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {L.programs.cats[code]}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const it = L.programs.items[p.key];
              return (
                <Link href="/signup" key={p.key} className="group relative block aspect-[3/4] overflow-hidden rounded-2xl">
                  <img
                    src={photoCarte(p.photo, 900)}
                    srcSet={LARGEURS_CARTE.map((w) => `${photoCarte(p.photo, w)} ${w}w`).join(", ")}
                    sizes="(min-width:1024px) 32vw, (min-width:640px) 48vw, 92vw"
                    alt={it.title} loading="lazy" decoding="async"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="text-2xl font-bold uppercase leading-tight text-white">{it.title}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wider text-white/60">{it.subtitle}</p>
                  </div>
                  <span className="absolute right-4 top-4 flex h-8 w-8 translate-y-1 items-center justify-center rounded-full bg-white opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
                    <ArrowRight className="h-4 w-4 text-zinc-900" />
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* ── FEATURES ── */}
      <Section className="bg-zinc-50">
        <Container>
          <SectionHeading
            eyebrow={L.features.eyebrow}
            title={L.features.title}
            subtitle={L.features.subtitle}
          />
          {/* ── TROIS PILIERS ─────────────────────────────────────────────────
              Douze cartes de poids RIGOUREUSEMENT identique ne hiérarchisent rien :
              l'œil ne sait pas par où commencer et la page se lit comme du papier
              peint. On met donc en avant ce qui distingue réellement le produit, avec
              un chiffre vérifiable par pilier, et la première carte en sombre pour
              créer le point d'entrée qui manquait. */}
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {L.features.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i];
              const sombre = i === 0;
              return (
                <div key={p.title}
                  className={`rounded-2xl border p-7 ${sombre ? "border-transparent bg-[#0b1f1a] text-white" : "border-zinc-200 bg-white"}`}>
                  <Icon className={sombre ? "h-5 w-5 text-[#34d399]" : "h-5 w-5 text-[#059669]"} strokeWidth={1.6} />
                  <div className="mt-7 text-[1.75rem] font-bold leading-none tracking-tight">{p.metric}</div>
                  <div className={`mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${sombre ? "text-white/45" : "text-zinc-400"}`}>
                    {p.metricLabel}
                  </div>
                  <h3 className="mt-6 text-[17px] font-semibold tracking-tight">{p.title}</h3>
                  <p className={`mt-2 text-sm leading-relaxed ${sombre ? "text-white/65" : "text-zinc-500"}`}>{p.desc}</p>
                </div>
              );
            })}
          </div>

          {/* ── LE RESTE : UNE LISTE, PAS DES CARTES ──────────────────────────
              Neuf cadres de plus rejoueraient exactement le défaut qu'on vient de
              corriger. Des filets et de l'air suffisent — et l'ancienne pastille d'un
              mot (« Essentiel », « Santé », « Exclusif »…) disparaît : douze catégories
              employées chacune UNE fois ne classent rien, elles décorent. */}
          <div className="mt-12 grid border-t border-zinc-200 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-3">
            {L.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div key={f.title} className="flex gap-3.5 border-b border-zinc-200 py-5">
                  <Icon className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-[#059669]" strokeWidth={1.7} />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900">{f.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* La section « Coaching IA » vivait ici. Elle a été SUPPRIMÉE : ses trois
          encarts répétaient mot pour mot les trois piliers ci-dessus — « Ghost Runner
          vocal » apparaissait deux fois à l'identique en un seul écran, et « Plan
          adaptatif » redisait « Le plan se replanifie seul ». Son titre
          (« L'intelligence au cœur de ta préparation ») ne portait aucune information,
          et son argument (« plus réactif qu'un coach humain ») était une comparaison
          invérifiable. Deux aplats sombres s'enchaînaient en prime. Une page qui dit
          chaque chose UNE fois convainc mieux qu'une page qui se répète. */}

      {/* ── TARIFS ── */}
      <Section id="tarifs" className="bg-zinc-50">
        <Container>
          <SectionHeading
            eyebrow={L.pricing.eyebrow}
            title={L.pricing.title}
            subtitle={L.pricing.subtitle}
          />
          {/* Sélecteur de périodicité — « Annuel » n'est pas une formule. En faire une
              troisième carte obligeait à lui inventer des exclusivités pour la remplir :
              c'est de là que venaient « Posture Lab » et « Accès API développeur ». */}
          <div className="mt-12 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-1">
              {(["mois", "an"] as const).map((p) => (
                <button key={p} onClick={() => setPeriode(p)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    periode === p ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
                  {p === "mois" ? L.pricing.mois : L.pricing.an}
                  {p === "an" && <span className={`ml-2 text-[11px] font-bold ${periode === "an" ? "text-[#34d399]" : "text-[#059669]"}`}>{L.pricing.economie}</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-zinc-500">{L.pricing.essai}</p>

          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            {L.pricing.plans.map((plan) => {
              const centimes = PRIX[plan.cle][periode];
              // À l'année on affiche l'équivalent MENSUEL en grand et le total en dessous :
              // c'est le chiffre que l'acheteur compare, et le masquer derrière un total
              // annuel fait paraître l'offre plus chère qu'elle n'est.
              const grand = periode === "an" ? Math.round(centimes / 12) : centimes;
              const vedette = plan.cle === "premium";
              return (
                <div key={plan.cle}
                  className={`relative flex flex-col rounded-3xl p-8 ${vedette ? "bg-zinc-950 text-white ring-2 ring-[#059669]" : "bg-white ring-1 ring-inset ring-zinc-200"}`}>
                  {plan.badge && (
                    <span className="absolute -top-3 left-8 rounded-full bg-[#10b981] px-3 py-1 text-[11px] font-bold text-[#04120c]">
                      {plan.badge}
                    </span>
                  )}
                  <div className={`text-sm font-semibold ${vedette ? "text-white/50" : "text-zinc-400"}`}>{plan.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{plan.cle === "gratuit" ? euros(0, lang) : euros(grand, lang)}</span>
                    <span className={`text-sm ${vedette ? "text-white/40" : "text-zinc-400"}`}>{plan.cle === "gratuit" ? "" : L.pricing.parMois}</span>
                  </div>
                  <div className={`mt-1 h-5 text-xs ${vedette ? "text-white/40" : "text-zinc-400"}`}>
                    {plan.cle === "gratuit" ? L.pricing.gratuitNote : periode === "an" ? `${euros(centimes, lang)} / ${L.pricing.an.toLowerCase()}` : ""}
                  </div>
                  <p className={`mt-4 text-sm ${vedette ? "text-white/70" : "text-zinc-500"}`}>{plan.pitch}</p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-start gap-2.5 text-sm ${vedette ? "text-white/75" : "text-zinc-600"}`}>
                        <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${vedette ? "text-[#34d399]" : "text-[#059669]"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.cle === "gratuit" ? "/signup" : `/signup?formule=${plan.cle}&periode=${periode}`}
                    className={btnClass(vedette ? "secondary" : "primary", "md", "mt-8 w-full")}>
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Ce qui se passe APRÈS l'essai, écrit noir sur blanc. Une app qui coupe tout
              sans prévenir se fait désinstaller ; le dire à l'avance rassure, et c'est vrai. */}
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-zinc-500">
            {L.pricing.apres}
          </p>
        </Container>
      </Section>

      {/* ── CTA FINAL ── */}
      <Section>
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-20 text-center sm:py-24">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_0%,rgba(16,185,129,.16),transparent_60%)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                {L.cta.title}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-lg text-white/55">
                {L.cta.subtitle}
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link href="/signup" className={btnClass("brand", "lg")}>
                  {L.cta.primary} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white ring-1 ring-inset ring-white/25 hover:bg-white/10 transition-colors">
                  {L.cta.secondary}
                </Link>
              </div>
              <p className="mt-6 text-sm text-white/35">{L.cta.note}</p>
            </div>
          </div>
        </Container>
      </Section>

      {/* ── FOOTER ── */}
      <SiteFooter />
    </div>
  );
}
