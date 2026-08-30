import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Create your department",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
