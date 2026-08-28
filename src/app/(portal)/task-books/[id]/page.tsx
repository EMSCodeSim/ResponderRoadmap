"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import {
  APPROVAL_LEVELS,
  APPROVAL_LEVEL_LABELS,
  COMPLETION_TYPES,
  COMPLETION_TYPE_LABELS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  RETRY_POLICIES,
  RETRY_POLICY_LABELS,
  SCORING_METHODS,
  SCORING_METHOD_LABELS,
  TASK_BOOK_CATEGORIES,
} from "@/lib/constants";
import { reviewTaskBook, skillDefaults, type CriticalFailure, type EvaluationStep, type QualityIssue, type StandardReference } from "@/lib/taskbook";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea } from "@/components/ui";

type Requirement = {
  clientId: string;
  title: string;
  description: string;
  instructions: string;
  sortOrder: number;
  isRequired: boolean;
  dueOffsetDays: number | null;
  referenceDocument: string;
  referenceUrl: string;
  evidenceType: string;
  memberNotesAllowed: boolean;
  evaluatorNotesEnabled: boolean;
  supervisorApprovalRequired: boolean;
  evaluatorSignOffRequired: boolean;
  repetitionsRequired: number;
  estimatedMinutes: number | null;
  internalNotes: string;
  objectives: string[];
  tags: string[];
  prerequisites: string[];
  completionType: string;
  scoringMethod: string;
  evaluationSteps: EvaluationStep[];
  criticalFailures: CriticalFailure[];
  evidenceTypes: string[];
  maxAttempts: number | null;
  retryWaitHours: number | null;
  remediationRequired: boolean;
  supervisorReviewOnFail: boolean;
  approvalPath: string[];
  standards: StandardReference[];
  retryPolicy: string;
};

type Section = {
  clientId: string;
  title: string;
  description: string;
  sortOrder: number;
  requirements: Requirement[];
};

type Book = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  intendedPosition?: string;
  estimatedDurationDays?: number | null;
  workingVersion: {
    id: string;
    version: string;
    status: string;
    sections: Array<{ id?: string; title: string; description: string; sortOrder: number; requirements: Array<Requirement & { id?: string }> }>;
  } | null;
  versions: Array<{ id: string; version: string; status: string }>;
  review?: { issues: QualityIssue[]; sectionCount: number; requirementCount: number; ready: boolean };
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankRequirement(sortOrder: number): Requirement {
  const defaults = skillDefaults();
  return {
    clientId: uid(),
    title: "",
    description: "",
    instructions: "",
    sortOrder,
    isRequired: true,
    dueOffsetDays: null,
    referenceDocument: "",
    referenceUrl: "",
    evidenceType: defaults.evidenceType,
    memberNotesAllowed: defaults.memberNotesAllowed,
    evaluatorNotesEnabled: defaults.evaluatorNotesEnabled,
    supervisorApprovalRequired: false,
    evaluatorSignOffRequired: defaults.evaluatorSignOffRequired,
    repetitionsRequired: defaults.repetitionsRequired,
    estimatedMinutes: null,
    internalNotes: "",
    objectives: [],
    tags: [],
    prerequisites: [],
    completionType: defaults.completionType,
    scoringMethod: defaults.scoringMethod,
    evaluationSteps: [],
    criticalFailures: [],
    evidenceTypes: ["SKILL_EVALUATION"],
    maxAttempts: null,
    retryWaitHours: null,
    remediationRequired: false,
    supervisorReviewOnFail: false,
    approvalPath: ["EVALUATOR"],
    standards: [],
    retryPolicy: "UNLIMITED",
  };
}

