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
    default: "Fire & EMS Training Readiness | Responder Roadmap",
    template: "%s | Responder Roadmap",
  },
  description:
    "Fire & EMS training readiness software for Training Officers, Chiefs, Captains, and instructors. Manage Task Books, assignments, evaluations, and member progress alongside your existing records system.",
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
    "fire EMS training readiness",
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
    title: "Fire & EMS Training Readiness | Responder Roadmap",
    description:
      "Know what every member has completed, what they are working on, and what they need next.",
  },
  twitter: {
    card: "summary",
    title: "Fire & EMS Training Readiness | Responder Roadmap",
    description:
      "Digital Task Books, Assignments, evaluations, and training progress for Fire & EMS departments.",
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
      "Fire and EMS training readiness software for Task Books, Assignments, evaluations, and member progress.",
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
