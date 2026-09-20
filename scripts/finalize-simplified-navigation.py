from pathlib import Path

quick = Path('src/app/(portal)/training-assignments/page.tsx')
s = quick.read_text()
target = '  return (\n    <div>\n      <PageHeader\n        kicker="Training"'
assert target in s, 'Quick-assignment primary page not found'
s = s.replace(target, '  return (\n    <div>\n      <WorkspaceTabs />\n      <PageHeader\n        kicker="Training"', 1)
quick.write_text(s)

shell = Path('src/components/AppShell.tsx')
s = shell.read_text()
target = '          <Link href="/settings" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-white/75 hover:bg-white/10 hover:text-white"><CircleHelp size={18} />Help & account</Link>\n'
assert target in s, 'Duplicate Help & account link not found'
s = s.replace(target, '', 1)
s = s.replace('CalendarCheck, CircleHelp, LayoutDashboard', 'CalendarCheck, LayoutDashboard', 1)
shell.write_text(s)

dashboard = Path('src/app/(portal)/dashboard/page.tsx')
s = dashboard.read_text()
target = '  return (\n    <div>\n      <PageHeader\n        kicker="Today"'
assert target in s, 'Dashboard header not found'
s = s.replace(target, '  return (\n    <div>\n      <div className="mb-4 flex justify-end"><Link href="/inbox" className="inline-flex min-h-11 items-center rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-navy-50">Needs Attention</Link></div>\n      <PageHeader\n        kicker="Today"', 1)
dashboard.write_text(s)
print('Fixed primary quick-assignment tabs, retained inbox access, and removed duplicate Help link')
