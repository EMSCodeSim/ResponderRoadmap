"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { parseCertificateCsv, type CertificateRow } from "@/lib/certification-import";
import { matchRosterRows, type ImportMember } from "@/lib/smart-import";
import { Button, Card, Field, Flash, Input, PageHeader, Select, TextArea } from "@/components/ui";

type ReviewRow = CertificateRow & { membershipId: string; selected: boolean };
export default function BulkCertificationImportPage() {
  const [members, setMembers] = useState<ImportMember[]>([]);
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    api<{ members: ImportMember[] }>("classes/setup").then((response) => setMembers(response.members))
      .catch(() => setError("Unable to load department members. Check your training permissions."));
  }, []);
  const ready = useMemo(() => rows.filter((row) => row.selected && row.membershipId && row.credentialName.trim()), [rows]);
  function prepare() {
    setError(null); setSuccess("");
    try {
      const parsed = parseCertificateCsv(raw);
      const matched = matchRosterRows(parsed.map((row) => row.email || row.member), members);
      setRows(parsed.map((row, i) => ({ ...row, membershipId: matched[i].issue ? "" : matched[i].member?.id || "", selected: !matched[i].issue && Boolean(row.credentialName.trim()) })));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to read CSV."); }
  }
  async function save() {
    if (!ready.length || busy) return;
    setBusy(true); setError(null); setSuccess("");
    try {
      const response = await api<{ imported: number }>("credentials/import", {
        method: "POST",
        body: JSON.stringify({ rows: ready.map(({ membershipId, credentialName, issuer, credentialNumber, issueDate, expirationDate, doesNotExpire }) =>
          ({ membershipId, credentialName, issuer, credentialNumber, issueDate, expirationDate, doesNotExpire })) }),
      });
      setSuccess(`${response.imported} certification records imported as UNVERIFIED. Review originals before approving.`);
      setRows([]);
    } catch (err) { setError(err instanceof Error ? err.message : "Import failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <PageHeader kicker="Certifications" title="Bulk Certification Import" description="Paste or upload a CSV, match department members, review dates, and import records as unverified." actions={<Link href="/certifications"><Button variant="secondary">Back to certifications</Button></Link>} />
    <Flash message={error} tone="danger" />
    {success ? <Card className="p-4"><p role="status">{success}</p></Card> : null}
    <Card className="space-y-3 p-5">
      <p className="text-sm text-navy-600">Required columns: Member or Email, Certification. Optional: Issuer, Number, Issue Date, Expiration Date, Does Not Expire. Dates must be YYYY-MM-DD.</p>
      <Field label="Upload certification CSV"><Input type="file" accept=".csv,text/csv" onChange={async (event) => {
        const file = event.target.files?.[0]; if (!file) return;
        if (file.size > 1024 * 1024) { setError("CSV must be under 1 MB."); return; }
        setRaw(await file.text()); setRows([]); setError(null);
      }} /></Field>
      <Field label="Or paste certification table"><TextArea rows={6} value={raw} onChange={(event) => { setRaw(event.target.value); setRows([]); }} placeholder={"Member,Email,Certification,Issuer,Number,Issue Date,Expiration Date\nJane Smith,jane@example.org,EMT,State,123,2026-01-01,2028-01-01"} /></Field>
      <Button disabled={!raw.trim() || !members.length} onClick={prepare}>Review member matches</Button>
    </Card>
    {rows.length ? <Card className="space-y-3 p-5">
      <h2 className="text-lg font-bold">Review before import · {ready.length} selected of {rows.length}</h2>
      <p className="text-sm text-navy-600">Only selected rows with a matched member are imported. Imported certificates are UNVERIFIED and do not establish a qualification.</p>
      {rows.map((row, i) => <div key={i} className="space-y-2 rounded-lg border border-navy-200 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={row.selected} onChange={(event) => setRows((items) => items.map((item, j) => j === i ? { ...item, selected: event.target.checked } : item))} />Include row {i + 1}</label>
        <Field label={`Member from source: ${row.member || row.email || "Unknown"}`}>
          <Select value={row.membershipId} onChange={(event) => setRows((items) => items.map((item, j) => j === i ? { ...item, membershipId: event.target.value } : item))}>
            <option value="">Choose a member…</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.email ? ` · ${member.email}` : ""}</option>)}
          </Select>
        </Field>
        <Field label="Certification name"><Input value={row.credentialName} onChange={(event) => setRows((items) => items.map((item, j) => j === i ? { ...item, credentialName: event.target.value } : item))} /></Field>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field label="Issue date (YYYY-MM-DD)"><Input value={row.issueDate} onChange={(event) => setRows((items) => items.map((item, j) => j === i ? { ...item, issueDate: event.target.value } : item))} /></Field>
          <Field label="Expiration date (YYYY-MM-DD)"><Input value={row.expirationDate} disabled={row.doesNotExpire} onChange={(event) => setRows((items) => items.map((item, j) => j === i ? { ...item, expirationDate: event.target.value } : item))} /></Field>
        </div>
      </div>)}
      <Button disabled={busy || !ready.length} onClick={() => void save()}>{busy ? "Importing…" : `Import ${ready.length} unverified certifications`}</Button>
    </Card> : null}
  </div>;
}
