"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Link2, Mail, MessageCircle, MoreHorizontal, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { actionPartage, CIBLES, estAnnulation, estMobile, type Cible, type Invitation } from "@/lib/social/invitation";
import { LogoApplication } from "./logosApplications";

/**
 * LA FEUILLE « INVITER » — une rangée d'applications, comme partout ailleurs.
 *
 * Voir `lib/social/invitation` pour le pourquoi. Sur téléphone, une feuille qui monte du
 * bas ; sur ordinateur, une fenêtre centrée. Le lien est toujours visible et copiable à
 * la main : si tout le reste échoue, il reste ça.
 */
const L: Record<string, Record<string, string>> = {
  fr: { titre: "Inviter des amis", sous: "Choisis où envoyer ton invitation.", copier: "Copier", copie: "Copié", plus: "Plus",
    coller: "Lien copié — colle-le dans ta conversation {app}.", copieOk: "Lien copié", copieKo: "Copie impossible — sélectionne le lien à la main.",
    fermer: "Fermer", messages: "Messages", email: "E-mail" },
  en: { titre: "Invite friends", sous: "Choose where to send your invitation.", copier: "Copy", copie: "Copied", plus: "More",
    coller: "Link copied — paste it into your {app} chat.", copieOk: "Link copied", copieKo: "Couldn't copy — select the link by hand.",
    fermer: "Close", messages: "Messages", email: "Email" },
  de: { titre: "Freunde einladen", sous: "Wähle, wohin deine Einladung geht.", copier: "Kopieren", copie: "Kopiert", plus: "Mehr",
    coller: "Link kopiert — füge ihn in deinen {app}-Chat ein.", copieOk: "Link kopiert", copieKo: "Kopieren nicht möglich — markiere den Link von Hand.",
    fermer: "Schließen", messages: "Nachrichten", email: "E-Mail" },
  es: { titre: "Invitar a amigos", sous: "Elige dónde enviar tu invitación.", copier: "Copiar", copie: "Copiado", plus: "Más",
    coller: "Enlace copiado: pégalo en tu conversación de {app}.", copieOk: "Enlace copiado", copieKo: "No se pudo copiar: selecciona el enlace a mano.",
    fermer: "Cerrar", messages: "Mensajes", email: "Correo" },
  pt: { titre: "Convidar amigos", sous: "Escolhe onde enviar o teu convite.", copier: "Copiar", copie: "Copiado", plus: "Mais",
    coller: "Ligação copiada — cola-a na tua conversa de {app}.", copieOk: "Ligação copiada", copieKo: "Não foi possível copiar — seleciona a ligação à mão.",
    fermer: "Fechar", messages: "Mensagens", email: "E-mail" },
};

const NOM_APP: Record<Cible, string> = {
  messages: "", whatsapp: "WhatsApp", instagram: "Instagram", messenger: "Messenger",
  telegram: "Telegram", x: "X", facebook: "Facebook", email: "",
};

/** La pastille de chaque application, à ses couleurs. */
function Pastille({ cible }: { cible: Cible }) {
  const base = "flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-sm transition-transform group-active:scale-95 sm:h-12 sm:w-12";
  switch (cible) {
    case "messages": return <span className={`${base} bg-[#34C759]`}><MessageCircle className="h-7 w-7 sm:h-6 sm:w-6" fill="currentColor" strokeWidth={0} /></span>;
    case "whatsapp": return <span className={`${base} bg-[#25D366]`}><LogoApplication nom="whatsapp" className="h-7 w-7 sm:h-6 sm:w-6" /></span>;
    case "instagram": return <span className={`${base} bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]`}><LogoApplication nom="instagram" className="h-7 w-7 sm:h-6 sm:w-6" /></span>;
    case "messenger": return <span className={`${base} bg-gradient-to-br from-[#00B2FF] to-[#006AFF]`}><LogoApplication nom="messenger" className="h-7 w-7 sm:h-6 sm:w-6" /></span>;
    case "telegram": return <span className={`${base} bg-[#26A5E4]`}><LogoApplication nom="telegram" className="h-7 w-7 sm:h-6 sm:w-6" /></span>;
    case "x": return <span className={`${base} bg-black`}><LogoApplication nom="x" className="h-6 w-6 sm:h-5 sm:w-5" /></span>;
    case "facebook": return <span className={`${base} bg-[#1877F2]`}><LogoApplication nom="facebook" className="h-7 w-7 sm:h-6 sm:w-6" /></span>;
    case "email": return <span className={`${base} bg-zinc-700`}><Mail className="h-6 w-6 sm:h-5 sm:w-5" /></span>;
  }
}

