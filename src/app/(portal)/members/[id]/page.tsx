"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams } from "next/navigation";
import MemberProfile from "./profile";

export default function Page() {
  const params = useParams<{ id: string }>();

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Link
          href={`/members/${params.id}/permissions`}
          className="rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700 shadow-sm hover:bg-navy-50"
        >
          Role & Permissions
        </Link>
      </div>
      <Suspense fallback={<p className="text-navy-500">Loading member…</p>}>
        <MemberProfile />
      </Suspense>
    </div>
  );
}
