import { cn } from "@/lib/utils/cn";

export type BtnVariant = "primary" | "secondary" | "ghost" | "brand";
export type BtnSize = "sm" | "md" | "lg";

const VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800",
  secondary: "bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50",
  ghost: "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100",
  brand: "bg-[#059669] text-white hover:bg-[#047857]",
};

const SIZES: Record<BtnSize, string> = {
  sm: "text-[13px] px-3.5 py-2 rounded-lg gap-1.5",
  md: "text-sm px-5 py-2.5 rounded-xl gap-2",
  lg: "text-base px-7 py-3.5 rounded-xl gap-2",
};

// Helper réutilisable — pratique pour styler un <Link> ou un <button>.
export function btnClass(variant: BtnVariant = "primary", size: BtnSize = "md", className = "") {
  return cn(
    "inline-flex items-center justify-center font-semibold transition-colors active:scale-[.98] whitespace-nowrap",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
    "disabled:opacity-60 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return <button className={btnClass(variant, size, className)} {...props} />;
}
