export type DashboardPriorityItem = {
  memberId: string;
  href: string;
};

export type DashboardPriorityGroup<T extends DashboardPriorityItem> = {
  kind: "evaluation" | "follow-up" | "due-soon";
  items: T[];
};

export type RankedDashboardPriority<T extends DashboardPriorityItem> = T & {
  kind: DashboardPriorityGroup<T>["kind"];
};

/**
 * Builds one short action queue for Home. A member is shown only once, using
 * the highest-priority workflow: evaluation, follow-up, then upcoming due date.
 */
export function dashboardPriorities<T extends DashboardPriorityItem>(
  groups: DashboardPriorityGroup<T>[],
  limit = 5,
): RankedDashboardPriority<T>[] {
  const seen = new Set<string>();
  const priorities: RankedDashboardPriority<T>[] = [];

  for (const group of groups) {
    for (const item of group.items) {
      if (seen.has(item.memberId)) continue;
      seen.add(item.memberId);
      priorities.push({ ...item, kind: group.kind });
      if (priorities.length === limit) return priorities;
    }
  }

  return priorities;
}
