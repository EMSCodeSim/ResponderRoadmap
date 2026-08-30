import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
