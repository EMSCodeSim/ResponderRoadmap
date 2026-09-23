from pathlib import Path

p = Path("src/app/landing.tsx")
s = p.read_text()
if "Know exactly where your department stands." in s and "See the 3-Minute Demo" in s:
    print("Homepage already uses the progress-focused positioning.")
    raise SystemExit(0)
raise SystemExit("Homepage is missing the current Training Officer positioning.")
