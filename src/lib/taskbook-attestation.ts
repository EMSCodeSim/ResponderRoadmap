export const TASKBOOK_ATTESTATION_VERSION = "taskbook-signoff-v1";

export const TASKBOOK_ATTESTATION_TEXT =
  "I verify that I personally reviewed this member's submitted work and available evidence and, to the best of my knowledge, this requirement was completed to department standards for this approval stage.";

export function taskBookAttestationRecord(input: {
  reviewerName: string;
  reviewerRole?: string | null;
}) {
  const role = input.reviewerRole ? ` (${input.reviewerRole})` : "";
  return `[${TASKBOOK_ATTESTATION_VERSION}] Electronically attested by ${input.reviewerName}${role}: ${TASKBOOK_ATTESTATION_TEXT}`;
}