export function FeuilleInvitation({ ouverte, onFermer, invitation }: { ouverte: boolean; onFermer: () => void; invitation: Invitation }) {
  const { lang } = useT();
  const d = L[lang] ?? L.fr;
  const [copie, setCopie] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [natif, setNatif] = useState(false);
  const boite = useRef<HTMLDivElement>(null);

  // Décidé APRÈS le montage : au rendu serveur, `navigator` n'existe pas.
  useEffect(() => {
    setMobile(estMobile(navigator.userAgent));
    setNatif(typeof (navigator as Navigator & { share?: unknown }).share === "function");
  }, []);

  useEffect(() => {
    if (!ouverte) return;
    setCopie(false);
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", echap);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    boite.current?.focus();
    return () => { document.removeEventListener("keydown", echap); document.body.style.overflow = avant; };
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  /** Copie le lien ; renvoie la promesse SANS l'attendre pour qui doit encore ouvrir une fenêtre. */
  const lancerCopie = (): Promise<boolean> => {
    // Repli quand le presse-papiers moderne est refusé (anciens iPhone, page sans focus,
    // navigateurs intégrés) : une zone de texte hors écran, sélectionnée, copiée.
    const repli = () => {
      try {
        const zone = document.createElement("textarea");
        zone.value = invitation.url;
        zone.setAttribute("readonly", "");
        zone.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(zone);
        zone.select();
        const ok = document.execCommand("copy");
        zone.remove();
        return ok;
      } catch { return false; }
    };
    try {
      if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(invitation.url).then(() => true, () => repli());
    } catch { /* API absente ou refusée d'emblée */ }
    return Promise.resolve(repli());
  };

  const copier = async () => {
    if (await lancerCopie()) { setCopie(true); toast.success(d.copieOk); } else toast.error(d.copieKo);
  };

  const choisir = (c: Cible) => {
    const a = actionPartage(c, invitation, { mobile });
    // ⚠️ LA COPIE ET L'OUVERTURE DANS LE MÊME GESTE, sans `await` entre les deux : après
    // une attente, le navigateur ne voit plus le clic et bloque la nouvelle fenêtre.
    const copieEnCours = a.copier ? lancerCopie() : null;
    if (/^https?:/.test(a.href)) window.open(a.href, "_blank", "noopener,noreferrer");
    else window.location.href = a.href;   // sms:, mailto:, fb-messenger:
    if (copieEnCours) void copieEnCours.then((ok) => ok
      ? toast.success(d.coller.replace("{app}", NOM_APP[c]))
      : toast.error(d.copieKo));
  };

  const plus = async () => {
    try {
      await (navigator as Navigator & { share: (x: ShareData) => Promise<void> }).share({ title: "Pacevo", text: invitation.texte, url: invitation.url });
    } catch (e) {
      // Fermer la feuille du système n'est pas une erreur ; un refus du navigateur
      // (constaté sur Mac) retombe sur la copie du lien, jamais sur un échec sec.
      if (!estAnnulation(e)) await copier();
    }
  };

  const libelle = (c: Cible) => c === "messages" ? d.messages : c === "email" ? d.email : NOM_APP[c];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <button type="button" aria-label={d.fermer} onClick={onFermer} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div ref={boite} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titre-invitation"
        className="relative w-full max-w-md rounded-t-3xl bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl outline-none sm:rounded-3xl sm:pb-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="titre-invitation" className="text-lg font-bold text-zinc-900">{d.titre}</h2>
            <p className="text-sm text-zinc-500">{d.sous}</p>
          </div>
          <button type="button" onClick={onFermer} aria-label={d.fermer} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4">
          {CIBLES.map((c) => (
            <button key={c} type="button" onClick={() => choisir(c)} className="group flex flex-col items-center gap-1.5 text-[11px] font-medium text-zinc-700">
              <Pastille cible={c} />
              {libelle(c)}
            </button>
          ))}
        </div>

        {/* Le lien, lisible et copiable : si tout le reste échoue, il reste ça. */}
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-1.5 pl-3">
          <Link2 className="h-4 w-4 flex-shrink-0 text-zinc-400" />
          <input readOnly value={invitation.url} onFocus={(e) => e.currentTarget.select()} aria-label={d.titre}
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-700 outline-none" />
          <button type="button" onClick={copier}
            className={`flex flex-shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${copie ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}>
            {copie ? <Check className="h-3.5 w-3.5" /> : null}{copie ? d.copie : d.copier}
          </button>
        </div>

        {natif && (
          <button type="button" onClick={plus} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50">
            <MoreHorizontal className="h-4 w-4" />{d.plus}
          </button>
        )}
      </div>
    </div>
  );
}
