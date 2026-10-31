import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

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
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased selection:bg-teal-500/30 selection:text-teal-200">
        {children}
        <Toaster
          position="top-right"
          richColors
          theme="dark"
          closeButton
        />
      </body>
    </html>
  );
}
