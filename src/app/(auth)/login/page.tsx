"use client";

import { useEffect, useState , useId} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { cheminSur } from "@/lib/social/amisLiens";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";
import { BoutonsOAuth } from "@/components/auth/BoutonsOAuth";
import { AideCompte, type Situation } from "@/components/auth/AideCompte";
import { messageErreurConnexion } from "@/lib/auth/messageErreur";
import { sansMotDePasse, type StatutCompte } from "@/lib/auth/statut";
import { memoriserEmail, reprendreEmail } from "@/lib/auth/emailMemorise";

export default function LoginPage() {
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
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  // Pourquoi la connexion a échoué, et quoi faire — affiché jusqu'à la prochaine saisie.
  const [aide, setAide] = useState<Situation | null>(null);
  const [renvoi, setRenvoi] = useState({ enCours: false, fait: false });
  const { t, lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).login;
  const A = (AUTH[lang] ?? AUTH.fr).aide;

  // Surface une erreur renvoyée par /auth/callback ou /auth/confirm
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "confirm") toast.error(L.errConfirm);
    else if (err) toast.error(L.errGeneric);
  }, [L]);

  // L'adresse tapée sur l'inscription ou « mot de passe oublié » suit la personne ici.
  useEffect(() => {
    const e = reprendreEmail();
    if (e) setEmail(e);
  }, []);

  /**
   * LA VRAIE RAISON DE L'ÉCHEC. Supabase ne dit que « Invalid login credentials » — que
   * l'adresse n'ait aucun compte, que le compte s'ouvre avec Google (pas de mot de passe du
   * tout), ou que le mot de passe soit faux. On demande donc à `/api/auth/statut` ce qu'il
   * en est (décision du 11/10/2026, voir `lib/auth/statut`). Si la question échoue, on
   * retombe sur le message traduit d'avant — jamais sur l'anglais brut.
   */
  async function diagnostiquer(message: string): Promise<Situation> {
    const brut = message.toLowerCase();
    if (brut.includes("not confirmed")) return { cas: "a_confirmer" };
    if (brut.includes("invalid")) {
      const r = await fetch("/api/auth/statut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).catch(() => null);
      if (r?.status === 429) return { cas: "message", texte: L.errRate };
      const s = r?.ok ? ((await r.json().catch(() => null)) as StatutCompte | null) : null;
      if (s?.compte === "aucun") return { cas: "aucun_compte" };
      // Compte jamais confirmé ET mot de passe refusé : la personne ne connaît pas celui posé
      // à l'inscription — peut-être pas le sien (pré-inscription). Voir la route d'inscription.
      if (s?.compte === "a_confirmer") return { cas: "a_confirmer", motDePasseConnu: false };
      if (s?.compte === "actif") return sansMotDePasse(s.methodes) ? { cas: "via_oauth", methodes: s.methodes } : { cas: "mauvais_mot_de_passe" };
    }
    return { cas: "message", texte: messageErreurConnexion(message, L) };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAide(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // ⚠️ PAS `error.message` : Supabase répond en anglais (« Invalid login credentials »).
      setRenvoi({ enCours: false, fait: false });
      setAide(await diagnostiquer(error.message));
      setLoading(false);
      return;
    }
    // `?next=` : un chemin SUR le site (jamais une adresse externe) où revenir — la page
    // d'invitation /amis/<id> s'en sert pour que le suivi se fasse juste après.
    router.push(cheminSur(new URLSearchParams(window.location.search).get("next")));
    router.refresh();
  }

  /** Adresse jamais confirmée : on renvoie le lien, sans recréer quoi que ce soit. */
  async function renvoyerConfirmation() {
    setRenvoi({ enCours: true, fait: false });
    const r = await fetch("/api/auth/confirmation", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, lang, renvoi: true, motDePasseConnu: !(aide?.cas === "a_confirmer" && aide.motDePasseConnu === false) }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j?.ok) { setRenvoi({ enCours: false, fait: true }); return; }
    setRenvoi({ enCours: false, fait: false });
    toast.error(r?.status === 429 ? L.errRate : A.envoiImpossible);
  }

  function saisir(maj: () => void) {
    maj();
    setAide(null);
  }

  return (
    <AuthShell>
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <Logo size={40} />
            <Wordmark className="text-xl" />
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900">{L.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">{L.subtitle}</p>
        </div>

        {/* Les mêmes boutons que sur l'inscription (composant partagé). */}
        <BoutonsOAuth lang={lang} separateur />

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${cid}-email`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.email}</label>
            <input id={`${cid}-email`}
              type="email"
              value={email}
              onChange={(e) => saisir(() => setEmail(e.target.value))}
              placeholder={t("auth.emailPh")}
              autoComplete="email"
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                         placeholder:text-zinc-400 transition-shadow"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${cid}-mdp`} className="text-sm font-medium text-zinc-700">{L.password}</label>
              <Link href="/forgot-password" onClick={() => memoriserEmail(email)} className="text-xs text-emerald-600 hover:text-emerald-700">
                {L.forgot}
              </Link>
            </div>
            <div className="relative">
              <input id={`${cid}-mdp`}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => saisir(() => setPassword(e.target.value))}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 bg-white text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           placeholder:text-zinc-400 transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {aide && (
            <AideCompte situation={aide} email={email} lang={lang}
              onRenvoyer={renvoyerConfirmation} renvoiEnCours={renvoi.enCours} renvoiFait={renvoi.fait} />
          )}
          <button
            type="submit"
            disabled={loading}
            className="btn-brand w-full justify-center py-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {L.submit}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 mt-6">
          {L.noAccount}{" "}
          <Link href="/signup" onClick={() => memoriserEmail(email)} className="text-emerald-600 font-medium hover:text-emerald-700">
            {L.signup}
          </Link>
        </p>
    </AuthShell>
  );
}
