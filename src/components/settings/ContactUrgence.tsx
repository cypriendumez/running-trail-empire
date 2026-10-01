"use client";

/**
 * LE CONTACT D'URGENCE — dans Paramètres › Sécurité (30/09/2026).
 *
 * Il vivait dans l'onglet Santé › Sécurité, retiré à la demande de Cyprien (« sécurité, ça
 * ne sert à rien, enlève-le »). Le contact, lui, SERT : l'enregistrement de sortie (Ghost
 * Runner) lui prépare le SMS avec le lien de suivi en direct. Il déménage donc ici, avec
 * les deux garanties qu'il avait gagnées :
 *   - il est VRAIMENT écrit dans les réglages (`/api/settings`), et un refus est DIT —
 *     l'ancien bouton affichait « enregistré » sans rien écrire ;
 *   - une fois enregistré, il est appelable d'un geste (`tel:`).
 * ⚠️ Et il ne promet rien de plus : Pacevo n'appelle ni n'écrit à personne tout seul.
 */
import { useId, useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone, CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

const TX: Record<string, Record<string, string>> = {
  fr: { titre: "Contact d'urgence", desc: "La personne à prévenir pendant une sortie : l'enregistrement lui prépare un SMS avec ton lien de suivi en direct. Pacevo n'appelle et n'écrit à personne tout seul.", nom: "Prénom Nom", nomPh: "Jean Dupont", tel: "Téléphone", enregistrer: "Enregistrer le contact", ok: "Contact enregistré.", ko: "Contact non enregistré — réessaie.", appeler: "Appeler" },
  en: { titre: "Emergency contact", desc: "The person to alert during a run: the recorder prepares a text with your live tracking link. Pacevo never calls or messages anyone on its own.", nom: "First & last name", nomPh: "John Smith", tel: "Phone", enregistrer: "Save contact", ok: "Contact saved.", ko: "Contact not saved — try again.", appeler: "Call" },
  de: { titre: "Notfallkontakt", desc: "Die Person, die während eines Laufs informiert wird: Die Aufzeichnung bereitet ihr eine SMS mit deinem Live-Tracking-Link vor. Pacevo ruft niemanden von selbst an und schreibt niemandem.", nom: "Vor- & Nachname", nomPh: "Max Mustermann", tel: "Telefon", enregistrer: "Kontakt speichern", ok: "Kontakt gespeichert.", ko: "Kontakt nicht gespeichert — bitte erneut versuchen.", appeler: "Anrufen" },
  es: { titre: "Contacto de emergencia", desc: "La persona a avisar durante una salida: la grabación le prepara un SMS con tu enlace de seguimiento en directo. Pacevo no llama ni escribe a nadie por su cuenta.", nom: "Nombre y apellidos", nomPh: "Juan Pérez", tel: "Teléfono", enregistrer: "Guardar contacto", ok: "Contacto guardado.", ko: "Contacto no guardado — inténtalo de nuevo.", appeler: "Llamar" },
  pt: { titre: "Contacto de emergência", desc: "A pessoa a avisar durante uma saída: a gravação prepara-lhe um SMS com a tua ligação de seguimento em direto. A Pacevo não liga nem escreve a ninguém por si só.", nom: "Nome completo", nomPh: "João Silva", tel: "Telefone", enregistrer: "Guardar contacto", ok: "Contacto guardado.", ko: "Contacto não guardado — tenta de novo.", appeler: "Ligar" },
};

export function ContactUrgence({ initial }: { initial: { nom: string; tel: string } }) {
  const { lang } = useT();
  const t = (k: string) => TX[lang]?.[k] ?? TX.fr[k];
  const id = useId();
  const [nom, setNom] = useState(initial.nom);
  const [tel, setTel] = useState(initial.tel);
  const [enCours, setEnCours] = useState(false);
  const [enregistre, setEnregistre] = useState(initial);

  async function enregistrer() {
    setEnCours(true);
    try {
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactUrgenceNom: nom.trim(), contactUrgenceTel: tel.trim() }),
      });
      if (r.ok) { toast.success(t("ok")); setEnregistre({ nom: nom.trim(), tel: tel.trim() }); }
      else toast.error(t("ko"));
    } catch { toast.error(t("ko")); }
    setEnCours(false);
  }

  const champ = "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100";
  return (
    <section id="contact-urgence" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-bold text-zinc-900">{t("titre")}</h2>
      <p className="mt-0.5 text-sm text-zinc-500">{t("desc")}</p>
      <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-n`} className="block">
          <span className="mb-1 block text-[13px] font-semibold text-zinc-600">{t("nom")}</span>
          <input id={`${id}-n`} value={nom} onChange={(e) => setNom(e.target.value)} placeholder={t("nomPh")} autoComplete="off" className={champ} />
        </label>
        <label htmlFor={`${id}-t`} className="block">
          <span className="mb-1 block text-[13px] font-semibold text-zinc-600">{t("tel")}</span>
          <input id={`${id}-t`} value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+33 6 12 34 56 78" type="tel" autoComplete="off" className={champ} />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={enregistrer} disabled={enCours || (!nom.trim() && !tel.trim())}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t("enregistrer")}
        </button>
        {enregistre.tel && (
          <a href={`tel:${enregistre.tel.replace(/[^\d+]/g, "")}`}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
            <Phone className="h-4 w-4" />{t("appeler")} {enregistre.nom}
          </a>
        )}
      </div>
    </section>
  );
}
