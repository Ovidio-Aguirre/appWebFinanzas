import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinanzaPro PWA — Finanzas Personales, Tarjetas, Préstamos y Bóvedas",
  description:
    "Progressive Web Application modular para control patrimonial, tarjetas de crédito, amortización de deudas, suscripciones, tickets comprimidos y metas de ahorro.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FinanzaPro",
  },
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f131d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${inter.variable} ${jakarta.variable} bg-surface text-on-surface font-sans antialiased selection:bg-primary/25 selection:text-primary`}
      >
        {children}
        <Toaster
          position="top-right"
          richColors
          theme="dark"
          closeButton
          toastOptions={{
            classNames: {
              toast: "font-sans bg-surface-container-high border border-white/10 text-on-surface shadow-2xl",
            },
          }}
        />
      </body>
    </html>
  );
}
