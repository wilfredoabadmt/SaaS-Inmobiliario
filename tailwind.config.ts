import type { Config } from "tailwindcss";

/**
 * Tokens — fuente de verdad: design_handoff_inmox/ (feature 003-design-system).
 * Paleta papel cálida; venta = teal/salvia, renta = bronce. Los valores literales
 * viven en globals.css (:root); aquí solo se mapean a utilidades de Tailwind.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Superficies
        bg: {
          DEFAULT: "var(--bg)",
          subtle: "var(--bg-subtle)",
          panel: "var(--bg-panel)",
          hover: "var(--bg-hover)",
          sunken: "var(--bg-sunken)",
          active: "var(--bg-active)",
        },
        divider: "var(--surface-divider)",
        border: {
          DEFAULT: "var(--border)",
          strong: "var(--border-strong)",
        },
        // Tinta
        text: {
          DEFAULT: "var(--text)",
          2: "var(--text-2)",
          3: "var(--text-3)",
          4: "var(--text-4)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          strong: "var(--ink-strong)",
          hover: "var(--ink-hover)",
          faintest: "var(--ink-faintest)",
        },
        // Acento de marca (teal/salvia)
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          soft: "var(--accent-soft)",
          tint: "var(--accent-tint)",
          text: "var(--accent-text)",
        },
        // Operación
        venta: {
          DEFAULT: "var(--venta)",
          dot: "var(--venta-dot)",
          tint: "var(--venta-tint)",
          border: "var(--venta-border)",
          text: "var(--venta-text)",
        },
        renta: {
          DEFAULT: "var(--renta)",
          dot: "var(--renta-dot)",
          tint: "var(--renta-tint)",
          border: "var(--renta-border)",
          text: "var(--renta-text)",
        },
        status: {
          online: "var(--status-online)",
          ok: "var(--status-ok)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        rail: "var(--radius-rail)",
      },
      boxShadow: {
        rest: "var(--shadow-rest)",
        lift: "var(--shadow-hover)",
        bubble: "var(--shadow-bubble)",
        ficha: "var(--shadow-ficha)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
