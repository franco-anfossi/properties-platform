import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SessionNav } from "@/components/layout/SessionNav";
import { ThemeScript } from "@/components/layout/theme-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "PortalProp — Propiedades en vivo",
    template: "%s · PortalProp",
  },
  description:
    "Buscá propiedades en vivo desde Portal Inmobiliario, guardá favoritos y seguí tu historial de búsquedas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <head>
        {/* Fija el tema antes del primer paint (evita FOUC). */}
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <Header sessionSlot={<SessionNav />} />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
