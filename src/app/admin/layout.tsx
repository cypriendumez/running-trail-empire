export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessageNotifier } from "@/components/messages/MessageNotifier";
import { MfaGate } from "@/components/admin/MfaGate";
import { estAdmin } from "@/lib/admin/acces";
import { etatMfa } from "@/lib/admin/mfa";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    redirect("/dashboard");
  }

  /**
   * ⚠️ UN MOT DE PASSE SEUL NE LIE RIEN À UN APPAREIL. Cet espace ouvre les factures des
   * clients, leurs données personnelles et le chiffre d'affaires : toute machine où la
   * session reste ouverte y donne accès.
   *
   * ⚠️ MAIS ON N'EXIGE LE CODE QUE SI UN FACTEUR EST DÉJÀ VÉRIFIÉ. L'imposer à quelqu'un
   * qui n'en a jamais configuré le mettrait dehors de son propre espace, sans recours.
   * Tant qu'il n'y en a pas, le bandeau insiste et laisse passer.
   */
  const mfa = await etatMfa(supabase);
  if (!mfa.ouvert) {
    return <MfaGate configure={mfa.configure} ouvert={false} />;
  }

  return (
    <>
      <MessageNotifier />
      <MfaGate configure={mfa.configure} ouvert />
      {children}
    </>
  );
}
