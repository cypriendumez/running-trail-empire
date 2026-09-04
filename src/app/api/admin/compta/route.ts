export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estAdmin, gardeAdmin } from "@/lib/admin/acces";
import { valider, type Ecriture, type Reglages, MOYENS } from "@/lib/compta/model";
import { idEditeur } from "@/lib/compta/enregistrer";

/**
 * LE JOURNAL COMPTABLE DE L'ÉDITEUR.
 *
 * Stocké dans `notifications`, la table fourre-tout typée du projet — types
 * `compta_ecriture` et `compta_reglages`. Aucune migration : une table dédiée devrait
 * être créée à la main sur la base de production, et l'expérience de ce projet est qu'un
 * fichier de migration ne prouve pas qu'une table existe.
 *
 * ⚠️ `created_at` (enregistrement) et `data.date` (opération) sont DEUX dates
 * différentes. Une facture de janvier saisie en mars est une opération de janvier ; les
 * confondre décale le résultat d'un exercice.
 *
 * ⚠️ AUCUNE SUPPRESSION. Une écriture s'ANNULE, avec un motif, et reste dans le journal.
 * Un livre de recettes dont on peut retirer une ligne ne prouve plus rien — c'est le
 * principe même d'un journal comptable, et c'est la seule raison pour laquelle il peut
 * servir de justificatif.
 *
 * ⚠️ Le contrôle d'accès est refait ici : le layout `/admin` protège les PAGES, pas les
 * routes d'API. Au bout de celle-ci, il y a le chiffre d'affaires de l'entreprise.
 */

const TYPE_ECRITURE = "compta_ecriture";
const TYPE_REGLAGES = "compta_reglages";

/**
 * Qui a le droit d'entrer, et à QUEL journal il accède — deux questions distinctes.
 *
 * ⚠️ LE JOURNAL ÉTAIT RATTACHÉ AU COMPTE CONNECTÉ. Depuis que plusieurs adresses ouvrent
 * l'espace coach, cela affichait une comptabilité DIFFÉRENTE selon la façon de se
 * connecter : les recettes saisies depuis le compte Google étaient invisibles depuis le
 * compte e-mail. Deux journaux pour une seule entreprise, sans le moindre message.
 * La comptabilité appartient à l'ENTREPRISE : `idEditeur()` désigne toujours le même.
 */
async function admin(): Promise<{ id: string } | null> {
  // Adresse autorisée ET second facteur présenté — la même exigence que pour les pages.
  if (!(await gardeAdmin())) return null;
  const id = await idEditeur();
  return id ? { id } : null;
}

type Ligne = { id: string; user_id: string; data: unknown; created_at: string; title: string | null };

const versEcriture = (l: Ligne): Ecriture => {
  const d = (l.data ?? {}) as Partial<Ecriture>;
  return {
    id: l.id,
    date: String(d.date ?? l.created_at.slice(0, 10)),
    libelle: String(d.libelle ?? l.title ?? ""),
    sens: d.sens === "entree" ? "entree" : "sortie",
    categorie: String(d.categorie ?? "autre_sortie"),
    montantCents: Number(d.montantCents ?? 0),
    moyen: (MOYENS as readonly string[]).includes(String(d.moyen)) ? (d.moyen as Ecriture["moyen"]) : "Autre",
    tiers: d.tiers ? String(d.tiers) : undefined,
    piece: d.piece ? String(d.piece) : undefined,
    pieceFichier: d.pieceFichier ? String(d.pieceFichier) : undefined,
    tvaTaux: typeof d.tvaTaux === "number" ? d.tvaTaux : undefined,
    note: d.note ? String(d.note) : undefined,
    recurrente: Boolean(d.recurrente),
    saisieLe: String(d.saisieLe ?? l.created_at),
    annulee: Boolean(d.annulee),
    motifAnnulation: d.motifAnnulation ? String(d.motifAnnulation) : undefined,
    annuleeLe: d.annuleeLe ? String(d.annuleeLe) : undefined,
  };
};

