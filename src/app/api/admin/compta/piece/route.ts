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

/**
 * Sert la pièce — SANS jamais laisser d'adresse de stockage atteindre le navigateur.
 *
 * ⚠️ LA VERSION PRÉCÉDENTE REDIRIGEAIT VERS UNE URL SIGNÉE. Cette adresse atterrissait
 * dans l'historique du navigateur, et surtout : elle reste valable pendant toute sa durée
 * de vie POUR N'IMPORTE QUI. Copiée, partagée, ou simplement lue dans l'historique d'une
 * machine partagée, elle ouvre la facture d'un client — sans compte, sans mot de passe.
 * Le fichier transite maintenant PAR le serveur : rien de réutilisable ne sort.
 *
 * ⚠️ ET CHAQUE CONSULTATION EST TRACÉE. Qui, quand, quel document, depuis quelle adresse.
 * Sans journal d'accès, une lecture illégitime ne laisse aucune trace — et la question
 * « est-ce que quelqu'un a vu mes factures ? » n'a alors aucune réponse possible.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!estAdmin(user?.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await idEditeur();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chemin = new URL(req.url).searchParams.get("chemin") ?? "";
  // ⚠️ Un chemin venu du navigateur ne se croit pas : sans ce contrôle, un appelant
  // pourrait réclamer n'importe quel objet du seau en fabriquant l'adresse.
  if (!cheminAppartientA(chemin, id)) return NextResponse.json({ error: "Chemin refusé" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(chemin);
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Pièce introuvable" }, { status: 404 });

  // Journal d'accès. Il ne doit JAMAIS empêcher la lecture : une facture illisible parce
  // que la trace a échoué serait une panne provoquée par la sécurité elle-même.
  try {
    await admin.from("notifications").insert({
      user_id: id, type: "compta_acces", title: "Consultation d'une pièce", read: true,
      data: {
        chemin, par: user?.email ?? "?", le: new Date().toISOString(),
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        appareil: (req.headers.get("user-agent") ?? "").slice(0, 200),
      },
    });
  } catch (e) { console.error("[compta] trace d'accès non enregistrée :", (e as Error).message); }

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // `inline` pour lire sans télécharger ; `no-store` pour qu'aucun cache
      // intermédiaire ne conserve une facture.
      "Content-Disposition": `inline; filename="piece"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const runtime = "nodejs";
export const maxDuration = 30;
// ⚠️ Pas de `export const config` : l'App Router l'ignore, et le `build` le refuse. La
// taille est bornée deux fois — par `validerFichier` ici, et par le `file_size_limit` du
// seau lui-même, qui reste vrai même si quelqu'un contourne cette route.
