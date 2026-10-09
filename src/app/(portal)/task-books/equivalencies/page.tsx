"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button, Card, PageHeader, Field, Select, TextArea, Flash } from "@/components/ui";

type Skill = { id: string; title: string; taskBook: string };
type Equivalency = { id: string; sourceRequirementId: string; targetRequirementId: string; reason: string; approvedAt: string };

export default function SkillEquivalenciesPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [links, setLinks] = useState<Equivalency[]>([]);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const [available, existing] = await Promise.all([
      api<Skill[]>("skill-evidence-equivalencies/skills"),
      api<Equivalency[]>("skill-evidence-equivalencies"),
    ]);
    setSkills(available);
    setLinks(existing);
  }
  useEffect(() => { void load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load skill mappings.")); }, []);
  const names = new Map(skills.map((item) => [item.id, `${item.taskBook} — ${item.title}`]));
  async function approve() {
    setBusy(true); setError(""); setMessage("");
    try {
      await api("skill-evidence-equivalencies", { method: "POST", body: JSON.stringify({ sourceRequirementId: source, targetRequirementId: target, reason }) });
      await load();
      setSource(""); setTarget(""); setReason("");
      setMessage("Equivalency approved. Existing Task Book sign-offs remain required.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to approve this mapping."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!window.confirm("Revoke this mapping? Existing audit history is retained, but this link will no longer authorize new evidence reuse.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await api(`skill-evidence-equivalencies/${id}/revoke`, { method: "POST" });
      await load();
      setMessage("Mapping revoked.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to revoke."); }
    finally { setBusy(false); }
  }
  return <div>
    <PageHeader kicker="Training evidence" title="Approved Skill Equivalencies" description="Training leadership can authorize a documented Training Sheet skill as evidence for a different Task Book requirement. This never grants competency approval." actions={<Link href="/task-books" className="text-sm font-semibold text-fire underline">Back to Task Books</Link>} />
    <Flash tone="danger" message={error} /><Flash tone="current" message={message} />
    <Card className="mb-5 p-5">
      <h2 className="text-xl font-bold">Approve a skill match</h2>
      <p className="mt-1 text-sm text-navy-600">Choose a skill that was performed, then the requirement it may support. The mapping works in that direction only.</p>
      <div className="mt-4 grid gap-4">
        <Field label="Source Training Sheet skill"><Select value={source} onChange={(event) => setSource(event.target.value)}><option value="">Select source skill</option>{skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.taskBook} — {skill.title}</option>)}</Select></Field>
        <Field label="Target Task Book requirement"><Select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Select target requirement</option>{skills.map((skill) => <option value={skill.id} key={skill.id}>{skill.taskBook} — {skill.title}</option>)}</Select></Field>
        <Field label="Reason for equivalency"><TextArea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain how the demonstrated skill meets the target standard, including any limitations." /></Field>
        <Button onClick={() => void approve()} disabled={busy || !source || !target || source === target || reason.trim().length < 10}>Approve evidence match</Button>
      </div>
    </Card>
    <Card className="p-5">
      <h2 className="text-xl font-bold">Active approved matches</h2>
      {links.length === 0 ? <p className="mt-3 text-sm text-navy-600">No cross-template equivalencies approved yet. Exact skill matches still work.</p> : (
        <ul className="mt-3 divide-y divide-navy-100">{links.map((item) => <li key={item.id} className="py-4">
          <div className="text-sm font-semibold">{names.get(item.sourceRequirementId) || item.sourceRequirementId} → {names.get(item.targetRequirementId) || item.targetRequirementId}</div>
          <p className="mt-2 text-sm text-navy-600">{item.reason}</p>
          <p className="mt-1 text-xs text-navy-500">Approved {new Date(item.approvedAt).toLocaleDateString()}</p>
          <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => void revoke(item.id)}>Revoke match</Button>
        </li>)}</ul>
      )}
    </Card>
  </div>;
}
