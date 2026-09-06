type InvitationEmail = {
  id: string;
  token: string;
  email: string | null;
  departmentName: string;
  roleLabel: string;
  invitedByName: string;
};

export type InvitationDelivery = {
  status: "SENT" | "NOT_CONFIGURED" | "NO_EMAIL" | "FAILED";
  message: string;
};

const apiKey = () => process.env.RESEND_API_KEY?.trim() || "";
const fromEmail = () => process.env.RESEND_FROM_EMAIL?.trim() || "";

export function invitationEmailConfigured() {
  return Boolean(apiKey() && fromEmail());
}

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "https://responderroadmap.com").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailBody(invitation: InvitationEmail) {
  const invitationUrl = `${appOrigin()}/invite/${encodeURIComponent(invitation.token)}`;
  const department = escapeHtml(invitation.departmentName);
  const inviter = escapeHtml(invitation.invitedByName);
  const role = escapeHtml(invitation.roleLabel);
  return {
    from: fromEmail(),
    to: [invitation.email!],
    subject: `Join ${invitation.departmentName} on ResponderRoadmap`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#132238"><h1 style="font-size:24px">You have been invited to ResponderRoadmap</h1><p>${inviter} invited you to join <strong>${department}</strong> as <strong>${role}</strong>.</p><p><a href="${invitationUrl}" style="display:inline-block;background:#c2412d;color:white;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">Accept department invitation</a></p><p style="font-size:13px;color:#526174">This link expires in 14 days. If you already use ResponderRoadmap, sign in and accept the invitation. Otherwise, the link will guide you through account creation.</p><p style="font-size:12px;color:#718096">If you were not expecting this invitation, you can ignore this email.</p></div>`,
    text: `${invitation.invitedByName} invited you to join ${invitation.departmentName} as ${invitation.roleLabel} on ResponderRoadmap. Accept the invitation within 14 days: ${invitationUrl}`,
  };
}

export async function sendInvitationEmail(invitation: InvitationEmail): Promise<InvitationDelivery> {
  if (!invitation.email) return { status: "NO_EMAIL", message: "No email address was provided; copy the invitation link manually." };
  if (!invitationEmailConfigured()) {
    return { status: "NOT_CONFIGURED", message: "Email delivery is not configured; copy the invitation link manually." };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `invitation-${invitation.id}-${invitation.token}`,
      },
      body: JSON.stringify(emailBody(invitation)),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      return { status: "FAILED", message: payload?.message || `Email provider returned ${response.status}.` };
    }
    return { status: "SENT", message: `Invitation emailed to ${invitation.email}.` };
  } catch {
    return { status: "FAILED", message: "Email delivery could not be reached; the invitation link is still available." };
  }
}

export async function sendInvitationEmailBatch(invitations: InvitationEmail[]): Promise<InvitationDelivery> {
  const deliverable = invitations.filter((invitation) => invitation.email);
  if (deliverable.length === 0) return { status: "NO_EMAIL", message: "No email addresses were available." };
  if (!invitationEmailConfigured()) {
    return { status: "NOT_CONFIGURED", message: "Email delivery is not configured; invitation links were still created." };
  }
  try {
    for (let index = 0; index < deliverable.length; index += 100) {
      const batch = deliverable.slice(index, index + 100);
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `invitation-batch-${batch.map((item) => item.id).join("-")}`.slice(0, 256),
        },
        body: JSON.stringify(batch.map(emailBody)),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        return { status: "FAILED", message: payload?.message || `Email provider returned ${response.status}.` };
      }
    }
    return { status: "SENT", message: `${deliverable.length} invitation email${deliverable.length === 1 ? "" : "s"} sent.` };
  } catch {
    return { status: "FAILED", message: "Email delivery could not be reached; invitation links were still created." };
  }
}
