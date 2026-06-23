import { cn } from "@/lib/utils/cn";

// Carte minimal-premium : surface blanche, bord fin, coins doux, lift discret au survol (option).
export function Card({
  className,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white ring-1 ring-inset ring-zinc-200/80",
        hover && "transition-all duration-300 hover:ring-zinc-300 hover:shadow-[0_18px_40px_-22px_rgba(16,24,40,.25)]",
        className,
      )}
      {...props}
    />
  );
}
