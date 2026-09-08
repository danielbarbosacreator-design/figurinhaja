import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { MetaPixel } from "@/components/analytics/MetaPixel";

// Inter — toda a interface do app
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Poppins — só logo, headlines e títulos de marketing
const poppins = Poppins({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FigurinhaJá — Crie suas figurinhas em segundos",
  description:
    "Crie figurinhas e fotos personalizadas com seu candidato. Envie suas fotos e receba seu pack para WhatsApp em segundos. Pagamento seguro e liberação imediata.",
  keywords: "figurinhas, stickers, politica, whatsapp, candidato, personalizado",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#6D28D9",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background">
        <MetaPixel />
        <div className="flex-1 w-full max-w-md mx-auto px-5 flex flex-col">
          {children}
        </div>
        <SiteFooter />
      </body>
    </html>
  );
}
