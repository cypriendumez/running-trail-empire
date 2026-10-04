export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normLang } from "@/lib/i18n/translations";
import { aujourdhui, FUSEAU_DEFAUT } from "@/lib/time/fuseau";
import { estIndicateur } from "@/lib/indicateurs/types";
import { ficheIndicateur, titresIndicateurs } from "@/lib/indicateurs/fiches";
import { chargerDonnees } from "@/lib/indicateurs/donnees";
import { TEXTES } from "@/lib/indicateurs/textes";
import { FicheIndicateur } from "@/components/indicateurs/FicheIndicateur";

/**
 * /dashboard/indicateurs/[cle] — la page détaillée d'une carte du tableau de bord
 * (04/10/2026). Cyprien : « quand on clique sur ces modules, une page qui donne les valeurs
 * précises et qui explique pourquoi ». Neuf fiches : forme, vfc, vitesse, discipline,
 * objectif, charge, acwr, volume, zones.
 */
export async function generateMetadata({ params }: { params: Promise<{ cle: string }> }): Promise<Metadata> {
  const { cle } = await params;
  return { title: estIndicateur(cle) ? titresIndicateurs("fr")[cle] : "Indicateur" };
}

export default async function PageIndicateur({ params }: { params: Promise<{ cle: string }> }) {
  const { cle } = await params;
  if (!estIndicateur(cle)) notFound();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profil } = await sb.from("profiles").select("preferred_language").eq("id", user.id).maybeSingle();
  const lang = normLang(String(profil?.preferred_language ?? "fr"));
  const donnees = await chargerDonnees(sb, user.id, lang, aujourdhui(FUSEAU_DEFAUT));
  return (
    <FicheIndicateur fiche={ficheIndicateur(cle, donnees)} titres={titresIndicateurs(lang)} textes={TEXTES[lang].commun} lang={lang} pannes={donnees.pannes} />
  );
}
