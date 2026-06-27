import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { btnClass } from "@/components/ui/Button";
import { getPublicLang } from "@/lib/i18n/serverLang";
import type { Lang } from "@/lib/i18n/translations";

// Cadre de la page traduit ; les 26 témoignages restent en VO (authenticité).
const AV: Record<Lang, { testers: string; titleA: string; titleAccent: string; subtitle: string; avgLabel: string; avgSub: string; publishedLabel: string; testersSub: string; fiveLabel: string; maxSub: string; beginnersLabel: string; beginnersSub: string; ctaTitle: string; ctaSub: string; ctaBtn: string; ctaNote: string }> = {
  fr: { testers: "coureurs testeurs", titleA: "Ils ont testé. Ils ont ", titleAccent: "adoré", subtitle: "Coureurs amateurs, traileurs confirmés et athlètes élite — voici leurs retours, sans filtre.", avgLabel: "Note moyenne", avgSub: "sur 5 étoiles", publishedLabel: "Avis publiés", testersSub: "coureurs testeurs", fiveLabel: "5 étoiles", maxSub: "avis maximum", beginnersLabel: "Débutants", beginnersSub: "premiers km avec nous", ctaTitle: "Écris ton propre avis.", ctaSub: "Rejoins les coureurs qui progressent avec Pacevo.", ctaBtn: "Créer un compte gratuit", ctaNote: "Gratuit · Sans carte bancaire · Annulable à tout moment" },
  en: { testers: "tester runners", titleA: "They tried it. They ", titleAccent: "loved it", subtitle: "Amateur runners, seasoned trail runners and elite athletes — here's their unfiltered feedback.", avgLabel: "Average rating", avgSub: "out of 5 stars", publishedLabel: "Published reviews", testersSub: "tester runners", fiveLabel: "5 stars", maxSub: "top reviews", beginnersLabel: "Beginners", beginnersSub: "first km with us", ctaTitle: "Write your own review.", ctaSub: "Join the runners progressing with Pacevo.", ctaBtn: "Create a free account", ctaNote: "Free · No credit card · Cancel anytime" },
  de: { testers: "Test-Läufer", titleA: "Sie haben getestet. Sie waren ", titleAccent: "begeistert", subtitle: "Amateurläufer, erfahrene Trailrunner und Elite-Athleten — hier ihr ungefiltertes Feedback.", avgLabel: "Ø-Bewertung", avgSub: "von 5 Sternen", publishedLabel: "Veröffentlichte Bewertungen", testersSub: "Test-Läufer", fiveLabel: "5 Sterne", maxSub: "Top-Bewertungen", beginnersLabel: "Einsteiger", beginnersSub: "erste km mit uns", ctaTitle: "Schreib deine eigene Bewertung.", ctaSub: "Schließe dich den Läufern an, die mit Pacevo Fortschritte machen.", ctaBtn: "Kostenloses Konto erstellen", ctaNote: "Gratis · Keine Kreditkarte · Jederzeit kündbar" },
  es: { testers: "corredores testers", titleA: "Lo probaron. Les ", titleAccent: "encantó", subtitle: "Corredores aficionados, traileros expertos y atletas de élite — aquí sus opiniones, sin filtro.", avgLabel: "Nota media", avgSub: "sobre 5 estrellas", publishedLabel: "Opiniones publicadas", testersSub: "corredores testers", fiveLabel: "5 estrellas", maxSub: "opiniones máximas", beginnersLabel: "Principiantes", beginnersSub: "primeros km con nosotros", ctaTitle: "Escribe tu propia opinión.", ctaSub: "Únete a los corredores que progresan con Pacevo.", ctaBtn: "Crear cuenta gratis", ctaNote: "Gratis · Sin tarjeta · Cancela cuando quieras" },
  pt: { testers: "corredores testers", titleA: "Experimentaram. ", titleAccent: "Adoraram", subtitle: "Corredores amadores, traileiros experientes e atletas de elite — aqui o feedback deles, sem filtro.", avgLabel: "Nota média", avgSub: "em 5 estrelas", publishedLabel: "Avaliações publicadas", testersSub: "corredores testers", fiveLabel: "5 estrelas", maxSub: "avaliações máximas", beginnersLabel: "Iniciantes", beginnersSub: "primeiros km connosco", ctaTitle: "Escreve a tua própria avaliação.", ctaSub: "Junta-te aos corredores que evoluem com a Pacevo.", ctaBtn: "Criar conta grátis", ctaNote: "Grátis · Sem cartão · Cancela quando quiseres" },
};

