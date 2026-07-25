import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta inspirada no PRD do Aliquo
        page: "#f5f4f1",
        ink: "#1f1e1c",
        ink2: "#57554f",
        muted: "#8a887f",
        line: "#e3e1da",
        accent: {
          DEFAULT: "#185fa5",
          bg: "#e6f1fb",
          text: "#0c447c",
          border: "#85b7eb",
        },
        teal: {
          bg: "#e1f5ee",
          text: "#085041",
          border: "#5dcaa5",
        },
        warn: {
          bg: "#faeeda",
          text: "#633806",
          border: "#efc27a",
        },
        danger: {
          bg: "#fcebeb",
          text: "#791f1f",
          border: "#e8a3a3",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
