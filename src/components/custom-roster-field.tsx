"use client";

import { Field, Input, Select } from "@/components/ui";
import { US_STATES } from "@/lib/class-registration";

export type CustomRosterFieldDefinition = { id: string; label: string; type: string; required: boolean; appliesTo?: "ROSTER" | "RESULT" };

export function CustomRosterField({ field, value, onChange, onBlur, disabled = false }: {
  field: CustomRosterFieldDefinition;
  value: unknown;
  onChange: (value: string | number | boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  const shown = value == null ? "" : String(value);
  if (field.type === "CHECKBOX") return <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-navy-800"><input type="checkbox" checked={value === true || value === "true"} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{field.label}{field.required ? " *" : ""}</label>;
  return <Field label={`${field.label}${field.required ? " *" : ""}`}>
    {field.type === "STATE" ? <Select value={shown} disabled={disabled} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">Choose state</option>{US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</Select>
      : field.type === "PASS_FAIL" ? <Select value={shown} disabled={disabled} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">Choose result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></Select>
        : <Input type={field.type === "EMAIL" ? "email" : field.type === "NUMBER" || field.type === "PERCENT" ? "number" : field.type === "DATE" ? "date" : "text"} inputMode={field.type === "LAST4" ? "numeric" : undefined} pattern={field.type === "LAST4" ? "[0-9]{4}" : undefined} maxLength={field.type === "LAST4" ? 4 : field.type === "EMAIL" ? 254 : undefined} min={field.type === "PERCENT" ? "0" : undefined} max={field.type === "PERCENT" ? "100" : undefined} placeholder={field.type === "LAST4" ? "4 digits" : undefined} value={shown} disabled={disabled} required={field.required} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />}
  </Field>;
}