const REVIEWS = [
  { name: "Thomas G.", stars: 5, text: "Le Ghost Runner vocal m'a fait gagner 4 minutes sur mon semi. Se faire coacher en temps réel kilomètre par kilomètre, c'est impressionnant.", date: "14 avr. 2026", tag: "Semi-marathon" },
  { name: "Camille R.", stars: 5, text: "L'analyse VFC du matin m'a évité un sur-entraînement. J'avais des signaux d'alerte que j'ignorais. L'IA les a détectés avant moi.", date: "12 avr. 2026", tag: "Santé" },
  { name: "Maxime L.", stars: 5, text: "Synchronisation Garmin parfaite. Toutes mes données remontent automatiquement, le dashboard est propre et les insights sont pertinents.", date: "11 avr. 2026", tag: "Garmin" },
  { name: "Sophie M.", stars: 5, text: "Le plan marathon généré par l'IA est très bien structuré. Il s'adapte chaque semaine selon mes données de récupération. Top !", date: "10 avr. 2026", tag: "Marathon" },
  { name: "Julien B.", stars: 5, text: "Le Trail Builder SIG est exactement ce que je cherchais depuis des années. Je trace mes boucles sur carte IGN et j'exporte en GPX.", date: "9 avr. 2026", tag: "Trail" },
  { name: "Léa F.", stars: 5, text: "J'adore le Smart Journal. Parler de ma séance et voir l'IA détecter ma fatigue mentale, c'est bluffant. Très utile avant une compétition.", date: "8 avr. 2026", tag: "Journal" },
  { name: "Antoine D.", stars: 5, text: "Le widget Affûtage Banister m'a permis d'arriver avec un TSB de +18 le jour du marathon. Nouvelle PR de 6 minutes. Merci !", date: "7 avr. 2026", tag: "Marathon" },
  { name: "Marine C.", stars: 5, text: "Interface épurée et moderne. La couleur qui change selon l'état physique du jour, c'est une excellente idée pour entrer dans une logique de récup.", date: "6 avr. 2026", tag: "Design" },
  { name: "Romain P.", stars: 5, text: "Le coaching IA répond en quelques secondes avec des recommandations basées sur mes données réelles. Plus rapide qu'attendre mon coach !", date: "5 avr. 2026", tag: "Coaching IA" },
  { name: "Élodie V.", stars: 5, text: "La synchro Body Battery avec Garmin est parfaite. Je comprends enfin pourquoi certains jours je suis à plat sans raison apparente.", date: "4 avr. 2026", tag: "Santé" },
  { name: "Nicolas T.", stars: 5, text: "Les ligues hebdomadaires m'ont redonné la motivation de me dépasser. Compétition saine et addictive entre coureurs.", date: "3 avr. 2026", tag: "Ligues" },
  { name: "Clara B.", stars: 5, text: "Première fois que je suis un plan jusqu'au bout. L'IA s'adapte si bien à ma vie que je n'ai plus d'excuses pour sauter des séances.", date: "2 avr. 2026", tag: "Plan IA" },
  { name: "Hugo M.", stars: 5, text: "Le meilleur Trail Builder que j'ai testé. Snap-to-path ultra précis sur les GR, export GPX direct sur Garmin 965 sans souci.", date: "1 avr. 2026", tag: "Trail" },
  { name: "Aurélie N.", stars: 5, text: "Mon coach humain utilise maintenant les données de l'app. L'IA et le coach ensemble, c'est la formule parfaite pour progresser.", date: "31 mars 2026", tag: "Coaching" },
  { name: "Baptiste L.", stars: 5, text: "Le score discipline qui grimpe chaque semaine me motive plus que n'importe quelle appli. Simple mais terriblement efficace.", date: "30 mars 2026", tag: "Motivation" },
  { name: "Inès R.", stars: 4, text: "La prédiction de chrono du Ghost Runner est très précise. Il m'a prédit 48:23, j'ai fini en 48:41 sur mon dernier 10 km.", date: "29 mars 2026", tag: "Ghost Runner" },
  { name: "Florian C.", stars: 5, text: "Le hub de courses est excellent : fiches détaillées, profils altimétriques, barrières horaires. Tout pour choisir sa prochaine course.", date: "28 mars 2026", tag: "Courses" },
  { name: "Manon T.", stars: 5, text: "Interface ludique parfaite pour moi qui débute. Les badges et le vocabulaire accessible me donnent envie de progresser.", date: "27 mars 2026", tag: "Débutante" },
  { name: "Kevin S.", stars: 4, text: "CTL et TSB en temps réel, ça change tout pour la gestion de la charge. Avant je n'avais que mes sensations, maintenant j'ai des données.", date: "26 mars 2026", tag: "Mode Élite", elite: true },
  { name: "Pauline M.", stars: 5, text: "La prise en compte de mon cycle qui adapte les séances intenses est une vraie révolution. Enfin une appli pensée pour toutes.", date: "25 mars 2026", tag: "Santé" },
  { name: "Quentin D.", stars: 5, text: "J'ai testé 6 applis de running. La seule qui combine vraiment tout : sommeil, HRV, puissance, allure. Rien ne se compare.", date: "24 mars 2026", tag: "All-in-one" },
  { name: "Sarah K.", stars: 5, text: "Le journal vocal est top. Je parle de ma séance en rentrant et l'IA me sort une analyse de ma fatigue mentale. Très pertinent en prépa.", date: "23 mars 2026", tag: "Journal" },
  { name: "Damien F.", stars: 5, text: "Rapport hebdomadaire automatique très clair. Je le partage avec mon entraîneur chaque lundi. Un temps précieux gagné.", date: "22 mars 2026", tag: "Coaching" },
  { name: "Louise B.", stars: 5, text: "Le mode récupération qui change le fond en bleu m'aide vraiment à écouter mon corps les jours de repos. Un détail qui change tout.", date: "21 mars 2026", tag: "Design" },
  { name: "Alexis P.", stars: 5, text: "La sync avec Coros Apex 2 Pro fonctionne parfaitement. L'IA analyse la nuit et je trouve tout prêt le matin. Flux idéal.", date: "20 mars 2026", tag: "Coros" },
  { name: "Céline V.", stars: 5, text: "Enfin quelque chose qui comprend les coureurs sérieux. Pas du gadget, pas du superficiel. Des données vraiment utiles.", date: "19 mars 2026", tag: "Performance" },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= count ? "fill-amber-400 text-amber-400" : "fill-zinc-200 text-zinc-200"}`} />
      ))}
    </div>
  );
}

export default async function AvisPage() {
  const lang = await getPublicLang();
  const A = AV[lang] ?? AV.fr;
  const avg = (REVIEWS.reduce((s, r) => s + r.stars, 0) / REVIEWS.length).toFixed(1);
  const fiveStars = REVIEWS.filter((r) => r.stars === 5).length;
  const cols = [0, 1, 2].map((c) => REVIEWS.filter((_, i) => i % 3 === c));

  const STATS = [
    { value: avg, label: A.avgLabel, sub: A.avgSub },
    { value: String(REVIEWS.length), label: A.publishedLabel, sub: A.testersSub },
    { value: `${Math.round((fiveStars / REVIEWS.length) * 100)}%`, label: A.fiveLabel, sub: `${fiveStars} ${A.maxSub}` },
    { value: "12", label: A.beginnersLabel, sub: A.beginnersSub },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <SiteHeader />

      {/* HERO */}
      <Container className="pt-16 pb-12 text-center sm:pt-20">
        <div className="flex justify-center">
          <Badge tone="brand" dot>{REVIEWS.length} {A.testers}</Badge>
        </div>
        <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
          {A.titleA}<span className="text-[#059669]">{A.titleAccent}</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-zinc-500">{A.subtitle}</p>

        {/* Stats */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4 gap-px">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white px-5 py-6">
              <div className="text-3xl font-bold tracking-tight tabular-nums text-zinc-900">{s.value}</div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">{s.label}</div>
              <div className="text-xs text-zinc-400">{s.sub}</div>
            </div>
          ))}
        </div>
      </Container>

      {/* REVIEWS (masonry 3 colonnes) */}
      <Section className="!pt-6 bg-zinc-50">
        <Container>
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
            {cols.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-4">
                {col.map((r) => {
                  const elite = r.elite;
                  return (
                    <div key={r.name} className={`rounded-2xl p-5 ${elite ? "bg-zinc-950 text-white" : "bg-white ring-1 ring-inset ring-zinc-200"}`}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${elite ? "bg-white text-zinc-900" : "bg-zinc-900 text-white"}`}>
                            {r.name.charAt(0)}
                          </div>
                          <div>
                            <div className={`text-sm font-semibold ${elite ? "text-white" : "text-zinc-900"}`}>{r.name}</div>
                            <div className={`text-xs ${elite ? "text-white/40" : "text-zinc-400"}`}>{r.date}</div>
                          </div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${elite ? "bg-white/10 text-white/70" : "bg-zinc-100 text-zinc-500"}`}>{r.tag}</span>
                      </div>
                      <Stars count={r.stars} />
                      <p className={`mt-3 text-sm leading-relaxed ${elite ? "text-white/70" : "text-zinc-600"}`}>{r.text}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <Section>
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-20 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_0%,rgba(16,185,129,.16),transparent_60%)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
                {A.ctaTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-sm text-lg text-white/55">{A.ctaSub}</p>
              <Link href="/signup" className={btnClass("brand", "lg", "mt-8")}>
                {A.ctaBtn} <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-6 text-sm text-white/35">{A.ctaNote}</p>
            </div>
          </div>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
