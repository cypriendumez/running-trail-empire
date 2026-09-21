import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { createAdminClient } from "@/lib/supabase/admin";
import { TYPE_AVIS, litAvis } from "@/lib/avis/store";
import { AvisForm } from "@/components/avis/AvisForm";
import { AvisListe } from "@/components/avis/AvisListe";
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
  ctaTitre: string; ctaSub: string; ctaBtn: string; ctaNote: string;
};

const AV: Record<Lang, Bloc> = {
  fr: {
    titre: "Aucun avis. ", accent: "Pas encore.",
    titrePlein: "Ce qu'ils en ", accentPlein: "disent.", chapoPlein: "Écrits par des coureurs qui ont un compte Pacevo, publiés tels quels.",
    chapo: "Pacevo vient d'ouvrir. Le jour où des coureurs écriront, ce sont leurs mots qui seront ici — pas les nôtres.",
    ctaTitre: "Sois parmi les premiers.",
    ctaSub: "Essaie Pacevo, et si ça t'aide, écris-le. Si ça ne t'aide pas, écris-le aussi.",
    ctaBtn: "Créer un compte gratuit",
    ctaNote: "Gratuit · Sans carte bancaire · Annulable à tout moment",
  },
  en: {
    titre: "No reviews. ", accent: "Not yet.",
    titrePlein: "What they ", accentPlein: "say.", chapoPlein: "Written by runners with a Pacevo account, published as written.",
    chapo: "Pacevo has just opened. The day runners write something, their words will be here — not ours.",
    ctaTitre: "Be among the first.",
    ctaSub: "Try Pacevo, and if it helps, say so. If it doesn't, say that too.",
    ctaBtn: "Create a free account",
    ctaNote: "Free · No credit card · Cancel anytime",
  },
  de: {
    titre: "Keine Bewertungen. ", accent: "Noch nicht.",
    titrePlein: "Was sie ", accentPlein: "sagen.", chapoPlein: "Von Läufern mit einem Pacevo-Konto geschrieben, unverändert veröffentlicht.",
    chapo: "Pacevo ist gerade gestartet. Sobald Läufer etwas schreiben, stehen ihre Worte hier — nicht unsere.",
    ctaTitre: "Sei unter den Ersten.",
    ctaSub: "Probier Pacevo aus. Wenn es hilft, schreib es. Wenn nicht, schreib das auch.",
    ctaBtn: "Kostenloses Konto erstellen",
    ctaNote: "Gratis · Keine Kreditkarte · Jederzeit kündbar",
  },
  es: {
    titre: "Sin opiniones. ", accent: "Todavía.",
    titrePlein: "Lo que ", accentPlein: "dicen.", chapoPlein: "Escritas por corredores con cuenta Pacevo, publicadas tal cual.",
    chapo: "Pacevo acaba de abrir. El día en que los corredores escriban, estarán sus palabras aquí — no las nuestras.",
    ctaTitre: "Sé de los primeros.",
    ctaSub: "Prueba Pacevo. Si te ayuda, dilo. Si no te ayuda, dilo también.",
    ctaBtn: "Crear cuenta gratis",
    ctaNote: "Gratis · Sin tarjeta · Cancela cuando quieras",
  },
  pt: {
    titre: "Sem avaliações. ", accent: "Ainda.",
    titrePlein: "O que eles ", accentPlein: "dizem.", chapoPlein: "Escritas por corredores com conta Pacevo, publicadas tal como escritas.",
    chapo: "A Pacevo acabou de abrir. No dia em que os corredores escreverem, estarão aqui as palavras deles — não as nossas.",
    ctaTitre: "Sê dos primeiros.",
    ctaSub: "Experimenta a Pacevo. Se ajudar, escreve. Se não ajudar, escreve também.",
    ctaBtn: "Criar conta grátis",
    ctaNote: "Grátis · Sem cartão · Cancela quando quiseres",
  },
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Avis" };

export default async function AvisPage() {
  const lang = await getPublicLang();
  const A = AV[lang] ?? AV.fr;

  // ⚠️ SEULS LES AVIS PUBLIÉS. Depuis le 17/09/2026, `publie` est VRAI dès la soumission :
  // les deux filtres qui comptent tournent avant (compte réel exigé par l'API,
  // grossièretés refusées à l'écriture). La modération sert donc à DÉPUBLIER après coup
  // et à répondre — jamais à écarter une mauvaise note (directive UE 2019/2161).
  let publies: { note: number; texte: string; auteur: string; at: string; reponse?: string; reponseAt?: string }[] = [];
  try {
    const { data } = await createAdminClient()
      .from("notifications").select("data, created_at")
      .eq("type", TYPE_AVIS).order("created_at", { ascending: false }).limit(60);
    publies = (data ?? [])
      .map((r) => litAvis(r.data))
      .filter((a): a is NonNullable<typeof a> => Boolean(a?.publie));
  } catch { publies = []; }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* ⚠️ HERO ET FORMULAIRE DANS UNE SEULE SECTION. Ils étaient dans deux `Section`
          empilées, or `Section` vaut `py-20 sm:py-28` : jusqu'à 224 px de vide entre le
          titre et le champ à remplir, sur une page qui n'a par ailleurs rien à montrer
          tant qu'aucun avis n'existe. L'espace était là par construction, pas par choix.
          ⚠️ ET `pb-0` NE SUFFIT PAS : mesuré à 1024 px, padding-bottom = 112 px. Le
          `sm:py-28` de `Section` vit dans la media query, donc APRÈS `pb-0` dans la
          feuille de style, et l'emporte dès 640 px — l'ordre des classes dans l'attribut
          n'y change rien, et `twMerge` ne voit pas de conflit entre deux variantes. Il
          faut annuler dans la même variante : `sm:pb-0`. Le vide de 224 px avait donc
          survécu sur ordinateur à sa première « correction ». */}
      <Section className="pt-12 pb-0 sm:pt-16 sm:pb-0">
        <Container>
          {/* ⚠️ TITRE RESSERRÉ. À text-5xl il écrasait tout : sur une page qui n'a
              qu'un formulaire à montrer, un titre deux fois plus gros que le reste fait
              paraître le contenu accessoire. */}
          <h1 className="mx-auto max-w-2xl text-balance text-center text-3xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-4xl">
            {publies.length ? A.titrePlein : A.titre}
            <span className="text-emerald-600">{publies.length ? A.accentPlein : A.accent}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-center text-[15px] leading-relaxed text-zinc-500">
            {publies.length ? A.chapoPlein : A.chapo}
          </p>

          {/* Le formulaire suit immédiatement : tant qu'il n'y a pas d'avis à lire, écrire
              le premier est la seule action que la page a à proposer. */}
          <div className="mt-9">
            <AvisForm />
          </div>
        </Container>
      </Section>

      {publies.length > 0 && (
        <Section className="pt-16 pb-0 sm:pt-20 sm:pb-0">
          <Container>
            <AvisListe avis={publies} />
          </Container>
        </Section>
      )}

      {/* ⚠️ LE BLOC DE CHIFFRES A ÉTÉ RETIRÉ LE 17/09/2026, sur décision de Cyprien, et il
          vaut la peine de dire pourquoi pour ne pas le remettre par réflexe. Il affichait
          « 10 000+ courses · 15 700 parcours · 7 j · 300+ chaussures » sous un titre
          « En attendant, voici ce qui se vérifie ».
          Trois raisons de sa disparition :
           · il répondait à une question que personne ne pose ICI — un visiteur venu lire
             ce que des coureurs pensent du coaching trouvait la TAILLE DU CATALOGUE ;
           · son titre disait le manque à voix haute, alors que le h1 le dit déjà
             (« Aucun avis. Pas encore. ») : la deuxième fois sonnait comme une excuse ;
           · ces quatre chiffres sont déjà sur la page d'accueil.
          Les chiffres eux-mêmes restent justes et vérifiables (lib/brand/stats) : ce n'est
          pas leur exactitude qui posait problème, c'est leur présence à cet endroit. */}
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
