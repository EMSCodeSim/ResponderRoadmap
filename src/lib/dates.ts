export type CredentialHealth = "current" | "expiring" | "expired" | "missing";

export type CredentialStatus = {
  health: CredentialHealth;
  daysUntil: number | null;
  label: string;
  window: "expired" | "7" | "14" | "30" | "60" | "90" | "180" | "current" | "missing";
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(date: Date, now = new Date()): number {
  const a = startOfDay(date).getTime();
  const b = startOfDay(now).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function credentialStatus(
  expirationDate: Date | null | undefined,
  now = new Date(),
  doesNotExpire = false,
): CredentialStatus {
  if (doesNotExpire) {
    return {
      health: "current",
      daysUntil: null,
      label: "Does not expire",
      window: "current",
    };
  }
  if (!expirationDate) {
    return {
      health: "missing",
      daysUntil: null,
      label: "No expiration on file",
      window: "missing",
    };
  }

  const days = daysUntil(expirationDate, now);

  if (days < 0) {
    const ago = Math.abs(days);
    return {
      health: "expired",
      daysUntil: days,
      label: ago === 1 ? "Expired yesterday" : `Expired ${ago} days ago`,
      window: "expired",
    };
  }

  if (days === 0) {
    return { health: "expiring", daysUntil: 0, label: "Expires today", window: "7" };
  }

  const window =
    days <= 7 ? "7" : days <= 14 ? "14" : days <= 30 ? "30" : days <= 60 ? "60" : days <= 90 ? "90" : days <= 180 ? "180" : "current";

  if (days <= 60) {
    return {
      health: "expiring",
      daysUntil: days,
      label: days === 1 ? "Expires tomorrow" : `Expires in ${days} days`,
      window,
    };
  }

  if (days <= 180) {
    return {
      health: "current",
      daysUntil: days,
      label: days < 120 ? `Expires in ${days} days` : "Current",
      window,
    };
  }

  return { health: "current", daysUntil: days, label: "Current", window: "current" };
}

export function worstCredentialHealth(items: CredentialStatus[]): CredentialHealth {
  const order: CredentialHealth[] = ["expired", "expiring", "missing", "current"];
  for (const health of order) {
    if (items.some((item) => item.health === health)) return health;
  }
  return "current";
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(value: Date | string | null | undefined, now = new Date()): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 14) return `${diffDay} days ago`;
  return formatDate(date);
}

export function daysRemainingLabel(dueDate: Date | string | null | undefined, now = new Date()): string {
  if (!dueDate) return "No due date";
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const days = daysUntil(date, now);
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "1 day remaining";
  return `${days} days remaining`;
}
