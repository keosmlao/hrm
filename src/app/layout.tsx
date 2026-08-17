import type { Metadata, Viewport } from "next";
import { Noto_Sans_Lao } from "next/font/google";
import "./globals.css";

const notoLao = Noto_Sans_Lao({
  variable: "--font-lao",
  subsets: ["lao"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ODIEN HRM — ລະບົບບໍລິຫານຊັບພະຍາກອນບຸກຄົນ",
  description: "ລະບົບບໍລິຫານຊັບພະຍາກອນບຸກຄົນ — ODIEN GROUP",
};

// ປິດ pinch/zoom (ໂດຍສະເພາະໃນແອັບພະນັກງານໃນມືຖື)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="lo" className={`${notoLao.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
