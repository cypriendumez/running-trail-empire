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

  // Après le clic sur le lien de l'email → /auth/callback a posé la session → on doit avoir un user.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setReady(!!data.user));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error(L.pwShort); return; }
    if (password !== confirm) { toast.error(L.pwMismatch); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(L.updated, { duration: 6000 });
    await supabase.auth.signOut();
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
          <h1 className="text-2xl font-bold text-zinc-900">{L.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">{L.subtitle}</p>
        </div>

        {ready === false ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-zinc-700">
            {L.invalid}
            <Link href="/forgot-password" className="text-emerald-600 font-medium hover:text-emerald-700">{L.invalidLink}</Link>.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-700 block mb-1.5">{L.newPw}</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
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
            </div>
            <div>
              <label htmlFor={`${cid}-c0`} className="text-sm font-medium text-zinc-700 block mb-1.5">{L.confirmPw}</label>
              <input id={`${cid}-c0`}
                type={showPwd ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
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