export async function GET() {
  // `editeur`, pas `user` : c'est le propriétaire du journal, pas la session.
  const editeur = await admin();
  if (!editeur) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();

  const [ecr, reg, acc] = await Promise.all([
    sb.from("notifications").select("id, user_id, data, created_at, title")
      .eq("user_id", editeur.id).eq("type", TYPE_ECRITURE).order("created_at", { ascending: false }).limit(5000),
    sb.from("notifications").select("data").eq("user_id", editeur.id).eq("type", TYPE_REGLAGES).maybeSingle(),
    // ⚠️ Le journal d'accès aux factures est REMONTÉ À L'ÉCRAN. Une trace que personne ne
    // peut lire ne répond à aucune question : « quelqu'un a-t-il consulté mes factures ? »
    // resterait sans réponse alors même que la réponse est enregistrée.
    sb.from("notifications").select("data, created_at").eq("user_id", editeur.id)
      .eq("type", "compta_acces").order("created_at", { ascending: false }).limit(30),
  ]);

  // ⚠️ On REMONTE l'erreur au lieu de renvoyer une liste vide. Un journal comptable qui
  // s'affiche vide parce que la requête a échoué se lit exactement comme un journal
  // vide — et on conclut qu'on n'a rien saisi.
  if (ecr.error) return NextResponse.json({ error: `Lecture impossible : ${ecr.error.message}` }, { status: 500 });

  return NextResponse.json({
    ok: true,
    ecritures: (ecr.data ?? []).map((l) => versEcriture(l as Ligne)),
    reglages: (reg.data?.data ?? {}) as Reglages,
    acces: (acc.data ?? []).map((a) => {
      const d = (a.data ?? {}) as Record<string, unknown>;
      return {
        le: String(d.le ?? a.created_at ?? ""), par: String(d.par ?? "?"),
        ip: d.ip ? String(d.ip) : null, appareil: String(d.appareil ?? ""),
      };
    }),
  });
}

export async function POST(req: Request) {
  // `editeur`, pas `user` : c'est le propriétaire du journal, pas la session.
  const editeur = await admin();
  if (!editeur) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Partial<Ecriture>;
  const ecriture: Partial<Ecriture> = {
    date: String(b.date ?? ""),
    libelle: String(b.libelle ?? "").trim().slice(0, 160),
    sens: b.sens === "entree" ? "entree" : "sortie",
    categorie: String(b.categorie ?? ""),
    montantCents: Math.round(Number(b.montantCents)),
    moyen: (MOYENS as readonly string[]).includes(String(b.moyen)) ? (b.moyen as Ecriture["moyen"]) : "Autre",
    tiers: b.tiers ? String(b.tiers).slice(0, 120) : undefined,
    piece: b.piece ? String(b.piece).slice(0, 160) : undefined,
    pieceFichier: b.pieceFichier ? String(b.pieceFichier).slice(0, 300) : undefined,
    tvaTaux: typeof b.tvaTaux === "number" ? b.tvaTaux : undefined,
    note: b.note ? String(b.note).slice(0, 600) : undefined,
    recurrente: Boolean(b.recurrente),
  };

  // La même validation qu'à l'écran, refaite ici : le formulaire peut être contourné.
  const erreurs = valider(ecriture);
  if (erreurs.length) return NextResponse.json({ ok: false, erreurs }, { status: 400 });

  const { data, error } = await createAdminClient().from("notifications").insert({
    user_id: editeur.id, type: TYPE_ECRITURE, title: ecriture.libelle, read: true,
    data: { ...ecriture, saisieLe: new Date().toISOString() },
  }).select("id, user_id, data, created_at, title").single();

  if (error) return NextResponse.json({ ok: false, erreurs: [`Enregistrement refusé : ${error.message}`] }, { status: 500 });
  return NextResponse.json({ ok: true, ecriture: versEcriture(data as Ligne) });
}

