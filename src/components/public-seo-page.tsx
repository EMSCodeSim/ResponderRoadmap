import Link from "next/link";
import type { Metadata } from "next";
import { BrandLockup, BrandMark } from "@/components/brand";
import { WalkDemoButton } from "@/components/walk-demo";

export type PublicSeoContent = {
  path: string;
  title: string;
  description: string;
  h1: string;
  lede: string;
  problem: string;
  workflow: string[];
  benefits: string[];
};

export function seoMetadata(page: PublicSeoContent): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.path },
    robots: { index: true, follow: true },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `https://responderroadmap.com${page.path}`,
      siteName: "ResponderRoadmap",
      type: "website",
    },
  };
}

export function PublicSeoPage({ page, demoAvailable }: { page: PublicSeoContent; demoAvailable: boolean }) {
  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/">
            <BrandLockup size={40} subtitle="Task Books for Fire & EMS" />
          </Link>
          <div className="flex gap-2">
            <Link href="/login" className="rounded-md px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10">
              Sign in
            </Link>
            <Link href="/register" className="rounded-md bg-fire px-3 py-2 text-sm font-semibold hover:bg-fire-dark">
              Create a department
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-12">
        <BrandMark size={88} alt="ResponderRoadmap" className="mb-6" />
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fire">Fire &amp; EMS training records</p>
        <h1 className="display mt-3 max-w-3xl text-5xl font-bold leading-[0.95]">{page.h1}</h1>
        <p className="mt-5 max-w-2xl text-lg text-white/70">{page.lede}</p>
        <div className="mt-8 max-w-md space-y-3">
          {demoAvailable ? <WalkDemoButton walk="to" /> : null}
          <Link href="/" className="inline-block text-sm font-semibold text-white/70 hover:text-white">
            ← Back to ResponderRoadmap
          </Link>
        </div>

        <section className="mt-14 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="display text-3xl font-bold">The problem</h2>
            <p className="mt-3 text-white/70">{page.problem}</p>
          </div>
          <div>
            <h2 className="display text-3xl font-bold">The workflow</h2>
            <ol className="mt-3 space-y-2 text-white/80">
              {page.workflow.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="font-bold text-fire">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="display text-3xl font-bold">What the department keeps</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {page.benefits.map((item) => (
              <li key={item} className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-white/80">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-4 px-5 py-6 text-sm text-white/40">
          <Link href="/" className="hover:text-white">
            Home
          </Link>
          <Link href="/firefighter-task-book-software" className="hover:text-white">
            Firefighter Task Books
          </Link>
          <Link href="/fire-department-training-records" className="hover:text-white">
            Training records
          </Link>
          <Link href="/probationary-firefighter-task-books" className="hover:text-white">
            Probationary books
          </Link>
          <Link href="/driver-operator-task-books" className="hover:text-white">
            Driver / Operator
          </Link>
          <Link href="/ems-training-records" className="hover:text-white">
            EMS records
          </Link>
        </div>
      </footer>
    </div>
  );
}
