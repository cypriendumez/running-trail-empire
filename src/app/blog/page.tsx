import Link from "next/link";
import { ArrowRight } from "lucide-react";

const CATEGORIES = ["TOUT", "IA & PERFORMANCE", "ENTRAÎNEMENT", "NUTRITION", "SANTÉ DU COUREUR", "LES COURSES", "ÉQUIPEMENT"];

const POSTS = [
  {
    id: 1,
    category: "IA & PERFORMANCE",
    title: "Pourquoi l'IA sera ton meilleur coach (et ce qu'un humain ne peut pas faire)",
    excerpt: "L'IA analyse ta VFC, ton sommeil, ta charge en temps réel. Un coach humain te voit une fois par semaine. Voici pourquoi l'avenir c'est les deux.",
    img: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "19 avr. 2026",
    readTime: "8 MIN DE LECTURE",
    featured: true,
  },
  {
    id: 2,
    category: "IA & PERFORMANCE",
    title: "HRV + IA : comment notre algorithme prédit ta fatigue 48h avant que tu la ressentes",
    excerpt: "Le modèle de Banister CTL/ATL/TSB combiné à l'analyse HRV permet de prédire les jours de sur-entraînement avec une précision de 94%.",
    img: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "16 avr. 2026",
    readTime: "12 MIN DE LECTURE",
    featured: false,
  },
  {
    id: 3,
    category: "ENTRAÎNEMENT",
    title: "Semi-marathon en moins de 1h45 : le plan IA qui a fonctionné pour 2 300 coureurs",
    excerpt: "Allure, fractions, récupération. Tout est calculé en fonction de ta VMA et de ta VFC du matin. Résultats : -8 min en moyenne sur le chrono final.",
    img: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "14 avr. 2026",
    readTime: "10 MIN DE LECTURE",
    featured: false,
  },
  {
    id: 4,
    category: "SANTÉ DU COUREUR",
    title: "Body Battery à 20% le matin : faut-il courir quand même ?",
    excerpt: "La réponse varie selon ton TSB, ta phase de préparation et le type de séance prévue. L'IA tranche pour toi — voici comment elle décide.",
    img: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "11 avr. 2026",
    readTime: "6 MIN DE LECTURE",
    featured: false,
  },
  {
    id: 5,
    category: "LES COURSES",
    title: "UTMB 2026 : les trails français à ne pas manquer cette saison",
    excerpt: "De l'UTMB au Grand Raid de La Réunion. Notre sélection des 20 courses trail incontournables avec profils altimétriques et barrières horaires.",
    img: "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "9 avr. 2026",
    readTime: "15 MIN DE LECTURE",
    featured: false,
  },
  {
    id: 6,
    category: "IA & PERFORMANCE",
    title: "Ghost Runner : courir avec un coach vocal IA, ça change vraiment quelque chose ?",
    excerpt: "On a testé le coaching vocal IA sur 6 semaines avec 80 coureurs. Les résultats sur l'allure, la régularité et la motivation sont sans appel.",
    img: "https://images.unsplash.com/photo-1571008887538-b36bb32f4571?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "7 avr. 2026",
    readTime: "9 MIN DE LECTURE",
    featured: false,
  },
  {
    id: 7,
    category: "NUTRITION",
    title: "Ravitaillement marathon : quoi manger, quand et combien selon ton poids et ton allure",
    excerpt: "Notre calculateur IA tient compte de ta sudation, ta corpulence et ton pace pour te donner un plan glucidique sur mesure.",
    img: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "4 avr. 2026",
    readTime: "11 MIN DE LECTURE",
    featured: false,
  },
  {
    id: 8,
    category: "ÉQUIPEMENT",
    title: "Chaussures de trail 2026 : notre comparatif IA selon ton type de foulée",
    excerpt: "L'IA analyse ta cadence, ton oscillation verticale et ton temps de contact au sol pour identifier la chaussure parfaite parmi 200+ modèles.",
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80&fit=crop",
    author: "Équipe R&TE",
    date: "1 avr. 2026",
    readTime: "14 MIN DE LECTURE",
    featured: false,
  },
];

