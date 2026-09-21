"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

type ClassInfo = { title: string; startsAt: string; location: string; open: boolean };

export default function PublicClassJoinPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<ClassInfo>(`public/classes/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load this class."));
  }, [token]);

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`public/classes/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ name, email, organization, consent, website }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to register. Contact your instructor.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1220] px-4 py-10 text-navy-900">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-fire">Responder Roadmap · Class registration</p>
        {!info ? <p className="mt-5" role="status">{error || "Loading class…"}</p> : (
          <>
            <h1 className="display mt-3 text-3xl font-bold">{info.title}</h1>
            <p className="mt-2 text-sm text-navy-600">{new Date(info.startsAt).toLocaleString()}{info.location ? ` · ${info.location}` : ""}</p>
            {done ? (
              <div className="mt-6 rounded-xl border border-green-300 bg-green-50 p-5" role="status">
                <h2 className="font-bold">Registration received</h2>
                <p className="mt-2 text-sm">Your information has been submitted for this class roster. An instructor will confirm attendance and record results. Registration is not certification or completion.</p>
              </div>
            ) : !info.open ? (
              <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4" role="status">Registration is closed. Contact your instructor.</p>
            ) : (
              <form onSubmit={register} className="mt-6 space-y-4">
                <p className="text-sm text-navy-600">Enter your own information. A department account is not required.</p>
                <label className="block text-sm font-semibold">Full name
                  <input className="mt-1 min-h-11 w-full rounded-lg border border-navy-200 px-3" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} autoComplete="name" />
                </label>
                <label className="block text-sm font-semibold">Email address
                  <input type="email" className="mt-1 min-h-11 w-full rounded-lg border border-navy-200 px-3" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} autoComplete="email" />
                </label>
                <label className="block text-sm font-semibold">Organization / agency (optional)
                  <input className="mt-1 min-h-11 w-full rounded-lg border border-navy-200 px-3" value={organization} onChange={(event) => setOrganization(event.target.value)} maxLength={180} />
                </label>
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
                </div>
                <label className="flex gap-3 text-xs leading-5 text-navy-600">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
                  <span>I understand my name, email, and optional organization will be shared with this class’s instructors for the roster, attendance, and evaluation records.</span>
                </label>
                {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
                <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-[#E11D48] px-4 font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Join class roster"}</button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
