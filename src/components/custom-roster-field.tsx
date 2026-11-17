"use client";

import { Field, Input, Select } from "@/components/ui";
import { US_STATES } from "@/lib/class-registration";

export type CustomRosterFieldDefinition = { id: string; label: string; type: string; required: boolean; appliesTo?: "ROSTER" | "RESULT"; description?: string };

export function CustomRosterField({ field, value, onChange, onBlur, disabled = false }: {
  field: CustomRosterFieldDefinition;
  value: unknown;
  onChange: (value: string | number | boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
}) {
  const shown = value == null ? "" : String(value);
  if (field.type === "CHECKBOX") return <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-navy-800"><input type="checkbox" checked={value === true || value === "true"} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />{field.label}{field.required ? " *" : ""}{field.description ? <span className="block text-xs font-normal text-navy-600">{field.description}</span> : null}</label>;
  return <Field label={`${field.label}${field.required ? " *" : ""}`} hint={field.description || undefined}>
    {field.type === "STATE" ? <Select value={shown} disabled={disabled} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">Choose state</option>{US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}</Select>
      : field.type === "PASS_FAIL" ? <Select value={shown} disabled={disabled} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">Choose result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option></Select>
        : field.type === "LETTER_GRADE" ? <Select value={shown} disabled={disabled} required={field.required} onChange={(event) => onChange(event.target.value)}><option value="">Choose grade</option>{["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"].map((grade) => <option key={grade} value={grade}>{grade}</option>)}</Select>
          : <Input type={field.type === "EMAIL" ? "email" : ["NUMBER", "PERCENT", "SCORE_1_10"].includes(field.type) ? "number" : field.type === "DATE" ? "date" : "text"} inputMode={field.type === "LAST4" || field.type === "SCORE_1_10" ? "numeric" : undefined} pattern={field.type === "LAST4" ? "[0-9]{4}" : undefined} maxLength={field.type === "LAST4" ? 4 : field.type === "EMAIL" ? 254 : undefined} min={field.type === "PERCENT" ? "0" : field.type === "SCORE_1_10" ? "1" : undefined} max={field.type === "PERCENT" ? "100" : field.type === "SCORE_1_10" ? "10" : undefined} step={field.type === "SCORE_1_10" ? "1" : undefined} placeholder={field.type === "LAST4" ? "4 digits" : field.type === "SCORE_1_10" ? "1–10" : undefined} value={shown} disabled={disabled} required={field.required} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />}
  </Field>;
}
