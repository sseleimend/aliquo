import type { Config } from "tailwindcss";

/**
 * Tokens extraídos 1:1 de `design/design.pen` (ver `GetVariables()` no
 * arquivo). Mantém o design system do template aprovado — não é o mesmo
 * visual do app (`apps/simulador`, que usa a linguagem "despacho"): a landing
 * page é a peça de marketing e usa a identidade que veio do .pen.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#FFFFFF",
          subtle: "#FAFAFA",
        },
        surface2: "#F5F5F7",
        ink: {
          DEFAULT: "#0B0B0F",
          2: "#16161C",
        },
        border: {
          DEFAULT: "#ECECF0",
          strong: "#E2E2E8",
          dark: "#26262E",
        },
        text: {
          primary: "#0E0E12",
          secondary: "#56565F",
          tertiary: "#6E6E7A",
          inverse: "#FFFFFF",
          inverse2: "#A0A0AC",
        },
        accent: {
          DEFAULT: "#4A3AFF",
          soft: "#EFEDFF",
          border: "#DDD9FF",
        },
        positive: {
          DEFAULT: "#14784E",
          soft: "#E8F6EF",
        },
        warn: {
          DEFAULT: "#9A5A05",
          soft: "#FFF3E4",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "12px",
        md: "16px",
        lg: "20px",
      },
    },
  },
  plugins: [],
};

export default config;
