from pathlib import Path

pages = [
    'src/app/(portal)/task-books/page.tsx',
    'src/app/(portal)/my-task-books/page.tsx',
    'src/app/(portal)/assignments/page.tsx',
    'src/app/(portal)/training-assignments/page.tsx',
    'src/app/(portal)/evaluate/page.tsx',
]
for filename in pages:
    path = Path(filename)
    source = path.read_text()
    assert source.startswith('"use client";'), f'Unexpected page header: {filename}'
    assert '<PageHeader' in source, f'Cannot find page header: {filename}'
    assert 'WorkspaceTabs' not in source, f'Workspace already integrated: {filename}'
    source = source.replace('"use client";\n', '"use client";\n\nimport { WorkspaceTabs } from "@/components/WorkspaceTabs";\n', 1)
    source = source.replace('<PageHeader', '<WorkspaceTabs />\n      <PageHeader', 1)
    path.write_text(source)
    print('Added workspace tabs to', filename)
