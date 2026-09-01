from pathlib import Path

p = Path('src/app/(portal)/task-books/[id]/page.tsx')
s = p.read_text()
bad = 'setAiReviewText([draft.description, ...findings].filter(Boolean).join("\n"));'
# The generated file currently contains an actual newline inside the quoted string.
bad_actual = 'setAiReviewText([draft.description, ...findings].filter(Boolean).join("\n"));'.replace('\\n', '\n')
if bad_actual in s:
    s = s.replace(bad_actual, 'setAiReviewText([draft.description, ...findings].filter(Boolean).join("\\n"));', 1)
elif bad not in s:
    raise SystemExit('AI review join target not found')
p.write_text(s)
print('fixed AI review newline')
