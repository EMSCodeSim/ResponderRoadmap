"use client";

import { Suspense } from "react";
import MemberProfile from "./profile";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-navy-500">Loading member…</p>}>
      <MemberProfile />
    </Suspense>
  );
}
