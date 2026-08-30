"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { DEMO_WALKS, type DemoWalkKey } from "@/lib/demo-accounts";
import { Button } from "@/components/ui";

export function WalkDemoButton({
  walk,
  variant = "primary",
  className,
  auto = false,
  children,
}: {
  walk: DemoWalkKey;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  auto?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const account = DEMO_WALKS[walk];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ needsDepartment: boolean }>("auth/demo-login", {
        method: "POST",
        body: JSON.stringify({ walk }),
      });
      router.push(result.needsDepartment ? "/onboarding" : account.next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "The Metro Fire demo is not available in this environment right now.",
      );
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    void go();
    // One-shot walk-in from /login?walk=
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div className={className}>
      <Button type="button" variant={variant} className="w-full" disabled={busy} onClick={go}>
        {busy ? "Opening Metro Fire…" : children || account.cta}
      </Button>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
