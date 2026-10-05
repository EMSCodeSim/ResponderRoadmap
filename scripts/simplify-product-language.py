from pathlib import Path

# Guarded presentation cleanup: preserve routes, permissions, APIs, and stored data.
p = Path('src/components/AppShell.tsx')
s = p.read_text()

replacements = {
    '{ href: "/skill-mastery", label: "Skill Mastery", icon: TrendingUp, visible: allowed.has("skill-mastery"), paths: ["/skill-mastery"] },': '{ href: "/skill-mastery", label: "Training Insights", icon: TrendingUp, visible: allowed.has("skill-mastery"), paths: ["/skill-mastery"] },',
    '{ href: "/classes", label: "Classes & Rosters", icon: CalendarCheck, visible: allowed.has("classes"), paths: ["/classes"] },': '{ href: "/classes", label: "Training Events", icon: CalendarCheck, visible: allowed.has("classes"), paths: ["/classes"] },',
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f'Expected AppShell navigation text not found: {old}')
    s = s.replace(old, new, 1)

p.write_text(s)

# Keep the underlying route/API stable while making the user-facing purpose clearer.
p = Path('src/app/(portal)/skill-mastery/page.tsx')
s = p.read_text()
if 'Skill Mastery' not in s:
    raise SystemExit('Expected Skill Mastery language not found')
s = s.replace('Skill Mastery', 'Training Insights')
s = s.replace('skill mastery', 'training insights')
p.write_text(s)
