"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Star, Zap, Heart, Map, Trophy, Bot, Ghost, Moon, CloudRain, ShoppingBag, BookOpen, Shield, Activity } from "lucide-react";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { Logo } from "@/components/brand/Logo";

const PROGRAMS = [
  { category: "10KM", title: "10 KILOMÈTRES", subtitle: "DE 6 SEMAINES À 4 MOIS", img: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80&fit=crop" },
  { category: "SEMI", title: "SEMI-MARATHON", subtitle: "DE 8 SEMAINES À 12 MOIS", img: "", gradient: "linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 70%,#e94560 100%)", label: "21.1 KM" },
  { category: "MARATHON", title: "MARATHON", subtitle: "DE 8 SEMAINES À 12 MOIS", img: "", gradient: "linear-gradient(135deg,#0d0d0d 0%,#1a1a1a 30%,#2d4a1e 60%,#f4a11d 100%)", label: "42.2 KM" },
  { category: "TRAIL", title: "TRAIL RUNNING", subtitle: "DE 6 SEMAINES À 12 MOIS", img: "https://images.unsplash.com/photo-1504025468847-0e438279542c?w=600&q=80&fit=crop" },
  { category: "DÉBUTANT", title: "DÉBUTER EN COURSE", subtitle: "DE 4 SEMAINES À 3 MOIS", img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80&fit=crop" },
  { category: "VITESSE", title: "AMÉLIORER SA VITESSE", subtitle: "DE 4 À 12 SEMAINES", img: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80&fit=crop" },
  { category: "ENDURANCE", title: "ENDURANCE DE BASE", subtitle: "DE 6 SEMAINES À 6 MOIS", img: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=600&q=80&fit=crop" },
  { category: "BLESSURE", title: "REPRENDRE APRÈS BLESSURE", subtitle: "DE 4 À 16 SEMAINES", img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80&fit=crop" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "TOUT VOIR": "bg-zinc-900 text-white",
  "10KM":      "bg-blue-500 text-white",
  "SEMI":      "bg-violet-500 text-white",
  "MARATHON":  "bg-orange-500 text-white",
  "TRAIL":     "bg-green-600 text-white",
  "DÉBUTANT":  "bg-lime-500 text-white",
  "VITESSE":   "bg-red-500 text-white",
  "ENDURANCE": "bg-sky-500 text-white",
  "BLESSURE":  "bg-rose-500 text-white",
};

const CATEGORY_INACTIVE = "bg-zinc-100 text-zinc-500 hover:bg-zinc-200";

const CATEGORIES = ["TOUT VOIR", "10KM", "SEMI", "MARATHON", "TRAIL", "DÉBUTANT", "VITESSE", "ENDURANCE", "BLESSURE"];

const FEATURES = [
  { icon: Bot,       title: "Coaching IA Gemini",   desc: "Plan ajusté chaque semaine selon ta VFC, ton sommeil et ta charge réelle.", badge: "Essentiel", img: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&q=80&fit=crop" },
  { icon: Heart,     title: "Analyse VFC & HRV",    desc: "HRV quotidien, Body Battery, score de récupération. Sync Garmin & Coros.", badge: "Santé",     img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80&fit=crop" },
  { icon: Ghost,     title: "Ghost Runner Vocal",   desc: "Coach audio en temps réel : allure cible, écart au plan, chrono live km/km.", badge: "Exclusif",  img: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=400&q=80&fit=crop" },
  { icon: Map,       title: "Trail Builder SIG",    desc: "Carte IGN, tracé snap-to-path, dénivelé auto, export GPX Garmin/Coros.", badge: "Trail",     img: "https://images.unsplash.com/photo-1504025468847-0e438279542c?w=400&q=80&fit=crop" },
  { icon: Zap,       title: "Affûtage Banister",    desc: "CTL/ATL/TSB en temps réel. TSB +15 le jour de course automatiquement.", badge: "Élite",     img: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&q=80&fit=crop" },
  { icon: Moon,      title: "Suivi du Sommeil",     desc: "Deep/REM/Light, Body Battery réveil. L'IA décide si tu peux t'entraîner.", badge: "Récup",     img: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400&q=80&fit=crop" },
  { icon: Activity,  title: "Sync Garmin & Coros",  desc: "Activités, puissance, zones cardio et wellness synchronisés en temps réel.", badge: "Connecté",  img: "https://images.unsplash.com/photo-1510771463146-e89e6e86560e?w=400&q=80&fit=crop" },
  { icon: CloudRain, title: "Météo & Performance",  desc: "Impact chaleur, humidité et vent. Objectifs de séance ajustés en direct.", badge: "Intelligent",img: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=400&q=80&fit=crop" },
  { icon: BookOpen,  title: "Smart Journal Vocal",  desc: "Parle de ta séance, l'IA détecte ta fatigue mentale et adapte ton plan.", badge: "Mental",    img: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&q=80&fit=crop" },
  { icon: Trophy,    title: "Ligues & Badges",      desc: "Compétition hebdo, classement Bronze→Élite, score discipline et récompenses.", badge: "Social",    img: "https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=400&q=80&fit=crop" },
  { icon: ShoppingBag,title:"Shopping Hub",         desc: "Comparateur i-Run, Alltricks, Lepape. Chaussure idéale selon ta foulée.", badge: "Équipement",img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80&fit=crop" },
  { icon: Shield,    title: "Guardian Mode",        desc: "Détection de chute. Alerte contacts d'urgence avec GPS en temps réel.", badge: "Sécurité",  img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&q=80&fit=crop" },
];

const STATS = [
  { value: "10K+", label: "Coureurs actifs" },
  { value: "98%", label: "Satisfaction" },
  { value: "4.9★", label: "Note moyenne" },
  { value: "50+", label: "Courses référencées" },
];

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState("TOUT VOIR");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nav adaptative : transparente au-dessus du hero, barre blanche au scroll
  const navLinkCls = scrolled ? "hover:text-zinc-900 transition-colors" : "hover:text-white transition-colors";

  const filtered = activeCategory === "TOUT VOIR"
    ? PROGRAMS
    : PROGRAMS.filter(p => p.category === activeCategory);

  return (
    <div className="bg-white min-h-screen font-sans">

      {/* ── NAV ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_24px_-16px_rgba(0,0,0,0.25)]" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo size={32} className="flex-shrink-0" />
            <span className={`hidden sm:inline text-[1.4rem] font-black uppercase tracking-[-0.02em] leading-none whitespace-nowrap transition-colors ${scrolled ? "text-zinc-900" : "text-white drop-shadow-sm"}`}>Pacevo</span>
          </div>
          <div className={`hidden md:flex items-center gap-8 text-sm font-medium transition-colors ${scrolled ? "text-zinc-500" : "text-white/75"}`}>
            <a href="#programmes" className={navLinkCls}>Programmes</a>
            <a href="#coaching" className={navLinkCls}>Coaching IA</a>
            <a href="#features" className={navLinkCls}>Fonctionnalités</a>
            <a href="#tarifs" className={navLinkCls}>Tarifs</a>
            <Link href="/blog" className={navLinkCls}>Blog</Link>
            <Link href="/avis" className={navLinkCls}>Avis</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link href="/login" className={`hidden sm:inline-flex text-sm font-medium px-4 py-2 transition-colors ${scrolled ? "text-zinc-600 hover:text-zinc-900" : "text-white/90 hover:text-white"}`}>
              Connexion
            </Link>
            <Link href="/signup" className={`inline-flex items-center gap-1.5 text-sm font-semibold px-4 sm:px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap ${scrolled ? "bg-zinc-900 text-white hover:bg-zinc-700" : "bg-white text-zinc-900 hover:bg-white/90"}`}>
              Essai gratuit <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-end overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1800&q=90&fit=crop&crop=center"
          alt="Runner"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        {/* voile haut : lisibilité de la nav transparente */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-8 pb-24">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50 mb-5">
            L&apos;app running la plus avancée · 2026
          </p>
          <h1 className="font-sport text-[clamp(5rem,14vw,13rem)] font-black uppercase leading-[0.85] tracking-tight text-white mb-8">
            COUREZ<br />PLUS LOIN.
          </h1>
          <p className="text-lg text-white/60 max-w-lg mb-10 leading-relaxed">
            Coaching IA, analyse VFC, Ghost Runner, Trail Builder SIG.
            Tout ce dont un coureur sérieux a besoin.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-zinc-900 font-bold text-base px-8 py-4 rounded-2xl hover:bg-zinc-100 transition-all">
              Créer un compte <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border border-white/30 text-white font-semibold text-base px-8 py-4 rounded-2xl hover:bg-white/10 transition-all">
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-3 bg-zinc-900" />

      {/* ── PROGRAMMES ── */}
      <section id="programmes" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Entraînement</p>
              <h2 className="font-sport text-4xl sm:text-5xl lg:text-6xl font-black uppercase text-zinc-900 leading-tight">NOS PROGRAMMES</h2>
            </div>
            <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-zinc-600 transition-colors">
              Voir tout <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Category filters */}
          <div className="flex items-center gap-2 flex-wrap mb-10">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeCategory === cat ? CATEGORY_COLORS[cat] : CATEGORY_INACTIVE
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Program cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(p => (
              <Link href="/signup" key={p.title} className="group relative rounded-3xl overflow-hidden aspect-[3/4] block">
                {p.img ? (
                  <img src={p.img} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full transition-transform duration-700 group-hover:scale-105" style={{ background: (p as {gradient?:string}).gradient }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                {(p as {label?:string}).label && (
                  <div className="absolute top-5 left-5">
                    <span className="font-sport text-5xl font-black text-white/20 leading-none">{(p as {label?:string}).label}</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <h3 className="font-sport text-3xl font-black uppercase text-white leading-tight">{p.title}</h3>
                  <p className="text-white/60 text-sm mt-1 uppercase tracking-wider font-medium">{p.subtitle}</p>
                </div>
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-white rounded-full p-2">
                    <ArrowRight className="w-4 h-4 text-zinc-900" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-3 bg-zinc-900" />

      {/* ── COACHING IA ── */}
      <section id="coaching" className="relative overflow-hidden bg-zinc-950 py-32">
        <img
          src="https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=1400&q=80&fit=crop"
          alt="Coaching"
          className="absolute inset-0 w-full h-full object-cover opacity-20"
        />
        <div className="relative z-10 max-w-7xl mx-auto px-8">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 bg-green-400 text-zinc-900 text-xs font-bold uppercase tracking-widest rounded-full mb-8">
              Coaching IA
            </span>
            <h2 className="font-sport text-[clamp(3rem,8vw,7rem)] font-black uppercase text-white leading-[0.9] mb-8">
              L&apos;IA AU<br />CŒUR DE<br />TA PRÉPA
            </h2>
            <p className="text-lg text-white/50 max-w-xl leading-relaxed mb-10">
              L&apos;intelligence de l&apos;app analyse ta VFC, ton sommeil et ta charge d&apos;entraînement
              pour adapter ton plan en temps réel. Plus intelligent que n&apos;importe quel coach humain.
            </p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-zinc-900 font-bold px-8 py-4 rounded-2xl hover:bg-zinc-100 transition-all">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Feature pills */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-20">
            {[
              { title: "Analyse VFC quotidienne", desc: "HRV, Body Battery, score de récupération Garmin & Coros synchronisés." },
              { title: "Plan adaptatif IA", desc: "Ajustement automatique de la charge selon ton état physiologique du jour." },
              { title: "Ghost Runner vocal", desc: "Coaching audio en temps réel avec prédiction de chrono live kilomètre par kilomètre." },
            ].map(f => (
              <div key={f.title} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mb-4" />
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-3 bg-white" />

      {/* ── FEATURES GRID ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Plateforme complète</p>
            <h2 className="font-sport text-4xl sm:text-5xl lg:text-6xl font-black uppercase text-zinc-900">TOUT CE DONT<br />UN COUREUR A BESOIN</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="rounded-2xl overflow-hidden border border-zinc-100 hover:shadow-lg transition-all group cursor-default bg-white">
                {/* Image */}
                <div className="relative h-36 overflow-hidden">
                  <img src={f.img} alt={f.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${i === 0 ? "bg-green-400 text-zinc-900" : "bg-white/90 text-zinc-700"}`}>
                    {f.badge}
                  </span>
                </div>
                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <f.icon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <h3 className="font-bold text-sm text-zinc-900">{f.title}</h3>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-3 bg-zinc-900" />

      {/* ── TARIFS ── */}
      <section id="tarifs" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400 mb-3">Tarification</p>
            <h2 className="font-sport text-4xl sm:text-5xl lg:text-6xl font-black uppercase text-zinc-900">SIMPLE &amp; TRANSPARENT</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                name: "Gratuit", price: "0€", period: "pour toujours",
                features: ["Dashboard complet", "5 plans IA/mois", "Hub courses France", "Coaching basique"],
                cta: "Commencer", href: "/signup", dark: false,
              },
              {
                name: "Pro", price: "10€", period: "/mois", badge: "Populaire",
                features: ["Plans IA illimités", "Ghost Runner vocal", "Trail Builder SIG", "Sync Garmin/Coros", "Smart Journal", "Affûtage Banister"],
                cta: "Essai 30 jours gratuit", href: "/signup?plan=pro", dark: true,
              },
              {
                name: "Annuel", price: "80€", period: "/an", badge: "−33%",
                features: ["Tout Pro inclus", "Posture Lab Vision IA", "API accès développeur", "Support prioritaire"],
                cta: "Choisir l'annuel", href: "/signup?plan=yearly", dark: false,
              },
            ].map(plan => (
              <div key={plan.name} className={`relative rounded-3xl p-8 flex flex-col ${plan.dark ? "bg-zinc-900 text-white" : "bg-zinc-50 border border-zinc-200"}`}>
                {plan.badge && (
                  <div className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-xs font-bold ${plan.dark ? "bg-green-400 text-zinc-900" : "bg-zinc-900 text-white"}`}>
                    {plan.badge}
                  </div>
                )}
                <div className="mb-6">
                  <div className={`text-sm font-semibold mb-2 ${plan.dark ? "text-white/50" : "text-zinc-400"}`}>{plan.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-5xl font-black font-sport ${plan.dark ? "text-white" : "text-zinc-900"}`}>{plan.price}</span>
                    <span className={`text-sm ${plan.dark ? "text-white/40" : "text-zinc-400"}`}>{plan.period}</span>
                  </div>
                </div>
                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className={`flex items-center gap-2.5 text-sm ${plan.dark ? "text-white/70" : "text-zinc-600"}`}>
                      <Star className={`w-3.5 h-3.5 flex-shrink-0 ${plan.dark ? "text-green-400" : "text-zinc-400"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`text-center py-3.5 rounded-xl font-bold text-sm transition-all ${plan.dark ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-3 bg-zinc-900" />

      {/* ── CTA FINAL ── */}
      <section className="relative overflow-hidden py-32">
        <img
          src="https://images.unsplash.com/photo-1483721310020-03333e577078?w=1400&q=80&fit=crop"
          alt="Trail runner"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 text-center px-8">
          <h2 className="font-sport text-[clamp(4rem,12vw,10rem)] font-black uppercase text-white leading-[0.85] mb-8">
            PRÊT À<br />PERFORMER ?
          </h2>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-zinc-900 font-bold text-lg px-10 py-5 rounded-2xl hover:bg-zinc-100 transition-all">
              Créer un compte gratuit <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="/login" className="inline-flex items-center gap-2 border-2 border-white/40 text-white font-bold text-lg px-10 py-5 rounded-2xl hover:bg-white/10 transition-all">
              Se connecter
            </Link>
          </div>
          <p className="text-white/30 text-sm mt-6">Gratuit · Pas de carte bancaire · Annulable à tout moment</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-zinc-950 text-white py-16 px-8">
        <div className="max-w-7xl mx-auto mb-12 flex flex-col items-center gap-4 border-b border-white/10 pb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-300 ring-1 ring-white/15">Newsletter</div>
          <h3 className="text-xl font-bold sm:text-2xl">Reçois nos articles & conseils course</h3>
          <p className="max-w-md text-sm text-white/50">Entraînement, trail, matériel, nutrition — directement dans ta boîte mail. Désinscription en un clic.</p>
          <div className="w-full max-w-md"><NewsletterSignup variant="dark" /></div>
        </div>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-lg font-black uppercase tracking-[-0.02em] text-white">Pacevo</span>
          </div>
          <p className="text-sm text-white/30">© 2026 Pacevo. Fait avec ❤️ pour les coureurs.</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/30">
            <Link href="/mentions-legales" className="hover:text-white/60 transition-colors">Mentions légales</Link>
            <Link href="/confidentialite" className="hover:text-white/60 transition-colors">Confidentialité</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">CGU</Link>
            <Link href="/contact" className="hover:text-white/60 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
