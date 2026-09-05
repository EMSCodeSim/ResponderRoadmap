export function activityText(type: string, metadata: Record<string, unknown>, actorName: string | null) {
  const actor = String(metadata.actorName || actorName || "Someone");
  const member = String(metadata.memberName || "");
  const title = String(metadata.title || metadata.taskBook || "");
  const requirement = String(metadata.requirement || "");
  const credential = String(metadata.credential || "");
  switch (type) {
    case "REQUIREMENT_COMPLETED":
      return `${member || actor} completed ${requirement || "a requirement"}`;
    case "REQUIREMENT_SUBMITTED":
      return `${member || actor} requested evaluation for ${requirement || "a requirement"}`;
    case "REQUIREMENT_SIGNED":
      return `${actor} signed ${requirement}${title ? ` (${title})` : ""}`;
    case "REQUIREMENT_RETURNED":
      return `${actor} returned ${requirement} to ${member}`;
    case "CREDENTIAL_UPLOADED":
      return `${member || actor} uploaded ${credential || "a credential"}`;
    case "CREDENTIAL_UPDATED":
      return `${actor} updated ${credential} for ${member}`;
    case "CREDENTIAL_SHARED":
      return `${member || actor} shared ${credential || "a certification"} with the department`;
    case "CREDENTIAL_SHARING_REVOKED":
      return `${member || actor} stopped sharing ${credential || "a certification"}`;
    case "TASKBOOK_ASSIGNED":
      return `${title || "Task Book"} assigned to ${member || "a member"}`;
    case "TASKBOOK_PUBLISHED":
      return `${actor} published ${title} v${String(metadata.version || "")}`.trim();
    case "TASKBOOK_CREATED":
      return `${actor} created Task Book ${title}`;
    case "NOTE_ADDED":
      return `${actor} added a training note`;
    case "MEMBER_JOINED":
      return `${member || actor} joined the department`;
    default:
      return `${actor} recorded ${type.toLowerCase().replaceAll("_", " ")}`;
  }
}
