import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Aliquo — Simulador Tributário e Landed Cost",
  description:
    "Classificação de NCM assistida por IA, cálculo de tributos de importação e custo total de nacionalização para pequenas empresas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
