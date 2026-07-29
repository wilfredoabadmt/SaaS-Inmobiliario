import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inmox — CRM Inmobiliario con WhatsApp",
  description: "CRM inmobiliario multi-tenant con WhatsApp como canal principal. Gestiona renta y venta desde una bandeja unificada.",
  icons: {
    icon: "/inmox-logo.png",
    shortcut: "/inmox-logo.png",
    apple: "/inmox-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
