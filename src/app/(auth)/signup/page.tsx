"use client";

import { useState , useId} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";
import { JOURS_ESSAI } from "@/lib/billing/access";

export default function SignupPage() {
  /**
   * ⚠️ CHAQUE CHAMP EST RELIÉ À SON LIBELLÉ, ET CE N'EST PAS COSMÉTIQUE.
   *
   * Constaté sur la production le 04/09/2026 : les libellés visibles (« Prénom & Nom »,
   * « Email », « Mot de passe ») n'étaient reliés à AUCUN champ. Le nom accessible
   * retombait donc sur le `placeholder` : un lecteur d'écran annonçait « Marie Dupont »
   * au lieu de « Prénom & Nom ». Quelqu'un qui n'y voit pas ne pouvait pas savoir quoi
   * taper — sur le formulaire d'inscription, la toute première interaction avec le
   * produit. Et pour tout le monde, cliquer le libellé ne plaçait pas le curseur.
   *
   * `useId()` plutôt qu'un identifiant écrit à la main : deux formulaires rendus sur la
   * même page ne peuvent pas entrer en collision.
   */
  const cid = useId();
  const { lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).signup;
  const [step, setStep] = useState<"account" | "verify">("account");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" });
  // Domaine sans serveur de courrier, renvoyé par la route : le message reste SOUS le
  // champ (un toast disparaît avant qu'on ait relu son adresse), avec la correction en
  // un clic quand la faute de frappe est évidente.
  const [domaineMort, setDomaineMort] = useState<{ domaine: string; suggestion: string | null; douteux: boolean } | null>(null);

  function update(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    if (field === "email") setDomaineMort(null);
  }

  async function handleSubmit(e: React.FormEvent, domaineConfirme = false) {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error(L.pwMismatch); return; }
    if (form.password.length < 8) { toast.error(L.pwShort); return; }
    setLoading(true);
    // ⚠️ ON N'APPELLE PLUS `supabase.auth.signUp()` DIRECTEMENT, et ce n'est pas un
    // détail : cet appel déclenche l'e-mail par DÉFAUT de Supabase — « Confirm your
    // email address », en anglais, expédié par `noreply@mail.app.supabase.io`, sans
    // logo. C'est le premier message qu'une personne reçoit après avoir donné son
    // adresse et son mot de passe, et il ressemble à ce qu'on apprend à ne pas ouvrir.
    //
    // La route crée le compte via `generateLink`, qui N'ENVOIE RIEN, et expédie NOTRE
    // message : logo, nom de l'app, et la langue choisie. Garder les deux ferait
    // arriver DEUX e-mails de confirmation.
    const rep = await fetch("/api/auth/confirmation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password, fullName: form.fullName, lang, domaineConfirme }),
    });
    const j = await rep.json().catch(() => null);
    setLoading(false);
    // ⚠️ Deux cas seulement donnent une vraie erreur : le mot de passe trop court, et un
    // DOMAINE qui ne reçoit pas de courrier (faute de frappe : « gmial.com »). Tout le
    // reste — adresse déjà prise, adresse inconnue — répond « c'est envoyé », sinon le
    // formulaire deviendrait un annuaire : il suffirait d'essayer des adresses pour
    // savoir qui a un compte. Même règle que « mot de passe oublié ». Le domaine, lui,
    // ne dit rien sur les comptes : il parle du fournisseur.
    // « douteux » : le domaine est à une ou deux lettres d'un fournisseur courant (et ces
    // domaines-là EXISTENT, déposés par des squatteurs) — on demande. « sans courrier » :
    // le domaine n'existe pas du tout — on refuse.
    if (j?.error === "domaine_sans_courrier" || j?.error === "domaine_douteux") {
      setDomaineMort({ domaine: String(j.domaine ?? ""), suggestion: j.suggestion ? String(j.suggestion) : null, douteux: j.error === "domaine_douteux" });
      return;
    }
    if (!rep.ok || !j?.ok) { toast.error(L.pwShort); return; }
    setStep("verify");
  }

  /**
   * ⚠️ PAR NOTRE ROUTE, PAS `supabase.auth.resend()`. Ce dernier expédie le gabarit
   * « Confirm signup » du tableau de bord Supabase — un texte qu'aucun test ne voit et
   * dont le lien, par défaut, passe par `supabase.co/auth/v1/verify` : le jeton y est
   * consommé, la session repart dans un `#fragment` que notre serveur ne lit pas, et
   * `/auth/confirm` répondait « lien invalide » à une confirmation réussie. Le renvoi
   * doit produire EXACTEMENT le même message que l'inscription : même logo, même langue,
   * même lien `token_hash`. Le mot de passe est encore dans le formulaire ; la route
   * regénère un jeton pour un compte non confirmé (vérifié sur Supabase le 13/09/2026).
   */
  async function resendConfirmation() {
    setLoading(true);
    const rep = await fetch("/api/auth/confirmation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email, password: form.password, fullName: form.fullName, lang, domaineConfirme: true }),
    }).catch(() => null);
    setLoading(false);
    if (!rep?.ok) { toast.error(L.pwShort); return; }
    toast.success(L.resent);
  }

  if (step === "verify") {
    const [pre, post] = L.verifyText.split("{email}");
    return (
      <AuthShell>
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-3">{L.verifyTitle}</h1>
          <p className="text-zinc-500 mb-8">
            {pre}<strong className="text-zinc-900">{form.email}</strong>{post}
          </p>
          <Link href="/login" className="btn-brand justify-center inline-flex w-full">
            {L.goLogin}
          </Link>
          <button
            type="button"
            onClick={resendConfirmation}
            disabled={loading}
            className="mt-4 text-sm text-zinc-500 hover:text-zinc-800 disabled:opacity-60 inline-flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {L.resend}
          </button>
          {/* Une adresse mal tapée mais sur un domaine réel ne se détecte pas avant l'envoi :
              on ne laisse donc personne bloqué devant « vérifiez votre email ». */}
          <p className="mt-6 text-xs text-zinc-400">{L.notArriving}</p>
          <button type="button" onClick={() => setStep("account")} className="mt-2 text-sm font-medium text-emerald-700 hover:text-emerald-900">
            {L.wrongEmail}
          </button>
        </div>
      </AuthShell>
    );
  }

  const passwordStrength = getPasswordStrength(form.password);
  const inputCls = "w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-zinc-400";

  return (
    <AuthShell>
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <Logo size={40} />
            <Wordmark className="text-xl" />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">{L.title}</h1>
          {/* La durée vient de JOURS_ESSAI, jamais d'une constante recopiée : la page
              annonçait « 30 jours », la page d'accueil « 7 », les réglages « 14 ». */}
          <p className="text-zinc-500 text-sm mt-1">{L.subtitle.replace("{n}", String(JOURS_ESSAI))}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${cid}-nom`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.name}</label>
            <input id={`${cid}-nom`} type="text" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} placeholder={L.namePh} required className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${cid}-email`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.email}</label>
            <input id={`${cid}-email`} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="marie@exemple.com" required aria-invalid={domaineMort ? true : undefined} aria-describedby={domaineMort ? `${cid}-email-erreur` : undefined} className={inputCls} />
            {domaineMort && (
              <p id={`${cid}-email-erreur`} role="alert" className="mt-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {(domaineMort.douteux ? L.domainDoubt : L.domainDead).replace("{domain}", domaineMort.domaine)}
                {domaineMort.suggestion && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-semibold underline underline-offset-2 hover:text-amber-950"
                      onClick={() => {
                        const local = form.email.split("@")[0];
                        setForm((p) => ({ ...p, email: `${local}@${domaineMort.suggestion}` }));
                        setDomaineMort(null);
                      }}
                    >
                      {L.didYouMean.replace("{suggestion}", domaineMort.suggestion)}
                    </button>
                  </>
                )}
                {domaineMort.douteux && (
                  <>
                    {" · "}
                    <button type="button" className="underline underline-offset-2 hover:text-amber-950" disabled={loading}
                      onClick={(e) => { setDomaineMort(null); void handleSubmit(e as unknown as React.FormEvent, true); }}>
                      {L.keepEmail.replace("{email}", form.email)}
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${cid}-mdp`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.password}</label>
            <input id={`${cid}-mdp`} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} placeholder={L.passwordPh} required className={inputCls} />
            {form.password && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= passwordStrength
                        ? passwordStrength <= 1 ? "bg-red-400" : passwordStrength <= 2 ? "bg-orange-400" : passwordStrength <= 3 ? "bg-yellow-400" : "bg-emerald-500"
                        : "bg-zinc-200"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor={`${cid}-confirm`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.confirm}</label>
            <input id={`${cid}-confirm`} type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} placeholder={L.confirmPh} required className={inputCls} />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-zinc-500">
            <input type="checkbox" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
            <span>
              {L.consentPre}
              <Link href="/terms" className="text-emerald-600 hover:underline">{L.cgu}</Link>
              {L.consentMid}
              <Link href="/confidentialite" className="text-emerald-600 hover:underline">{L.privacy}</Link>
              {L.consentPost}
            </span>
          </label>

          <button type="submit" disabled={loading} className="btn-brand w-full justify-center py-3">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {L.submit}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-400 mt-5">
          {L.footPre}
          <Link href="/terms" className="text-zinc-600 hover:text-zinc-900">{L.cgu}</Link>
          {L.footMid}
          <Link href="/confidentialite" className="text-zinc-600 hover:text-zinc-900">{L.privacy}</Link>
        </p>

        <p className="text-center text-sm text-zinc-500 mt-4">
          {L.haveAccount}{" "}
          <Link href="/login" className="text-emerald-600 font-medium hover:text-emerald-700">
            {L.login}
          </Link>
        </p>
    </AuthShell>
  );
}

function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}
