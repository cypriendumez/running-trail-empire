"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { AUTH } from "@/components/auth/authI18n";
import { BoutonsOAuth } from "@/components/auth/BoutonsOAuth";
import { fournisseurDe, sansMotDePasse, type Methode } from "@/lib/auth/statut";
import { memoriserEmail } from "@/lib/auth/emailMemorise";
import type { Lang } from "@/lib/i18n/translations";

/**
 * L'ENCADRÉ QUI DIT POURQUOI, ET QUOI FAIRE — sur la connexion, l'inscription et « mot de
 * passe oublié ».
 *
 * ⚠️ AVANT (constaté le 11/10/2026) : un toast fugace « E-mail ou mot de passe incorrect »
 * pour tout, et un « vérifiez votre email » qui n'arrivait jamais quand l'adresse avait déjà
 * un compte. Cyprien, dont le compte s'ouvre avec Google, n'a pas compris pourquoi rien ne
 * marchait. Chaque cas a maintenant sa phrase ET son geste : le bouton Google du compte,
 * « Se connecter », « Créer un compte », « Renvoyer l'e-mail ». L'encadré reste affiché
 * (role="alert") jusqu'à la prochaine saisie : on a le temps de le lire.
 */
export type Situation =
  /** Inscription : l'adresse a déjà un compte. */
  | { cas: "compte_existant"; methodes: Methode[] }
  /** Connexion ou mot de passe oublié : aucun compte avec cette adresse. */
  | { cas: "aucun_compte" }
  /** Connexion : mot de passe tenté sur un compte qui s'ouvre avec Google/Apple. */
  | { cas: "via_oauth"; methodes: Methode[] }
  | { cas: "mauvais_mot_de_passe" }
  /** Compte créé par e-mail, lien de confirmation jamais cliqué. */
  | { cas: "a_confirmer" }
  | { cas: "message"; texte: string };

const NOMS = { google: "Google", apple: "Apple" } as const;

export function AideCompte({ situation, email, lang, id, onRenvoyer, renvoiEnCours = false, renvoiFait = false }: {
  situation: Situation;
  /** L'adresse saisie : elle suit la personne vers la page proposée. */
  email: string;
  lang: Lang;
  id?: string;
  onRenvoyer?: () => void;
  renvoiEnCours?: boolean;
  renvoiFait?: boolean;
}) {
  const D = AUTH[lang] ?? AUTH.fr;
  const A = D.aide;
  const f = "methodes" in situation ? fournisseurDe(situation.methodes) : null;
  const remplir = (s: string) => s.replaceAll("{fournisseur}", f ? NOMS[f] : "").replaceAll("{bouton}", f ? D.login[f] : "");
  const suivre = () => memoriserEmail(email);
  const lien = "inline-block font-semibold underline underline-offset-2 hover:text-amber-950";
  const bouton = "inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60";

  let corps: React.ReactNode;
  switch (situation.cas) {
    case "compte_existant": {
      const seulOauth = sansMotDePasse(situation.methodes);
      corps = (
        <>
          <p className="font-semibold">{A.existe}</p>
          <p>{seulOauth ? remplir(A.existeOauth) : f ? remplir(A.existeMdpOauth) : A.existeMdp}</p>
          {f && <BoutonsOAuth lang={lang} seulement={[f]} />}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {!seulOauth && <Link href="/login" onClick={suivre} className={bouton}>{A.seConnecter}</Link>}
            <Link href="/forgot-password" onClick={suivre} className={lien}>{seulOauth ? A.choisirMdp : A.mdpOublie}</Link>
          </div>
        </>
      );
      break;
    }
    case "via_oauth":
      corps = (
        <>
          <p>{remplir(A.viaOauth)}</p>
          {f && <BoutonsOAuth lang={lang} seulement={[f]} />}
          <Link href="/forgot-password" onClick={suivre} className={lien}>{A.choisirMdp}</Link>
        </>
      );
      break;
    case "aucun_compte":
      corps = (
        <>
          <p>{A.aucun}</p>
          <Link href="/signup" onClick={suivre} className={bouton}>{A.creer}</Link>
        </>
      );
      break;
    case "mauvais_mot_de_passe":
      corps = (
        <>
          <p>{A.mauvaisMdp}</p>
          <Link href="/forgot-password" onClick={suivre} className={lien}>{A.mdpOublie}</Link>
        </>
      );
      break;
    case "a_confirmer":
      corps = (
        <>
          <p>{A.aConfirmer}</p>
          {renvoiFait ? (
            <p className="font-semibold">{A.renvoye}</p>
          ) : onRenvoyer ? (
            <button type="button" onClick={onRenvoyer} disabled={renvoiEnCours} className={bouton}>
              {renvoiEnCours && <Loader2 className="w-4 h-4 animate-spin" />}
              {A.renvoyer}
            </button>
          ) : null}
        </>
      );
      break;
    default:
      corps = <p>{situation.texte}</p>;
  }

  return (
    <div id={id} role="alert" className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      {corps}
    </div>
  );
}
