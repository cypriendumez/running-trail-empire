export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin } from "@/lib/admin/acces";
import { idEditeur } from "@/lib/compta/enregistrer";
import { BUCKET, validerFichier, cheminDe, cheminAppartientA } from "@/lib/compta/pieces";

/**
 * LES FACTURES ET REÇUS ATTACHÉS AUX ÉCRITURES.
 *
 * ⚠️ CE SONT DES DONNÉES PERSONNELLES DE CLIENTS PAYANTS : nom, adresse, montant. Les
 * deux seaux de stockage existants du projet (`avatars`, `message-attachments`) sont
 * PUBLICS — y déposer une facture la rendrait lisible par quiconque connaît l'adresse.
 * D'où un seau dédié et privé, et le contrôle ci-dessous.
 *
 * ⚠️ RIEN N'EST SERVI EN DIRECT. La lecture passe par une URL SIGNÉE de courte durée,
 * délivrée seulement à un administrateur connecté. Un lien de stockage qui traîne dans un
 * historique de navigation ne doit pas rester valable.
 */

async function editeur(): Promise<string | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return null;
  return idEditeur();
}

/**
 * ⚠️ LE SEAU EST VÉRIFIÉ À CHAQUE ÉCRITURE, pas une fois pour toutes à la création.
 * Un seau peut être basculé en public d'un clic dans le tableau de bord Supabase, ou par
 * un futur script. Le jour où ça arrive, on doit REFUSER d'y déposer une facture, pas
 * continuer comme si de rien n'était : c'est exactement le genre de bascule que personne
 * ne remarque.
 */
async function seauPrive(): Promise<{ ok: true } | { ok: false; motif: string }> {
  const { data, error } = await createAdminClient().storage.getBucket(BUCKET);
  if (error || !data) return { ok: false, motif: `Espace de stockage « ${BUCKET} » introuvable : ${error?.message ?? "absent"}.` };
  if (data.public) return { ok: false, motif: `L'espace « ${BUCKET} » est PUBLIC : une facture y serait lisible par tout le monde. Dépôt refusé.` };
  return { ok: true };
}

export async function POST(req: Request) {
  const id = await editeur();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const garde = await seauPrive();
  if (!garde.ok) return NextResponse.json({ ok: false, erreurs: [garde.motif] }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const fichier = form?.get("fichier");
  if (!(fichier instanceof File)) return NextResponse.json({ ok: false, erreurs: ["Aucun fichier reçu."] }, { status: 400 });

  const erreurs = validerFichier(fichier.type, fichier.size);
  if (erreurs.length) return NextResponse.json({ ok: false, erreurs }, { status: 400 });

  const chemin = cheminDe(id, fichier.type, crypto.randomUUID());
  const { error } = await createAdminClient().storage.from(BUCKET)
    .upload(chemin, await fichier.arrayBuffer(), { contentType: fichier.type, upsert: false });
  if (error) return NextResponse.json({ ok: false, erreurs: [`Dépôt refusé : ${error.message}`] }, { status: 500 });

  return NextResponse.json({ ok: true, chemin, nom: fichier.name, taille: fichier.size });
}

/** Délivre une URL signée de courte durée pour consulter une pièce. */
export async function GET(req: Request) {
  const id = await editeur();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chemin = new URL(req.url).searchParams.get("chemin") ?? "";
  // ⚠️ Un chemin venu du navigateur ne se croit pas : sans ce contrôle, un appelant
  // pourrait réclamer n'importe quel objet du seau en fabriquant l'adresse.
  if (!cheminAppartientA(chemin, id)) return NextResponse.json({ error: "Chemin refusé" }, { status: 400 });

  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(chemin, 120);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Pièce introuvable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}

export const runtime = "nodejs";
export const maxDuration = 30;
// ⚠️ Pas de `export const config` : l'App Router l'ignore, et le `build` le refuse. La
// taille est bornée deux fois — par `validerFichier` ici, et par le `file_size_limit` du
// seau lui-même, qui reste vrai même si quelqu'un contourne cette route.
