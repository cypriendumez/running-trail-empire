import { cn } from "@/lib/utils/cn";

// Largeur de contenu cohérente sur tout le site.
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-6 sm:px-8", className)} {...props} />;
}

// Section verticale avec rythme régulier.
export function Section({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("py-20 sm:py-28", className)} {...props} />;
}

// En-tête de section : sur-titre + titre + sous-titre, centré par défaut.
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl", className)}>
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#047857]">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">{title}</h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-zinc-500">{subtitle}</p>}
    </div>
  );
}
