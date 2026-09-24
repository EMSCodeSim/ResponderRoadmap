"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Badge, Button, Card, Field, Flash, Input, PageHeader } from "@/components/ui";

type Option = { id: string; name?: string; title?: string };
type Profile = {
  id: string; name: string; matchRanks: string[]; matchPositions: string[];
  credentialTypeIds: string[]; taskBookTemplateIds: string[];
  annualHours: Record<string, number>; active: boolean;
};
type Payload = { profiles: Profile[]; credentialTypes: Option[]; taskBooks: Option[] };

const CATEGORIES = ["COMPANY", "FACILITY", "HAZMAT", "DRIVER", "OFFICER", "EMS", "OTHER"];
const empty = { name: "", matchRanks: "", matchPositions: "", credentialTypeIds: [] as string[], taskBookTemplateIds: [] as string[], annualHours: {} as Record<string, number>, active: true };

export default function TrainingExpectationsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() { setData(await api<Payload>("training-expectations")); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  function edit(profile?: Profile) {
    setEditing(profile?.id || "new");
    setForm(profile ? {
      name: profile.name,
      matchRanks: profile.matchRanks.join(", "),
      matchPositions: profile.matchPositions.join(", "),
      credentialTypeIds: profile.credentialTypeIds,
      taskBookTemplateIds: profile.taskBookTemplateIds,
      annualHours: profile.annualHours,
      active: profile.active,
    } : { ...empty, credentialTypeIds: [], taskBookTemplateIds: [], annualHours: {} });
  }

  function toggle(list: string[], id: string) { return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]; }
  function split(value: string) { return value.split(",").map((item) => item.trim()).filter(Boolean); }

  async function save(event: FormEvent) {
    event.preventDefault();
    try {
      const body = { ...form, matchRanks: split(form.matchRanks), matchPositions: split(form.matchPositions) };
      await api(editing === "new" ? "training-expectations" : `training-expectations/${editing}`, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(body) });
      setEditing(null); setMessage("Training expectations saved."); await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to save expectations."); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this training expectation profile?")) return;
    await api(`training-expectations/${id}`, { method: "DELETE" });
    setMessage("Training expectation deleted."); await load();
  }

  return <div>
    <PageHeader kicker="Department setup" title="Training expectations" description="Define what your department expects by rank or position. Roadmap compares these expectations with each member's actual credentials, task books, and annual training hours." actions={<Button onClick={() => edit()}>Add expectation profile</Button>} />
    <Flash message={error} tone="danger" /><div className="mb-4"><Flash message={message} tone="current" /></div>
    <Card className="mb-5 p-4"><p className="text-sm text-navy-600"><strong>Your department defines the expectations.</strong> Responder Roadmap uses them to identify training gaps; it does not determine regulatory, ISO, or certification compliance.</p></Card>

    {editing ? <Card className="mb-6 p-5"><form onSubmit={save} className="space-y-5">
      <div><h2 className="display text-2xl font-bold">{editing === "new" ? "New expectation profile" : "Edit expectation profile"}</h2><p className="mt-1 text-sm text-navy-500">Example: Driver/Operator, Firefighter, Company Officer, EMT, or Paramedic.</p></div>
      <Field label="Profile name"><Input value={form.name} onChange={(e) => setForm({...form,name:e.target.value})} placeholder="Driver/Operator" required /></Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Apply to ranks" hint="Comma-separated. Leave blank if matching by position."><Input value={form.matchRanks} onChange={(e) => setForm({...form,matchRanks:e.target.value})} placeholder="Firefighter, Engineer" /></Field>
        <Field label="Apply to positions" hint="Comma-separated. A member matches when either rank or position matches."><Input value={form.matchPositions} onChange={(e) => setForm({...form,matchPositions:e.target.value})} placeholder="Driver/Operator" /></Field>
      </div>
      <div><div className="kicker">Required credentials</div><div className="mt-2 grid gap-2 md:grid-cols-2">{data?.credentialTypes.map((item) => <label key={item.id} className="flex items-center gap-2 rounded-md border border-navy-200 p-3 text-sm"><input type="checkbox" checked={form.credentialTypeIds.includes(item.id)} onChange={() => setForm({...form,credentialTypeIds:toggle(form.credentialTypeIds,item.id)})}/>{item.name}</label>)}</div></div>
      <div><div className="kicker">Required task books</div><div className="mt-2 grid gap-2 md:grid-cols-2">{data?.taskBooks.map((item) => <label key={item.id} className="flex items-center gap-2 rounded-md border border-navy-200 p-3 text-sm"><input type="checkbox" checked={form.taskBookTemplateIds.includes(item.id)} onChange={() => setForm({...form,taskBookTemplateIds:toggle(form.taskBookTemplateIds,item.id)})}/>{item.title}</label>)}</div></div>
      <div><div className="kicker">Annual training-hour expectations</div><p className="mt-1 text-sm text-navy-500">Only completed training with PRESENT attendance counts.</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{CATEGORIES.map((category)=><Field key={category} label={category.charAt(0)+category.slice(1).toLowerCase()}><Input type="number" min={0} step="0.5" value={form.annualHours[category] || ""} onChange={(e)=>setForm({...form,annualHours:{...form.annualHours,[category]:Number(e.target.value)||0}})} placeholder="0"/></Field>)}</div></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form,active:e.target.checked})}/> Profile active</label>
      <div className="flex gap-2"><Button type="submit">Save expectations</Button><Button type="button" variant="secondary" onClick={()=>setEditing(null)}>Cancel</Button></div>
    </form></Card> : null}

    <div className="grid gap-4 lg:grid-cols-2">{data?.profiles.map((profile)=><Card key={profile.id} className="p-5">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold">{profile.name}</h2><Badge tone={profile.active?"current":"neutral"}>{profile.active?"Active":"Inactive"}</Badge></div><p className="mt-1 text-sm text-navy-500">{[...profile.matchRanks,...profile.matchPositions].join(", ") || "No rank/position match configured"}</p></div></div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-md bg-navy-50 p-3"><div className="text-xl font-bold">{profile.credentialTypeIds.length}</div><div className="text-xs text-navy-500">Credentials</div></div><div className="rounded-md bg-navy-50 p-3"><div className="text-xl font-bold">{profile.taskBookTemplateIds.length}</div><div className="text-xs text-navy-500">Task books</div></div><div className="rounded-md bg-navy-50 p-3"><div className="text-xl font-bold">{Object.values(profile.annualHours).filter(Boolean).length}</div><div className="text-xs text-navy-500">Hour targets</div></div></div>
      <div className="mt-4 flex gap-2"><Button variant="secondary" onClick={()=>edit(profile)}>Edit</Button><Button variant="secondary" onClick={()=>remove(profile.id)}>Delete</Button></div>
    </Card>)}</div>
    {data?.profiles.length===0&&!editing?<Card className="p-8 text-center"><h2 className="text-lg font-bold">No expectations defined yet</h2><p className="mt-2 text-sm text-navy-500">Create a profile for a rank or position to make Training Gaps department-specific.</p></Card>:null}
  </div>;
}