export default function BlogPage() {
  const featured = POSTS.find(p => p.featured)!;
  const rest = POSTS.filter(p => !p.featured);

  return (
    <div className="bg-white min-h-screen font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-900 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-zinc-900 text-sm tracking-tight">Running & Trail Empire</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <Link href="/#programmes" className="hover:text-zinc-900 transition-colors">Programmes</Link>
            <Link href="/#coaching" className="hover:text-zinc-900 transition-colors">Coaching IA</Link>
            <Link href="/#features" className="hover:text-zinc-900 transition-colors">Fonctionnalités</Link>
            <Link href="/#tarifs" className="hover:text-zinc-900 transition-colors">Tarifs</Link>
            <Link href="/blog" className="text-zinc-900 font-semibold">Blog</Link>
            <Link href="/avis" className="hover:text-zinc-900 transition-colors">Avis</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors px-4 py-2">Connexion</Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors">
              Essai gratuit <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-40 pb-24 text-center px-8" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #fef9c3 0%, #fde68a 30%, #fff 70%)" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-600 mb-6">Le Blog</p>
        <h1 className="font-sport text-[clamp(4rem,12vw,9rem)] font-black uppercase text-zinc-900 leading-[0.85]">
          COMPRENDS<br />APPRENDS<br />PROGRESSE
        </h1>
        <p className="text-zinc-500 text-lg mt-8 max-w-xl mx-auto leading-relaxed">
          Tout ce que la science du sport et l&apos;intelligence artificielle peuvent faire pour ton running.
        </p>
      </section>

      {/* CATEGORIES */}
      <div className="bg-white border-b border-zinc-100 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap border border-zinc-200 text-zinc-500 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition-all first:bg-zinc-900 first:text-white first:border-zinc-900"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-20">

        {/* FEATURED POST — IA MANIFESTO */}
        <div className="grid lg:grid-cols-2 gap-10 mb-20 items-center">
          <div className="relative rounded-3xl overflow-hidden aspect-[4/3]">
            <img src={featured.img} alt={featured.title} className="w-full h-full object-cover" />
            <div className="absolute bottom-4 right-4 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
              {featured.readTime}
            </div>
          </div>
          <div>
            <span className="inline-block px-3 py-1 bg-green-400 text-zinc-900 text-xs font-black uppercase tracking-widest rounded-full mb-5">
              {featured.category}
            </span>
            <h2 className="font-sport text-4xl lg:text-5xl font-black uppercase text-zinc-900 leading-[0.9] mb-5">
              {featured.title}
            </h2>
            <p className="text-zinc-500 leading-relaxed mb-8 text-base">
              {featured.excerpt}
            </p>

            {/* IA vs Coach manifesto */}
            <div className="bg-zinc-50 rounded-2xl p-6 mb-8 border border-zinc-100">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">IA + Coach = La combinaison parfaite</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Coach humain", items: ["Vision long terme", "Motivation", "Expérience terrain", "Ajustement tactique"] },
                  { label: "IA Running", items: ["Analyse 24h/24", "HRV + sommeil + charge", "Prédiction fatigue", "Plan temps réel"] },
                ].map(col => (
                  <div key={col.label}>
                    <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${col.label === "IA Running" ? "text-green-600" : "text-zinc-900"}`}>
                      {col.label}
                    </div>
                    <ul className="space-y-1.5">
                      {col.items.map(item => (
                        <li key={item} className="text-xs text-zinc-500 flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.label === "IA Running" ? "bg-green-400" : "bg-zinc-300"}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <Link href="/signup" className="inline-flex items-center gap-2 bg-zinc-900 text-white font-bold px-7 py-3.5 rounded-xl hover:bg-zinc-700 transition-all">
              Lire l&apos;article <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* GRID */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {rest.map(post => (
            <Link href="/signup" key={post.id} className="group">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3] mb-5">
                <img
                  src={post.img}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  {post.readTime}
                </div>
              </div>
              <span className={`inline-block px-2.5 py-1 text-xs font-black uppercase tracking-widest rounded-full mb-3 ${
                post.category === "IA & PERFORMANCE"
                  ? "bg-green-400 text-zinc-900"
                  : "bg-zinc-100 text-zinc-600"
              }`}>
                {post.category}
              </span>
              <h3 className="font-sport text-2xl font-black uppercase text-zinc-900 leading-tight mb-2 group-hover:text-zinc-600 transition-colors">
                {post.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{post.excerpt}</p>
              <div className="flex items-center gap-2 mt-4 text-xs text-zinc-400">
                <span className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center text-white font-bold text-xs">R</span>
                <span>{post.author}</span>
                <span>·</span>
                <span>{post.date}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA NEWSLETTER */}
      <section className="bg-zinc-950 py-24 px-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/30 mb-4">Newsletter</p>
        <h2 className="font-sport text-5xl lg:text-7xl font-black uppercase text-white leading-[0.9] mb-6">
          RESTE À LA<br />POINTE
        </h2>
        <p className="text-white/40 mb-10 max-w-md mx-auto">
          Reçois chaque semaine les dernières avancées en IA running, entraînement et science du sport.
        </p>
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="ton@email.com"
            className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/30 px-5 py-3.5 rounded-xl text-sm outline-none focus:border-white/40 transition-colors"
          />
          <button className="bg-white text-zinc-900 font-bold px-6 py-3.5 rounded-xl hover:bg-zinc-100 transition-colors whitespace-nowrap text-sm">
            S&apos;inscrire
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-zinc-950 border-t border-white/5 text-white py-12 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center">
              <span className="text-zinc-900 font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-white text-sm">Running & Trail Empire</span>
          </div>
          <p className="text-sm text-white/30">© 2026 Running & Trail Empire.</p>
          <div className="flex gap-6 text-sm text-white/30">
            <Link href="/" className="hover:text-white/60 transition-colors">Accueil</Link>
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Confidentialité</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">CGU</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
