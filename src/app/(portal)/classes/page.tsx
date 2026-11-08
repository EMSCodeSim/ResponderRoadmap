"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { EMS_CE_CATEGORIES, emsCreditSummary } from "@/lib/ems-ce-categories";

type ClassRow = {
  id: string;
  title: string;
  classType: string;
  trainingCategory: string;
  creditHours: number;
  checklistTitle: string;
  checklistVersion: string;
  startsAt: string;
  location: string;
  status: string;
  rmsStatus: string;
  instructorApprovedAt: string | null;
  rmsEnteredAt: string | null;
  rosterCount: number;
  completeCount: number;
  proctors: string[];
};

type SignedRequirement = { id: string; title: string; completion?: { status: string; completedAt?: string | null; evidence?: Array<{ id: string }>; signOffs?: Array<{ id: string; result: string; evaluatorName: string; signedAt: string; approvalLevel: string }> } | null };
type SourceDetail = { sections: Array<{ title: string; requirements: SignedRequirement[] }> };
type SourceAssignment = { id: string; templateId: string; memberName: string; progress: number; status: string; complete: number; totalRequired: number; pendingApproval: number }; 
type CEAllocation = { category: string; hours: number };
type GradingConfig = { writtenTestEnabled: boolean; writtenTestPassPercent: number | null; ccfEnabled: boolean; ccfPassPercent: number | null };
type TrainingSheetTemplate = { id: string; name: string; defaultTitle: string; classType: string; trainingCategory: string; topic: string; creditHours: number; checklistVersionId: string | null; location: string; notes: string; selfRegistration: boolean; proctorUserIds: string[]; ceCredits: CEAllocation[]; gradingConfig: GradingConfig; };

type Setup = {
  checklists: Array<{ id: string; title: string; version: string; skillCount: number }>;
  members: Array<{ id: string; name: string; rank: string | null }>;
  proctors: Array<{ userId: string; name: string; role: string }>;
  requiredFields: string[];
};

const emptyForm = {
  title: "",
  classType: "GENERAL",
  checklistVersionId: "",
  trainingCategory: "COMPANY",
  creditHours: "",
  startsAt: "",
  endsAt: "",
  location: "",
  notes: "",
  membershipIds: [] as string[],
  selfRegistration: false,
  proctorUserIds: [] as string[],
};

