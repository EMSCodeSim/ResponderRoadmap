from pathlib import Path

page = Path('src/app/(portal)/members/page.tsx')
s = page.read_text()

def change(old, new):
    global s
    assert old in s, f'People page target not found: {old[:70]}'
    s = s.replace(old, new, 1)

change('  name: string;\n  rank: string | null;', '  name: string;\n  role: string;\n  rank: string | null;')
change('  const [peopleActions, setPeopleActions] = useState<string[]>([]);', '''  const [peopleActions, setPeopleActions] = useState<string[]>([]);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);''')
change('    api<{ nav: string[] }>("auth/me")\n      .then((session) => setPeopleActions(session.nav))', '''    api<{ nav: string[]; membershipId: string; role: string }>("auth/me")
      .then((session) => {
        setPeopleActions(session.nav);
        setCurrentMemberId(session.membershipId);
        setCurrentRole(session.role);
      })''')
change('  const books = useMemo(', '''  async function removeMember(member: MemberRow) {
    if (member.status !== "ACTIVE" || member.id === currentMemberId || removingId) return;
    if (!window.confirm(`Remove ${member.name} from the active department roster? Their training records will be retained and they can be reactivated later.`)) return;
    setRemovingId(member.id);
    setActionMessage(null);
    try {
      await api(`members/${member.id}`, { method: "PATCH", body: JSON.stringify({ status: "INACTIVE" }) });
      setData((previous) => previous ? {
        ...previous,
        members: previous.members.map((row) => row.id === member.id ? { ...row, status: "INACTIVE" } : row)
          .filter((row) => !status || row.status === status),
      } : previous);
      setActionMessage(`${member.name} was removed from the active roster. Their training history was preserved.`);
    } catch (err) {
      setActionMessage(err instanceof Error ? `Unable to remove ${member.name}: ${err.message}` : `Unable to remove ${member.name}.`);
    } finally {
      setRemovingId(null);
    }
  }

  const canRemoveMembers = currentRole === "TRAINING_OFFICER" || currentRole === "DEPARTMENT_ADMINISTRATOR";

  const books = useMemo(''')
change('      <Card className="p-4">', '      {actionMessage ? <p role="status" className="mb-3 rounded-md border border-navy-200 bg-white p-3 text-sm text-navy-800">{actionMessage}</p> : null}\n      <Card className="p-4">')
change('                  <th>Status</th>', '                  <th>Status</th>\n                  {canRemoveMembers ? <th>Manage</th> : null}')
change('                    </td>\n                  </tr>\n                ))}', '''                    </td>
                    {canRemoveMembers ? (
                      <td>
                        {member.status === "ACTIVE" && member.id !== currentMemberId && (member.role !== "DEPARTMENT_ADMINISTRATOR" || currentRole === "DEPARTMENT_ADMINISTRATOR") ? (
                          <button
                            type="button"
                            disabled={removingId !== null}
                            onClick={() => void removeMember(member)}
                            className="min-h-10 rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Remove ${member.name} from department`}
                          >
                            {removingId === member.id ? "Removing…" : "Remove member"}
                          </button>
                        ) : <span className="text-xs text-navy-400">—</span>}
                      </td>
                    ) : null}
                  </tr>
                ))}''')
page.write_text(s)

service = Path('src/server/services/members.ts')
t = service.read_text()
old = '  if (!membership) throw new HttpError(404, "Member not found.");\n  if (input.role && input.role !== membership.role) {'
new = '''  if (!membership) throw new HttpError(404, "Member not found.");
  if (input.status === "INACTIVE" && membership.id === ctx.membershipId) {
    throw new HttpError(400, "You cannot remove your own department membership.");
  }
  if (input.status === "INACTIVE" && membership.role === "DEPARTMENT_ADMINISTRATOR") {
    assertPermission(ctx, "roles.write");
  }
  if (input.role && input.role !== membership.role) {'''
assert old in t, 'Member status update target not found'
service.write_text(t.replace(old, new, 1))
print('Updated People roster and member status protection')
