"use client";

import { Check, Circle, X } from "lucide-react";
import { verifierRegles } from "@/lib/auth/reglesMotDePasse";
import type { AuthDict } from "@/components/auth/authI18n";

/**
 * La liste des règles sous un champ « nouveau mot de passe », cochée pendant la frappe.
 * Elle lit les MÊMES règles que le serveur (`verifierRegles`) : ce que l'écran coche est
 * exactement ce que l'inscription, la réinitialisation et les réglages acceptent.
 * La fuite (Have I Been Pwned) n'est connue qu'à l'envoi : la note le dit, sans cocher.
 */
export function ReglesMotDePasse({ mdp, email, L, id }: { mdp: string; email?: string | null; L: AuthDict["mdp"]; id?: string }) {
  const raisons = new Set(verifierRegles(mdp, email));
  const saisi = mdp.length > 0;
  const lignes: { ok: boolean; texte: string }[] = [
    { ok: !raisons.has("longueur"), texte: L.longueur },
    { ok: !raisons.has("familles"), texte: L.familles },
    { ok: !raisons.has("contient_email") && !raisons.has("contient_marque"), texte: L.perso },
  ];
  // Deux règles qu'on ne montre que lorsqu'elles sont enfreintes : elles ne gênent presque personne.
  if (saisi && raisons.has("variete")) lignes.push({ ok: false, texte: L.variete });
  if (raisons.has("trop_long")) lignes.push({ ok: false, texte: L.tropLong });
  return (
    <div id={id} className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
      <p className="font-medium text-zinc-700">{L.titre}</p>
      <ul className="mt-1 space-y-0.5">
        {lignes.map((l) => {
          const etat = !saisi ? "attente" : l.ok ? "ok" : "ko";
          return (
            <li key={l.texte} className={`flex items-start gap-1.5 ${etat === "ok" ? "text-emerald-700" : ""}`}>
              {etat === "ok" ? <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                : etat === "ko" ? <X aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                : <Circle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />}
              <span>{l.texte}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5">{L.fuiteNote}</p>
    </div>
  );
}

/** Le message à afficher pour un refus du serveur (inscription ou changement de mot de passe). */
export function messageRefusMotDePasse(erreur: unknown, L: AuthDict["mdp"]): string | null {
  switch (erreur) {
    case "mot_de_passe_faible": return L.faible;
    case "mot_de_passe_fuite": return L.fuite;
    case "actuel_requis": return L.actuelRequis;
    case "actuel_faux": return L.actuelFaux;
    case "identique": return L.identique;
    case "reauthentification": return L.reauth;
    case "trop_de_requetes": return L.trop;
    case "non_connecte": return L.sessionExpiree;
    default: return null;
  }
}
