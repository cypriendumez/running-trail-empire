"use client";

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE TARIFS — elle partage DÉSORMAIS le dictionnaire de la page d'accueil.
//
//  Elle avait le sien (`pricingI18n.ts`), et les deux avaient divergé au point de
//  ne plus vendre le même produit : trois paliers ici contre trois autres là, et
//  une liste de fonctionnalités qui n'existent pour la plupart nulle part —
//  « Guardian Mode », « Nutrition Lab », « Posture Lab (IA Vision caméra) »,
//  « API Access (Terra / Webhooks) », « Dashboard équipe », « Life Stress Sync »,
//  « Score Bio-Compat ». Deux vitrines pour un seul produit, c'est deux fois plus
//  d'occasions de promettre ce qu'on n'a pas.
//
//  Un seul dictionnaire, donc : celui de la landing. Changer un prix ou une
//  fonctionnalité à un endroit les change aux deux.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { JOURS_ESSAI } from "@/lib/billing/access";
import { PRIX_AFFICHES as PRIX, euros, moisOfferts, MOIS_OFFERTS_MAX } from "@/lib/billing/prix";
import { Check, Loader2 } from "lucide-react";
import { OffreEtudiante } from "@/components/landing/OffreEtudiante";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Container, Section, SectionHeading } from "@/components/ui/Container";
import { btnClass } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LanguageProvider";
import { LANDING } from "@/components/landing/landingI18n";
import { estAppliNative } from "@/lib/natif/appli";
import { acheterDansLAppli, restaurerAchats, prixDansLAppli } from "@/lib/natif/achat";
import { PRODUITS_STORES } from "@/lib/billing/stores";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n/translations";

/** Les messages de l'achat intégré (appli native), dans les cinq langues. */
const NATIF: Record<Lang, { indispo: string; erreur: string; merci: string; restaurer: string; restaure: string; storeNote: string }> = {
  fr: { indispo: "L'abonnement dans l'appli n'est pas encore ouvert. Reviens très bientôt.", erreur: "L'achat n'a pas abouti. Aucun montant n'a été prélevé par Pacevo.", merci: "Merci ! Ton abonnement est actif.", restaurer: "Restaurer mes achats", restaure: "Achats restaurés.", storeNote: "Paiement et résiliation par ton compte App Store ou Google Play." },
  en: { indispo: "In-app subscriptions aren't open yet. Check back very soon.", erreur: "The purchase didn't go through. Pacevo charged nothing.", merci: "Thank you! Your subscription is active.", restaurer: "Restore purchases", restaure: "Purchases restored.", storeNote: "Payment and cancellation through your App Store or Google Play account." },
  de: { indispo: "Abos in der App sind noch nicht verfügbar. Schau bald wieder vorbei.", erreur: "Der Kauf wurde nicht abgeschlossen. Pacevo hat nichts abgebucht.", merci: "Danke! Dein Abo ist aktiv.", restaurer: "Käufe wiederherstellen", restaure: "Käufe wiederhergestellt.", storeNote: "Zahlung und Kündigung über dein App-Store- oder Google-Play-Konto." },
  es: { indispo: "La suscripción en la app aún no está disponible. Vuelve muy pronto.", erreur: "La compra no se completó. Pacevo no ha cobrado nada.", merci: "¡Gracias! Tu suscripción está activa.", restaurer: "Restaurar compras", restaure: "Compras restauradas.", storeNote: "Pago y cancelación desde tu cuenta de App Store o Google Play." },
  pt: { indispo: "A assinatura no app ainda não está disponível. Volte em breve.", erreur: "A compra não foi concluída. A Pacevo não cobrou nada.", merci: "Obrigado! Sua assinatura está ativa.", restaurer: "Restaurar compras", restaure: "Compras restauradas.", storeNote: "Pagamento e cancelamento pela sua conta App Store ou Google Play." },
};


