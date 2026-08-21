import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { CHIFFRES } from "@/lib/brand/stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, litAvis } from "@/lib/avis/store";
import { AvisForm } from "@/components/avis/AvisForm";
import type { Lang } from "@/lib/i18n/translations";

/**
 * LA PAGE AVIS, VIDÉE DE SES FAUX AVIS — 21/08/2026.
 *
 * ⚠️ CE QU'ELLE CONTENAIT. Vingt-six témoignages entièrement fabriqués : prénoms et
 * initiales inventés, dates inventées, notes inventées, et des faits chiffrés inventés
 * dans le corps du texte — « m'a fait gagner 4 minutes sur mon semi », « nouvelle PR de
 * 6 minutes », « il m'a prédit 48:23, j'ai fini en 48:41 ». Au-dessus, quatre compteurs
 * du même bois : 4,9 de note moyenne, 26 avis publiés, 92 % de 5 étoiles, 12 débutants.
 * Le titre annonçait « voici leurs retours, sans filtre », et un commentaire du code
 * précisait que les témoignages restaient en VO « pour l'authenticité ».
 *
 * ⚠️ POURQUOI C'EST PLUS GRAVE QU'UNE EXAGÉRATION. Publier de faux avis de consommateurs
 * est une pratique commerciale réputée trompeuse EN TOUTES CIRCONSTANCES depuis la
 * directive (UE) 2019/2161, transposée en France à l'article L121-4 du code de la
 * consommation. Ce n'est pas une zone grise qu'on plaide : la pratique est listée. La
 * sanction encourue relève de l'article L132-2 — deux ans d'emprisonnement et 300 000 €
 * d'amende, portée jusqu'à 10 % du chiffre d'affaires. Et le site est mis en vente : un
 * acheteur qui découvre vingt-six témoignages fabriqués ne renégocie pas, il part.
 *
 * ── CE QU'ON MET À LA PLACE ──────────────────────────────────────────────────
 * Pas une page vide, et surtout pas une page qui s'excuse. La preuve sociale manque
 * parce que le produit vient d'ouvrir ; ce qui ne manque pas, c'est la preuve tout court.
 * Les chiffres de `lib/brand/stats` se RECOMPTENT — 14 000 courses par une requête,
 * 15 700 parcours par une lecture de fichier. Une page qui montre ce qui se vérifie et
 * dit franchement ce qui n'existe pas encore vaut mieux, y compris commercialement,
 * qu'une page de compliments écrits par son propre éditeur.
 */

type Bloc = {
  titre: string; accent: string; chapo: string;
  // Quand des avis existent, la page ne peut plus s'intituler « Aucun avis ».
  titrePlein: string; accentPlein: string; chapoPlein: string;
  methodeTitre: string; methode: string[];
  preuveTitre: string; preuveSub: string;
  labelCourses: string; labelParcours: string; labelPlan: string; labelSynchro: string;
  ctaTitre: string; ctaSub: string; ctaBtn: string; ctaNote: string;
};

