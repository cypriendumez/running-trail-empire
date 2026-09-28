import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { peut } from "@/lib/billing/access";
import { quotaDuJour } from "@/lib/billing/aiQuota";
import { lireFil, etatDe, niveauDe } from "@/lib/ai/coachChatServeur";
import { CoachChat } from "@/components/coach/CoachChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coach IA" };

/**
 * « Coach IA » — la conversation avec le coach qui connaît le plan.
 *
 * L'état initial (conversation mémorisée, formule, crédits du jour) est lu ICI, côté
 * serveur, par les mêmes fonctions que la route : l'écran s'ouvre sur la bonne
 * conversation et le bon compteur, sans chargement ni clignotement.
 *
 * `?q=` pré-remplit la question SANS l'envoyer : un lien ne doit jamais dépenser un
 * crédit à la place de l'athlète.
 */
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const etat = await etatDe(supabase, user.id);
  const [fil, quota] = await Promise.all([lireFil(supabase, user.id), quotaDuJour(supabase, user.id, etat)]);
  if (fil.erreur) console.error("[coach IA] conversation illisible :", fil.erreur);
  const q = (await searchParams).q;

  return (
    <div className="mx-auto max-w-3xl">
      <CoachChat
        initial={{
          messages: fil.messages, acces: peut(etat, "ia"), niveau: niveauDe(etat), essai: etat === "essai",
          restants: quota.restants, plafond: quota.plafond,
        }}
        prefill={typeof q === "string" ? q : ""}
      />
    </div>
  );
}
