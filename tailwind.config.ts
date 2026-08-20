import type { Config } from "tailwindcss";

/**
 * Linguagem visual: "despacho" — documento fiscal moderno.
 *
 * As escolhas vêm do que o produto vende: rastreabilidade e fonte oficial.
 * Papel quente em vez de branco clínico, fios de 1px em vez de sombras
 * flutuantes, cantos discretos em vez de pílulas, e código NCM sempre em
 * monoespaçada — é um documento, não um cartão de marketing.
 *
 * Duas tintas: VERDE para interação (a cor da caneta) e CARIMBO para estado
 * que exige atenção. Nenhuma terceira cor decorativa.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Papel e tinta
        papel: "#f7f4ee", // fundo — off-white quente, não cinza
        papel2: "#efe9df", // faixas alternadas, cabeçalho de tabela
        folha: "#fffdfa", // superfície de painel
        tinta: "#1c1917", // texto principal
        tinta2: "#4a443d", // texto secundário
        fraco: "#8a8177", // meta, rótulos
        fio: "#ded5c8", // hairline — a régua do documento
        fio2: "#c9bdab", // hairline com mais presença

        // Tinta de caneta — interação
        caneta: {
          DEFAULT: "#1d5c4a",
          forte: "#123d31",
          fraca: "#e6efea",
          fio: "#94b8a9",
        },

        // Carimbo — pendência, bloqueio, provisório
        carimbo: {
          DEFAULT: "#a03c2c",
          fraca: "#f8ebe7",
          fio: "#d6a79b",
        },

        // Anotação — aviso, atenção
        nota: {
          DEFAULT: "#8a6314",
          fraca: "#f7f0dd",
          fio: "#d8c288",
        },

        // Conferido — confirmado, recuperável
        visto: {
          DEFAULT: "#2f6b4f",
          fraca: "#e8f1ea",
          fio: "#9cbfa9",
        },
      },

      fontFamily: {
        // Serifada nos títulos, como as publicações oficiais.
        serifa: ["var(--fonte-serifa)", "Georgia", "Times New Roman", "serif"],
        // Sans institucional, sem cara de landing page genérica.
        sans: ["var(--fonte-sans)", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        // Códigos NCM, alíquotas e valores.
        mono: ["var(--fonte-mono)", "Consolas", "monospace"],
      },

      borderRadius: {
        // Cantos discretos: documento, não pílula.
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
        lg: "5px",
        xl: "6px",
      },

      boxShadow: {
        // Sombras quase inexistentes — a hierarquia vem dos fios.
        // Nomes que NÃO colidem com nomes de cor: `shadow-folha` seria lido
        // como cor-de-sombra, não como a sombra em si.
        sutil: "0 1px 0 rgba(28,25,23,0.04)",
        elevada: "0 1px 2px rgba(28,25,23,0.06), 0 8px 24px rgba(28,25,23,0.06)",
      },

      letterSpacing: {
        rotulo: "0.09em",
      },

      fontSize: {
        rotulo: ["10.5px", { lineHeight: "1.4", letterSpacing: "0.09em" }],
      },
    },
  },
  plugins: [],
};

export default config;