const AV: Record<Lang, Bloc> = {
  fr: {
    titre: "Aucun avis. ", accent: "Pas encore.",
    titrePlein: "Ce qu'ils en ", accentPlein: "disent.", chapoPlein: "Écrits par des coureurs qui ont un compte Pacevo, publiés tels quels.",
    chapo: "Pacevo vient d'ouvrir. Le jour où des coureurs écriront, ce sont leurs mots qui seront ici — pas les nôtres.",
    methodeTitre: "Ce qu'on s'engage à faire quand ils arriveront",
    methode: [
      "Publier les avis tels qu'ils sont écrits, sans les retoucher.",
      "Ne pas cacher les avis négatifs : un produit sans reproche n'existe pas.",
      "N'afficher que des avis de personnes ayant réellement un compte.",
      "Ne jamais écrire d'avis nous-mêmes, ni en commander.",
    ],
    preuveTitre: "En attendant, voici ce qui se vérifie",
    preuveSub: "Chacun de ces chiffres se recompte dans l'application. Aucun ne vient d'une enquête qu'on n'a pas faite.",
    labelCourses: "Courses à venir en base",
    labelParcours: "Parcours cartographiés",
    labelPlan: "De plan glissant, recalculé",
    labelSynchro: "Entre deux replanifications",
    ctaTitre: "Sois parmi les premiers.",
    ctaSub: "Essaie Pacevo, et si ça t'aide, écris-le. Si ça ne t'aide pas, écris-le aussi.",
    ctaBtn: "Créer un compte gratuit",
    ctaNote: "Gratuit · Sans carte bancaire · Annulable à tout moment",
  },
  en: {
    titre: "No reviews. ", accent: "Not yet.",
    titrePlein: "What they ", accentPlein: "say.", chapoPlein: "Written by runners with a Pacevo account, published as written.",
    chapo: "Pacevo has just opened. The day runners write something, their words will be here — not ours.",
    methodeTitre: "What we commit to when they arrive",
    methode: [
      "Publish reviews exactly as they are written, unedited.",
      "Never hide the negative ones: no product is beyond reproach.",
      "Only show reviews from people who really have an account.",
      "Never write reviews ourselves, nor commission any.",
    ],
    preuveTitre: "In the meantime, here is what can be checked",
    preuveSub: "Every figure below can be recounted inside the app. None comes from a survey we never ran.",
    labelCourses: "Upcoming races in the database",
    labelParcours: "Mapped routes",
    labelSynchro: "Between two replans",
    labelPlan: "Rolling plan, recalculated",
    ctaTitre: "Be among the first.",
    ctaSub: "Try Pacevo, and if it helps, say so. If it doesn't, say that too.",
    ctaBtn: "Create a free account",
    ctaNote: "Free · No credit card · Cancel anytime",
  },
  de: {
    titre: "Keine Bewertungen. ", accent: "Noch nicht.",
    titrePlein: "Was sie ", accentPlein: "sagen.", chapoPlein: "Von Läufern mit einem Pacevo-Konto geschrieben, unverändert veröffentlicht.",
    chapo: "Pacevo ist gerade gestartet. Sobald Läufer etwas schreiben, stehen ihre Worte hier — nicht unsere.",
    methodeTitre: "Was wir versprechen, sobald sie kommen",
    methode: [
      "Bewertungen genau so veröffentlichen, wie sie geschrieben wurden.",
      "Negative Bewertungen nicht verstecken: Kein Produkt ist tadellos.",
      "Nur Bewertungen von Personen zeigen, die wirklich ein Konto haben.",
      "Niemals selbst Bewertungen schreiben oder in Auftrag geben.",
    ],
    preuveTitre: "Bis dahin: das hier lässt sich nachprüfen",
    preuveSub: "Jede Zahl unten lässt sich in der App nachzählen. Keine stammt aus einer Umfrage, die es nie gab.",
    labelCourses: "Kommende Rennen in der Datenbank",
    labelParcours: "Kartierte Strecken",
    labelPlan: "Rollierender Plan, neu berechnet",
    labelSynchro: "Zwischen zwei Neuplanungen",
    ctaTitre: "Sei unter den Ersten.",
    ctaSub: "Probier Pacevo aus. Wenn es hilft, schreib es. Wenn nicht, schreib das auch.",
    ctaBtn: "Kostenloses Konto erstellen",
    ctaNote: "Gratis · Keine Kreditkarte · Jederzeit kündbar",
  },
  es: {
    titre: "Sin opiniones. ", accent: "Todavía.",
    titrePlein: "Lo que ", accentPlein: "dicen.", chapoPlein: "Escritas por corredores con cuenta Pacevo, publicadas tal cual.",
    chapo: "Pacevo acaba de abrir. El día en que los corredores escriban, estarán sus palabras aquí — no las nuestras.",
    methodeTitre: "A qué nos comprometemos cuando lleguen",
    methode: [
      "Publicar las opiniones tal y como se escriben, sin retocarlas.",
      "No esconder las negativas: ningún producto es irreprochable.",
      "Mostrar solo opiniones de personas que tienen cuenta de verdad.",
      "No escribir nunca opiniones nosotros mismos, ni encargarlas.",
    ],
    preuveTitre: "Mientras tanto, esto sí se puede comprobar",
    preuveSub: "Cada cifra se puede volver a contar dentro de la app. Ninguna viene de una encuesta que no hicimos.",
    labelCourses: "Carreras próximas en la base",
    labelParcours: "Rutas cartografiadas",
    labelPlan: "De plan deslizante, recalculado",
    labelSynchro: "Entre dos replanificaciones",
    ctaTitre: "Sé de los primeros.",
    ctaSub: "Prueba Pacevo. Si te ayuda, dilo. Si no te ayuda, dilo también.",
    ctaBtn: "Crear cuenta gratis",
    ctaNote: "Gratis · Sin tarjeta · Cancela cuando quieras",
  },
  pt: {
    titre: "Sem avaliações. ", accent: "Ainda.",
    titrePlein: "O que eles ", accentPlein: "dizem.", chapoPlein: "Escritas por corredores com conta Pacevo, publicadas tal como escritas.",
    chapo: "A Pacevo acabou de abrir. No dia em que os corredores escreverem, estarão aqui as palavras deles — não as nossas.",
    methodeTitre: "O que prometemos quando chegarem",
    methode: [
      "Publicar as avaliações tal como são escritas, sem retoques.",
      "Não esconder as negativas: nenhum produto é irrepreensível.",
      "Mostrar apenas avaliações de quem tem mesmo uma conta.",
      "Nunca escrever avaliações nós próprios, nem encomendá-las.",
    ],
    preuveTitre: "Entretanto, isto verifica-se",
    preuveSub: "Cada número abaixo pode ser recontado dentro da app. Nenhum vem de um inquérito que nunca fizemos.",
    labelCourses: "Provas futuras na base",
    labelParcours: "Percursos cartografados",
    labelPlan: "De plano deslizante, recalculado",
    labelSynchro: "Entre duas replanificações",
    ctaTitre: "Sê dos primeiros.",
    ctaSub: "Experimenta a Pacevo. Se ajudar, escreve. Se não ajudar, escreve também.",
    ctaBtn: "Criar conta grátis",
    ctaNote: "Grátis · Sem cartão · Cancela quando quiseres",
  },
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Avis — Pacevo" };

export default async function AvisPage() {
  const lang = await getPublicLang();
  const A = AV[lang] ?? AV.fr;

  // ⚠️ SEULS LES AVIS PUBLIÉS. `publie` est faux à la soumission et ne passe à vrai que
  // par la modération, qui n'écarte que l'insulte et le spam — jamais une mauvaise note.
  let publies: { note: number; texte: string; auteur: string; at: string }[] = [];
  try {
    const { data } = await createAdminClient()
      .from("notifications").select("data, created_at")
      .eq("type", TYPE_AVIS).order("created_at", { ascending: false }).limit(60);
    publies = (data ?? [])
      .map((r) => litAvis(r.data))
      .filter((a): a is NonNullable<typeof a> => Boolean(a?.publie));
  } catch { publies = []; }
  // Les quatre chiffres viennent de la SOURCE UNIQUE, jamais recopiés ici.
  const preuves = [
    { valeur: CHIFFRES.courses, label: A.labelCourses },
    { valeur: CHIFFRES.parcours, label: A.labelParcours },
    { valeur: CHIFFRES.plan, label: A.labelPlan },
    { valeur: CHIFFRES.synchro, label: A.labelSynchro },
  ];

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <Section className="pt-16">
        <Container>
          <h1 className="mx-auto max-w-3xl text-center text-5xl font-bold leading-[1.05] tracking-tight text-zinc-900 sm:text-6xl">
            {publies.length ? A.titrePlein : A.titre}
            <span className="text-emerald-600">{publies.length ? A.accentPlein : A.accent}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-center text-lg leading-relaxed text-zinc-500">
            {publies.length ? A.chapoPlein : A.chapo}
          </p>
        </Container>
      </Section>

      {/* L'ENGAGEMENT. C'est ce qui remplace la preuve sociale : à défaut de pouvoir
          montrer des avis, on montre la règle qu'on s'impose pour le jour où il y en aura. */}
      <Section>
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl bg-zinc-50 p-8 ring-1 ring-inset ring-zinc-200">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 flex-shrink-0 text-emerald-600" />
              <h2 className="text-base font-bold text-zinc-900">{A.methodeTitre}</h2>
            </div>
            <ul className="mt-5 space-y-3">
              {A.methode.map((m) => (
                <li key={m} className="flex gap-3 text-sm leading-relaxed text-zinc-600">
                  <span aria-hidden className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-emerald-600" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {publies.length > 0 && (
        <Section>
          <Container>
            <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {publies.map((a) => (
                <div key={`${a.auteur}-${a.at}`} className="rounded-2xl bg-white p-5 ring-1 ring-inset ring-zinc-200">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                      {a.auteur.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">{a.auteur}</div>
                      <div className="text-xs text-zinc-400">{a.at.slice(0, 10)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-0.5" aria-label={`${a.note}/5`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < a.note ? "text-amber-400" : "text-zinc-200"}>★</span>
                    ))}
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-zinc-600">{a.texte}</p>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      )}

      <Section>
        <Container>
          <AvisForm />
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">{A.preuveTitre}</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-zinc-500">{A.preuveSub}</p>
          <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-zinc-200 ring-1 ring-zinc-200 sm:grid-cols-4">
            {preuves.map((p) => (
              <div key={p.label} className="bg-white px-5 py-8 text-center">
                <div className="text-4xl font-bold tracking-tight text-zinc-900">{p.valeur}</div>
                <div className="mt-2 text-xs leading-snug text-zinc-500">{p.label}</div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-20 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_50%_0%,rgba(16,185,129,.16),transparent_60%)]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
                {A.ctaTitre}
              </h2>
              <p className="mx-auto mt-4 max-w-md text-lg text-white/55">{A.ctaSub}</p>
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
