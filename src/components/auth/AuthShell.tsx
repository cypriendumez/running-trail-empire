import type { ReactNode } from "react";

// Cadre commun des pages d'auth (login / signup / mot de passe oublié) :
// ambiance émeraude cohérente avec le hero de l'app + carte glassmorphism.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-[#FAFAFA] to-teal-50 px-6 py-10">
      <div className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-teal-300/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/20 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/70 bg-white/80 p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_24px_60px_-24px_rgba(16,24,40,0.22)] backdrop-blur-xl sm:p-10">
        {children}
      </div>
    </div>
  );
}
