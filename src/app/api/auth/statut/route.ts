export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { statutCompte } from "@/lib/auth/statutCompte";
import { autoriser, ipDe } from "@/lib/auth/limiteur";

/**
 * « CETTE ADRESSE A-T-ELLE UN COMPTE, ET COMMENT S'OUVRE-T-IL ? »
 *
 * Interrogée par l'inscription (dès qu'on quitte le champ e-mail) et par la connexion (après
 * un échec), pour dire la VRAIE raison : aucun compte, compte ouvert avec Google, adresse pas
 * encore confirmée, ou mot de passe faux. Voir `lib/auth/statut.ts` pour la décision.
 *
 * Ne rend que `{ compte, methodes }` — jamais un nom, un identifiant ou une date.
 * 30 questions par 10 minutes et par IP : largement assez pour une personne qui se trompe,
 * trop peu pour parcourir une liste d'adresses.
 */
export async function POST(req: Request) {
  if (!autoriser(`statut:${ipDe(req)}`, 30, 10 * 60_000)) {
    return NextResponse.json({ error: "trop_de_requetes" }, { status: 429 });
  }
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const adresse = String(email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(adresse)) {
    return NextResponse.json({ error: "adresse_invalide" }, { status: 400 });
  }
  const statut = await statutCompte(adresse);
  if (!statut) return NextResponse.json({ error: "indisponible" }, { status: 503 });
  return NextResponse.json(statut, { headers: { "Cache-Control": "no-store" } });
}
