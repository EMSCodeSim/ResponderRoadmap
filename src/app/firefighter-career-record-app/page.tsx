import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { ArrowRight, Award, BookOpenCheck, BriefcaseBusiness, ClipboardCheck, GraduationCap, ShieldCheck, UserRound } from "lucide-react";

const appStore = "https://apps.apple.com/us/app/responder-roadmap/id6800092347";
const url = "https://responderroadmap.com/firefighter-career-record-app";

export const metadata: Metadata = {
  title: "Firefighter Career Record App | Own Your Career History",
  description: "Build a personal firefighter career timeline for training, certifications, experience, and achievements. Connect to a department for assigned training and verified records.",
  keywords: ["firefighter career record app", "firefighter career timeline", "firefighter training record app", "firefighter certification tracker", "firefighter career portfolio"],
  alternates: { canonical: "/firefighter-career-record-app" },
  openGraph: {
    title: "Your Firefighter Career. One Lasting Record. | Responder Roadmap",
    description: "Keep a personal record of your fire and EMS career, then connect to your department for assignments, evaluations, and approved training.",
    url,
    type: "website",
  },
};

const personal = [
  { icon: BookOpenCheck, title: "Career Timeline", copy: "See how your training, experience, and achievements build over time—not just what is due next." },
  { icon: Award, title: "Certifications & education", copy: "Organize certifications, education, renewal dates, and professional development in one place." },
  { icon: BriefcaseBusiness, title: "Experience & accomplishments", copy: "Capture meaningful calls, teaching, leadership, driving, milestones, and achievements for future reviews and interviews." },
  { icon: GraduationCap, title: "Career goals", copy: "Set a direction, track progress, and see the next practical step toward the role you want." },
];
const department = [
  { title: "Assigned training", copy: "Receive department Task Books, assignments, and training requirements." },
  { title: "Instructor documentation", copy: "Record attendance, training hours, and skill evaluations through Training Sheets." },
  { title: "Verified qualifications", copy: "Authorized evaluators and Training Officers approve official work; personal entries do not become automatic sign-offs." },
];

