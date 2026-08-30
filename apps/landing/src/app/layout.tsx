import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aliquo — o custo da sua importação, com a fonte de cada alíquota à vista",
  description:
    "Descubra a NCM na base oficial da Receita, calcule II, IPI, PIS, COFINS e ICMS com as alíquotas publicadas, e chegue ao custo total de nacionalização — sabendo de onde veio cada número.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-bg font-sans text-text-primary">{children}</body>
    </html>
  );
}
