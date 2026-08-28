"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, ApiError, downloadCsv } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { Badge, Button, Card, Field, Flash, Input, Modal, PageHeader, Select, TextArea, certTone } from "@/components/ui";

type Credential = {
  id: string;
  memberId: string;
  memberName: string;
  credentialName: string;
  issuer: string;
  credentialNumber: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  verificationStatus: string;
  notes: string;
  health: string;
  label: string;
  window: string;
};

type Payload = { credentials: Credential[]; types: Array<{ id: string; name: string; isCustom: boolean }> };

const WINDOWS = [
  ["expired", "Expired"],
  ["30", "Next 30 days"],
  ["60", "Next 60 days"],
  ["90", "Next 90 days"],
  ["180", "6 months"],
  ["current", "Current"],
  ["missing", "Missing info"],
];

function CertificationsInner() {
  const search = useSearchParams();
  const windowFilter = search.get("window") || "60";
  const [data, setData] = useState<Payload | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    membershipId: "",
    credentialName: "CPR",
    issuer: "",
    credentialNumber: "",
    issueDate: "",
    expirationDate: "",
    notes: "",
  });
  const [typeName, setTypeName] = useState("");

  async function load() {
    const payload = await api<Payload>(`credentials?window=${windowFilter}`);
    setData(payload);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    api<{ members: Array<{ id: string; name: string }> }>("members").then((payload) => setMembers(payload.members));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowFilter]);

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      await api("credentials", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setMessage("Credential saved.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to save credential.");
    }
  }

  async function createType(event: FormEvent) {
    event.preventDefault();
    try {
      await api("credential-types", { method: "POST", body: JSON.stringify({ name: typeName, issuerDefault: "Metro Fire & Rescue" }) });
      setTypeOpen(false);
      setTypeName("");
      setMessage("Custom credential type added.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to add type.");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Credentials"
        title="Certification management"
        description="Department-managed credentials only. Personal Career Road licenses are not shown unless the member shares them here."
        actions={
          <>
            <Button variant="secondary" onClick={() => data && downloadCsv("certifications.csv", data.credentials as unknown as Array<Record<string, unknown>>)}>
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
            <Button variant="secondary" onClick={() => setTypeOpen(true)}>
              Custom credential
            </Button>
            <Button onClick={() => setOpen(true)}>Add credential</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {WINDOWS.map(([id, label]) => (
          <Link
            key={id}
            href={`/certifications?window=${id}`}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${windowFilter === id ? "bg-navy-900 text-white" : "border border-navy-200 bg-white"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Flash message={error} tone="danger" />
      <div className="mb-3">
        <Flash message={message} tone="current" />
      </div>
      <Card>
        {!data ? (
          <p className="p-6 text-navy-500">Loading credentials…</p>
        ) : data.credentials.length === 0 ? (
          <p className="p-6 text-navy-500">No credentials in this window.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Credential</th>
                  <th>Issuer</th>
                  <th>Number</th>
                  <th>Issued</th>
                  <th>Expiration</th>
                  <th>Verification</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.credentials.map((row) => (
                  <tr key={row.id} className="clickable" onClick={() => (window.location.href = `/members/${row.memberId}?tab=certifications`)}>
                    <td className="font-semibold">{row.memberName}</td>
                    <td>{row.credentialName}</td>
                    <td>{row.issuer || "—"}</td>
                    <td>{row.credentialNumber || "—"}</td>
                    <td>{formatDate(row.issueDate)}</td>
                    <td>{formatDate(row.expirationDate)}</td>
                    <td>{row.verificationStatus.toLowerCase().replaceAll("_", " ")}</td>
                    <td>
                      <Badge tone={certTone(row.health)}>{row.label}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={open} title="Add department credential" onClose={() => setOpen(false)}>
        <form onSubmit={save} className="space-y-3">
          <Field label="Member">
            <Select value={form.membershipId} onChange={(e) => setForm({ ...form, membershipId: e.target.value })} required>
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Credential">
            <Select value={form.credentialName} onChange={(e) => setForm({ ...form, credentialName: e.target.value })}>
              {data?.types.map((type) => (
                <option key={type.id}>{type.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Issuing organization">
            <Input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
          </Field>
          <Field label="Credential number">
            <Input value={form.credentialNumber} onChange={(e) => setForm({ ...form, credentialNumber: e.target.value })} />
          </Field>
          <Field label="Issue date">
            <Input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          </Field>
          <Field label="Expiration date" hint="Leave blank if the card has no expiration.">
            <Input type="date" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
          </Field>
          <Field label="Notes">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Button type="submit">Save credential</Button>
        </form>
      </Modal>

      <Modal open={typeOpen} title="Create custom credential" onClose={() => setTypeOpen(false)}>
        <form onSubmit={createType} className="space-y-3">
          <Field label="Name" hint="Examples: Engine Operator, Annual Fit Test, Wildland Red Card">
            <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} required />
          </Field>
          <Button type="submit">Create type</Button>
        </form>
      </Modal>
    </div>
  );
}

export default function CertificationsPage() {
  return (
    <Suspense fallback={<p>Loading certifications…</p>}>
      <CertificationsInner />
    </Suspense>
  );
}
