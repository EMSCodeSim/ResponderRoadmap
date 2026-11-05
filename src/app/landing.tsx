import Image from "next/image";
import { Award, BookOpen, CalendarDays, ClipboardCheck, ClipboardList, GraduationCap, Layers, Users } from "lucide-react";
import { BrandLockup } from "@/components/brand";

const APP_STORE_URL = "https://apps.apple.com/us/app/responder-roadmap/id6800092347";

const card = "rounded-xl border border-white/[0.08] bg-[#121A2A]";
const kicker = "text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300/80";
const heading = "mt-3 max-w-3xl text-[1.9rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.4rem]";
const body = "mt-4 max-w-3xl text-[15px] leading-7 text-white/68";

const capabilities = [
  ["Department requirements", "Define roles, credentials, Task Books, recurring skills, and department training expectations."],
  ["Field documentation", "Members and instructors record classes, skills, evidence, and training hours from the app."],
  ["Human verification", "Authorized evaluators review submitted work and attach each decision to the member record."],
  ["Progress oversight", "Training Officers see incomplete work, follow-up needs, expiring credentials, and approved qualifications."],
];

const workflow = [
  ["Set up", "Build department requirements and reusable Training Sheet templates in the dashboard."],
  ["Complete", "Members perform assigned work and document training from the app."],
  ["Review", "Evaluators examine evidence and sign each required performance."],
  ["Follow", "The dashboard shows approved progress and the work that still needs attention."],
];

const heroCapabilities = [
  { label: "Task Books", icon: BookOpen },
  { label: "Assignments", icon: ClipboardList },
  { label: "Training Sheets", icon: Layers },
  { label: "Qualifications", icon: Award },
];

