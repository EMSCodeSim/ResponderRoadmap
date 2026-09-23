import Link from "next/link";
import { DEMO_ATTENTION, DEMO_DEPARTMENT_NAME, DEMO_MEMBERS, DEMO_SUMMARY } from "@/lib/demo-story";

const statusClass: Record<string, string> = {
  "On Track": "bg-emerald-50 text-emerald-800",
  "Awaiting Evaluation": "bg-amber-50 text-amber-800",
  "Needs Attention": "bg-rose-50 text-rose-800",
  Completed: "bg-slate-100 text-slate-700",
};

export function DashboardPreview({ href, compact = false }: { href: string; compact?: boolean }) {
  const rows = compact ? DEMO_MEMBERS.slice(0, 5) : DEMO_MEMBERS;
  return (
    <div className="overflow-hidden rounded-lg border border-white/15 bg-[#F3F5F8] text-[#0C1524] shadow-[0_16px_40px_rgba(0,0,0,.28)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#D6DDE8] bg-[#0C1524] px-4 py-3 text-[11px] font-semibold text-white/80">
        <span>{DEMO_DEPARTMENT_NAME} · Training Officer</span>
        <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-emerald-200">Live product preview</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#5A7196]">Home</p>
        <h3 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">Department progress</h3>
        <p className="mt-1 text-xs text-[#5A7196]">One screen tells you what is happening in the department.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            ["Members", DEMO_SUMMARY.members],
            ["Active Task Books", DEMO_SUMMARY.activeTaskBooks],
            ["Active Assignments", DEMO_SUMMARY.activeAssignments],
            ["Awaiting Evaluation", DEMO_SUMMARY.awaitingEvaluation],
            ["Needs Attention", DEMO_SUMMARY.needsAttention],
          ].map(([label, value], index) => (
            <div key={label} className="rounded-lg border border-[#D6DDE8] bg-white px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wide text-[#5A7196]">{label}</div>
              <div className={`mt-1 text-2xl font-bold ${index >= 3 ? "text-[#C47A0A]" : "text-[#0C1524]"} ${label === "Needs Attention" ? "text-[#B42318]" : ""}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-[#D6DDE8] bg-white p-3">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#5A7196]">Do this next</p>
              <h4 className="text-sm font-bold">Needs My Attention</h4>
            </div>
            <span className="text-[11px] font-semibold text-[#5A7196]">{DEMO_ATTENTION.length} actions</span>
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {DEMO_ATTENTION.slice(0, 4).map((item) => (
              <li key={item.id} className={`rounded-md border px-3 py-2 ${item.kind === "follow-up" ? "border-rose-200 bg-rose-50/70" : "border-amber-200 bg-amber-50/70"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.memberName}</p>
                    <p className="truncate text-[11px] text-[#3A5278]">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold">{item.action}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-[#D6DDE8] bg-white">
          <div className="flex items-center justify-between px-3 py-2">
            <h4 className="text-sm font-bold">Member Progress</h4>
            <span className="text-[11px] text-[#5A7196]">Progress visibility — not a score</span>
          </div>
          <div className="hidden sm:block">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#F3F5F8] text-[10px] uppercase tracking-wide text-[#5A7196]">
                <tr>
                  <th className="px-3 py-2 font-semibold">Member</th>
                  <th className="px-3 py-2 font-semibold">Current Work</th>
                  <th className="px-3 py-2 font-semibold">Progress</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[#E6EAF0]">
                    <td className="px-3 py-2 font-semibold">{row.name}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-[#3A5278]">{row.currentWork}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E6EAF0]">
                          <span className="block h-full bg-[#C8102E]" style={{ width: `${row.percent}%` }} />
                        </span>
                        {row.percent}%
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass[row.status]}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-[#E6EAF0] sm:hidden">
            {rows.map((row) => (
              <li key={row.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{row.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass[row.status]}`}>{row.status}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#3A5278]">{row.currentWork} · {row.percent}%</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D6DDE8] bg-white px-4 py-3 text-[11px] text-[#5A7196]">
        <span>Fictional {DEMO_DEPARTMENT_NAME} records · not a customer department</span>
        <Link href={href} className="font-bold text-[#C8102E] underline underline-offset-4">See it in the demo →</Link>
      </div>
    </div>
  );
}
