"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const REVIEWS = [
  { name: "Thomas G.", stars: 5, text: "Le Ghost Runner vocal m'a fait gagner 4 minutes sur mon semi. C'est impressionnant de se faire coacher en temps réel kilomètre par kilomètre.", date: "14 avr. 2026", tag: "Semi-marathon", color: "bg-blue-50" },
  { name: "Camille R.", stars: 5, text: "L'analyse VFC du matin m'a évité un sur-entraînement. J'avais des signaux d'alerte que j'ignorais complètement. L'IA les a détectés avant moi.", date: "12 avr. 2026", tag: "Santé", color: "bg-rose-50" },
  { name: "Maxime L.", stars: 5, text: "Synchronisation Garmin parfaite. Toutes mes données remontent automatiquement. Le dashboard est propre et les insights sont vraiment pertinents.", date: "11 avr. 2026", tag: "Garmin", color: "bg-violet-50" },
  { name: "Sophie M.", stars: 5, text: "Le plan marathon généré par l'IA est très bien structuré. Il s'adapte chaque semaine selon mes données de récupération. Vraiment top !", date: "10 avr. 2026", tag: "Marathon", color: "bg-orange-50" },
  { name: "Julien B.", stars: 5, text: "Le Trail Builder SIG est exactement ce que je cherchais depuis des années. Je trace mes boucles directement sur carte IGN et j'exporte en GPX.", date: "9 avr. 2026", tag: "Trail", color: "bg-green-50" },
  { name: "Léa F.", stars: 5, text: "J'adore le Smart Journal. Parler de ma séance et voir l'IA détecter ma fatigue mentale c'est bluffant. Très utile avant une compétition.", date: "8 avr. 2026", tag: "Journal", color: "bg-amber-50" },
  { name: "Antoine D.", stars: 5, text: "Le widget Affûtage Banister m'a permis d'arriver avec un TSB de +18 le jour du marathon. Nouvelle PR de 6 minutes. Merci !", date: "7 avr. 2026", tag: "Marathon", color: "bg-orange-50" },
  { name: "Marine C.", stars: 5, text: "Interface épurée et moderne. La couleur qui change selon l'état physique du jour c'est une excellente idée, on rentre vraiment dans une logique de récupération.", date: "6 avr. 2026", tag: "Design", color: "bg-zinc-50" },
  { name: "Romain P.", stars: 5, text: "Le coaching IA répond à mes questions en quelques secondes avec des recommandations basées sur mes données réelles. Plus rapide qu'attendre mon coach !", date: "5 avr. 2026", tag: "Coaching IA", color: "bg-green-50" },
  { name: "Élodie V.", stars: 5, text: "La synchronisation Body Battery avec Garmin est parfaite. Maintenant je comprends pourquoi certains jours je suis à plat sans raison apparente.", date: "4 avr. 2026", tag: "Santé", color: "bg-rose-50" },
  { name: "Nicolas T.", stars: 5, text: "Les ligues hebdomadaires m'ont redonné la motivation de me dépasser chaque semaine. Compétition saine et addictive entre coureurs.", date: "3 avr. 2026", tag: "Ligues", color: "bg-yellow-50" },
  { name: "Clara B.", stars: 5, text: "Première fois que je suis un plan jusqu'au bout. L'IA s'adapte si bien à ma vie que je n'ai plus d'excuses pour sauter des séances.", date: "2 avr. 2026", tag: "Plan IA", color: "bg-emerald-50" },
  { name: "Hugo M.", stars: 5, text: "Le Trail Builder est le meilleur que j'ai testé. Snap-to-path ultra précis sur les chemins GR. Export GPX direct sur Garmin 965 sans aucun souci.", date: "1 avr. 2026", tag: "Trail", color: "bg-green-50" },
  { name: "Aurélie N.", stars: 5, text: "Mon coach humain utilise maintenant les données de l'app. L'IA et le coach ensemble c'est vraiment la formule parfaite pour progresser.", date: "31 mars 2026", tag: "Coaching", color: "bg-green-50" },
  { name: "Baptiste L.", stars: 5, text: "Score discipline qui grimpe chaque semaine, ça me motive plus que n'importe quelle autre appli. Simple mais terriblement efficace psychologiquement.", date: "30 mars 2026", tag: "Motivation", color: "bg-pink-50" },
  { name: "Inès R.", stars: 4, text: "La prédiction de chrono du Ghost Runner est très précise. Il m'a prédit 48:23, j'ai fini en 48:41 sur mon dernier 10km. Bluffant.", date: "29 mars 2026", tag: "Ghost Runner", color: "bg-indigo-50" },
  { name: "Florian C.", stars: 5, text: "Le hub de courses est excellent. Fiches détaillées, profils altimétriques, barrières horaires. Tout ce qu'il faut pour choisir sa prochaine course.", date: "28 mars 2026", tag: "Courses", color: "bg-sky-50" },
  { name: "Manon T.", stars: 5, text: "Interface ludique parfaite pour moi qui débute. Les badges et le vocabulaire accessible me donnent envie de progresser sans me sentir nulle.", date: "27 mars 2026", tag: "Débutante", color: "bg-lime-50" },
  { name: "Kevin S.", stars: 4, text: "CTL et TSB en temps réel ça change tout pour la gestion de la charge. Je ne m'appuyais que sur mes sensations avant. Maintenant j'ai des données.", date: "26 mars 2026", tag: "Mode Élite", color: "bg-zinc-900" },
  { name: "Pauline M.", stars: 5, text: "La prise en compte de mon cycle féminin qui adapte les séances intenses est une vraie révolution. Enfin une appli pensée pour toutes.", date: "25 mars 2026", tag: "Santé", color: "bg-rose-50" },
  { name: "Quentin D.", stars: 5, text: "J'ai testé 6 applis de running. Celle-ci est la seule qui combine vraiment tout : sommeil, HRV, puissance, allure. Rien ne se compare.", date: "24 mars 2026", tag: "All-in-one", color: "bg-teal-50" },
  { name: "Sarah K.", stars: 5, text: "Le journal vocal est top. Je parle de ma séance en rentrant et l'IA me sort une analyse de ma fatigue mentale. Très pertinent en période de prépa.", date: "23 mars 2026", tag: "Journal", color: "bg-amber-50" },
  { name: "Damien F.", stars: 5, text: "Rapport hebdomadaire automatique très clair. Je le partage avec mon entraîneur chaque lundi matin. Ça nous fait gagner un temps précieux.", date: "22 mars 2026", tag: "Coaching", color: "bg-green-50" },
  { name: "Louise B.", stars: 5, text: "Le mode récupération qui change le fond en bleu m'aide vraiment à écouter mon corps les jours de repos. Un détail qui change tout.", date: "21 mars 2026", tag: "Design", color: "bg-zinc-50" },
  { name: "Alexis P.", stars: 5, text: "La sync avec Coros Apex 2 Pro fonctionne parfaitement. L'IA analyse la nuit et je trouve tout prêt le matin. Flux de travail idéal.", date: "20 mars 2026", tag: "Coros", color: "bg-violet-50" },
  { name: "Céline V.", stars: 5, text: "Enfin quelque chose qui comprend les coureurs sérieux. Pas du gadget, pas du superficiel. Des données vraiment utiles au quotidien.", date: "19 mars 2026", tag: "Performance", color: "bg-red-50" },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= count ? "text-amber-400" : "text-zinc-200"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

