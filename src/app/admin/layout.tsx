export const dynamic = "force-dynamic";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MessageNotifier } from "@/components/messages/MessageNotifier";
import { AppareilGate } from "@/components/admin/AppareilGate";
import { estAdmin } from "@/lib/admin/acces";
import { COOKIE_APPAREIL, appareilExige, verifierAppareil } from "@/lib/admin/appareil";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!estAdmin(user?.email)) {
    redirect("/dashboard");
  }

  /**
   * ⚠️ UN MOT DE PASSE NE LIE RIEN À UNE MACHINE. Cet espace ouvre les factures des
   * clients, leurs données personnelles et le chiffre d'affaires : toute session restée
   * ouverte ailleurs y donne accès. L'appareil doit avoir été scellé une fois.
   *
   * ⚠️ MAIS TANT QUE LES SECRETS NE SONT PAS POSÉS, ON NE VÉRIFIE RIEN : exiger un jeton
   * avant que la configuration existe enfermerait l'éditeur dehors, sans recours.
   */
  const configure = appareilExige();
  const verdict = configure
    ? verifierAppareil({
        secret: String(process.env.ADMIN_DEVICE_SECRET),
        userId: user!.id,
        jeton: (await cookies()).get(COOKIE_APPAREIL)?.value,
      })
    : ({ ok: true } as const);

  if (configure && !verdict.ok) {
    return <AppareilGate configure reconnu={false} motif={"motif" in verdict ? verdict.motif : undefined} />;
  }

  return (
    <>
      <MessageNotifier />
      <AppareilGate configure={configure} reconnu />
      {children}
    </>
  );
}
