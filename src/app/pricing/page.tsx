import Link from "next/link";
import { PricingFaqs, PricingTiers } from "@/components/PricingTiers";

export default function PricingPage() {
  return <main className="min-h-screen bg-[#0B1220] text-white">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 text-sm font-semibold sm:px-8" aria-label="Pricing navigation">
      <Link href="/" className="text-white">← Responder Roadmap</Link>
      <Link href="/login" className="text-white/80 hover:text-white">Sign in</Link>
    </nav>
    <PricingTiers id="pricing" />
    <PricingFaqs />
  </main>;
}
