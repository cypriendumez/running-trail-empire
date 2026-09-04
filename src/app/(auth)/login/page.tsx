"use client";

import { useEffect, useState , useId} from "react";
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
import { fournisseursActifs } from "@/lib/auth/fournisseurs";

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
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "apple">(null);
  // ⚠️ Ni Google ni Apple n'étaient activés côté Supabase (vérifié le 22/08/2026) : les
  // deux boutons échouaient à chaque clic. Ils ne s'affichent plus que si on les
  // DÉCLARE — voir `lib/auth/fournisseurs`.
  const oauth = fournisseursActifs(process.env.NEXT_PUBLIC_OAUTH);
  const { t, lang } = useT();
  const L = (AUTH[lang] ?? AUTH.fr).login;

  // Surface une erreur renvoyée par /auth/callback ou /auth/confirm
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "confirm") toast.error(L.errConfirm);
    else if (err) toast.error(L.errGeneric);
  }, [L]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleOAuth(provider: "google" | "apple") {
    try {
      setOauthLoading(provider);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      // Si pas d'erreur, le navigateur est redirigé automatiquement vers le provider.
      if (error) {
        toast.error(
          error.message?.toLowerCase().includes("not enabled") || error.message?.toLowerCase().includes("provider")
            ? L.errProvider.replace("{provider}", provider === "google" ? "Google" : "Apple")
            : error.message
        );
        setOauthLoading(null);
      }
    } catch {
      toast.error(L.errOAuth);
      setOauthLoading(null);
    }
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

        {/* Social Login */}
        {oauth.length > 0 && (<>
<div className="space-y-3 mb-6">
          {oauth.includes("google") && <button
            onClick={() => handleOAuth("google")}
            disabled={oauthLoading !== null}
            className="w-full btn-secondary justify-center gap-3 py-3 disabled:opacity-60"
          >
            {oauthLoading === "google" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {L.google}
          </button>}
          {oauth.includes("apple") && <button
            onClick={() => handleOAuth("apple")}
            disabled={oauthLoading !== null}
            className="w-full btn-secondary justify-center gap-3 py-3 disabled:opacity-60"
          >
            {oauthLoading === "apple" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
              </svg>
            )}
            {L.apple}
          </button>}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-zinc-200" />
          <span className="text-xs text-zinc-400">{L.or}</span>
          <div className="flex-1 h-px bg-zinc-200" />
        </div>
        </>)}

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor={`${cid}-email`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.email}</label>
            <input id={`${cid}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("auth.emailPh")}
              required
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white text-sm
                         focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                         placeholder:text-zinc-400 transition-shadow"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`${cid}-mdp`} className="text-sm font-medium text-zinc-700">{L.password}</label>
              <Link href="/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700">
                {L.forgot}
              </Link>
            </div>
            <div className="relative">
              <input id={`${cid}-mdp`}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
          <Link href="/signup" className="text-emerald-600 font-medium hover:text-emerald-700">
            {L.signup}
          </Link>
        </p>
    </AuthShell>
  );
}
