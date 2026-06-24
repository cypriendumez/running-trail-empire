"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, ChevronRight, Play, Check,
  Bot, Heart, Map, Trophy, Ghost, Moon, CloudRain, ShoppingBag, BookOpen, Shield, Activity, Zap,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { Container, Section, SectionHeading } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { LANDING, CATEGORY_CODES } from "@/components/landing/landingI18n";

// Données visuelles (non traduisibles). Les libellés viennent de LANDING[lang].
const PROGRAMS: { key: string; category: string; img?: string; gradient?: string; label?: string }[] = [
  { key: "km10", category: "10KM", img: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80&fit=crop" },
  { key: "semi", category: "SEMI", gradient: "linear-gradient(135deg,#0f172a,#1e293b 60%,#059669)", label: "21.1" },
  { key: "marathon", category: "MARATHON", gradient: "linear-gradient(135deg,#0a0a0a,#1c1917 55%,#047857)", label: "42.2" },
  { key: "trail", category: "TRAIL", img: "https://images.unsplash.com/photo-1504025468847-0e438279542c?w=600&q=80&fit=crop" },
  { key: "beginner", category: "BEGINNER", img: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&q=80&fit=crop" },
  { key: "speed", category: "SPEED", img: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80&fit=crop" },
  { key: "endurance", category: "ENDURANCE", img: "https://images.unsplash.com/photo-1483721310020-03333e577078?w=600&q=80&fit=crop" },
  { key: "injury", category: "INJURY", img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80&fit=crop" },
];

const FEATURE_ICONS: LucideIcon[] = [Bot, Heart, Ghost, Map, Zap, Moon, Activity, CloudRain, BookOpen, Trophy, ShoppingBag, Shield];

const STAT_VALUES = ["10k+", "4.9★", "98%", "17k+"];
const SYNC = ["Garmin", "Coros", "Strava", "Suunto", "Polar"];
const PLAN_VISUALS = [
  { price: "0€", href: "/signup", featured: false },
  { price: "10€", href: "/signup?plan=pro", featured: true },
  { price: "80€", href: "/signup?plan=yearly", featured: false },
];

export default function LandingPage() {
  const { lang } = useT();
  const L = LANDING[lang] ?? LANDING.fr;
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Nav adaptative : blanche sur le hero photo, sombre une fois scrollé.
  const navLink = scrolled ? "hover:text-zinc-900 transition-colors" : "hover:text-white transition-colors";

  const filtered = activeCategory === "ALL" ? PROGRAMS : PROGRAMS.filter((p) => p.category === activeCategory);
  const stats = [L.stats.runners, L.stats.rating, L.stats.satisfaction, L.stats.races];

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">

      {/* ── NAV ── */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-xl border-b border-zinc-200/70" : "bg-transparent"}`}>
        <Container className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={30} />
            <Wordmark tone={scrolled ? "dark" : "light"} className="text-xl" />
          </Link>
          <div className={`hidden md:flex items-center gap-8 text-sm font-medium ${scrolled ? "text-zinc-500" : "text-white/80"}`}>
            <a href="#programmes" className={navLink}>{L.nav.programs}</a>
            <a href="#features" className={navLink}>{L.nav.features}</a>
            <a href="#tarifs" className={navLink}>{L.nav.pricing}</a>
            <Link href="/blog" className={navLink}>{L.nav.blog}</Link>
            <Link href="/avis" className={navLink}>{L.nav.reviews}</Link>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageSwitcher light={!scrolled} />
            <Link href="/login" className={`hidden sm:inline-flex px-3 py-2 text-sm font-medium transition-colors ${scrolled ? "text-zinc-600 hover:text-zinc-900" : "text-white/90 hover:text-white"}`}>
              {L.nav.login}
            </Link>
            <Link href="/signup" className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${scrolled ? "bg-zinc-900 text-white hover:bg-zinc-800" : "bg-white text-zinc-900 hover:bg-white/90"}`}>
              {L.nav.trial} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Container>
      </nav>

      {/* ── HERO ── plein cadre, photo de piste immersive */}
      <section className="relative flex min-h-screen items-end overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1920&q=85&fit=crop&crop=center"
          alt="Piste d'athlétisme vue du dessus"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />

        <Container className="relative z-10 pb-20 pt-28 sm:pb-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/20 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" /> {L.hero.badge}
            </span>
            <h1 className="mt-5 text-5xl font-bold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {L.hero.titleA}<br />{L.hero.titleB}<span className="text-[#34d399]">{L.hero.accent}</span>.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">
              {L.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-zinc-900 transition-colors hover:bg-white/90">
                {L.hero.ctaPrimary} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/10">
                <Play className="h-4 w-4" /> {L.hero.ctaSecondary}
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{L.hero.sync}</span>
              {SYNC.map((s) => (
                <span key={s} className="text-xs font-bold uppercase tracking-wide text-white/35">{s}</span>
              ))}
            </div>
          </div>
        </Container>
      </section>

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
                  {p.img ? (
                    <img src={p.img} alt={it.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  ) : (
                    <div className="h-full w-full transition-transform duration-700 group-hover:scale-105" style={{ background: p.gradient }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  {p.label && (
                    <span className="absolute left-5 top-5 font-sport text-5xl leading-none text-white/25">{p.label}</span>
                  )}
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
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {L.features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <Card key={f.title} hover className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ecfdf5] text-[#059669]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <Badge>{f.badge}</Badge>
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{f.desc}</p>
                </Card>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* ── COACHING IA (highlight) ── */}
      <Section>
        <Container>
          <div className="overflow-hidden rounded-3xl bg-zinc-950 px-8 py-14 sm:px-14 sm:py-20">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Badge tone="brand" dot>{L.coaching.badge}</Badge>
                <h2 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.05] tracking-tight text-white">
                  {L.coaching.title}
                </h2>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/55">
                  {L.coaching.subtitle}
                </p>
                <Link href="/signup" className={btnClass("secondary", "lg", "mt-8")}>
                  {L.coaching.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid gap-3">
                {L.coaching.pills.map((f) => (
                  <div key={f.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                      <h3 className="font-semibold text-white">{f.t}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/45">{f.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ── TARIFS ── */}
      <Section id="tarifs" className="bg-zinc-50">
        <Container>
          <SectionHeading
            eyebrow={L.pricing.eyebrow}
            title={L.pricing.title}
            subtitle={L.pricing.subtitle}
          />
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {L.pricing.plans.map((plan, i) => {
              const v = PLAN_VISUALS[i];
              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-3xl p-8 ${v.featured ? "bg-zinc-950 text-white ring-2 ring-[#059669]" : "bg-white ring-1 ring-inset ring-zinc-200"}`}
                >
                  {plan.badge && (
                    <span className={`absolute -top-3 left-8 rounded-full px-3 py-1 text-[11px] font-bold ${v.featured ? "bg-[#10b981] text-[#04120c]" : "bg-zinc-900 text-white"}`}>
                      {plan.badge}
                    </span>
                  )}
                  <div className={`text-sm font-semibold ${v.featured ? "text-white/50" : "text-zinc-400"}`}>{plan.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tight">{v.price}</span>
                    <span className={`text-sm ${v.featured ? "text-white/40" : "text-zinc-400"}`}>{plan.period}</span>
                  </div>
                  <ul className="mt-7 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-center gap-2.5 text-sm ${v.featured ? "text-white/75" : "text-zinc-600"}`}>
                        <Check className={`h-4 w-4 flex-shrink-0 ${v.featured ? "text-[#34d399]" : "text-[#059669]"}`} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={v.href}
                    className={btnClass(v.featured ? "secondary" : "primary", "md", "mt-8 w-full")}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>
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
