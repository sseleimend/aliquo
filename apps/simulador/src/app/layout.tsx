import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Spectral } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

/**
 * Trio tipográfico do "despacho":
 *   Spectral      — serifada de tela, para títulos; ecoa publicação oficial
 *   IBM Plex Sans — sans institucional, sem cara de landing genérica
 *   IBM Plex Mono — código NCM, alíquota e valor SEMPRE em monoespaçada
 *
 * As três são auto-hospedadas pelo next/font: nenhuma requisição a terceiros
 * em runtime.
 */
const serifa = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fonte-serifa",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fonte-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fonte-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aliquo — custo de importação",
  description:
    "Classificação de NCM na base oficial, cálculo de tributos e custo total de nacionalização, com a fonte de cada alíquota à vista.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serifa.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
