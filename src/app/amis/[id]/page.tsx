import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { athletesMasques, estMasque } from "@/lib/social/visibilite";
import { estUuid } from "@/lib/social/amisLiens";
import { getPublicLang } from "@/lib/i18n/serverLang";
import { AMI_I18N } from "./amiI18n";
import { RetenirIntention } from "./RetenirIntention";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation" };

/**
 * LA PAGE DERRIÈRE LE QR CODE D'UN ATHLÈTE — publique, lisible sans compte.
 *
 * Un ami scanne le code avec l'appareil photo de son téléphone et arrive ici.
 *  - Connecté : on l'envoie tout droit sur l'annuaire, l'athlète proposé en tête.
 *  - Sans compte : la page montre QUI invite et propose de se connecter ou de
 *    s'inscrire, en RETENANT l'intention (stockage local, voir `RetenirIntention`)
 *    pour que le suivi se fasse juste après — sinon le lien scanné serait perdu
 *    à la première redirection vers /login.
 *
 * ⚠️ ON NE MONTRE QUE LE PRÉNOM ET L'AVATAR, et rien si l'athlète s'est masqué
 * (Paramètres › Confidentialité) ou n'a pas fini son inscription : un identifiant
 * deviné ne doit rien apprendre sur quelqu'un qui n'a pas choisi d'être trouvable.
 */
export default async function AmiPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // `id` est une colonne uuid : filtrer la forme AVANT la requête, sinon PostgREST lève.
  const valide = estUuid(id) ? id.toLowerCase() : null;

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (user && valide) redirect(`/dashboard/communaute?suivre=${valide}`);

  let athlete: { full_name: string | null; avatar_url: string | null } | null = null;
  if (valide) {
    const admin = createAdminClient();
    const [{ data }, masques] = await Promise.all([
      admin.from("profiles").select("full_name, avatar_url, onboarding_completed").eq("id", valide).maybeSingle(),
      athletesMasques(admin),
    ]);
    const p = data as { full_name?: string | null; avatar_url?: string | null; onboarding_completed?: boolean | null } | null;
    if (p && p.onboarding_completed === true && !estMasque(masques, valide)) {
      athlete = { full_name: p.full_name ?? null, avatar_url: p.avatar_url ?? null };
    }
  }

  const prenom = athlete?.full_name?.trim().split(/\s+/)[0] || null;
  const initiale = (prenom ?? "?")[0]?.toUpperCase() ?? "?";
  // Page publique : la langue vient du navigateur (cookie, puis Accept-Language).
  const L = AMI_I18N[await getPublicLang()] ?? AMI_I18N.fr;
  const avec = (s: string) => s.replace("{prenom}", prenom ?? "");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 py-12 text-center">
      <Logo size={40} />
      {athlete && valide ? (
        <>
          <RetenirIntention id={valide} />
          {athlete.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={athlete.avatar_url} alt="" className="mt-8 h-20 w-20 rounded-full object-cover ring-4 ring-white shadow" />
          ) : (
            <div className="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-bold text-white ring-4 ring-white shadow">{initiale}</div>
          )}
          <h1 className="mt-5 text-2xl font-black tracking-tight text-zinc-900">{avec(L.titre)}</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">{avec(L.sous)}</p>
          <div className="mt-7 flex w-full max-w-xs flex-col gap-2">
            <Link href={`/login?next=${encodeURIComponent(`/amis/${valide}`)}`} className="rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">{L.connexion}</Link>
            <Link href="/signup" className="rounded-full border border-zinc-200 bg-white py-3 text-sm font-semibold text-zinc-800 transition hover:border-zinc-300">{L.inscription}</Link>
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-8 text-2xl font-black tracking-tight text-zinc-900">{L.introuvable}</h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">{L.introuvableSous}</p>
          <Link href="/" className="mt-7 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white">{L.decouvrir}</Link>
        </>
      )}
    </main>
  );
}
