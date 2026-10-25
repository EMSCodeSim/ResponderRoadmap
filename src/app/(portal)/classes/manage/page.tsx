"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Flash, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";

type Row = { id:string; title:string; startsAt:string; status:string; rosterCount:number; hasOfficialRecords:boolean; canDelete:boolean; staleDraft:boolean; cleanupReason:string|null };

export default function ManageClassesPage() {
  const [rows,setRows]=useState<Row[]>([]); const [archived,setArchived]=useState(false); const [busy,setBusy]=useState<string|null>(null); const [error,setError]=useState<string|null>(null);
  async function load(next=archived){ setRows(await api<Row[]>(`classes/cleanup?archived=${next}`)); }
  useEffect(()=>{ load().catch(e=>setError(e instanceof Error?e.message:"Unable to load classes.")); },[archived]);
  async function act(row:Row, action:"archive"|"restore"|"delete"){
    const warning=action==="delete"?`Permanently delete “${row.title}”? This is only allowed because it has no roster or training records.`:action==="archive"?`Archive “${row.title}”? Training records will be preserved.`:`Restore “${row.title}” to the class list?`;
    if(!window.confirm(warning)) return; setBusy(row.id); setError(null);
    try { await api("classes/cleanup",{method:"POST",body:JSON.stringify({id:row.id,action})}); await load(); }
    catch(e){ setError(e instanceof ApiError?e.message:"Unable to update class."); } finally { setBusy(null); }
  }
  const suggested=rows.filter(r=>r.cleanupReason); const others=rows.filter(r=>!r.cleanupReason);
  const cards=(items:Row[])=>items.map(row=><Card key={row.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-navy-900">{row.title}</h2><Badge tone="neutral">{row.status}</Badge>{row.cleanupReason?<Badge tone="info">{row.cleanupReason}</Badge>:null}</div><p className="mt-1 text-sm text-navy-500">{formatDate(row.startsAt)} · {row.rosterCount} roster member{row.rosterCount===1?"":"s"}</p>{row.hasOfficialRecords?<p className="mt-2 text-sm text-navy-600">Contains training records. Deletion is locked; archive preserves the audit trail.</p>:null}</div><div className="flex flex-wrap gap-2"><Link href={`/classes/${row.id}`}><Button variant="secondary">Open</Button></Link>{archived?<Button disabled={busy===row.id} onClick={()=>act(row,"restore")}>Restore</Button>:<><Button disabled={busy===row.id} variant="secondary" onClick={()=>act(row,"archive")}>Archive</Button><Button disabled={busy===row.id||!row.canDelete} onClick={()=>act(row,"delete")}>Delete unused</Button></>}</div></div></Card>);
  return <div><PageHeader kicker="Training Officer" title="Manage classes" description="Clean up old, cancelled, duplicate, and test classes without losing official training records." actions={<div className="flex gap-2"><Link href="/classes"><Button variant="secondary">Back to classes</Button></Link><Button variant={archived?"secondary":undefined} onClick={()=>setArchived(!archived)}>{archived?"Show current":"Show archived"}</Button></div>}/><Flash message={error} tone="danger"/>{archived?<div className="grid gap-3">{rows.length?cards(rows):<Card className="p-6 text-navy-500">No archived classes.</Card>}</div>:<div className="space-y-7"><section><h2 className="mb-3 text-lg font-bold text-navy-900">Cleanup suggestions</h2><div className="grid gap-3">{suggested.length?cards(suggested):<Card className="p-5 text-navy-500">No obvious cleanup items right now.</Card>}</div></section><section><h2 className="mb-3 text-lg font-bold text-navy-900">All current classes</h2><div className="grid gap-3">{cards(others)}</div></section></div>}<Card className="mt-7 p-5 text-sm text-navy-600"><strong>Record protection:</strong> Delete is available only when a class has no roster or official training results. Classes containing records must be archived instead.</Card></div>;
}