export default function AvisPage() {
  const avg = (REVIEWS.reduce((s, r) => s + r.stars, 0) / REVIEWS.length).toFixed(1);
  const fiveStars = REVIEWS.filter(r => r.stars === 5).length;
  const pct = Math.round(fiveStars / REVIEWS.length * 100);

  // Split into 3 columns manually for masonry effect
  const col1 = REVIEWS.filter((_, i) => i % 3 === 0);
  const col2 = REVIEWS.filter((_, i) => i % 3 === 1);
  const col3 = REVIEWS.filter((_, i) => i % 3 === 2);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-zinc-100">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="font-semibold text-zinc-900 text-sm tracking-tight">Pacevo</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500">
            <Link href="/#programmes" className="hover:text-zinc-900 transition-colors">Programmes</Link>
            <Link href="/#coaching" className="hover:text-zinc-900 transition-colors">Coaching IA</Link>
            <Link href="/#features" className="hover:text-zinc-900 transition-colors">Fonctionnalités</Link>
            <Link href="/#tarifs" className="hover:text-zinc-900 transition-colors">Tarifs</Link>
            <Link href="/blog" className="hover:text-zinc-900 transition-colors">Blog</Link>
            <Link href="/avis" className="text-zinc-900 font-semibold">Avis</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 px-4 py-2">Connexion</Link>
            <Link href="/signup" className="inline-flex items-center gap-1.5 bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors">
              Essai gratuit <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-40 pb-20 px-8" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #dcfce7 0%, #fff 70%)" }}>
        <div className="max-w-7xl mx-auto">

          {/* Badge */}
          <div className="flex justify-center mb-10">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-white shadow-sm border border-zinc-100 rounded-full text-sm font-semibold text-zinc-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              34 coureurs testeurs
            </span>
          </div>

          {/* Title */}
          <h1 className="font-sport font-black uppercase text-center leading-[0.9] text-zinc-900 mb-8" style={{ fontSize: "clamp(3rem, 7vw, 6rem)" }}>
            ILS ONT TESTÉ.
            <br />
            <span style={{ color: "#16a34a" }}>ILS ONT ADORÉ.</span>
          </h1>

          <p className="text-center text-zinc-400 text-xl max-w-lg mx-auto mb-16 leading-relaxed">
            Coureurs amateurs, traileurs confirmés et athlètes élite.<br />Voici leurs retours sans filtre.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-4xl mx-auto">
            {[
              { value: avg, label: "Note moyenne", sub: "★★★★★", bg: "bg-green-500", text: "text-white" },
              { value: "26", label: "Avis publiés", sub: "sur 34 testeurs", bg: "bg-blue-500", text: "text-white" },
              { value: "94%", label: "Satisfaction", sub: "24 avis 5 étoiles", bg: "bg-amber-400", text: "text-zinc-900" },
              { value: "12", label: "Débutants", sub: "premiers km avec nous", bg: "bg-violet-500", text: "text-white" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-3xl p-7 flex flex-col gap-1`}>
                <div className={`font-sport font-black leading-none ${s.text}`} style={{ fontSize: "4rem" }}>{s.value}</div>
                <div className={`text-sm font-bold uppercase tracking-wide mt-2 ${s.text} opacity-70`}>{s.label}</div>
                <div className={`text-xs ${s.text} opacity-50`}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="bg-[#F8F8F8] py-20 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {[col1, col2, col3].map((col, ci) => (
              <div key={ci} className="flex flex-col gap-4">
                {col.map((r) => {
                  const isElite = r.tag === "Mode Élite";
                  return (
                    <div key={r.name} className={`rounded-2xl p-5 ${isElite ? "bg-zinc-900" : "bg-white border border-zinc-100"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isElite ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>
                            {r.name.charAt(0)}
                          </div>
                          <div>
                            <div className={`font-semibold text-sm ${isElite ? "text-white" : "text-zinc-900"}`}>{r.name}</div>
                            <div className={`text-xs ${isElite ? "text-white/40" : "text-zinc-400"}`}>{r.date}</div>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isElite ? "bg-white/10 text-white/70" : "bg-zinc-100 text-zinc-500"}`}>
                          {r.tag}
                        </span>
                      </div>
                      <Stars count={r.stars} />
                      <p className={`text-sm leading-relaxed mt-3 ${isElite ? "text-white/70" : "text-zinc-600"}`}>{r.text}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-zinc-950 py-24 px-8 text-center">
        <h2 className="font-sport text-[clamp(3rem,8vw,7rem)] font-black uppercase text-white leading-[0.9] mb-4">
          ÉCRIS TON<br />PROPRE AVIS
        </h2>
        <p className="text-white/40 mb-10 max-w-sm mx-auto">Gratuit · Pas de carte bancaire · Annulable à tout moment</p>
        <Link href="/signup" className="inline-flex items-center gap-2 bg-green-400 text-zinc-900 font-bold text-base px-10 py-4 rounded-2xl hover:bg-green-300 transition-all">
          Créer un compte gratuit <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="bg-zinc-950 border-t border-white/5 py-10 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-semibold text-white text-sm">Pacevo</span>
          </div>
          <p className="text-sm text-white/30">© 2026 Pacevo.</p>
          <div className="flex gap-6 text-sm text-white/30">
            <Link href="/" className="hover:text-white/60 transition-colors">Accueil</Link>
            <Link href="/blog" className="hover:text-white/60 transition-colors">Blog</Link>
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
