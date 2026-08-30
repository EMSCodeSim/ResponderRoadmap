import type { Metadata } from "next";
import { IBM_Plex_Sans, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import "./control-fixes.css";

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
  metadataBase: new URL("https://responderroadmap.com"),
  title: {
    default: "ResponderRoadmap | Firefighter & EMS Digital Task Books",
    template: "%s | ResponderRoadmap",
  },
  description:
    "Digital firefighter and EMS task books for departments. Build qualification books, assign members, complete field skill evaluations, track sign-offs, certifications, expirations, and training readiness.",
  keywords: [
    "firefighter task book",
    "digital firefighter task book",
    "fire department training software",
    "EMS training software",
    "firefighter skills checklist",
    "fire department qualification tracking",
    "firefighter sign off app",
    "probationary firefighter task book",
    "driver operator task book",
    "fire officer task book",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "https://responderroadmap.com/",
    siteName: "ResponderRoadmap",
    title: "ResponderRoadmap | Firefighter & EMS Digital Task Books",
    description:
      "Build, assign, evaluate, and track firefighter and EMS qualification Task Books with field sign-offs and department readiness reporting.",
  },
  twitter: {
    card: "summary",
    title: "ResponderRoadmap | Firefighter & EMS Digital Task Books",
    description:
      "Digital Task Books, field skill evaluations, sign-offs, certifications, and readiness tracking for fire and EMS departments.",
  },
  category: "Fire and EMS training software",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ResponderRoadmap",
    url: "https://responderroadmap.com/",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Digital firefighter and EMS Task Book software for qualification tracking, field skill evaluations, sign-offs, certifications, and department training readiness.",
    audience: {
      "@type": "Audience",
      audienceType: "Fire departments, EMS agencies, training officers, firefighters, EMTs, and paramedics",
    },
  };

  return (
    <html lang="en">
      <body className={`${ibm.variable} ${barlow.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
