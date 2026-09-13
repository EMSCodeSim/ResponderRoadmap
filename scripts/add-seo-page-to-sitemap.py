from pathlib import Path

path = Path('src/app/sitemap.ts')
text = path.read_text()
needle = '''    {
      url: "https://responderroadmap.com/department-interest",
'''
insert = '''    {
      url: "https://responderroadmap.com/firefighter-task-book-software",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: "https://responderroadmap.com/department-interest",
'''
if needle not in text:
    raise SystemExit('Expected sitemap entry not found; refusing unsafe patch')
if 'firefighter-task-book-software' not in text:
    path.write_text(text.replace(needle, insert, 1))
