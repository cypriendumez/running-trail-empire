import Link from "next/link";

export const metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFA] px-6 text-center">
      <div className="text-6xl font-black tracking-tight text-emerald-600">404</div>
      <h1 className="mt-3 text-xl font-bold text-zinc-900">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">
        Cette page n&apos;existe pas ou a été déplacée. Reprends ta course depuis le tableau de bord.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link href="/dashboard" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
          Tableau de bord
        </Link>
        <Link href="/" className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
          Accueil
        </Link>
      </div>
    </div>
  );
}