export default function ClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [sourceAssignments, setSourceAssignments] = useState<SourceAssignment[] | null>(null);
  const [sourceAssignmentError, setSourceAssignmentError] = useState("");
  const [selectedSourceMember, setSelectedSourceMember] = useState("");
  const [selectedSourceDetail, setSelectedSourceDetail] = useState<SourceDetail | null>(null);
  const [sourceDetailBusy, setSourceDetailBusy] = useState(false);
  const [sourceDetailError, setSourceDetailError] = useState("");
  async function reviewSourceMember(id: string) {
    setSelectedSourceMember(id);
    setSelectedSourceDetail(null);
    setSourceDetailError("");
    setSourceDetailBusy(true);
    try { setSelectedSourceDetail(await api<SourceDetail>(`assignments/${encodeURIComponent(id)}`)); }
    catch { setSourceDetailError("Unable to read signed evaluation details for this member."); }
    finally { setSourceDetailBusy(false); }
  }
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [sheetFilter, setSheetFilter] = useState("all");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [templates, setTemplates] = useState<TrainingSheetTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [showRosterSetup, setShowRosterSetup] = useState(false);
  const [showChecklistSetup, setShowChecklistSetup] = useState(false);
  const [showTemplateSetup, setShowTemplateSetup] = useState(false);
  const [templateCategory, setTemplateCategory] = useState("");
  const [emsCeMode, setEmsCeMode] = useState(false);
  const [emsCredits, setEmsCredits] = useState<Record<string, number>>({});
  const [form, setForm] = useState(emptyForm);
  const [stationChecklistIds, setStationChecklistIds] = useState<string[]>([]);
  const [stationProctors, setStationProctors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const quickAddOpened = useRef(false);
  const templateOpened = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setRows(await api<ClassRow[]>("classes"));
    api<Setup>("classes/setup").then(setSetup).catch(() => setSetup(null));
    api<TrainingSheetTemplate[]>("training-sheet-templates").then(setTemplates).catch(() => setTemplates([]));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load classes."));
    if (new URLSearchParams(window.location.search).get("status") === "complete") setSheetFilter("complete");
  }, []);

  useEffect(() => {
    if (!setup || quickAddOpened.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("quick") !== "1" && params.get("mode") !== "class") return;
    quickAddOpened.current = true;
    openTraining(params.get("quick") === "1");
  }, [setup]);

  useEffect(() => {
    if (!setup) return;
    const params = new URLSearchParams(window.location.search);
    const sourceId = params.get("sourceTaskBookId");
    if (!sourceId || params.get("quick") !== "1") return;
    let cancelled = false;
    api<{ id: string; title: string; status: string; templateKind?: string }>(`task-books/${encodeURIComponent(sourceId)}`)
      .then((source) => {
        if (cancelled) return;
        if (source.id !== sourceId || source.status !== "ACTIVE" || source.templateKind === "TRAINING_TASK") {
          setError("Only published Task Books can be used as a Training Sheet source.");
          return;
        }
        const sourceTitle = source.title.trim().slice(0, 160) || "Task Book skills training";
        setForm((previous) => ({
          ...previous,
          title: sourceTitle,
          notes: `Source Task Book: ${sourceTitle} (ID: ${source.id}). Verify attendance and evaluation evidence before awarding credit. Do not count previously recorded training hours twice.`,
        }));
      })
      .catch(() => { if (!cancelled) setError("Unable to verify the source Task Book. Start from a published Task Book you can access."); });
    return () => { cancelled = true; };
  }, [setup]);

  useEffect(() => {
    const sourceId = new URLSearchParams(window.location.search).get("sourceTaskBookId");
    if (!sourceId) return;
    let cancelled = false;
    api<SourceAssignment[]>("assignments")
      .then((items) => { if (!cancelled) setSourceAssignments(items.filter((item) => item.templateId === sourceId)); })
      .catch(() => { if (!cancelled) setSourceAssignmentError("Assignment summary unavailable. Review Task Book records before awarding credit."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (templateOpened.current || !setup || !templates.length) return;
    const id = new URLSearchParams(window.location.search).get("template");
    if (!id) return;
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    templateOpened.current = true;
    quickAddOpened.current = true;
    openTraining(false);
    setSelectedTemplateId(id);
    setShowTemplateSetup(true);
    setShowChecklistSetup(true);
    setTemplateCategory(template.topic || "OTHER");
    setEmsCeMode((template.ceCredits || []).length > 0);
    setEmsCredits(Object.fromEntries((template.ceCredits || []).map((item) => [item.category, item.hours])));
    setForm({
      ...emptyForm,
      title: (template.ceCredits || []).length ? "" : template.defaultTitle || template.name,
      classType: template.classType,
      trainingCategory: template.trainingCategory,
      creditHours: template.creditHours ? String(template.creditHours) : "",
      checklistVersionId: template.checklistVersionId || "",
      location: template.location,
      notes: template.notes,
      selfRegistration: template.selfRegistration,
      proctorUserIds: template.proctorUserIds,
    });
  }, [setup, templates]);

  function toggle(key: "membershipIds" | "proctorUserIds", id: string) {
    const values = form[key];
    setForm({ ...form, [key]: values.includes(id) ? values.filter((item) => item !== id) : [...values, id] });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (form.classType === "CPR" && !form.checklistVersionId && !emsCeMode) {
        throw new Error("Select the department's published CPR skills checklist before creating this class.");
      }
      const total = Object.values(emsCredits).reduce((sum, hours) => sum + hours, 0);
      if (emsCeMode && total > 24) throw new Error("EMS credits cannot exceed 24 hours per training sheet.");
      const ceCredits = emsCeMode
        ? Object.entries(emsCredits).filter(([, hours]) => hours > 0).map(([category, hours]) => ({ category, hours }))
        : undefined;
      const payload = emsCeMode
        ? { ...form, classType: "EMS", trainingCategory: "EMS", creditHours: total, ceCredits,
            notes: [emsCreditSummary(emsCredits), form.notes.trim()].filter(Boolean).join("\n\n") }
        : form;
      const stations = stationChecklistIds.map((id, index) => ({ checklistVersionId: id, title: setup?.checklists.find((item) => item.id === id)?.title || `Station ${index + 1}`, proctorUserId: stationProctors[id] || form.proctorUserIds[0] || "" }));
      const created = await api<{ id: string }>("classes", { method: "POST", body: JSON.stringify({ ...payload, stations, ceCredits, trainingSheetTemplateId: selectedTemplateId || undefined }) });
      window.location.href = `/classes/${created.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create class.");
      setBusy(false);
    }
  }

  function localDateTimeNow() {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }

  function openTraining(quick = false) {
    const currentUser = setup?.proctors.find((item) => item.role === "TRAINING_OFFICER" || item.role === "DEPARTMENT_ADMINISTRATOR" || item.role === "INSTRUCTOR" || item.role === "EVALUATOR");
    setQuickMode(quick);
    setEmsCeMode(false);
    setEmsCredits({});
    setSelectedTemplateId("");
    setStationChecklistIds([]);
    setStationProctors({});
    setShowAdvancedSetup(false);
    setShowRosterSetup(false);
    setShowChecklistSetup(false);
    setShowTemplateSetup(false);
    setTemplateCategory("");
    setForm({ ...emptyForm, startsAt: localDateTimeNow(), selfRegistration: true, proctorUserIds: currentUser ? [currentUser.userId] : [] });
    setOpen(true);
  }

  function applyTemplate(id: string) {
    setSelectedTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setTemplateCategory(template.topic || "OTHER");
    const allocations = template.ceCredits || [];
    setEmsCeMode(allocations.length > 0);
    setEmsCredits(Object.fromEntries(allocations.map((item) => [item.category, item.hours])));
    setForm((current) => ({ ...current, title: allocations.length ? "" : template.defaultTitle || template.name, classType: template.classType, trainingCategory: template.trainingCategory, creditHours: template.creditHours ? String(template.creditHours) : "", checklistVersionId: template.checklistVersionId || "", location: template.location, notes: template.notes, selfRegistration: quickMode ? true : template.selfRegistration, proctorUserIds: template.proctorUserIds }));
  }

  const visibleRows = useMemo(() => rows.filter((row) => {
    const matchesSearch = [row.title, row.location, row.trainingCategory, row.classType].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()));
    const matchesStatus = sheetFilter === "all" || (sheetFilter === "approved" && Boolean(row.instructorApprovedAt)) || (sheetFilter === "complete" && row.status === "COMPLETE") || (sheetFilter === "pending" && row.status !== "COMPLETE") || (sheetFilter === "rms-entered" && row.rmsStatus === "RMS_ENTERED") || (sheetFilter === "rms-needed" && row.rmsStatus !== "RMS_ENTERED" && row.status !== "CANCELLED");
    return matchesSearch && matchesStatus;
  }).sort((a, b) => sort === "oldest" ? new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() : new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()), [rows, search, sort, sheetFilter]);


  return (
    <div>
      <PageHeader
        kicker="Training delivery"
        title="Training Sheets"
        description="Manage classes, drills, attendance, QR rosters, evaluations, training sheets, and RMS handoff."
        actions={<div className="flex flex-wrap gap-2"><Link href="/training-sheet-templates" className="inline-flex min-h-11 items-center rounded-md border border-navy-300 bg-white px-4 py-2 text-sm font-semibold text-navy-900 hover:bg-navy-50">Training templates</Link>{setup ? <><Button onClick={() => openTraining(true)} className="md:hidden">Quick training</Button><Button onClick={() => openTraining(false)}>Create training</Button></> : null}</div>}
      />
      <Flash message={error} tone="danger" />
      {setup ? <button type="button" onClick={() => openTraining(true)} className="fixed bottom-20 right-4 z-40 flex min-h-14 items-center rounded-full bg-fire px-5 text-sm font-bold text-white shadow-lg md:hidden" aria-label="Create quick training sheet">+ Quick training</button> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Input aria-label="Search training events" placeholder="Search class or training sheet…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select aria-label="Sort training events by date" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
        <Select aria-label="Filter training sheet status" value={sheetFilter} onChange={(event) => setSheetFilter(event.target.value)}>
          <option value="all">All training sheets</option>
          <option value="complete">Completed</option>
          <option value="pending">Not completed</option>
          <option value="approved">Instructor approved</option>
          <option value="rms-needed">RMS actions needed</option>
          <option value="rms-entered">Entered into RMS</option>
        </Select>
      </div>
      <div className="mb-2 text-sm text-navy-500">{visibleRows.length} of {rows.length} training sheets</div>
      <p className="mb-3 text-xs text-navy-600">Training completed, instructor approved, and entered into RMS are separate milestones. Only the RMS entry confirms the department’s official RMS record.</p>
      <div className="space-y-2 md:hidden">
        {visibleRows.map(row => <Link key={row.id} href={`/classes/${row.id}`} className="block rounded-lg border border-navy-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2"><span className="font-semibold text-navy-900">{row.title}</span><span className="text-xs text-navy-500">{formatDate(row.startsAt)}</span></div>
          <div className="mt-2 text-xs text-navy-600">Roster {row.completeCount}/{row.rosterCount}</div>
          <div className="mt-2 flex flex-wrap gap-2"><Badge tone={row.status === "COMPLETE" ? "current" : "info"}>{row.status === "COMPLETE" ? "Training completed" : "Training not completed"}</Badge><Badge tone={row.instructorApprovedAt ? "current" : "warn"}>{row.instructorApprovedAt ? "Instructor approved" : "Instructor not approved"}</Badge><Badge tone={row.rmsStatus === "RMS_ENTERED" ? "current" : "warn"}>{row.rmsStatus === "RMS_ENTERED" ? "Entered into RMS" : "Not entered into RMS"}</Badge></div>
          <div className="mt-3 text-sm font-semibold text-fire">Open details →</div>
        </Link>)}
        {visibleRows.length === 0 ? <p className="py-5 text-center text-sm text-navy-500">No matching training sheets.</p> : null}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-navy-200 bg-white md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-navy-50 text-navy-700"><tr>
            <th className="px-4 py-3 font-semibold">Date</th>
            <th className="px-4 py-3 font-semibold">Training event</th>
            <th className="px-4 py-3 font-semibold">Roster</th>
            <th className="px-4 py-3 font-semibold">Training</th>
            <th className="px-4 py-3 font-semibold">Instructor</th>
            <th className="px-4 py-3 font-semibold">RMS status</th>
            <th className="px-4 py-3 font-semibold">Record</th>
          </tr></thead>
          <tbody className="divide-y divide-navy-100">
            {visibleRows.map((row) => (
              <tr key={row.id} className="hover:bg-navy-50/60">
                <td className="whitespace-nowrap px-4 py-3">{formatDate(row.startsAt)}</td>
                <td className="px-4 py-3"><Link href={`/classes/${row.id}`} className="font-semibold text-navy-900 hover:text-fire hover:underline">{row.title}</Link><div className="text-xs text-navy-500">{row.trainingCategory.replaceAll("_", " ")}{row.location ? ` · ${row.location}` : ""}</div></td>
                <td className="whitespace-nowrap px-4 py-3">{row.completeCount}/{row.rosterCount}</td>
                <td className="px-4 py-3"><Badge tone={row.status === "COMPLETE" ? "current" : row.status === "ACTIVE" ? "info" : "neutral"}>{row.status === "COMPLETE" ? "Completed" : row.status === "ACTIVE" ? "In progress" : row.status === "DRAFT" ? "Draft" : row.status === "CANCELLED" ? "Cancelled" : row.status}</Badge></td>
                <td className="px-4 py-3"><Badge tone={row.instructorApprovedAt ? "current" : "warn"}>{row.instructorApprovedAt ? "Approved" : "Not approved"}</Badge></td>
                <td className="px-4 py-3"><Badge tone={row.rmsStatus === "RMS_ENTERED" ? "current" : row.rmsStatus === "ACTIONS_NEEDED" ? "warn" : "neutral"}>{row.rmsStatus === "RMS_ENTERED" ? "Entered into RMS" : row.rmsStatus === "ACTIONS_NEEDED" ? "Action needed" : "Not ready"}</Badge></td>
                <td className="px-4 py-3"><Link href={`/classes/${row.id}`} className="font-semibold text-fire underline">Open</Link></td>
              </tr>
            ))}
            {visibleRows.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-navy-500">{rows.length === 0 ? "No training events yet." : "No training events match these filters."}</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Modal open={open} title={quickMode ? "Quick training — field entry" : "Create digital training sheet"} onClose={() => setOpen(false)} wide>
        <form onSubmit={create} className="space-y-5">
          {sourceAssignments ? (
            <div className="rounded-lg border border-navy-200 bg-white p-3" aria-label="Source Task Book assignment review">
              <h3 className="font-semibold text-navy-900">Source Task Book progress</h3>
              <p className="mt-1 text-sm text-navy-600">{sourceAssignments.length} assigned member records · {sourceAssignments.filter((item) => item.status === "COMPLETE").length} complete. Progress is for reference only, not imported evaluations or attendance.</p>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                {sourceAssignments.slice(0, 25).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 py-1"><span>{item.memberName}</span><span>{item.complete}/{item.totalRequired} requirements · {item.pendingApproval} awaiting approval <button type="button" className="ml-2 font-semibold text-fire underline" onClick={() => reviewSourceMember(item.id)} aria-label={`Review signed evaluations for ${item.memberName}`}>Review sign-offs</button></span></li>)}
              </ul>
              {sourceDetailBusy ? <p className="mt-2 text-sm">Loading signed evaluations…</p> : null}
              {sourceDetailError ? <p role="alert" className="mt-2 text-sm text-warn">{sourceDetailError}</p> : null}
              {selectedSourceDetail ? <div className="mt-3 rounded-md border border-navy-200 p-3">
                <h4 className="font-semibold">Signed evaluation records</h4>
                <p className="text-xs text-navy-500">Read-only source evidence for {sourceAssignments.find((item) => item.id === selectedSourceMember)?.memberName}. These records are not yet imported into the Training Sheet.</p>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {selectedSourceDetail.sections.flatMap((section) => section.requirements).filter((req) => req.completion?.signOffs?.length).map((req) =>
                    <li key={req.id} className="border-b border-navy-100 pb-2"><span className="font-medium">{req.title}</span>
                      {req.completion?.signOffs?.map((sign) => <div key={sign.id} className="text-xs text-navy-600">{sign.result} · {sign.evaluatorName} · {new Date(sign.signedAt).toLocaleDateString()} · {sign.approvalLevel}</div>)}
                    </li>)}
                </ul>
              </div> : null}
              {sourceAssignments.length > 25 ? <p className="mt-2 text-xs text-navy-500">Showing first 25 members.</p> : null}
            </div>
          ) : null}
          {sourceAssignmentError ? <p role="alert" className="text-sm text-warn">{sourceAssignmentError}</p> : null}
          {new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).has("sourceTaskBookId") ? (
            <div className="rounded-lg border border-navy-200 bg-navy-50 p-3 text-sm text-navy-800" role="note">Linked Task Book reference. This pre-fills the title and source reference only. Attendance, signed evaluations, and hours are not automatically transferred; verify them before saving.</div>
          ) : null}
          {quickMode ? <div className="rounded-lg border border-fire/30 bg-fire-soft p-4"><div className="font-semibold text-navy-900">Quick Training Sheet</div><p className="mt-1 text-sm text-navy-600">Enter a title and start time to begin. Templates, checklists, roster selection, hours, end time and RMS documentation can be completed later.</p></div> : null}
          {showAdvancedSetup ? <label className="flex min-h-12 items-center gap-3 rounded-lg border border-navy-200 p-3 font-semibold">
            <input type="checkbox" checked={emsCeMode} onChange={(event) => {
              setEmsCeMode(event.target.checked);
              if (event.target.checked) setForm((current) => ({ ...current, classType: "EMS", trainingCategory: "EMS", selfRegistration: true }));
            }} />
            EMS Continuing Education Training Sheet
          </label> : null}
          {emsCeMode && showAdvancedSetup ? <section aria-label="EMS continuing education credits" className="space-y-3 rounded-lg border border-navy-200 p-4">
            <h3 className="text-lg font-bold">EMS credit categories</h3>
            <p className="text-sm text-navy-600">Assign hours to one or more topics. Only nonzero categories appear on the saved sheet. Credit hours total automatically.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(EMS_CE_CATEGORIES).map((category) => <Field key={category} label={category}>
                <Input aria-label={`${category} credit hours`} type="number" min="0" max="24" step="0.25" value={emsCredits[category] ?? ""} placeholder="0" onChange={(event) => {
                  const value = event.target.value === "" ? 0 : Number(event.target.value);
                  setEmsCredits((current) => ({ ...current, [category]: Number.isFinite(value) && value >= 0 ? value : 0 }));
                }} />
              </Field>)}
            </div>
            <div className="font-bold">Total EMS CE credit: {Object.values(emsCredits).reduce((sum, hours) => sum + hours, 0).toFixed(2)} hours</div>
          </section> : null}
          <section className="rounded-lg border border-navy-200 p-4 space-y-3">
            <label className="flex items-center gap-3 font-bold"><input type="checkbox" checked={showTemplateSetup} onChange={(event) => setShowTemplateSetup(event.target.checked)} /> Use a training template (optional)</label>
            {showTemplateSetup ? <>
            <h3 className="text-sm font-semibold">Choose Fire, EMS, HazMat or another template</h3>
            <Field label="Topic"><Select value={templateCategory} onChange={(event) => {
              const topic = event.target.value;
              const category = ({ EMS: "EMS", FIRE: "COMPANY", HAZMAT: "HAZMAT", DRIVER: "DRIVER", CPR: "EMS", OFFICER: "OFFICER", FACILITY: "FACILITY", OTHER: "OTHER" } as Record<string, string>)[topic] || "COMPANY";
              setTemplateCategory(topic); setSelectedTemplateId("");
              setForm((current) => ({ ...current, trainingCategory: category, checklistVersionId: "" }));
              setEmsCeMode(false); setEmsCredits({});
            }}>
              <option value="">Choose a topic</option>
              <option value="EMS">EMS</option><option value="FIRE">Fire</option><option value="HAZMAT">HazMat</option><option value="DRIVER">Driver Operator</option><option value="CPR">CPR</option><option value="OFFICER">Officer</option><option value="FACILITY">Facility</option><option value="OTHER">Other</option>
            </Select></Field>
            <Field label="Department training template"><Select value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)}><option value="">Blank sheet</option>{templates.filter((item) => !templateCategory || (item.topic || "OTHER") === templateCategory).sort((a, b) => a.name.localeCompare(b.name)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
            <p className="text-xs text-navy-600">Templates prefill class details, skills checklist and any custom student results. You can add students now or let them scan the QR code after creation.</p>
            </> : null}
          </section>
          <button type="button" className="w-full rounded-lg border border-navy-200 p-3 text-left text-sm font-semibold" onClick={() => setShowAdvancedSetup((value) => !value)}>{showAdvancedSetup ? "− Hide" : "+ Show"} advanced setup (codes, hours, proctors and objectives)</button>
          {setup?.requiredFields?.length ? <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-sm"><span className="font-semibold">RMS-ready record:</span> department-required RMS fields are validated when the instructor finishes the training sheet, not before teaching.</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Training title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Fire Academy Skills Day 4" required /></Field>
            {showAdvancedSetup ? <Field label="Class type">
              <Select value={form.classType} onChange={(e) => setForm({ ...form, classType: e.target.value })}>
                <option value="GENERAL">General skills class</option>
                <option value="FIRE_ACADEMY">Fire academy testing</option>
                <option value="CPR">CPR class</option>
                <option value="EMS">EMS skills testing</option>
              </Select>
            </Field> : null}
            {showAdvancedSetup ? <Field label="Training-hours category">
              <Select value={form.trainingCategory} onChange={(e) => setForm({ ...form, trainingCategory: e.target.value })}>
                <option value="COMPANY">Company training</option>
                <option value="FACILITY">Facility training</option>
                <option value="HAZMAT">HazMat</option>
                <option value="DRIVER">Driver / apparatus</option>
                <option value="OFFICER">Officer development</option>
                <option value="EMS">EMS</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field> : null}
            {showAdvancedSetup ? <Field label="Credit hours" hint="Leave blank to use the time between Starts and Ends.">
              <Input type="number" min="0" max="24" step="0.25" value={emsCeMode ? String(Object.values(emsCredits).reduce((sum, hours) => sum + hours, 0)) : form.creditHours} disabled={emsCeMode} onChange={(e) => setForm({ ...form, creditHours: e.target.value })} placeholder="2.0" />
            </Field> : null}
            {(showChecklistSetup || Boolean(form.checklistVersionId)) ? <Field label="Skills checklist" hint="Optional. Leave blank for attendance-only training such as company drills or classroom training.">
              <Select value={form.checklistVersionId} onChange={(e) => setForm({ ...form, checklistVersionId: e.target.value })}>
                <option value="">No checklist — attendance/training record only</option>
                {setup?.checklists.map((item) => <option key={item.id} value={item.id}>{item.title} v{item.version} · {item.skillCount} skills</option>)}
              </Select>
            </Field> : null}
            <Field label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Station, classroom, or training site" /></Field>
            <Field label="Training date and start time"><Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} required /></Field>
            {showAdvancedSetup ? <Field label="Ends (finish after teaching)"><Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></Field> : null}
          </div>
          {showAdvancedSetup ? <Field label="Optional preparation notes" hint="Use this for topic, objectives, drill description, or information that would normally appear on the paper training sheet.">
            <TextArea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Topic, objectives, skills covered, instructor notes…" />
          </Field> : null}
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-navy-200 p-3 text-sm font-semibold"><input type="checkbox" checked={showChecklistSetup} onChange={(event) => setShowChecklistSetup(event.target.checked)} /> Add a skills checklist now (optional)</label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-navy-200 p-3 text-sm font-semibold"><input type="checkbox" checked={showRosterSetup} onChange={(event) => setShowRosterSetup(event.target.checked)} /> Select department members now (optional)</label>
          {showRosterSetup ? <h3 className="font-bold">Add participants</h3> : null}
          <label className="flex min-h-12 items-center gap-3 rounded-lg border border-fire/30 bg-fire-soft p-4 text-sm font-semibold">
            <input type="checkbox" checked={form.selfRegistration} onChange={(event) => setForm({ ...form, selfRegistration: event.target.checked })} />
            Enable QR sign-in (print or display QR from the sheet after creation)
          </label>
          {showRosterSetup || showAdvancedSetup ? <div className={`grid gap-5 ${quickMode ? "" : "md:grid-cols-2"}`}>
            <Field label={`Roster (${form.membershipIds.length})`} hint={form.selfRegistration ? "Optional: pre-add department members." : "Select students or enable QR registration."}>
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.members.map((member) => (
                  <label key={member.id} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.membershipIds.includes(member.id)} onChange={() => toggle("membershipIds", member.id)} />
                    <span>{member.name}{member.rank ? ` · ${member.rank}` : ""}</span>
                  </label>
                ))}
              </div>
            </Field>
            {showAdvancedSetup ? <Field label={`Proctors (${form.proctorUserIds.length})`} hint="Evaluators see only classes to which they are assigned.">
              <div className="max-h-64 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
                {setup?.proctors.map((proctor) => (
                  <label key={proctor.userId} className="flex min-h-11 items-center gap-3 rounded px-2 hover:bg-navy-50">
                    <input type="checkbox" checked={form.proctorUserIds.includes(proctor.userId)} onChange={() => toggle("proctorUserIds", proctor.userId)} />
                    <span>{proctor.name} · {proctor.role.toLowerCase().replaceAll("_", " ")}</span>
                  </label>
                ))}
              </div>
            </Field> : null}
          </div> : null}
          {showAdvancedSetup ? <section className="rounded-lg border border-navy-200 p-4 space-y-3">
            <h3 className="font-bold">Stations and assigned proctors</h3>
            <p className="text-sm text-navy-600">Select checklists for this class and assign an authorized proctor to each station. Each station keeps its own skill results.</p>
            <div className="max-h-56 space-y-1 overflow-auto rounded-md border border-navy-200 p-2">
              {setup?.checklists.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-3 px-2">
                <input type="checkbox" checked={stationChecklistIds.includes(item.id)} onChange={(event) => {
                  setStationChecklistIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id));
                  if (event.target.checked && form.proctorUserIds[0]) setStationProctors((current) => ({ ...current, [item.id]: current[item.id] || form.proctorUserIds[0] }));
                }} />
                <span className="flex-1">{item.title} v{item.version} · {item.skillCount} skills</span>
                {stationChecklistIds.includes(item.id) ? <Select aria-label={`Proctor for ${item.title}`} value={stationProctors[item.id] || form.proctorUserIds[0] || ""} onChange={(event) => setStationProctors((current) => ({ ...current, [item.id]: event.target.value }))}>
                  <option value="">Choose proctor</option>{setup?.proctors.map((person) => <option key={person.userId} value={person.userId}>{person.name}</option>)}
                </Select> : null}
              </label>)}
            </div>
          </section> : null}
          <p className="text-sm text-navy-600">After creation: add members or outside students, or display the QR code to register. Teach, take attendance and evaluate skills. Finish documentation and explicitly mark Entered into RMS to clear Needs Attention.</p>
          <Button type="submit" className={quickMode ? "w-full min-h-12" : undefined} disabled={busy}>{busy ? "Creating…" : form.selfRegistration ? "Create & show QR code" : "Create training sheet"}</Button>
        </form>
      </Modal>
    </div>
  );
}