function DashboardVisual() {
  const members = [
    { name: "Jordan Smith", work: "Probationary Firefighter", progress: "80%", status: "Awaiting review" },
    { name: "Casey Jones", work: "Driver / Operator", progress: "61%", status: "Needs follow-up" },
    { name: "Morgan Garcia", work: "First-Due Company", progress: "100%", status: "Complete" },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-[#F4F6F9] text-[#0C1524] shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between bg-[#111B2C] px-4 py-3 text-white">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/45">Department dashboard</p>
          <p className="mt-1 text-sm font-semibold">Qualification and training overview</p>
        </div>
        <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">Current department view</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Members", "75"],
            ["Review now", "6"],
            ["Follow up", "2"],
            ["Sheets to finish", "14"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">Needs attention</p>
              <span className="text-[10px] text-slate-500">22 items</span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["Review now", "6"],
                ["Follow up", "2"],
                ["Training Sheets", "14"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-[11px]">
                  <span className="font-semibold">{label}</span>
                  <span className="font-bold text-[#C8102E]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-3 py-2.5">
              <p className="text-xs font-bold">Member progress</p>
              <span className="text-[10px] text-slate-500">Approved work</span>
            </div>
            <div className="divide-y divide-slate-100">
              {members.map((member) => (
                <div key={member.name} className="px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold">{member.name}</p>
                      <p className="truncate text-[10px] text-slate-500">{member.work}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600">{member.status}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#C8102E]" style={{ width: member.progress }} />
                    </div>
                    <span className="text-[10px] font-bold">{member.progress}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroDashboardPreview() {
  const metrics = [
    { label: "Members", value: "75", icon: Users, color: "text-sky-300" },
    { label: "In review", value: "6", icon: ClipboardCheck, color: "text-rose-300" },
    { label: "Follow-ups", value: "2", icon: CalendarDays, color: "text-amber-300" },
    { label: "Qualifications", value: "36", icon: GraduationCap, color: "text-emerald-300" },
  ];
  const reviews = ["FF Task Book · Johnson, A.", "EMT Skills · Miller, C.", "Driver/Operator · Reyes, D."];
  const followUps = ["Annual Skills Check · Smith, R.", "PPE Competency · Carter, M.", "EMS Protocol Update · Nguyen, T."];
  const sheets = ["SCBA Donning & Doffing", "Ladder Operations", "Patient Assessment (BLS)"];
  const qualifications = [
    ["Firefighter II", 76],
    ["EMT · Basic", 90],
    ["Driver/Operator", 62],
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#081321]/95 text-white shadow-2xl shadow-black/50 ring-1 ring-white/10 backdrop-blur-sm">
      <div className="flex min-w-0">
        <aside className="hidden w-[132px] shrink-0 flex-col border-r border-white/[0.08] bg-[#091321]/90 p-3 md:flex">
          <div className="mb-5 border-b border-white/[0.08] pb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">Responder</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/75">Roadmap</p>
          </div>
          {[
            ["Dashboard", true],
            ["Members", false],
            ["Qualifications", false],
            ["Task Books", false],
            ["Training Sheets", false],
            ["Assignments", false],
            ["Reports", false],
          ].map(([label, active]) => (
            <div key={String(label)} className={active ? "mb-1 rounded-lg bg-[#C8102E] px-2.5 py-2 text-[10px] font-semibold text-white" : "mb-1 rounded-lg px-2.5 py-2 text-[10px] font-medium text-white/55"}>
              {String(label)}
            </div>
          ))}
        </aside>

        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-sky-200/60">Example department view</p>
              <h2 className="mt-1 truncate text-sm font-semibold sm:text-base">Department Dashboard</h2>
              <p className="mt-1 hidden text-[10px] text-white/45 sm:block">Training, qualifications and competency tracking</p>
            </div>
            <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[9px] font-medium text-white/65">All members⌄</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 sm:p-2.5">
                <div className="flex items-center gap-1.5">
                  <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${color}`} strokeWidth={2} />
                  <span className="truncate text-[9px] font-semibold text-white/50">{label}</span>
                </div>
                <p className="mt-1 text-lg font-bold leading-none sm:text-xl">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-white/[0.08] bg-[#0E1A2B] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold"><ClipboardList aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />Review Queue</h3>
                <span className="text-[9px] text-white/40">6 items</span>
              </div>
              <ul className="space-y-1.5">
                {reviews.map((item) => <li key={item} className="flex min-w-0 items-center justify-between gap-2 text-[9px] text-white/65"><span className="truncate">{item}</span><span className="shrink-0 rounded-full bg-[#C8102E]/20 px-1.5 py-0.5 font-semibold text-rose-200">Review</span></li>)}
              </ul>
            </section>
            <section className="min-w-0 rounded-lg border border-white/[0.08] bg-[#0E1A2B] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5 text-amber-300" />Follow-Ups</h3>
                <span className="text-[9px] text-white/40">2 items</span>
              </div>
              <ul className="space-y-1.5">
                {followUps.map((item) => <li key={item} className="flex min-w-0 items-center justify-between gap-2 text-[9px] text-white/65"><span className="truncate">{item}</span><span className="shrink-0 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-white/55">Due soon</span></li>)}
              </ul>
            </section>
          </div>

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-white/[0.08] bg-[#0E1A2B] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold"><Layers aria-hidden="true" className="h-3.5 w-3.5 text-rose-300" />Training Sheets</h3>
                <span className="text-[9px] text-white/40">14 to finish</span>
              </div>
              <ul className="space-y-1.5">
                {sheets.map((item) => <li key={item} className="flex min-w-0 items-center justify-between gap-2 text-[9px] text-white/65"><span className="truncate">{item}</span><span className="shrink-0 rounded-full bg-emerald-300/10 px-1.5 py-0.5 text-emerald-200">Active</span></li>)}
              </ul>
            </section>
            <section className="min-w-0 rounded-lg border border-white/[0.08] bg-[#0E1A2B] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[10px] font-semibold"><Award aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" />Qualification Progress</h3>
              </div>
              <ul className="space-y-2">
                {qualifications.map(([label, progress]) => (
                  <li key={String(label)} className="grid grid-cols-[82px_1fr_25px] items-center gap-1.5 text-[9px] text-white/65">
                    <span className="truncate">{String(label)}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} /></span>
                    <span className="text-right text-white/75">{progress}%</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberAppVisual() {
  return (
    <div className="mx-auto w-full max-w-[330px] rounded-[2.4rem] border-[7px] border-[#05080E] bg-[#07111F] p-2 shadow-2xl shadow-black/45">
      <div className="overflow-hidden rounded-[1.8rem] bg-[#F4F6F9] text-[#0C1524]">
        <div className="bg-[#111B2C] px-5 pb-4 pt-5 text-white">
          <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/15" />
          <p className="text-[10px] font-semibold uppercase tracking-[.15em] text-white/45">Member app</p>
          <h3 className="mt-1 text-lg font-semibold">My training</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 rounded-lg bg-slate-200 p-1 text-center text-[10px] font-semibold">
            <span className="rounded-md bg-[#C8102E] px-2 py-2 text-white">Assigned</span>
            <span className="px-2 py-2">Task Books</span>
            <span className="px-2 py-2">Completed</span>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold">Apparatus rig check</p>
            <p className="mt-1 text-[10px] text-slate-500">Driver / Operator Task Book · Performance 3 of 5</p>
            <div className="mt-4 space-y-3">
              {[
                ["Inspect fluids and belts", true],
                ["Check emergency lighting", true],
                ["Verify equipment inventory", true],
                ["Document deficiencies", false],
              ].map(([label, complete]) => (
                <div key={String(label)} className="flex items-center gap-2 text-[11px]">
                  <span className={complete ? "flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-white" : "h-5 w-5 rounded border border-slate-300"}>{complete ? "✓" : ""}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <button className="mt-5 w-full rounded-lg bg-[#C8102E] px-3 py-3 text-xs font-bold text-white">Request evaluator signature</button>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold">Quick actions</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[10px] font-semibold">
              <span className="rounded-lg bg-slate-100 px-2 py-3">Join class</span>
              <span className="rounded-lg bg-slate-100 px-2 py-3">Quick log</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0B1220] text-white">
      <header className="border-b border-white/[0.08] bg-[#0B1220]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-5 py-4 sm:gap-4 sm:px-8">
          <BrandLockup size={32} subtitle="Fire & EMS Qualification Tracking" compactOnMobile />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <nav aria-label="Product sections" className="mr-2 hidden items-center gap-5 text-[13px] font-medium text-white/60 lg:flex">
              <a href="#platform" className="hover:text-white">Platform</a>
              <a href="#views" className="hover:text-white">App & dashboard</a>
              <a href="#workflow" className="hover:text-white">Workflow</a>
            </nav>
            <a
              href="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-2 text-[11px] font-semibold text-white/85 transition hover:bg-white/5 hover:text-white sm:px-3.5 sm:text-[13px]"
            >
              Log in
            </a>
            <a
              href="/demo"
              className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#C8102E] px-2 text-[11px] font-semibold text-white transition hover:bg-[#9E0C24] sm:px-3.5 sm:text-[13px]"
            >
              See Demo
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#081321]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[url('/images/roadmap-homepage-bg.webp')] bg-cover bg-[position:48%_center] md:bg-center" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#07111f]/75 via-[#07111f]/55 to-[#07111f]/90 md:bg-gradient-to-r md:from-[#07111f]/40 md:via-[#07111f]/70 md:to-[#07111f]/80" />
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-12 lg:grid-cols-[.86fr_1.14fr] lg:gap-12 lg:pb-16 lg:pt-14">
          <div>
            <p className={kicker}>Qualification and competency tracking for Fire & EMS</p>
            <h1 className="mt-4 max-w-xl text-[2.5rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Connect field training to verified department qualifications.
            </h1>
            <span aria-hidden="true" className="mt-6 block h-1 w-20 rounded-full bg-[#C8102E]" />
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/80">
              Manage department requirements, Task Books, Training Sheets and approvals in one connected platform.
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {heroCapabilities.map(({ label, icon: Icon }) => (
                <div key={label} className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#081321]/55 px-2 py-3 text-center text-[12px] font-semibold text-white shadow-lg shadow-black/10 backdrop-blur-sm sm:text-[13px]">
                  <Icon aria-hidden="true" className="h-5 w-5 text-rose-400" strokeWidth={1.8} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <HeroDashboardPreview />
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624] px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-6xl">
            <p className={kicker}>Current product</p>
            <h2 className={heading}>The dashboard and member app share one department training record.</h2>
            <p className={body}>
              Training Officers organize the department from the dashboard. Members and evaluators document and review work from the app. Approved work flows back into the same progress and qualification view.
            </p>
            <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#111B2C] shadow-2xl shadow-black/30">
              <Image
                src="/showcase/dashboard-phone-artwork.jpg"
                alt="Responder Roadmap department dashboard and member app working together"
                width={1672}
                height={941}
                priority
                unoptimized
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section id="views" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>Up-to-date product views</p>
          <h2 className={heading}>See what each person uses.</h2>
          <p className={body}>These current product previews show the department oversight view and the field workflow members use to complete and submit work.</p>

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.2fr_.8fr]">
            <figure className={card}>
              <div className="p-4 sm:p-5"><DashboardVisual /></div>
              <figcaption className="border-t border-white/[0.08] p-5">
                <h3 className="font-semibold">Training Officer dashboard</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">Review needs attention, open member progress, manage department requirements, and follow training that still needs documentation.</p>
              </figcaption>
            </figure>
            <figure className={card}>
              <div className="p-5 sm:p-7"><MemberAppVisual /></div>
              <figcaption className="border-t border-white/[0.08] p-5">
                <h3 className="font-semibold">Member and evaluator app</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">Complete assigned skills, document repeated performances, join Training Sheets, and request evaluator signatures from the field.</p>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="platform" className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
            <p className={kicker}>Department defined</p>
            <h2 className={heading}>Built around the way your department qualifies people.</h2>
            <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {capabilities.map(([title, description], index) => (
                <article key={title} className={card + " p-6"}>
                  <span className="text-[11px] font-semibold text-white/30">{(index + 1).toString().padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/58">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <p className={kicker}>Connected workflow</p>
          <h2 className={heading}>From assigned requirement to verified record.</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(([title, description], index) => (
              <article key={title} className={card + " p-6"}>
                <span className="text-[11px] font-semibold text-sky-300/70">Step {(index + 1).toString()}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/58">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/[0.08] bg-[#0E1624]">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:py-20">
            <article>
              <p className={kicker}>Training Sheets</p>
              <h2 className="mt-3 text-2xl font-semibold">Document classes quickly in the field.</h2>
              <p className="mt-4 text-sm leading-7 text-white/60">Start from department templates, add rosters by QR or department membership, record checklists and grading, then finish objectives, hours, narrative, and RMS codes.</p>
            </article>
            <article>
              <p className={kicker}>Task Books and Assignments</p>
              <h2 className="mt-3 text-2xl font-semibold">Track repeated skills and required signatures.</h2>
              <p className="mt-4 text-sm leading-7 text-white/60">Require a performance more than once, keep each completion on its own date, and require an evaluator signature for every performance before the requirement is complete.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 px-5 py-8 text-[13px] text-white/45 sm:px-8 md:flex-row md:items-center">
          <div>
            <p className="font-medium text-white/75">Responder Roadmap</p>
            <p className="mt-1">Department qualifications, competency tracking, and field training records for Fire & EMS.</p>
          </div>
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className="font-medium text-white/65 hover:text-white">Responder Roadmap for iPhone</a>
        </div>
      </footer>
    </div>
  );
}