export default function FirefighterCareerRecordPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Responder Roadmap",
    url,
    applicationCategory: "EducationalApplication",
    operatingSystem: "iOS, Web",
    description: "A personal firefighter and EMS career record with optional department-connected training and qualification workflows.",
  };

  return (
    <div className="min-h-screen bg-navy-950 text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" aria-label="Responder Roadmap home"><BrandLockup size={44} subtitle="Fire & EMS Career Records" /></Link>
          <Link href="/demo" className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10">Department demo</Link>
        </div>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[.17em] text-sky-300">Firefighter career record app</p>
          <h1 className="display mt-4 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Your career is more than a task book. Keep the whole story.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/70">Training, certifications, experience, leadership, and accomplishments add up over years. Responder Roadmap gives firefighters, EMTs, and paramedics a personal career record they can build independently—and a way to connect that progress to department training when enrolled.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={appStore} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-fire px-6 text-sm font-bold hover:bg-fire-dark">Get the iPhone app <ArrowRight className="h-4 w-4" /></a>
            <Link href="/department-interest?source=firefighter-career-record-app" className="inline-flex min-h-12 items-center rounded-md border border-white/25 px-6 text-sm font-semibold hover:bg-white/10">Connect your department</Link>
          </div>
          <p className="mt-4 text-sm text-white/50">Start with your own history. Department enrollment is optional.</p>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-xs font-bold uppercase tracking-[.17em] text-sky-300">Personal career ownership</p>
            <h2 className="display mt-3 max-w-3xl text-3xl font-bold sm:text-4xl">A career record you build for yourself.</h2>
            <p className="mt-4 max-w-3xl leading-7 text-white/70">Your professional history should not depend on whether you are currently enrolled with a department. Build a personal timeline of your work, learning, and growth. Department-approved records remain distinct from personal entries.</p>
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {personal.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="rounded-xl border border-white/10 bg-navy-950 p-6">
                  <Icon aria-hidden="true" className="h-7 w-7 text-sky-300" />
                  <h3 className="mt-4 text-xl font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/65">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <p className="text-xs font-bold uppercase tracking-[.17em] text-sky-300">One app, two connected uses</p>
          <h2 className="display mt-3 text-3xl font-bold sm:text-4xl">Personal history stays personal. Official records are verified.</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="rounded-xl border border-sky-300/30 bg-sky-300/5 p-7">
              <UserRound className="h-8 w-8 text-sky-300" aria-hidden="true" />
              <h3 className="mt-4 text-2xl font-bold">For individual responders</h3>
              <p className="mt-3 leading-7 text-white/70">Add your own records, reflect on milestones, track certifications, and plan career growth. Use the app without a department connection.</p>
              <p className="mt-5 text-sm font-semibold text-sky-200">Personal entries are self-reported, not department approvals.</p>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[.04] p-7">
              <ShieldCheck className="h-8 w-8 text-emerald-300" aria-hidden="true" />
              <h3 className="mt-4 text-2xl font-bold">For connected departments</h3>
              <p className="mt-3 leading-7 text-white/70">Training Officers assign requirements, instructors document classes, and authorized evaluators review performance and approve official qualification progress.</p>
              <p className="mt-5 text-sm font-semibold text-emerald-200">Department approval stays under department control.</p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="text-xs font-bold uppercase tracking-[.17em] text-sky-300">When your department joins</p>
            <h2 className="display mt-3 text-3xl font-bold sm:text-4xl">From personal progress to documented readiness.</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {department.map(({ title, copy }, i) => (
                <article key={title} className="rounded-xl border border-white/10 bg-navy-950 p-6">
                  <span className="text-xs font-bold text-sky-300">0{i + 1}</span>
                  <h3 className="mt-3 text-xl font-bold">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/65">{copy}</p>
                </article>
              ))}
            </div>
            <Link href="/demo" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md bg-fire px-5 text-sm font-bold hover:bg-fire-dark">Explore the department workflow <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="display text-3xl font-bold sm:text-4xl">Frequently asked questions</h2>
          <div className="mt-7 max-w-4xl divide-y divide-white/10">
            {[
              ["Can I use Responder Roadmap without joining a department?", "Yes. The personal career record is designed for standalone use. Department enrollment adds official assignments, evaluations, and training workflows."],
              ["Is a personal career record the same as an official training record?", "No. Personal records document your own history. Official department qualifications and sign-offs require the department's authorized review and approval."],
              ["Does this replace my department's RMS?", "No. Responder Roadmap supports training, qualifications, and evidence alongside your existing records management process."],
              ["Is it only for firefighters?", "No. Firefighters, EMTs, paramedics, instructors, and aspiring officers can document professional growth."],
            ].map(([question, answer]) => (
              <div key={question} className="py-5">
                <h3 className="text-lg font-bold">{question}</h3>
                <p className="mt-2 leading-7 text-white/65">{answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-navy-900/60">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center">
            <ClipboardCheck className="mx-auto h-9 w-9 text-sky-300" aria-hidden="true" />
            <h2 className="display mt-4 text-3xl font-bold sm:text-4xl">Start keeping the career record that matters to you.</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/65">Keep your personal story organized today. Connect to department training and verified qualifications when you need them.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <a href={appStore} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-md bg-fire px-6 text-sm font-bold hover:bg-fire-dark">Get Responder Roadmap for iPhone</a>
              <Link href="/digital-firefighter-task-books" className="inline-flex min-h-12 items-center rounded-md border border-white/25 px-6 text-sm font-semibold hover:bg-white/10">Explore digital Task Books</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-white/50">
        <span>© {new Date().getFullYear()} Responder Roadmap</span>
        <Link href="/" className="hover:text-white">Home</Link>
      </footer>
    </div>
  );
}
