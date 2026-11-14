"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Modal } from "@/components/ui";

export type CleanupType = "TASK_BOOK" | "ASSIGNMENT" | "TRAINING_SHEET";
type CleanupItem = { id: string };
type CleanupData = { taskBooks: CleanupItem[]; assignments: CleanupItem[]; unstartedAssignments: CleanupItem[]; trainingSheets: CleanupItem[] };
type Session = { role: string | null };

const emptyCleanup: CleanupData = { taskBooks: [], assignments: [], unstartedAssignments: [], trainingSheets: [] };

export function useTrainingCleanup() {
  const [canManage, setCanManage] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupData>(emptyCleanup);

  const refresh = useCallback(async () => {
    try {
      const session = await api<Session>("auth/me");
      const authorized = session.role === "TRAINING_OFFICER" || session.role === "DEPARTMENT_ADMINISTRATOR";
      setCanManage(authorized);
      setCleanup(authorized ? await api<CleanupData>("training-cleanup") : emptyCleanup);
    } catch {
      setCanManage(false);
      setCleanup(emptyCleanup);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { canManage, cleanup, refresh };
}

export function TrainingRecordDeleteButton({
  id,
  title,
  type,
  detail,
  onRemoved,
}: {
  id: string;
  title: string;
  type: CleanupType;
  detail: string;
  onRemoved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api("training-cleanup", { method: "DELETE", body: JSON.stringify({ type, id }) });
      setNotice(`“${title}” was removed. It can be restored from Training record cleanup for seven days.`);
      setOpen(false);
      window.setTimeout(() => onRemoved?.(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove this record.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Button type="button" variant="danger" className="min-h-9 px-3 text-xs" onClick={(event) => { event.stopPropagation(); setError(null); setOpen(true); }}>Delete</Button>
    {notice ? <span role="status" className="text-xs font-medium text-ok">Removed · restorable for 7 days</span> : null}
    <Modal open={open} title="Remove this record?" onClose={() => { if (!busy) setOpen(false); }}>
      <div className="space-y-4">
        <p className="font-semibold text-navy-900">{title}</p>
        <p className="text-sm text-navy-600">{detail}</p>
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">This record can be restored for seven days. Training history with attendance, evaluations, or member work is protected.</p>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete record"}</Button></div>
      </div>
    </Modal>
  </>;
}
