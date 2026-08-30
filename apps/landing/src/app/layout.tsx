import type { Metadata } from "next";
import localFont from "next/font/local";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const geistSans = localFont({
  src: "../fonts/geist-sans/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../fonts/geist-mono/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});

const sora = localFont({
  src: "../fonts/sora/Sora-Variable.woff2",
  weight: "100 800",
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aliquo — o custo da sua importação, com a fonte de cada alíquota à vista",
  description:
    "Descubra a NCM na base oficial da Receita, calcule II, IPI, PIS, COFINS e ICMS com as alíquotas publicadas, e chegue ao custo total de nacionalização — sabendo de onde veio cada número.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable}`}
    >
      <body className="bg-bg font-sans text-text-primary" suppressHydrationWarning>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
