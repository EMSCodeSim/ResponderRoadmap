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
    default: "Fire & EMS Task Book Software | Responder Roadmap",
    template: "%s | Responder Roadmap",
  },
  description:
    "Digital Task Books, Assignments, evaluations, and member progress for Fire & EMS Training Officers. AI drafts the paperwork. Humans approve the work.",
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
    title: "Fire & EMS Task Book Software | Responder Roadmap",
    description:
      "Create Task Books and Assignments, manage evaluations, and see what needs attention — built for Fire & EMS training.",
  },
  twitter: {
    card: "summary",
    title: "Fire & EMS Task Book Software | Responder Roadmap",
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
      "Fire and EMS Task Book software for creating Assignments, documenting evaluations, and tracking member development progress.",
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
