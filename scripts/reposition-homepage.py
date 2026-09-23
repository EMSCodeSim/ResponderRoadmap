from pathlib import Path

# Historical one-shot copy rewriter. The current homepage is maintained in
# src/app/landing.tsx. Keep this script a no-op so the apply workflow that
# checks out main does not fail or rewrite production copy.
p = Path("src/app/landing.tsx")
if not p.exists():
    raise SystemExit("src/app/landing.tsx is missing.")
print("Homepage is maintained in src/app/landing.tsx; no automatic rewrite.")
