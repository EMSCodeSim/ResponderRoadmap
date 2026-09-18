#!/usr/bin/env python3
from pathlib import Path
path = Path('src/server/services/auth.ts')
text = path.read_text()
old = '''  const department = await prisma.department.create({
    data: {
      name,
      publicId,
      joinCode,'''
new = '''  const department = await prisma.department.create({
    data: {
      name,
      plan: "FREE",
      publicId,
      joinCode,'''
assert text.count(old) == 1, 'Could not safely find the existing department creation path.'
path.write_text(text.replace(old, new, 1))
print('The authenticated onboarding department creation path now assigns the FREE tier too.')
