"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Flash, Modal, PageHeader } from "@/components/ui";

type Item = { id: string; title: string; detail: string; createdAt: string };
type RecoveryItem = { id: string; entityType: string; title: string; deletedAt: string; expiresAt: string };
type CleanupData = { taskBooks: Item[]; assignments: Item[]; unstartedAssignments: Item[]; trainingSheets: Item[]; templates: Item[]; recovery: RecoveryItem[] };
type CleanupType = "TASK_BOOK" | "ASSIGNMENT" | "TRAINING_SHEET" | "TEMPLATE";
type SelectedItem = { id: string; title: string; type: CleanupType; description: string };

export default function TrainingCleanupPage() {
  const [data, setData] = useState<CleanupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await api<CleanupData>("training-cleanup")); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load cleanup records."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function removeSelected() {
    if (!selected) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await api("training-cleanup", { method: "DELETE", body: JSON.stringify({ type: selected.type, id: selected.id }) });
      setNotice(`“${selected.title}” was removed and can be restored for seven days. The action was recorded in the audit history.`);
      setSelected(null);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to remove this item."); }
    finally { setBusy(false); }
  }

  async function restore(item: RecoveryItem) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await api<{ title: string }>(`training-cleanup/restore/${encodeURIComponent(item.id)}`, { method: "POST" });
      setNotice(`“${result.title}” was restored.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to restore this item."); }
    finally { setBusy(false); }
  }

  if (!data && !error) return <p className="text-navy-500">Loading cleanup records…</p>;
  const sections: Array<{ title: string; description: string; rows: Item[]; type: CleanupType }> = [
    { title: "Unused Task Books", description: "Only books with no member assignments, Training Sheets, or role/expectation links are listed.", rows: data?.taskBooks || [], type: "TASK_BOOK" },
    { title: "Assignments", description: "Includes unused Assignment templates and unstarted or overdue member assignments with no submitted work.", rows: [...(data?.assignments || []), ...(data?.unstartedAssignments || [])], type: "ASSIGNMENT" },
    { title: "Unfinished Training Sheets", description: "Only draft or active sheets with no recorded attendance, grades, or skill evaluations are listed.", rows: data?.trainingSheets || [], type: "TRAINING_SHEET" },
    { title: "Training Sheet templates", description: "Removing a template does not change past sheets; their settings are saved with each record.", rows: data?.templates || [], type: "TEMPLATE" },
  ];

  return <div>
    <PageHeader kicker="Training administration" title="Training record cleanup" description="Remove old items that are no longer used. Training Officers and Department Administrators can manage this page." actions={<Button variant="secondary" onClick={() => void load()} disabled={busy}>Refresh</Button>} />
    <div className="mb-4 space-y-2"><Flash message={error} tone="danger" /><Flash message={notice} tone="current" /></div>
    <Card className="mb-5 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>Completed and in-progress training history is protected.</strong> Books linked to assignments, classes, role qualifications, or training expectations are kept. Sheets with recorded attendance or evaluation results are kept. Only unstarted or overdue assignments with no submitted work appear below. Eligible items can be restored for seven days; all actions are recorded in audit history.</Card>
    <div className="space-y-5">
      {sections.map((section) => <Card key={section.title} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="display text-xl font-bold">{section.title}</h2><p className="mt-1 max-w-3xl text-sm text-navy-500">{section.description}</p></div><Badge>{section.rows.length} available</Badge></div>
        {section.rows.length ? <div className="mt-3 divide-y divide-navy-100">{section.rows.map((item) => {
          const type: CleanupType = section.title === "Assignments" && data?.assignments.some((template) => template.id === item.id) ? "ASSIGNMENT" : section.type;
          const description = type === "TASK_BOOK" ? "This unused Task Book and its draft content will be removed. It can be restored for seven days." : type === "TRAINING_SHEET" ? "This unfinished Training Sheet and its ungraded roster entries will be removed. It can be restored for seven days." : type === "TEMPLATE" ? "This reusable Training Sheet template will be removed. It can be restored for seven days." : data?.assignments.some((template) => template.id === item.id) ? "This unused Assignment template will be removed. It can be restored for seven days." : "This unstarted member assignment will be removed. It can be restored for seven days.";
          return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="font-semibold text-navy-900">{item.title}</div><div className="text-sm text-navy-500">{item.detail} · created {new Date(item.createdAt).toLocaleDateString()}</div></div><Button variant="danger" className="min-h-9 px-3 text-xs" onClick={() => setSelected({ id: item.id, title: item.title, type, description })}>Delete</Button></div>;
        })}</div> : <p className="mt-4 rounded-md bg-navy-50 p-3 text-sm text-navy-500">Nothing eligible for cleanup.</p>}
      </Card>)}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="display text-xl font-bold">Recently removed</h2><p className="mt-1 text-sm text-navy-500">Restore eligible cleanup items within seven days of removal.</p></div><Badge>{data?.recovery.length || 0} available</Badge></div>
        {data?.recovery.length ? <div className="mt-3 divide-y divide-navy-100">{data.recovery.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold text-navy-900">{item.title}</div><div className="text-sm text-navy-500">Removed {new Date(item.deletedAt).toLocaleString()} · expires {new Date(item.expiresAt).toLocaleDateString()}</div></div><Button variant="secondary" disabled={busy} onClick={() => void restore(item)}>Restore</Button></div>)}</div> : <p className="mt-4 rounded-md bg-navy-50 p-3 text-sm text-navy-500">No recently removed items are available.</p>}
      </Card>
    </div>
    <Modal open={!!selected} title="Remove this item?" onClose={() => { if (!busy) setSelected(null); }}>
      {selected ? <div className="space-y-4"><p className="font-semibold text-navy-900">{selected.title}</p><p className="text-sm text-navy-600">{selected.description}</p><p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">It will be available in Recently removed for seven days. After that it is permanently discarded.</p><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => void removeSelected()}>{busy ? "Removing…" : "Remove item"}</Button></div></div> : null}
    </Modal>
  </div>;
}
