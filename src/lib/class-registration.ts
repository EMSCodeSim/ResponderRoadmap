export type GuestRegistration = { name: string; email: string; organization: string };

export class RegistrationInputError extends Error {
  constructor(message: string) { super(message); this.name = "RegistrationInputError"; }
}

export function normalizeGuestRegistration(raw: unknown): GuestRegistration {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new RegistrationInputError("Enter your registration details.");
  const fields = raw as Record<string, unknown>;
  if (fields.website) throw new RegistrationInputError("Unable to accept this registration.");
  if (fields.consent !== true) throw new RegistrationInputError("Please acknowledge how your registration details will be used.");
  const name = typeof fields.name === "string" ? fields.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
  const organization = typeof fields.organization === "string" ? fields.organization.trim() : "";
  if (name.length < 2 || name.length > 120) throw new RegistrationInputError("Enter your full name (2–120 characters).");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RegistrationInputError("Enter a valid email address.");
  if (organization.length > 180) throw new RegistrationInputError("Organization must be 180 characters or fewer.");
  return { name, email, organization };
}
