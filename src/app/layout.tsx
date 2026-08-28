import type { Metadata } from "next";
import { IBM_Plex_Sans, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const ibm = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: "ResponderRoadmap Department Portal",
  description: "Department Task Books, qualifications, and credential readiness for fire and EMS.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${ibm.variable} ${barlow.variable} antialiased`}>{children}</body>
    </html>
  );
}
