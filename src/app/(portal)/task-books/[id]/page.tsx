"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { EVIDENCE_TYPES, EVIDENCE_TYPE_LABELS, TASK_BOOK_CATEGORIES } from "@/lib/constants";
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
  workingVersion: {
    id: string;
    version: string;
    status: string;
    sections: Array<{
      id?: string;
      title: string;
      description: string;
      sortOrder: number;
      requirements: Array<Requirement & { id?: string }>;
    }>;
  } | null;
  versions: Array<{ id: string; version: string; status: string }>;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function blankRequirement(sortOrder: number): Requirement {
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
    evidenceType: "SKILL_EVALUATION",
    memberNotesAllowed: true,
    evaluatorNotesEnabled: true,
    supervisorApprovalRequired: false,
    evaluatorSignOffRequired: true,
    repetitionsRequired: 1,
    estimatedMinutes: null,
    internalNotes: "",
    objectives: [],
    tags: [],
  };
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-start gap-2">
      <button type="button" className="mt-3 text-navy-300" {...attributes} {...listeners} aria-label="Drag">
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
  const [category, setCategory] = useState("Custom");
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    const data = await api<Book>(`task-books/${params.id}`);
    setBook(data);
    setTitle(data.title);
    setDescription(data.description);
    setCategory(data.category);
    const mapped =
      data.workingVersion?.sections.map((section) => ({
        clientId: section.id || uid(),
        title: section.title,
        description: section.description,
        sortOrder: section.sortOrder,
        requirements: section.requirements.map((req, index) => ({
          clientId: req.id || uid(),
          title: req.title,
          description: req.description || "",
          instructions: req.instructions || "",
          sortOrder: req.sortOrder ?? index,
          isRequired: req.isRequired,
          dueOffsetDays: req.dueOffsetDays,
          referenceDocument: req.referenceDocument || "",
          referenceUrl: req.referenceUrl || "",
          evidenceType: req.evidenceType,
          memberNotesAllowed: req.memberNotesAllowed,
          evaluatorNotesEnabled: req.evaluatorNotesEnabled,
          supervisorApprovalRequired: req.supervisorApprovalRequired,
          evaluatorSignOffRequired: req.evaluatorSignOffRequired,
          repetitionsRequired: req.repetitionsRequired,
          estimatedMinutes: req.estimatedMinutes,
          internalNotes: req.internalNotes || "",
          objectives: req.objectives || [],
          tags: req.tags || [],
        })),
      })) ?? [];
    setSections(mapped);
    setSelectedSection(mapped[0]?.clientId ?? null);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const current = sections.find((section) => section.clientId === selectedSection) ?? null;
  const currentReq = current?.requirements.find((req) => req.clientId === selectedReq) ?? null;
  const draftLocked = book?.workingVersion?.status === "PUBLISHED";

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      await api(`task-books/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, category }),
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
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      await saveDraft();
      await api(`task-books/${params.id}/publish`, { method: "POST" });
      setMessage("Published. Existing assignments stay on the version they were given.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to publish.");
    } finally {
      setBusy(false);
    }
  }

  async function newVersion() {
    await api(`task-books/${params.id}/new-version`, { method: "POST" });
    await load();
  }

  function onSectionDrag(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((items) => {
      const oldIndex = items.findIndex((item) => item.clientId === active.id);
      const newIndex = items.findIndex((item) => item.clientId === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function onReqDrag(event: DragEndEvent) {
    if (!current) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((items) =>
      items.map((section) => {
        if (section.clientId !== current.clientId) return section;
        const oldIndex = section.requirements.findIndex((item) => item.clientId === active.id);
        const newIndex = section.requirements.findIndex((item) => item.clientId === over.id);
        return { ...section, requirements: arrayMove(section.requirements, oldIndex, newIndex) };
      }),
    );
  }

  function updateReq(patch: Partial<Requirement>) {
    if (!current || !currentReq) return;
    setSections((items) =>
      items.map((section) =>
        section.clientId === current.clientId
          ? {
              ...section,
              requirements: section.requirements.map((req) => (req.clientId === currentReq.clientId ? { ...req, ...patch } : req)),
            }
          : section,
      ),
    );
  }

  const versionLabel = book?.workingVersion ? `v${book.workingVersion.version} ${book.workingVersion.status.toLowerCase()}` : "";

  if (!book) return <p className="text-navy-500">Loading Task Book…</p>;

  return (
    <div>
      <PageHeader
        kicker="Task Book builder"
        title={title || "Untitled Task Book"}
        description="Sections contain requirements. Publishing freezes this version so later edits cannot silently change completed work."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPreview(true)}>
              Preview member view
            </Button>
            {draftLocked ? (
              <Button variant="secondary" onClick={newVersion}>
                Start next version
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={saveDraft} disabled={busy}>
                  Save draft
                </Button>
                <Button onClick={publish} disabled={busy}>
                  Publish {book.workingVersion?.version}
                </Button>
              </>
            )}
          </>
        }
      />
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
        <span className="text-xs text-navy-400">{versionLabel}</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr_320px]">
        <Card className="p-3">
          <Field label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={draftLocked} />
          </Field>
          <div className="mt-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={draftLocked}>
                {TASK_BOOK_CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Description">
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} disabled={draftLocked} />
            </Field>
          </div>
          <div className="kicker mt-4 mb-2">Sections</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDrag}>
            <SortableContext items={sections.map((section) => section.clientId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section) => (
                  <SortableRow key={section.clientId} id={section.clientId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSection(section.clientId);
                        setSelectedReq(section.requirements[0]?.clientId ?? null);
                      }}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                        selectedSection === section.clientId ? "border-fire bg-fire-soft" : "border-navy-200"
                      }`}
                    >
                      <div className="font-semibold">{section.title || "Untitled section"}</div>
                      <div className="text-xs text-navy-400">{section.requirements.length} requirements</div>
                    </button>
                  </SortableRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {!draftLocked ? (
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => {
                const section: Section = { clientId: uid(), title: "New section", description: "", sortOrder: sections.length, requirements: [] };
                setSections([...sections, section]);
                setSelectedSection(section.clientId);
              }}
            >
              Add section
            </Button>
          ) : null}
        </Card>

        <Card className="p-4">
          {current ? (
            <>
              <Field label="Section title">
                <Input
                  value={current.title}
                  disabled={draftLocked}
                  onChange={(e) =>
                    setSections((items) => items.map((section) => (section.clientId === current.clientId ? { ...section, title: e.target.value } : section)))
                  }
                />
              </Field>
              <div className="mt-3 flex gap-2">
                {!draftLocked ? (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const req = blankRequirement(current.requirements.length);
                        setSections((items) =>
                          items.map((section) =>
                            section.clientId === current.clientId ? { ...section, requirements: [...section.requirements, req] } : section,
                          ),
                        );
                        setSelectedReq(req.clientId);
                      }}
                    >
                      Add requirement
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
                        setSections([...sections, copy]);
                      }}
                    >
                      Duplicate section
                    </Button>
                  </>
                ) : null}
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onReqDrag}>
                <SortableContext items={current.requirements.map((req) => req.clientId)} strategy={verticalListSortingStrategy}>
                  <div className="mt-4 space-y-2">
                    {current.requirements.map((req) => (
                      <SortableRow key={req.clientId} id={req.clientId}>
                        <button
                          type="button"
                          onClick={() => setSelectedReq(req.clientId)}
                          className={`w-full rounded-md border px-3 py-3 text-left ${selectedReq === req.clientId ? "border-fire bg-fire-soft" : "border-navy-200"}`}
                        >
                          <div className="text-[11px] font-bold uppercase tracking-wide text-navy-400">Requirement</div>
                          <div className="font-semibold">{req.title || "Untitled requirement"}</div>
                          {req.objectives.length ? (
                            <ul className="mt-1 list-disc pl-4 text-xs text-navy-500">
                              {req.objectives.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : null}
                        </button>
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
              <div className="kicker">Requirement</div>
              <Field label="Title">
                <Input value={currentReq.title} disabled={draftLocked} onChange={(e) => updateReq({ title: e.target.value })} />
              </Field>
              <Field label="Description">
                <TextArea value={currentReq.description} disabled={draftLocked} onChange={(e) => updateReq({ description: e.target.value })} />
              </Field>
              <Field label="Instructions">
                <TextArea value={currentReq.instructions} disabled={draftLocked} onChange={(e) => updateReq({ instructions: e.target.value })} />
              </Field>
              <Field label="Objectives (one per line)">
                <TextArea
                  value={currentReq.objectives.join("\n")}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ objectives: e.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })}
                />
              </Field>
              <Field label="Evidence type">
                <Select value={currentReq.evidenceType} disabled={draftLocked} onChange={(e) => updateReq({ evidenceType: e.target.value })}>
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {EVIDENCE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={currentReq.isRequired} disabled={draftLocked} onChange={(e) => updateReq({ isRequired: e.target.checked })} />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={currentReq.evaluatorSignOffRequired}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ evaluatorSignOffRequired: e.target.checked })}
                />
                Evaluator sign-off required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={currentReq.supervisorApprovalRequired}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ supervisorApprovalRequired: e.target.checked })}
                />
                Supervisor approval required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={currentReq.memberNotesAllowed}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ memberNotesAllowed: e.target.checked })}
                />
                Member notes allowed
              </label>
              <Field label="Repetitions required">
                <Input
                  type="number"
                  min={1}
                  value={currentReq.repetitionsRequired}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ repetitionsRequired: Number(e.target.value) })}
                />
              </Field>
              <Field label="Due offset (days from assignment)">
                <Input
                  type="number"
                  value={currentReq.dueOffsetDays ?? ""}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ dueOffsetDays: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Estimated minutes">
                <Input
                  type="number"
                  value={currentReq.estimatedMinutes ?? ""}
                  disabled={draftLocked}
                  onChange={(e) => updateReq({ estimatedMinutes: e.target.value === "" ? null : Number(e.target.value) })}
                />
              </Field>
              <Field label="Reference document">
                <Input value={currentReq.referenceDocument} disabled={draftLocked} onChange={(e) => updateReq({ referenceDocument: e.target.value })} />
              </Field>
              <Field label="Reference URL">
                <Input value={currentReq.referenceUrl} disabled={draftLocked} onChange={(e) => updateReq({ referenceUrl: e.target.value })} />
              </Field>
              <Field label="Internal department notes">
                <TextArea value={currentReq.internalNotes} disabled={draftLocked} onChange={(e) => updateReq({ internalNotes: e.target.value })} />
              </Field>
              {!draftLocked ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const copy = { ...currentReq, clientId: uid(), title: `${currentReq.title} (copy)` };
                      setSections((items) =>
                        items.map((section) =>
                          section.clientId === current?.clientId ? { ...section, requirements: [...section.requirements, copy] } : section,
                        ),
                      );
                      setSelectedReq(copy.clientId);
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      setSections((items) =>
                        items.map((section) =>
                          section.clientId === current?.clientId
                            ? { ...section, requirements: section.requirements.filter((req) => req.clientId !== currentReq.clientId) }
                            : section,
                        ),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-navy-500">Select a requirement to edit its fields.</p>
          )}
        </Card>
      </div>

      <Modal open={preview} title="Member view preview" onClose={() => setPreview(false)} wide>
        <p className="mb-4 text-sm text-navy-500">This is how the assigned Task Book will read for a firefighter in the app.</p>
        <h2 className="display text-3xl font-bold">{title}</h2>
        <p className="text-navy-500">{description}</p>
        {sections.map((section) => (
          <div key={section.clientId} className="mt-5">
            <div className="kicker">Section</div>
            <h3 className="text-lg font-semibold">{section.title}</h3>
            <ul className="mt-2 space-y-2">
              {section.requirements.map((req) => (
                <li key={req.clientId} className="rounded-md border border-navy-200 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-navy-400">Requirement</div>
                  <div className="font-semibold">{req.title}</div>
                  {req.objectives.length ? (
                    <ul className="mt-1 list-disc pl-5 text-sm text-navy-600">
                      {req.objectives.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Modal>
      <div className="mt-4">
        <Link href="/task-books" className="text-sm font-semibold text-navy-600">
          Back to library
        </Link>
      </div>
    </div>
  );
}
