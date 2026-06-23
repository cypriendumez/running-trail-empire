import { cn } from "@/lib/utils/cn";

type Tone = "neutral" | "brand" | "dark";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-600",
  brand: "bg-[#ecfdf5] text-[#047857]",
  dark: "bg-zinc-900 text-white",
};

// Petite pastille (eyebrow, "Nouveau", tag de plan…). `dot` = point coloré à gauche.
export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />}
      {children}
    </span>
  );
}
