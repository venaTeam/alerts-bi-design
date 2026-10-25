# Add the import-github-zips skill and change notes

Branch: feat/import-github-zips

## What changed

Adds the `import-github-zips` skill, which imports admin, portal and design into the private
network from GitHub ZIPs and opens one GitLab merge request per repository, and
`docs/private-network-import.md`, which describes the process. Imports record
`.github-import.json`, so a squashed, rebased or reverted import is detected and recorded again
with `baseline --reset`. Adds `changes/`: every pull request now leaves a note for that import,
drafted by `changes/notes.py new` and checked in CI. `tests/unit` covers both scripts.

## Deploy

- Migrations: none
- Settings: none
- Order: any
- Other steps: install the skill by copying `.claude/skills/import-github-zips/` into
  `.claude/skills/` of the private workspace folder. The first import records a baseline from
  the ZIPs of the last manual import (`docs/private-network-import.md`).

## Private network

- Dockerfile: no change
- CI: changed (.github/workflows/checks.yml): adds the change-note job (GitHub-only, do not
  port) and runs ruff format, strict mypy and pytest on `changes/`, the skill's script and
  `tests/unit`; port those three if GitLab CI runs design's checks.
- Packages: none
