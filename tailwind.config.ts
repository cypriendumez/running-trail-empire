import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Organic State-Based UI Colors
        polar: { DEFAULT: "#E0F2FE", dark: "#0284C7" },
        emerald: { DEFAULT: "#D1FAE5", dark: "#059669" },
        ember: { DEFAULT: "#FFEDD5", dark: "#EA580C" },
        // Brand palette
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16",
        },
        // Neutral ultra-clean
        surface: {
          DEFAULT: "#FAFAFA",
          secondary: "#F4F4F5",
          tertiary: "#E4E4E7",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-anton)", "Impact", "sans-serif"],
        sport: ["var(--font-anton)", "Impact", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 8s linear infinite",
        "bg-shift": "bgShift 4s ease-in-out infinite",
        heartbeat: "heartbeat 1s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        bgShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        heartbeat: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(0,0,0,0.07), 0 10px 20px -2px rgba(0,0,0,0.04)",
        card: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.06)",
        glow: "0 0 30px rgba(34,197,94,0.25)",
        "glow-orange": "0 0 30px rgba(234,88,12,0.25)",
        "glow-blue": "0 0 30px rgba(2,132,199,0.25)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mesh-green":
          "radial-gradient(at 40% 20%, hsla(141,97%,72%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(155,100%,67%,0.1) 0px, transparent 50%)",
        "mesh-blue":
          "radial-gradient(at 40% 20%, hsla(199,100%,72%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(210,100%,67%,0.1) 0px, transparent 50%)",
        "mesh-orange":
          "radial-gradient(at 40% 20%, hsla(25,100%,72%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(35,100%,67%,0.1) 0px, transparent 50%)",
      },
    },
  },
  plugins: [],
};

export default config;
