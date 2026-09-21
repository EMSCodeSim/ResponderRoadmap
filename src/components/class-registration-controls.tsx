"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api, ApiError } from "@/lib/api";
import { Button, Card } from "@/components/ui";

type Detail = { registrationToken: string | null; registrationEnabled: boolean } & Record<string, unknown>;

export function ClassRegistrationControls({ classId, token, enabled, status, onChange }: {
  classId: string; token: string | null; enabled: boolean; status: string; onChange: (detail: Detail) => void;
}) {
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!token) { setUrl(""); setQr(""); return; }
    const next = `${window.location.origin}/class-join/${encodeURIComponent(token)}`;
    setUrl(next);
    QRCode.toDataURL(next, { width: 360, margin: 2, errorCorrectionLevel: "M" }).then(setQr).catch(() => setError("Unable to generate the QR image."));
  }, [token]);
  async function change(action: "OPEN" | "CLOSE" | "ROTATE") {
    setBusy(true); setError("");
    try { onChange(await api<Detail>(`classes/${classId}/registration`, { method: "POST", body: JSON.stringify({ action }) })); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Unable to update registration."); }
    finally { setBusy(false); }
  }
  const canOpen = ["DRAFT", "ACTIVE"].includes(status);
  return <Card className="no-print mb-5 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Student QR registration</h2><p className="mt-1 text-sm text-navy-600">Guests join this roster without an account or department seat. Registration does not mark attendance or completion.</p></div><span className="rounded-full bg-navy-100 px-3 py-1 text-xs font-bold">{enabled ? "Open" : "Closed"}</span></div>
    {token ? <><div className="mt-5 flex flex-wrap gap-5">{enabled && qr ? <Image alt="Class registration QR code" src={qr} width={220} height={220} unoptimized className="rounded-lg border bg-white p-2" /> : null}<div className="min-w-0 flex-1">{enabled ? <><input aria-label="Registration link" readOnly value={url} onFocus={(event) => event.target.select()} className="w-full rounded-lg border p-3 text-xs" /><div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => navigator.clipboard.writeText(url)}>Copy link</Button>{qr ? <a className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-semibold" href={qr} download="class-registration-qr.png">Download QR</a> : null}<Button variant="secondary" onClick={() => window.print()}>Print</Button></div></> : <p className="text-sm">The old link is disabled; existing roster records are retained.</p>}</div></div><div className="mt-4 flex flex-wrap gap-2">{enabled ? <Button variant="secondary" disabled={busy} onClick={() => change("CLOSE")}>Close registration</Button> : canOpen ? <Button disabled={busy} onClick={() => change("OPEN")}>Open registration</Button> : null}{canOpen ? <Button variant="ghost" disabled={busy} onClick={() => window.confirm("Replace this QR code and invalidate the previous link?") && void change("ROTATE")}>Replace QR code</Button> : null}</div></> : canOpen ? <div className="mt-4"><Button disabled={busy} onClick={() => change("OPEN")}>Generate QR code</Button></div> : <p className="mt-3 text-sm">Registration is unavailable for this class.</p>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
  </Card>;
}