/** Annulation d'une écriture, ou mise à jour des réglages. Jamais de suppression. */
export async function PATCH(req: Request) {
  // `editeur`, pas `user` : c'est le propriétaire du journal, pas la session.
  const editeur = await admin();
  if (!editeur) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = createAdminClient();
  const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string; motif?: string; reglages?: Reglages };

  if (b.action === "reglages") {
    const r = b.reglages ?? {};
    const propre: Reglages = {
      tauxCotisations: typeof r.tauxCotisations === "number" && r.tauxCotisations >= 0 && r.tauxCotisations <= 100 ? r.tauxCotisations : undefined,
      tva: Boolean(r.tva),
      // ⚠️ Une date fantaisiste couperait les recettes au mauvais endroit sans rien dire.
      acreJusquau: typeof r.acreJusquau === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.acreJusquau) ? r.acreJusquau : undefined,
      tauxApresAcre: typeof r.tauxApresAcre === "number" && r.tauxApresAcre >= 0 && r.tauxApresAcre <= 100 ? r.tauxApresAcre : undefined,
      seuilCA: typeof r.seuilCA === "number" && r.seuilCA > 0 ? r.seuilCA : undefined,
      soldeInitialCents: Number.isInteger(r.soldeInitialCents) ? r.soldeInitialCents : undefined,
    };
    // ⚠️ Même piège qu'ailleurs : une lecture en échec passe pour « aucun réglage »,
    // on insère une seconde ligne, et la lecture des réglages (l. 83, `maybeSingle`)
    // échoue ensuite définitivement — la comptabilité perd ses taux et son solde
    // initial d'un coup.
    const { data: exist, error: eLecture } = await sb.from("notifications")
      .select("id").eq("user_id", editeur.id).eq("type", TYPE_REGLAGES).maybeSingle();
    if (eLecture) return NextResponse.json({ ok: false, erreurs: [eLecture.message] }, { status: 500 });
    const { error } = exist
      ? await sb.from("notifications").update({ data: propre }).eq("id", exist.id)
      : await sb.from("notifications").insert({ user_id: editeur.id, type: TYPE_REGLAGES, title: "Réglages comptables", read: true, data: propre });
    if (error) return NextResponse.json({ ok: false, erreurs: [error.message] }, { status: 500 });
    return NextResponse.json({ ok: true, reglages: propre });
  }

  if (b.action === "annuler") {
    const motif = String(b.motif ?? "").trim();
    // ⚠️ Un motif est OBLIGATOIRE. Une annulation sans raison est indiscernable d'une
    // erreur de manipulation, et c'est justement ce qu'on demandera de justifier.
    if (!motif) return NextResponse.json({ ok: false, erreurs: ["Un motif d'annulation est obligatoire."] }, { status: 400 });
    const { data: ligne, error: eLire } = await sb.from("notifications")
      .select("id, user_id, data, created_at, title").eq("id", String(b.id ?? "")).eq("user_id", editeur.id).eq("type", TYPE_ECRITURE).maybeSingle();
    if (eLire) return NextResponse.json({ ok: false, erreurs: [eLire.message] }, { status: 500 });
    if (!ligne) return NextResponse.json({ ok: false, erreurs: ["Écriture introuvable."] }, { status: 404 });

    const d = (ligne.data ?? {}) as Record<string, unknown>;
    if (d.annulee) return NextResponse.json({ ok: false, erreurs: ["Cette écriture est déjà annulée."] }, { status: 409 });

    const { error } = await sb.from("notifications")
      .update({ data: { ...d, annulee: true, motifAnnulation: motif.slice(0, 300), annuleeLe: new Date().toISOString() } })
      .eq("id", ligne.id);
    if (error) return NextResponse.json({ ok: false, erreurs: [error.message] }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, erreurs: ["Action inconnue."] }, { status: 400 });
}
