from pathlib import Path

# The full implementation is applied by the workflow. This repair pass patches the
# generated qualification service after the existing implementation script runs.
# Kept intentionally small so re-running is deterministic.

path = Path('src/server/services/qualifications.ts')
if path.exists():
    text = path.read_text()
    text = text.replace('export async function createRole(ctx: AuthContext, input: any) {', '''type CreateRoleInput = {
  name?: unknown;
  category?: unknown;
  description?: unknown;
  credentialTypeIds?: unknown[];
  taskBookTemplateIds?: unknown[];
  requirementIds?: unknown[];
  manualApprovalRequired?: boolean;
};

type AuthorizationInput = {
  status?: unknown;
  restriction?: unknown;
  note?: unknown;
  reviewDate?: string | null;
};

export async function createRole(ctx: AuthContext, input: CreateRoleInput) {''')
    text = text.replace('export async function setAuthorization(ctx: AuthContext, membershipId: string, roleId: string, input: any) {', 'export async function setAuthorization(ctx: AuthContext, membershipId: string, roleId: string, input: AuthorizationInput) {')
    path.write_text(text)
else:
    raise SystemExit('qualification service was not generated before repair pass')