export default function PricingPage() {
  const { lang } = useT();
  const P = (LANDING[lang] ?? LANDING.fr).pricing;
  const [periode, setPeriode] = useState<"mois" | "an">("mois");
  const [loading, setLoading] = useState<string | null>(null);
  /**
   * JOURS D'ESSAI RÉELLEMENT ACCORDÉS À CE VISITEUR.
   *
   * ⚠️ SANS ÇA, LE BOUTON MENT DÈS LE LENDEMAIN DE L'INSCRIPTION. L'essai Stripe ne dure
   * plus que les jours RESTANTS de l'essai gratuit (voir `joursEssaiStripe`) : un libellé
   * figé « Essayer 7 jours » promettrait sept jours à quelqu'un qui n'en obtiendra que
   * trois — le même défaut que celui qu'on vient de corriger, déplacé d'un cran.
   *
   * `null` = on ne sait pas encore. Tant qu'on ne sait pas, le bouton reste NEUTRE : on
   * n'affiche pas un chiffre optimiste en attendant la réponse.
   */
  const [essai, setEssai] = useState<{ connecte: boolean; jours: number } | null>(null);
  /**
   * DANS L'APPLI DES STORES, L'ACHAT INTÉGRÉ — JAMAIS STRIPE (règle 3.1.1 d'Apple : aucun
   * autre moyen de paiement, ni invitation à en utiliser un). Lu APRÈS le montage : le
   * serveur ne connaît pas l'appli, et deux rendus différents feraient une erreur #418.
   * Les prix affichés sont alors ceux du STORE (ce qui sera réellement facturé), pas ceux du site.
   */
  const [natif, setNatif] = useState(false);
  const [prixStore, setPrixStore] = useState<Record<string, string>>({});
  const N = NATIF[lang as Lang] ?? NATIF.fr;
  const idUtilisateur = async (): Promise<string | null> => {
    try { return (await createClient().auth.getUser()).data.user?.id ?? null; } catch { return null; }
  };
  useEffect(() => {
    if (!estAppliNative()) return;
    setNatif(true);
    idUtilisateur().then((id) => (id ? prixDansLAppli(id) : {})).then(setPrixStore).catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/billing/essai")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && typeof j.jours === "number") setEssai({ connecte: !!j.connecte, jours: j.jours }); })
      .catch(() => { /* le bouton reste neutre : mieux qu'un chiffre inventé */ });
  }, []);

  /** Le libellé d'une formule payante, ou `null` tant qu'on ne sait pas quoi promettre. */
  const libelleAbo = (): string | null => {
    if (!essai) return null;
    return essai.jours > 0 ? P.ctaEssai.replace("{n}", String(essai.jours)) : P.ctaAbo;
  };

  async function souscrireDansLAppli(formule: "starter" | "premium") {
    setLoading(formule);
    try {
      const id = await idUtilisateur();
      if (!id) { window.location.href = `/signup?formule=${formule}&periode=${periode}`; return; }
      const r = await acheterDansLAppli(formule, periode, id);
      if (r === "achete") { toast.success(N.merci); window.location.href = "/dashboard"; }
      else if (r === "indisponible") toast.error(N.indispo);
      else if (r === "erreur") toast.error(N.erreur);
    } finally {
      setLoading(null);
    }
  }

  async function restaurer() {
    const id = await idUtilisateur();
    if (!id) { window.location.href = "/login"; return; }
    const r = await restaurerAchats(id);
    if (r === "achete") toast.success(N.restaure);
    else if (r === "indisponible") toast.error(N.indispo);
    else if (r === "erreur") toast.error(N.erreur);
  }

  async function souscrire(formule: "starter" | "premium") {
    if (natif) return souscrireDansLAppli(formule);
    setLoading(formule);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Une périodicité seule ne désigne plus un tarif : il y a deux formules.
        body: JSON.stringify({ formule, periode }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      // ⚠️ 401 = pas de compte, pas une panne. Le message brut du serveur est
      // « Unauthorized » — un mot anglais et technique, affiché à quelqu'un dont le seul
      // tort est de ne pas être inscrit. On l'emmène s'inscrire, en gardant la formule
      // qu'il visait pour qu'il la retrouve après création du compte.
      if (res.status === 401) { window.location.href = `/signup?formule=${formule}&periode=${periode}`; return; }
      if (data.url) window.location.href = data.url;
      // Le message du serveur est affiché TEL QUEL : c'est lui qui sait pourquoi
      // ça a échoué — paiement pas encore ouvert, session expirée, tarif inconnu.
      else toast.error(data.error || "Erreur lors de la création du paiement");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
      <SiteHeader />

      <Section>
        <Container>
          <SectionHeading eyebrow={P.eyebrow} title={P.title} subtitle={P.subtitle} />

          <div className="mt-10 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-1">
              {(["mois", "an"] as const).map((p) => (
                <button key={p} onClick={() => setPeriode(p)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                    periode === p ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"}`}>
                  {p === "mois" ? P.mois : P.an}
                  {p === "an" && <span className={`ml-2 text-[11px] font-bold ${periode === "an" ? "text-[#34d399]" : "text-[#059669]"}`}>{P.economie.replace("{n}", String(MOIS_OFFERTS_MAX))}</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-zinc-500">{P.essai.replace("{n}", String(JOURS_ESSAI))}</p>

          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
            {P.plans.map((plan) => {
              const centimes = PRIX[plan.cle][periode];
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
                    <span className="text-5xl font-bold tracking-tight">{plan.cle === "gratuit" ? euros(0, lang)
                      : natif ? (prixStore[PRODUITS_STORES[plan.cle as "starter" | "premium"][periode]] ?? "…") : euros(grand, lang)}</span>
                    <span className={`text-sm ${vedette ? "text-white/40" : "text-zinc-400"}`}>{plan.cle === "gratuit" || natif ? "" : P.parMois}</span>
                  </div>
                  <div className={`mt-1 h-5 text-xs ${vedette ? "text-white/40" : "text-zinc-400"}`}>
                    {plan.cle === "gratuit" ? P.gratuitNote : natif ? (periode === "an" ? `/ ${P.an.toLowerCase()}` : `/ ${P.mois.toLowerCase()}`) : periode === "an" ? `${euros(centimes, lang)} / ${P.an.toLowerCase()} · ${P.moisOfferts.replace("{n}", String(moisOfferts(plan.cle as "starter" | "premium")))}` : ""}
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
                  <button onClick={() => plan.cle === "gratuit" ? (window.location.href = "/signup") : souscrire(plan.cle as "starter" | "premium")} disabled={loading !== null}
                    className={btnClass(vedette ? "secondary" : "primary", "md", "mt-8 w-full disabled:opacity-60")}>
                    {loading === plan.cle
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      // Le palier gratuit garde son libellé propre (« Créer mon compte ») :
                      // il ne passe pas par Stripe et n'a donc aucun essai à annoncer.
                      : plan.cle === "gratuit" ? plan.cta : (libelleAbo() ?? plan.cta)}
                  </button>
                </div>
              );
            })}
          </div>

          {/* L'offre étudiante se demande par e-mail, hors de l'appli : interdit dans l'appli des stores. */}
          {natif ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-zinc-500">{N.storeNote}</p>
              <button type="button" onClick={restaurer} className={btnClass("ghost", "sm", "mt-3")}>{N.restaurer}</button>
            </div>
          ) : (
            <OffreEtudiante texte={P.etudiant} cta={P.etudiantCta} sujet={P.etudiantSujet} />
          )}
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-zinc-500">{P.apres}</p>
        </Container>
      </Section>

      <SiteFooter />
    </div>
  );
}
