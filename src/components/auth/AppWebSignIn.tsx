"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui";

type WebSignInRequest = {
  requestId: string;
  approvalToken: string;
  browserSecret: string;
  expiresAt: string;
  deepLink: string;
  approvalUrl: string;
};

export function AppWebSignIn({ onSignedIn }: { onSignedIn: (needsDepartment: boolean) => void }) {
  const [request, setRequest] = useState<WebSignInRequest | null>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "WAITING" | "APPROVED">("IDLE");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  useEffect(() => () => stopPolling(), []);

  async function start() {
    stopPolling();
    setStarting(true);
    setError(null);
    setQr("");
    try {
      const created = await api<WebSignInRequest>("auth/web-signin/request", { method: "POST" });
      setRequest(created);
      setStatus("WAITING");
      setQr(await QRCode.toDataURL(created.deepLink, { width: 320, margin: 1, errorCorrectionLevel: "M" }));

      timer.current = setInterval(async () => {
        try {
          const result = await api<{ status: "PENDING" | "APPROVED"; needsDepartment?: boolean }>("auth/web-signin/consume", {
            method: "POST",
            body: JSON.stringify({ requestId: created.requestId, browserSecret: created.browserSecret }),
          });
          if (result.status === "APPROVED") {
            stopPolling();
            setStatus("APPROVED");
            onSignedIn(Boolean(result.needsDepartment));
          }
        } catch (err) {
          if (err instanceof ApiError && (err.status === 409 || err.status === 410)) {
            stopPolling();
            setStatus("IDLE");
            setError("This QR code expired or was already used. Create a new one.");
          }
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create app sign-in request.");
      setStatus("IDLE");
    } finally {
      setStarting(false);
    }
  }

  if (!request || status === "IDLE") {
    return (
      <div className="mt-5 rounded-md border border-navy-200 bg-navy-50 p-4">
        <div className="text-sm font-bold text-navy-900">Already signed in on the Responder Roadmap app?</div>
        <p className="mt-1 text-xs text-navy-500">Use the app to sign in to this browser without typing your password.</p>
        {error ? <p className="mt-2 text-xs font-semibold text-danger">{error}</p> : null}
        <Button type="button" variant="secondary" className="mt-3 w-full" disabled={starting} onClick={() => void start()}>
          {starting ? "Creating secure sign-in…" : "Sign in with app"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-md border border-navy-200 bg-white p-4 text-center">
      <div className="text-sm font-bold text-navy-900">Sign in with the app</div>
      <p className="mt-1 text-xs text-navy-500">Open Responder Roadmap on your phone and scan this code. The request expires in about 2 minutes.</p>
      {qr ? <Image src={qr} width={220} height={220} alt="QR code for secure Responder Roadmap web sign-in" className="mx-auto mt-3 rounded-md" unoptimized /> : null}
      <p className="mt-2 text-xs font-semibold text-navy-600">{status === "APPROVED" ? "Approved. Signing you in…" : "Waiting for approval in the app…"}</p>
      <a href={request.deepLink} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-md border border-navy-200 px-3 text-sm font-semibold text-fire hover:border-fire">
        Open Responder Roadmap app
      </a>
      <button type="button" className="mt-3 text-xs font-semibold text-navy-500 underline" onClick={() => void start()}>Create a new code</button>
      {error ? <p className="mt-2 text-xs font-semibold text-danger">{error}</p> : null}
    </div>
  );
}
