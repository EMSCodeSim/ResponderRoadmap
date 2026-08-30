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
  title: "ResponderRoadmap — Task Books for Fire & EMS",
  description:
    "Build a qualification Task Book in minutes. Evaluate on a phone. Print an official record. Know who is stalled before the shift starts.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${ibm.variable} ${barlow.variable} antialiased`}>{children}</body>
    </html>
  );
}
