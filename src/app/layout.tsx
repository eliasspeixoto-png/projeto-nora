import { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "@/app/globals.css";
import { Montserrat, EB_Garamond } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-body" });
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-headline" });

const APP_ICON = "/nora-icon-512.png";
const FAVICON = "/nora-icon-192.png";


export const metadata: Metadata = {
  metadataBase: new URL('https://nora.tec.br'),
  title: "NORA",
  description: "Sistema de Gestão para Empresas de Instalação e Segurança",
  applicationName: "NORA",
  manifest: "/manifest.json?v=2",
  appleWebApp: {
    capable: true,
    title: "NORA Pro",
    statusBarStyle: "black-translucent",
    startupImage: [
        APP_ICON
    ]
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "NORA Pro"
  },
  icons: {
    shortcut: FAVICON,
    apple: APP_ICON,
    icon: FAVICON,
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  minimumScale: 1,
  initialScale: 1,
  width: 'device-width',
  userScalable: false,
  maximumScale: 1,
  viewportFit: 'cover'
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="h-full bg-background">
      <head>
        <link rel="apple-touch-icon" href={APP_ICON} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${montserrat.variable} ${ebGaramond.variable} font-body antialiased h-full`}>
        <Providers>
          {children}
        </Providers>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />
      </body>
    </html>
  );
}
