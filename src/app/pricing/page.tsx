import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";

export const metadata: Metadata = {
  title: "Department testing",
  description: "Responder Roadmap is working with fire and EMS departments during a product testing period.",
  robots: { index: false, follow: false },
};

export default function DepartmentTestingPage() {
  return (
    <div className="min-h-screen bg-[#0B1220] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0B1220]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/" aria-label="Responder Roadmap home">
            <BrandLockup size={36} subtitle="Fire & EMS Training Progress" />
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-6 text-[13px] font-medium text-white/60">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/demo" className="hover:text-white">Demo</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#FB7185]">Department testing</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Responder Roadmap is in department testing.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/65">
          We are working with fire and EMS departments to validate the training workflows. Public pricing information is temporarily unavailable while department testing is underway.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/department-interest?source=department-testing" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#C8102E] px-5 text-sm font-semibold hover:bg-[#9E0C24]">
            Request department test access
          </Link>
          <Link href="/demo" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/15 px-5 text-sm font-semibold text-white/90 hover:bg-white/5">
            Explore the demo
          </Link>
        </div>
      </main>
    </div>
  );
}
