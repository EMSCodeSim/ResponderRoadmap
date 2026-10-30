export type GuestRegistration = { name: string; email: string; organization: string; customValues: Record<string, string | number | boolean | null> };
export type RegistrationCustomField = { id: string; label: string; type: string; required: boolean; appliesTo?: string };

export const US_STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"] as const;

export class RegistrationInputError extends Error {
  constructor(message: string) { super(message); this.name = "RegistrationInputError"; }
}

export function normalizeGuestRegistration(raw: unknown, rosterFields: RegistrationCustomField[] = []): GuestRegistration {
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
  const providedValues = fields.customValues && typeof fields.customValues === "object" && !Array.isArray(fields.customValues) ? fields.customValues as Record<string, unknown> : {};
  const customValues: GuestRegistration["customValues"] = {};
  for (const field of rosterFields) {
    const value = providedValues[field.id];
    const text = typeof value === "string" ? value.trim() : "";
    if (field.type === "CHECKBOX") {
      const checked = value === true || value === "true";
      if (field.required && !checked) throw new RegistrationInputError(`Confirm ${field.label}.`);
      customValues[field.id] = checked;
      continue;
    }
    if (field.required && !text) throw new RegistrationInputError(`Enter ${field.label}.`);
    if (!text) { customValues[field.id] = null; continue; }
    if (field.type === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new RegistrationInputError(`Enter a valid ${field.label.toLowerCase()}.`);
    if (field.type === "STATE" && !US_STATES.includes(text.toUpperCase() as (typeof US_STATES)[number])) throw new RegistrationInputError(`Choose a valid state for ${field.label}.`);
    if (field.type === "LAST4" && !/^\d{4}$/.test(text)) throw new RegistrationInputError(`${field.label} must contain exactly four digits.`);
    if (field.type === "NUMBER" || field.type === "PERCENT") {
      const number = Number(text);
      if (!Number.isFinite(number) || (field.type === "PERCENT" && (number < 0 || number > 100))) throw new RegistrationInputError(`Enter a valid value for ${field.label}.`);
      customValues[field.id] = number;
    } else customValues[field.id] = text.slice(0, 500);
  }
  return { name, email, organization, customValues };
}
