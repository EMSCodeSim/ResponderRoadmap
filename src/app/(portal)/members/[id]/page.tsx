"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import MemberProfile from "./profile";

export default function Page() {
  const params = useParams<{ id: string }>();
  const [canManageRoles, setCanManageRoles] = useState(false);

  useEffect(() => {
    api<{ permissions?: string[] }>("auth/me")
      .then((session) => setCanManageRoles(Boolean(session.permissions?.includes("roles.write"))))
      .catch(() => undefined);
  }, []);

  return (
    <div>
      {canManageRoles ? (
        <div className="mb-4 flex justify-end">
          <Link
            href={`/members/${params.id}/permissions`}
            className="min-h-11 rounded-md border border-navy-200 bg-white px-3 py-2 text-sm font-semibold text-navy-700 shadow-sm hover:bg-navy-50"
          >
            Role & Permissions
          </Link>
        </div>
      ) : null}
      <Suspense fallback={<p className="text-navy-500">Loading member…</p>}>
        <MemberProfile />
      </Suspense>
    </div>
  );
}
