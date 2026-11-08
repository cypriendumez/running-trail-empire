"use client";

import { useEffect, useState , useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Logo } from "@/components/brand/Logo";
import { Wordmark } from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n/LanguageProvider";
import { AUTH } from "@/components/auth/authI18n";
import { ReglesMotDePasse, messageRefusMotDePasse } from "@/components/auth/ReglesMotDePasse";
import { verifierRegles, MDP_MIN } from "@/lib/auth/reglesMotDePasse";
import { secondFacteurAttendu } from "@/lib/auth/mfaNavigateur";

export default function ResetPasswordPage() {
  // Chaque libellé est relié à son champ : sans cela, un lecteur d'écran annonce
  // le placeholder — ou rien — à la place du texte affiché.
  const cid = useId();
  const router = useRouter();
  const { lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).reset;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null); // session de récupération présente ?
  // Arrivée depuis une confirmation d'inscription CONTESTÉE (adresse réinscrite avant d'être
  // confirmée) : on dit pourquoi on demande un mot de passe. Voir /auth/confirm.
  const [apresInscription, setApresInscription] = useState(false);

  const M = (AUTH[lang] ?? AUTH.fr).mdp;
  const [email, setEmail] = useState<string | null>(null); // pour la règle « pas ton adresse »

  // Après le clic sur le lien de l'email → /auth/confirm a posé la session → on doit avoir un user.
  useEffect(() => {
    const supabase = createClient();
    // DOUBLE AUTHENTIFICATION : le lien e-mail ne vaut pas le code. Un compte protégé le donne
    // d'abord, puis revient ici (sinon le serveur refuserait le changement : session en attente).
    void secondFacteurAttendu(supabase).then((attendu) => { if (attendu) router.replace("/verification-2fa?next=/reset-password"); });
    supabase.auth.getUser().then(({ data }) => { setReady(!!data.user); setEmail(data.user?.email ?? null); });
    setApresInscription(new URLSearchParams(window.location.search).get("apres") === "inscription");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (verifierRegles(password, email).length) { toast.error(M.faible); return; }
    if (password !== confirm) { toast.error(L.pwMismatch); return; }
    setLoading(true);
    // ⚠️ PAR NOTRE ROUTE, PLUS PAR `supabase.auth.updateUser()` : le serveur applique les mêmes
    // règles ET refuse les mots de passe déjà fuités (Have I Been Pwned), ce que le navigateur
    // ne peut pas faire sans exposer le mot de passe. Et l'erreur arrive traduite, pas en anglais.
    const rep = await fetch("/api/auth/mot-de-passe", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    }).catch(() => null);
    const j = rep ? await rep.json().catch(() => null) : null;
    setLoading(false);
    if (!rep?.ok || !j?.ok) {
      // Plus d'une heure après le clic, le serveur réclame l'ancien mot de passe, que cette page
      // n'a pas : c'est un lien expiré, et la personne doit en redemander un.
      toast.error(messageRefusMotDePasse(j?.error === "actuel_requis" ? "non_connecte" : j?.error, M) ?? M.echec, { duration: 8000 });
      return;
    }
    toast.success(L.updated, { duration: 6000 });
    await createClient().auth.signOut();
    router.push("/login");
  }

  const pwInput = "w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-zinc-400 transition-shadow";

  return (
    <AuthShell>
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <Logo size={40} />
            <Wordmark className="text-xl" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">{L.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">{L.subtitle}</p>
          {apresInscription && (
            <p role="status" className="mt-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{L.apresInscription}</p>
          )}
        </div>

        {ready === false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-zinc-700">
            {L.invalid}
            <Link href="/forgot-password" className="text-emerald-600 font-medium hover:text-emerald-700">{L.invalidLink}</Link>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor={`${cid}-n0`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.newPw}</label>
              <div className="relative">
                <input id={`${cid}-n0`}
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={MDP_MIN}
                  autoComplete="new-password"
                  aria-describedby={`${cid}-regles`}
                  className={pwInput}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <ReglesMotDePasse mdp={password} email={email} L={M} id={`${cid}-regles`} />
            </div>
            <div>
              <label htmlFor={`${cid}-c0`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.confirmPw}</label>
              <input id={`${cid}-c0`}
                type={showPwd ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={MDP_MIN}
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-zinc-400 transition-shadow"
              />
            </div>
            <button type="submit" disabled={loading || ready === null} className="btn-brand w-full justify-center py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {L.submit}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-zinc-500 mt-6">
          <Link href="/login" className="text-emerald-600 font-medium hover:text-emerald-700">{L.back}</Link>
        </p>
    </AuthShell>
  );
}