function mapReq(req: Partial<Requirement> & { id?: string }, index: number): Requirement {
  const blank = blankRequirement(index);
  return {
    ...blank,
    ...req,
    clientId: req.id || req.clientId || uid(),
    title: req.title || "",
    description: req.description || "",
    instructions: req.instructions || "",
    objectives: req.objectives || [],
    tags: req.tags || [],
    prerequisites: req.prerequisites || [],
    evaluationSteps: req.evaluationSteps || [],
    criticalFailures: req.criticalFailures || [],
    evidenceTypes: req.evidenceTypes || (req.evidenceType ? [req.evidenceType] : blank.evidenceTypes),
    approvalPath: req.approvalPath?.length ? req.approvalPath : req.supervisorApprovalRequired ? ["EVALUATOR", "SUPERVISOR"] : ["EVALUATOR"],
    standards: req.standards || [],
    referenceDocument: req.referenceDocument || "",
    referenceUrl: req.referenceUrl || "",
    internalNotes: req.internalNotes || "",
  };
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-start gap-2">
      <button type="button" className="mt-3 min-h-11 min-w-11 text-navy-300" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function TaskBookBuilderPage() {
  const params = useParams<{ id: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Department Custom");
  const [intendedPosition, setIntendedPosition] = useState("");
  const [estimatedDurationDays, setEstimatedDurationDays] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<"member" | "evaluator" | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorTab, setEditorTab] = useState<"basics" | "evaluation" | "signoff" | "standards">("basics");
  const [quickEntry, setQuickEntry] = useState("");
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [evaluators, setEvaluators] = useState<Array<{ id: string; name: string }>>([]);
  const [assignForm, setAssignForm] = useState({ membershipIds: [] as string[], dueDate: "", evaluatorId: "", supervisorId: "", notes: "" });
  const snapshot = useRef("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const markDirty = useCallback(() => setDirty(true), []);

  function mapSections(data: Book): Section[] {
    return (
      data.workingVersion?.sections.map((section) => ({
        clientId: section.id || uid(),
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        requirements: section.requirements.map((req, index) => mapReq(req, index)),
      })) ?? []
    );
  }

  async function load() {
    const data = await api<Book>(`task-books/${params.id}`);
    setBook(data);
    setTitle(data.title);
    setDescription(data.description);
    setCategory(data.category);
    setIntendedPosition(data.intendedPosition || "");
    setEstimatedDurationDays(data.estimatedDurationDays ? String(data.estimatedDurationDays) : "");
    const mapped = mapSections(data);
    setSections(mapped);
    setSelectedSection((current) => current || mapped[0]?.clientId || null);
    setDirty(false);
    snapshot.current = JSON.stringify({ title: data.title, sections: mapped });
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    api<{ members: Array<{ id: string; name: string }> }>("members")
      .then((payload) => setMembers(payload.members))
      .catch(() => undefined);
    api<Array<{ id: string; name: string }>>("evaluators")
      .then(setEvaluators)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    function onLeave(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDraft();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, category, sections]);

  const current = sections.find((section) => section.clientId === selectedSection) ?? null;
  const currentReq = current?.requirements.find((req) => req.clientId === selectedReq) ?? null;
  const draftLocked = book?.workingVersion?.status === "PUBLISHED";
  const allReqs = sections.flatMap((section) => section.requirements.map((req) => ({ ...req, sectionTitle: section.title })));
  const review = useMemo(
    () =>
      reviewTaskBook({
        title,
        sections: sections.map((section) => ({
          title: section.title,
          requirements: section.requirements,
        })),
      }),
    [title, sections],
  );

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      await api(`task-books/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description,
          category,
          intendedPosition,
          estimatedDurationDays: estimatedDurationDays ? Number(estimatedDurationDays) : null,
        }),
      });
      await api(`task-books/${params.id}/draft`, {
        method: "PUT",
        body: JSON.stringify({
          sections: sections.map((section, sIndex) => ({
            title: section.title,
            description: section.description,
            sortOrder: sIndex,
            requirements: section.requirements.map((req, rIndex) => ({ ...req, sortOrder: rIndex })),
          })),
        }),
      });
      setMessage("Draft saved.");
      setDirty(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(force = false) {
    setBusy(true);
    setError(null);
    try {
      await saveDraft();
      await api(`task-books/${params.id}/publish`, { method: "POST", body: JSON.stringify({ force }) });
      setMessage("Published. Existing assignments stay on the version they were given.");
      setReviewOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to publish.");
    } finally {
      setBusy(false);
    }
  }

  function onSectionDrag(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    markDirty();
    setSections((items) => arrayMove(items, items.findIndex((item) => item.clientId === active.id), items.findIndex((item) => item.clientId === over.id)));
  }

  function onReqDrag(event: DragEndEvent) {
    if (!current) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    markDirty();
    setSections((items) =>
      items.map((section) => {
        if (section.clientId !== current.clientId) return section;
        return {
          ...section,
          requirements: arrayMove(
            section.requirements,
            section.requirements.findIndex((item) => item.clientId === active.id),
            section.requirements.findIndex((item) => item.clientId === over.id),
          ),
        };
      }),
    );
  }

  function updateReq(patch: Partial<Requirement>) {
    if (!current || !currentReq) return;
    markDirty();
    setSections((items) =>
      items.map((section) =>
        section.clientId === current.clientId
          ? { ...section, requirements: section.requirements.map((req) => (req.clientId === currentReq.clientId ? { ...req, ...patch } : req)) }
          : section,
      ),
    );
  }

  function addRequirement(afterSave = false) {
    if (!current) return;
    const req = blankRequirement(current.requirements.length);
    markDirty();
    setSections((items) =>
      items.map((section) => (section.clientId === current.clientId ? { ...section, requirements: [...section.requirements, req] } : section)),
    );
    setSelectedReq(req.clientId);
    setEditorTab("basics");
    if (afterSave) setMessage("Saved locally. Add the next task title.");
  }

  function applyQuickEntry() {
    if (!current) return;
    const titles = quickEntry.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!titles.length) return;
    markDirty();
    const added = titles.map((item, index) => ({ ...blankRequirement(current.requirements.length + index), title: item }));
    setSections((items) =>
      items.map((section) => (section.clientId === current.clientId ? { ...section, requirements: [...section.requirements, ...added] } : section)),
    );
    setQuickEntry("");
    setSelectedReq(added[0]?.clientId ?? selectedReq);
  }

  function bulkPatch(patch: Partial<Requirement>) {
    if (!selectedIds.length) return;
    markDirty();
    setSections((items) =>
      items.map((section) => ({
        ...section,
        requirements: section.requirements.map((req) => (selectedIds.includes(req.clientId) ? { ...req, ...patch } : req)),
      })),
    );
    setMessage(`Updated ${selectedIds.length} requirements.`);
  }

  async function assign() {
    try {
      const result = await api<{ created: number; skipped: number }>("assignments", {
        method: "POST",
        body: JSON.stringify({
          templateId: params.id,
          membershipIds: assignForm.membershipIds,
          dueDate: assignForm.dueDate || null,
          evaluatorId: assignForm.evaluatorId || null,
          supervisorId: assignForm.supervisorId || null,
          notes: assignForm.notes,
        }),
      });
      setMessage(`Assigned to ${result.created} member${result.created === 1 ? "" : "s"}.`);
      setAssignOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to assign.");
    }
  }

  if (!book) return <p className="text-navy-500">Loading Task Book…</p>;

  return (
    <div>
      <PageHeader
        kicker="Task Book builder"
        title={title || "Untitled Task Book"}
        description="TASK BOOK → Sections → Tasks → Evaluation criteria → Evidence → Sign-off. Publishing freezes this version."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreview("member")}>
              Preview as Member
            </Button>
            <Button variant="secondary" onClick={() => setPreview("evaluator")}>
              Preview as Evaluator
            </Button>
            {draftLocked ? (
              <>
                <Button variant="secondary" onClick={() => api(`task-books/${params.id}/new-version`, { method: "POST" }).then(load)}>
                  Create New Version
                </Button>
                {book.status === "ACTIVE" ? (
                  <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                    Assign
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={saveDraft} disabled={busy}>
                  Save draft
                </Button>
                <Button onClick={() => setReviewOpen(true)} disabled={busy}>
                  Review & publish
                </Button>
              </>
            )}
          </>
        }
      />
      {dirty ? <p className="mb-3 text-sm font-semibold text-warn">Unsaved changes. Save before leaving this page.</p> : null}
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {book.versions.map((version) => (
          <Badge key={version.id} tone={version.status === "PUBLISHED" ? "current" : version.status === "DRAFT" ? "warn" : "neutral"}>
            v{version.version} {version.status.toLowerCase()}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_1fr_340px]">
        <Card className="p-3">
          <Field label="Task Book name">
            <Input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} disabled={draftLocked} />
          </Field>
          <div className="mt-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => { setCategory(e.target.value); markDirty(); }} disabled={draftLocked}>
                {TASK_BOOK_CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Intended position">
              <Input value={intendedPosition} onChange={(e) => { setIntendedPosition(e.target.value); markDirty(); }} disabled={draftLocked} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Estimated days">
              <Input type="number" value={estimatedDurationDays} onChange={(e) => { setEstimatedDurationDays(e.target.value); markDirty(); }} disabled={draftLocked} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description">
              <TextArea value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} disabled={draftLocked} />
            </Field>
          </div>
          <div className="kicker mt-4 mb-2">Sections</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDrag}>
            <SortableContext items={sections.map((section) => section.clientId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <SortableRow key={section.clientId} id={section.clientId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSection(section.clientId);
                        setSelectedReq(section.requirements[0]?.clientId ?? null);
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedSection === section.clientId ? "border-fire bg-fire-soft" : "border-navy-200"}`}
                    >
                      <div className="font-semibold">{section.title || `Section ${index + 1}`}</div>
                      <div className="text-xs text-navy-400">{section.requirements.length} tasks</div>
                    </button>
                  </SortableRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {!draftLocked ? (
            <div className="mt-3 space-y-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  const section: Section = { clientId: uid(), title: `Section ${sections.length + 1}`, description: "", sortOrder: sections.length, requirements: [] };
                  markDirty();
                  setSections([...sections, section]);
                  setSelectedSection(section.clientId);
                }}
              >
                Add section
              </Button>
              {current ? (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      const idx = sections.findIndex((section) => section.clientId === current.clientId);
                      if (idx <= 0) return;
                      markDirty();
                      setSections(arrayMove(sections, idx, idx - 1));
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      const idx = sections.findIndex((section) => section.clientId === current.clientId);
                      if (idx < 0 || idx >= sections.length - 1) return;
                      markDirty();
                      setSections(arrayMove(sections, idx, idx + 1));
                    }}
                  >
                    Move down
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          {current ? (
            <>
              <Field label="Section title">
                <Input
                  value={current.title}
                  disabled={draftLocked}
                  onChange={(e) => {
                    markDirty();
                    setSections((items) => items.map((section) => (section.clientId === current.clientId ? { ...section, title: e.target.value } : section)));
                  }}
                />
              </Field>
              {!draftLocked ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => addRequirement()}>
                    Add task
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const copy: Section = {
                        ...current,
                        clientId: uid(),
                        title: `${current.title} (copy)`,
                        requirements: current.requirements.map((req) => ({ ...req, clientId: uid() })),
                      };
                      markDirty();
                      setSections([...sections, copy]);
                    }}
                  >
                    Duplicate section
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => {
                      markDirty();
                      setSections(sections.filter((section) => section.clientId !== current.clientId));
                    }}
                  >
                    Remove section
                  </Button>
                </div>
              ) : null}
              <div className="mt-4">
                <Field label="Quick entry" hint="Paste titles from a paper Task Book. Press Add titles — details can wait.">
                  <TextArea value={quickEntry} disabled={draftLocked} onChange={(e) => setQuickEntry(e.target.value)} placeholder={"Operate apparatus in emergency response\nPerform hydrant connection\nLead patient assessment"} />
                </Field>
                {!draftLocked ? (
                  <Button variant="secondary" className="mt-2" onClick={applyQuickEntry} disabled={!quickEntry.trim()}>
                    Add titles
                  </Button>
                ) : null}
              </div>
              {selectedIds.length ? (
                <div className="mt-4 rounded-md border border-navy-200 bg-navy-50 p-3">
                  <div className="text-sm font-semibold">{selectedIds.length} selected</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => bulkPatch({ evaluatorSignOffRequired: true })}>
                      Require evaluator sign-off
                    </Button>
                    <Button variant="secondary" onClick={() => bulkPatch({ repetitionsRequired: 3 })}>
                      Set 3 repetitions
                    </Button>
                    <Button variant="secondary" onClick={() => bulkPatch({ evidenceType: "PHOTO", evidenceTypes: ["PHOTO"] })}>
                      Require photo
                    </Button>
                    <Button variant="ghost" onClick={() => setSelectedIds([])}>
                      Clear
                    </Button>
                  </div>
                </div>
              ) : null}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReqDrag}>
                <SortableContext items={current.requirements.map((req) => req.clientId)} strategy={verticalListSortingStrategy}>
                  <div className="mt-4 space-y-2">
                    {current.requirements.map((req) => (
                      <SortableRow key={req.clientId} id={req.clientId}>
                        <div className={`rounded-md border px-3 py-3 ${selectedReq === req.clientId ? "border-fire bg-fire-soft" : "border-navy-200"}`}>
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedIds.includes(req.clientId)}
                              onChange={(e) => setSelectedIds((ids) => (e.target.checked ? [...ids, req.clientId] : ids.filter((id) => id !== req.clientId)))}
                            />
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedReq(req.clientId)}>
                              <div className="text-[11px] font-bold uppercase tracking-wide text-navy-400">
                                {COMPLETION_TYPE_LABELS[req.completionType as keyof typeof COMPLETION_TYPE_LABELS] || "Task"}
                                {req.repetitionsRequired > 1 ? ` · ${req.repetitionsRequired} reps` : ""}
                              </div>
                              <div className="text-base font-semibold">{req.title || "Untitled task"}</div>
                            </button>
                          </div>
                        </div>
                      </SortableRow>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
          ) : (
            <p className="text-sm text-navy-500">Add a section to begin.</p>
          )}
        </Card>

        <Card className="p-4">
          {currentReq ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {(["basics", "evaluation", "signoff", "standards"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setEditorTab(tab)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${editorTab === tab ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-700"}`}
                  >
                    {tab === "signoff" ? "Sign-off" : tab[0].toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              {editorTab === "basics" ? (
                <>
                  <Field label="Task title">
                    <Input
                      value={currentReq.title}
                      disabled={draftLocked}
                      onChange={(e) => updateReq({ title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !draftLocked) {
                          e.preventDefault();
                          addRequirement(true);
                        }
                      }}
                    />
                  </Field>
                  <Field label="Short description">
                    <TextArea value={currentReq.description} disabled={draftLocked} onChange={(e) => updateReq({ description: e.target.value })} />
                  </Field>
                  <Field label="Detailed instructions">
                    <TextArea value={currentReq.instructions} disabled={draftLocked} onChange={(e) => updateReq({ instructions: e.target.value })} />
                  </Field>
                  <Field label="Objectives (one per line)">
                    <TextArea
                      value={currentReq.objectives.join("\n")}
                      disabled={draftLocked}
                      onChange={(e) => updateReq({ objectives: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
                    />
                  </Field>
                  <Field label="Completion type">
                    <Select value={currentReq.completionType} disabled={draftLocked} onChange={(e) => updateReq({ completionType: e.target.value })}>
                      {COMPLETION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {COMPLETION_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Estimated minutes">
                    <Input type="number" value={currentReq.estimatedMinutes ?? ""} disabled={draftLocked} onChange={(e) => updateReq({ estimatedMinutes: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={currentReq.isRequired} disabled={draftLocked} onChange={(e) => updateReq({ isRequired: e.target.checked })} />
                    Required
                  </label>
                  <Field label="Prerequisites">
                    <Select
                      value=""
                      disabled={draftLocked}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        updateReq({ prerequisites: [...new Set([...currentReq.prerequisites, e.target.value])] });
                      }}
                    >
                      <option value="">Add a prior task…</option>
                      {allReqs
                        .filter((req) => req.clientId !== currentReq.clientId)
                        .map((req) => (
                          <option key={req.clientId} value={req.clientId}>
                            {req.title || "Untitled"} ({req.sectionTitle})
                          </option>
                        ))}
                    </Select>
                    <ul className="mt-2 text-xs text-navy-600">
                      {currentReq.prerequisites.map((id) => (
                        <li key={id} className="flex justify-between gap-2">
                          <span>{allReqs.find((req) => req.clientId === id)?.title || id}</span>
                          {!draftLocked ? (
                            <button type="button" onClick={() => updateReq({ prerequisites: currentReq.prerequisites.filter((item) => item !== id) })}>
                              Remove
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </Field>
                </>
              ) : null}
              {editorTab === "evaluation" ? (
                <>
                  <Field label="Scoring">
                    <Select value={currentReq.scoringMethod} disabled={draftLocked} onChange={(e) => updateReq({ scoringMethod: e.target.value })}>
                      {SCORING_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {SCORING_METHOD_LABELS[method]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Repetitions required" hint="Each attempt keeps its own date, evaluator, notes, and result.">
                    <Input type="number" min={1} value={currentReq.repetitionsRequired} disabled={draftLocked} onChange={(e) => updateReq({ repetitionsRequired: Number(e.target.value) })} />
                  </Field>
                  <Field label="Evaluation steps" hint="One checklist item per line. Evaluators mark Meets / Needs Improvement / Not Performed.">
                    <TextArea
                      value={currentReq.evaluationSteps.map((step) => step.text).join("\n")}
                      disabled={draftLocked}
                      onChange={(e) =>
                        updateReq({
                          evaluationSteps: e.target.value
                            .split("\n")
                            .map((text) => text.trim())
                            .filter(Boolean)
                            .map((text, index) => ({ id: currentReq.evaluationSteps[index]?.id || uid(), text })),
                        })
                      }
                    />
                  </Field>
                  <Field label="Critical failures" hint="If any of these occur, the attempt does not pass.">
                    <TextArea
                      value={currentReq.criticalFailures.map((item) => item.text).join("\n")}
                      disabled={draftLocked}
                      onChange={(e) =>
                        updateReq({
                          criticalFailures: e.target.value
                            .split("\n")
                            .map((text) => text.trim())
                            .filter(Boolean)
                            .map((text, index) => ({ id: currentReq.criticalFailures[index]?.id || uid(), text })),
                        })
                      }
                    />
                  </Field>
                  <Field label="Evidence">
                    <div className="grid max-h-40 gap-1 overflow-auto rounded-md border border-navy-200 p-2">
                      {EVIDENCE_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={draftLocked}
                            checked={currentReq.evidenceTypes.includes(type) || currentReq.evidenceType === type}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...new Set([...currentReq.evidenceTypes, type])]
                                : currentReq.evidenceTypes.filter((item) => item !== type);
                              updateReq({ evidenceTypes: next, evidenceType: next[0] || "NONE" });
                            }}
                          />
                          {EVIDENCE_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={currentReq.memberNotesAllowed} disabled={draftLocked} onChange={(e) => updateReq({ memberNotesAllowed: e.target.checked })} />
                    Member notes optional
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={currentReq.evaluatorNotesEnabled} disabled={draftLocked} onChange={(e) => updateReq({ evaluatorNotesEnabled: e.target.checked })} />
                    Evaluator notes enabled
                  </label>
                </>
              ) : null}
              {editorTab === "signoff" ? (
                <>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={currentReq.evaluatorSignOffRequired} disabled={draftLocked} onChange={(e) => updateReq({ evaluatorSignOffRequired: e.target.checked })} />
                    Evaluator sign-off required
                  </label>
                  <Field label="Approval path" hint="Each level keeps name, role, date, result, and comments.">
                    <div className="space-y-1">
                      {APPROVAL_LEVELS.map((level) => (
                        <label key={level} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={draftLocked}
                            checked={currentReq.approvalPath.includes(level)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...currentReq.approvalPath, level]
                                : currentReq.approvalPath.filter((item) => item !== level);
                              updateReq({
                                approvalPath: next.length ? next : ["EVALUATOR"],
                                supervisorApprovalRequired: next.includes("SUPERVISOR"),
                              });
                            }}
                          />
                          {APPROVAL_LEVEL_LABELS[level]}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Retry rule">
                    <Select value={currentReq.retryPolicy} disabled={draftLocked} onChange={(e) => updateReq({ retryPolicy: e.target.value })}>
                      {RETRY_POLICIES.map((policy) => (
                        <option key={policy} value={policy}>
                          {RETRY_POLICY_LABELS[policy]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Maximum attempts">
                    <Input type="number" min={1} value={currentReq.maxAttempts ?? ""} disabled={draftLocked} onChange={(e) => updateReq({ maxAttempts: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <Field label="Wait hours before retry">
                    <Input type="number" min={0} value={currentReq.retryWaitHours ?? ""} disabled={draftLocked} onChange={(e) => updateReq({ retryWaitHours: e.target.value === "" ? null : Number(e.target.value) })} />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={currentReq.remediationRequired} disabled={draftLocked} onChange={(e) => updateReq({ remediationRequired: e.target.checked })} />
                    Remediation required before retry
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={currentReq.supervisorReviewOnFail} disabled={draftLocked} onChange={(e) => updateReq({ supervisorReviewOnFail: e.target.checked })} />
                    Supervisor review after failure
                  </label>
                </>
              ) : null}
              {editorTab === "standards" ? (
                <>
                  <p className="text-xs text-navy-500">Only record references you can source. Do not invent NFPA, state, or NREMT citations.</p>
                  {currentReq.standards.map((standard, index) => (
                    <div key={standard.id} className="rounded-md border border-navy-200 p-3">
                      <Field label="Organization">
                        <Input value={standard.organization} disabled={draftLocked} onChange={(e) => updateReq({ standards: currentReq.standards.map((item, i) => (i === index ? { ...item, organization: e.target.value } : item)) })} />
                      </Field>
                      <Field label="Standard name">
                        <Input value={standard.standardName} disabled={draftLocked} onChange={(e) => updateReq({ standards: currentReq.standards.map((item, i) => (i === index ? { ...item, standardName: e.target.value } : item)) })} />
                      </Field>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Field label="Edition / year">
                          <Input value={standard.edition} disabled={draftLocked} onChange={(e) => updateReq({ standards: currentReq.standards.map((item, i) => (i === index ? { ...item, edition: e.target.value } : item)) })} />
                        </Field>
                        <Field label="Section / JPR">
                          <Input value={standard.section} disabled={draftLocked} onChange={(e) => updateReq({ standards: currentReq.standards.map((item, i) => (i === index ? { ...item, section: e.target.value } : item)) })} />
                        </Field>
                      </div>
                      <Field label="Source URL">
                        <Input value={standard.url} disabled={draftLocked} onChange={(e) => updateReq({ standards: currentReq.standards.map((item, i) => (i === index ? { ...item, url: e.target.value } : item)) })} />
                      </Field>
                    </div>
                  ))}
                  {!draftLocked ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        updateReq({
                          standards: [...currentReq.standards, { id: uid(), organization: "", standardName: "", edition: "", section: "", url: "", verified: false }],
                        })
                      }
                    >
                      Add standards reference
                    </Button>
                  ) : null}
                  <Field label="Reference document (legacy text)">
                    <Input value={currentReq.referenceDocument} disabled={draftLocked} onChange={(e) => updateReq({ referenceDocument: e.target.value })} />
                  </Field>
                </>
              ) : null}
              {!draftLocked ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => addRequirement(true)}>
                    Save & add another
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const copy = { ...currentReq, clientId: uid(), title: `${currentReq.title} (copy)` };
                      markDirty();
                      setSections((items) =>
                        items.map((section) => (section.clientId === current?.clientId ? { ...section, requirements: [...section.requirements, copy] } : section)),
                      );
                      setSelectedReq(copy.clientId);
                    }}
                  >
                    Duplicate task
                  </Button>
                  <Field label="Move to section">
                    <Select
                      value={current?.clientId ?? ""}
                      onChange={(e) => {
                        const target = e.target.value;
                        markDirty();
                        setSections((items) => {
                          const moving = currentReq;
                          return items.map((section) => {
                            if (section.clientId === current?.clientId) {
                              return { ...section, requirements: section.requirements.filter((req) => req.clientId !== moving.clientId) };
                            }
                            if (section.clientId === target) {
                              return { ...section, requirements: [...section.requirements, moving] };
                            }
                            return section;
                          });
                        });
                        setSelectedSection(target);
                      }}
                    >
                      {sections.map((section) => (
                        <option key={section.clientId} value={section.clientId}>
                          {section.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button
                    variant="danger"
                    onClick={() => {
                      markDirty();
                      setSections((items) =>
                        items.map((section) =>
                          section.clientId === current?.clientId
                            ? { ...section, requirements: section.requirements.filter((req) => req.clientId !== currentReq.clientId) }
                            : section,
                        ),
                      );
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-navy-500">Select a task to edit. Smart defaults: evaluator sign-off, one repetition, optional evidence.</p>
          )}
        </Card>
      </div>

      <Modal open={Boolean(preview)} title={preview === "evaluator" ? "Preview as Evaluator" : "Preview as Member"} onClose={() => setPreview(null)} wide>
        <p className="mb-4 text-sm text-navy-500">
          {preview === "evaluator"
            ? "This is the field evaluation layout: member, task, criteria, then large Pass / Needs Remediation controls."
            : "This is how a firefighter will read the assigned Task Book, including Up Next and section progress."}
        </p>
        <h2 className="display text-3xl font-bold">{title}</h2>
        <p className="text-navy-500">{description}</p>
        {preview === "member" ? (
          <div className="mt-4 rounded-md border border-navy-200 p-4">
            <div className="kicker">Up Next</div>
            <ol className="mt-2 list-decimal pl-5 text-sm">
              {sections.flatMap((section) => section.requirements).slice(0, 3).map((req) => (
                <li key={req.clientId}>{req.title || "Untitled task"}</li>
              ))}
            </ol>
          </div>
        ) : null}
        {sections.map((section) => (
          <div key={section.clientId} className="mt-5">
            <div className="kicker">
              {section.title} · 0 / {section.requirements.filter((req) => req.isRequired).length}
            </div>
            <ul className="mt-2 space-y-2">
              {section.requirements.map((req) => (
                <li key={req.clientId} className="rounded-md border border-navy-200 p-3">
                  <div className="font-semibold">{req.title}</div>
                  {req.instructions ? <p className="mt-1 text-sm text-navy-600">{req.instructions}</p> : null}
                  {req.evaluationSteps.length && preview === "evaluator" ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {req.evaluationSteps.map((step) => (
                        <li key={step.id}>☐ {step.text}</li>
                      ))}
                    </ul>
                  ) : null}
                  {preview === "evaluator" ? (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-ok px-3 py-3 text-center text-sm font-bold text-white">PASS</div>
                      <div className="rounded-md bg-warn px-3 py-3 text-center text-sm font-bold text-white">NEEDS REMEDIATION</div>
                      <div className="rounded-md bg-navy-200 px-3 py-3 text-center text-sm font-bold">NOT EVALUATED</div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Modal>

      <Modal open={reviewOpen} title="Task Book review" onClose={() => setReviewOpen(false)} wide>
        <p className="text-sm text-navy-500">
          {review.sectionCount} sections · {review.requirementCount} requirements
        </p>
        <ul className="mt-3 space-y-2">
          {review.issues.length === 0 ? <li className="text-sm text-ok">Ready to publish.</li> : null}
          {review.issues.map((issue) => (
            <li key={issue.message} className={issue.severity === "warn" ? "text-sm text-warn" : "text-sm text-ok"}>
              {issue.severity === "warn" ? "⚠" : "✓"} {issue.message}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => publish(false)} disabled={busy || !review.ready}>
            Publish {book.workingVersion?.version}
          </Button>
          {!review.ready ? null : review.issues.length ? (
            <Button variant="secondary" onClick={() => publish(true)} disabled={busy}>
              Publish anyway
            </Button>
          ) : null}
          {!review.ready && review.issues.length ? (
            <Button variant="secondary" onClick={() => publish(true)} disabled={busy}>
              Publish with warnings
            </Button>
          ) : null}
        </div>
      </Modal>

      <Modal open={assignOpen} title="Assign Task Book" onClose={() => setAssignOpen(false)} wide>
        <div className="grid max-h-64 gap-1 overflow-auto md:grid-cols-2">
          {members.map((member) => (
            <label key={member.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assignForm.membershipIds.includes(member.id)}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    membershipIds: e.target.checked ? [...assignForm.membershipIds, member.id] : assignForm.membershipIds.filter((id) => id !== member.id),
                  })
                }
              />
              {member.name}
            </label>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Due date">
            <Input type="date" value={assignForm.dueDate} onChange={(e) => setAssignForm({ ...assignForm, dueDate: e.target.value })} />
          </Field>
          <Field label="Evaluator">
            <Select value={assignForm.evaluatorId} onChange={(e) => setAssignForm({ ...assignForm, evaluatorId: e.target.value })}>
              <option value="">Any evaluator</option>
              {evaluators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button className="mt-4" onClick={assign} disabled={!assignForm.membershipIds.length}>
          Assign selected members
        </Button>
      </Modal>

      <div className="mt-4">
        <Link href="/task-books" className="text-sm font-semibold text-navy-600" onClick={(event) => {
          if (dirty && !confirm("Leave without saving this draft?")) event.preventDefault();
        }}>
          Back to library
        </Link>
      </div>
    </div>
  );
}
