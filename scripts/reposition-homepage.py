from pathlib import Path

p = Path("src/app/landing.tsx")
s = p.read_text()
replacements = {
'''<BrandLockup size={44} subtitle="Task Books for Fire & EMS" />''': '''<BrandLockup size={44} subtitle="Fire & EMS Training Management" />''',
'''Start Demo''': '''See Department Demo''',
'''Founding Department List''': '''Department Pricing & Access''',
'''Built for the station, not a generic training platform''': '''Fire & EMS training management built around digital Task Books''',
'''Know who is ready.\n              <span className="block text-white/80">Prove it on the record.</span>''': '''Assign it. Complete it. Sign it off.\n              <span className="block text-white/80">Prove it.</span>''',
'''Build qualification Task Books, create class rosters, assign skills checklists, evaluate members from a phone, track certifications, and keep a department record without turning training into a complicated software project.''': '''Create and assign digital Task Books, route skills to evaluators for field sign-off, track certifications and progress, and keep a defensible department training record—without the complexity of a traditional LMS.''',
'''<span className="text-fire">AI Task Book Creator</span>\n              <span className="text-white/55">Guided follow-up questions · PDF import · Human review</span>''': '''<span className="text-fire">Built around the workflow departments already use</span>\n              <span className="text-white/55">Assign · Complete · Evaluate · Approve · Record</span>''',
'''<WalkDemoButton walk="to">Start Live Demo</WalkDemoButton>''': '''<WalkDemoButton walk="to">See the 3-Minute Department Demo</WalkDemoButton>''',
'''No signup. Start in the Training Officer view and use the real ResponderRoadmap workflow with Metro Fire sample data.''': '''No signup. See the Training Officer view, follow a member from assignment to sign-off, and inspect the record the department retains.''',
}
for old, new in replacements.items():
    if old not in s:
        raise SystemExit(f"Missing expected homepage text: {old[:80]}")
    s = s.replace(old, new)

needle = '''            <p className="mt-3 text-xs text-white/40">\n              The live demo opens as the Training Officer with realistic members, Task Books, class rosters, inbox alerts, sign-offs, shared certifications, and reports.\n            </p>'''
replacement = needle + '''\n            <Link href="/firefighter-task-book-software" className="mt-4 inline-flex text-sm font-semibold text-fire hover:underline">\n              Explore firefighter digital Task Book software →\n            </Link>'''
if needle not in s:
    raise SystemExit("Missing preview footer")
s = s.replace(needle, replacement)
p.write_text(s)
