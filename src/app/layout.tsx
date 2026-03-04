import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans_Lao } from "next/font/google";
import { getConfiguredAppOrigin } from "@/lib/app-origin";
import PwaProvider from "@/components/pwa-provider";
import "./globals.css";

const appSans = Noto_Sans_Lao({
  variable: "--font-app-sans",
  subsets: ["lao", "latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appOrigin = getConfiguredAppOrigin();

export const metadata: Metadata = {
  title: "HRM - ລະບົບບໍລິຫານພະນັກງານ",
  description: "ລະບົບບໍລິຫານຊັບພະຍາກອນມະນຸດ",
  applicationName: "ODG HRM",
  metadataBase: new URL(appOrigin),
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ODG HRM",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/pwa-icon?size=192", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon?size=512", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/pwa-icon?size=180", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#21487a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lo">
      <body className={`${appSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
