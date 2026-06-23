/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // 浅色主题 ink 色阶（白→浅灰）
        ink: {
          950: "#FFFFFF",
          900: "#FFFFFF",
          850: "#FFFFFF",
          800: "#F4F4F7",
          700: "#E5E5EA",
          600: "#D1D1D8",
          500: "#A1A1AA",
        },
        crimson: {
          DEFAULT: "#E63946",
          50: "#FFF1F2",
          400: "#F87171",
          500: "#E63946",
          600: "#C81E2D",
          700: "#9E1623",
        },
        gold: {
          DEFAULT: "#D4AF37",
          300: "#E8C766",
          400: "#D4AF37",
          500: "#B8932B",
          600: "#8F7020",
        },
        indigo: {
          DEFAULT: "#3A86FF",
          400: "#60A5FA",
          500: "#3A86FF",
          600: "#2563EB",
          700: "#1D4ED8",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "serif"],
        sans: ['"Noto Sans SC"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px -4px rgba(230, 57, 70, 0.35)",
        "glow-indigo": "0 0 24px -4px rgba(58, 134, 255, 0.35)",
        "glow-gold": "0 0 20px -6px rgba(212, 175, 55, 0.4)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "pop-in": "pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};
