export const dynamic = "force-dynamic";
export const maxDuration = 300;
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { idEditeur } from "@/lib/compta/enregistrer";
import { ETAT_VIDE, trancheAVerifier, appliquerResultats, urlsSignalees, type EtatLiens } from "@/lib/races/liens";
import { dateDeLaFiche, doitMettreAJour } from "@/lib/races/fiche";
import { jourLocal } from "@/lib/streak/compute";

export const TYPE_ETAT = "races_liens";

/**
 * CONTRÔLE ÉTALÉ DES LIENS D'INSCRIPTION.
 *
 * Le catalogue est repris de deux agrégateurs : ses fiches peuvent pointer vers une page
 * disparue sans que rien ne le signale. Vérifier les 8 600 événements d'un coup est
 * impossible — la source répond 403 dès qu'on enchaîne les requêtes (14 sur 40 lors du
 * premier contrôle). On en vérifie donc une petite tranche par passage, en repartant du
 * curseur laissé par le précédent : le catalogue entier est parcouru en quelques
 * semaines, puis reparcouru.
 *
 * ⚠️ RYTHME VOLONTAIREMENT LENT. Une pause entre chaque requête, et un `HEAD` d'abord :
 * on interroge le site d'un tiers, pas le nôtre. Aller plus vite ferait bloquer l'app
 * entière, ce qui rendrait le contrôle impossible pour de bon.
 *
 * L'état vit dans `notifications` (type `races_liens`) rattaché au compte éditeur —
 * même procédé que la comptabilité, aucune migration.
 */
const TAILLE_LOT = 120;
const PAUSE_MS = 900;

export async function GET(req: Request) {
  const attendu = process.env.CRON_SECRET;
  if (!attendu || req.headers.get("authorization") !== `Bearer ${attendu}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const proprietaire = await idEditeur();
  if (!proprietaire) {
    return NextResponse.json({ error: "Aucun compte d'administration : l'état n'a pas de propriétaire." }, { status: 500 });
  }

  const sb = createAdminClient();

  // Une URL par ÉVÉNEMENT : les variantes de distance partagent la même page, les
  // contrôler séparément multiplierait les requêtes sans rien apprendre de plus.
  const urls: string[] = [];
  const vues = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("races").select("registration_url")
      .not("registration_url", "is", null).order("id").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    for (const r of data) {
      const u = String(r.registration_url ?? "");
      if (u && !vues.has(u)) { vues.add(u); urls.push(u); }
    }
    if (data.length < 1000) break;
  }

  const { data: ligne } = await sb.from("notifications").select("id, data")
    .eq("user_id", proprietaire).eq("type", TYPE_ETAT).maybeSingle();
  const etat: EtatLiens = { ...ETAT_VIDE, ...((ligne?.data ?? {}) as Partial<EtatLiens>) };

  const aujourdhui = jourLocal();
  const { tranche, suivant } = trancheAVerifier(urls, etat.curseur, TAILLE_LOT);
  const resultats: { url: string; code: number }[] = [];
  let datesRafraichies = 0;

  for (const url of tranche) {
    let code = 0;
    try {
      // ⚠️ GET ET NON HEAD, DEPUIS QUE CETTE VISITE SERT AUSSI À RAFRAÎCHIR LA DATE.
      //    L'ancienne synchronisation explorait jogging-plus, passé derrière un défi
      //    JavaScript anti-robot qu'un serveur ne peut pas résoudre : elle renvoyait
      //    zéro course et le catalogue était figé depuis le 10 juin. finishers.com, lui,
      //    autorise l'exploration et publie des données structurées. Comme on visite
      //    déjà ces pages pour contrôler le lien, on y lit la date au passage — une
      //    visite, deux bénéfices, et pas un octet de charge en plus pour la source.
      const rep = await fetch(url, {
        method: "GET", redirect: "follow", signal: AbortSignal.timeout(12000),
        headers: {
          // Un agent réaliste : une requête anonyme est refusée d'office, ce qui
          // produirait des « indéterminé » à la chaîne et ne contrôlerait rien.
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
          "Accept-Language": "fr-FR,fr;q=0.9",
        },
      });
      code = rep.status;
      if (code >= 200 && code < 300) {
        const lue = dateDeLaFiche(await rep.text());
        if (lue) {
          // Toutes les distances d'un même événement partagent cette page : on met à
          // jour d'un coup celles dont la date a bougé, et AUCUNE autre.
          const { data: aJour } = await sb.from("races").select("id,date").eq("registration_url", url);
          const cibles = (aJour ?? []).filter((r) => doitMettreAJour(r.date, lue, aujourdhui)).map((r) => r.id as string);
          if (cibles.length) {
            const { error } = await sb.from("races")
              .update({ date: lue, updated_at: new Date().toISOString() }).in("id", cibles);
            if (!error) datesRafraichies += cibles.length;
          }
        }
      }
    } catch {
      code = 0;   // réseau ou délai dépassé → indéterminé, ne marque rien
    }
    resultats.push({ url, code });
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  const nouvel = { ...appliquerResultats(etat, resultats), curseur: suivant };
  const charge = {
    user_id: proprietaire, type: TYPE_ETAT,
    title: "Contrôle des liens d'inscription",
    body: `${nouvel.verifiees} URL contrôlées · ${urlsSignalees(nouvel).length} page(s) signalée(s) · ${datesRafraichies} date(s) rafraîchie(s) à ce passage`,
    data: nouvel as unknown as Record<string, unknown>,
  };
  const { error } = ligne?.id
    ? await sb.from("notifications").update(charge).eq("id", ligne.id)
    : await sb.from("notifications").insert(charge);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const parVerdict = resultats.reduce<Record<string, number>>((a, r) => {
    const k = r.code === 404 || r.code === 410 ? "morte" : r.code >= 200 && r.code < 400 ? "vivante" : "indetermine";
    a[k] = (a[k] ?? 0) + 1; return a;
  }, {});
  return NextResponse.json({
    ok: true, controlees: resultats.length, total: urls.length,
    curseur: nouvel.curseur, signalees: urlsSignalees(nouvel).length,
    datesRafraichies, parVerdict,
  });
}
