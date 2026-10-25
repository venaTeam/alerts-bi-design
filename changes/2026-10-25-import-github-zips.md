# Add the import-github-zips skill and change notes

Branch: feat/import-github-zips

## What changed

Adds the `import-github-zips` skill, which imports admin, portal and design into the private
network from GitHub ZIPs and opens one GitLab merge request per repository, and
`docs/private-network-import.md`, which describes the process. Adds `changes/`: every pull
request now leaves a note for that import, drafted by `changes/notes.py new` and checked in CI.

## Deploy

- Migrations: none
- Settings: none
- Order: any
- Other steps: install the skill by copying `.claude/skills/import-github-zips/` into
  `.claude/skills/` of the private workspace folder. The first import records a baseline from
  the ZIPs of the last manual import (`docs/private-network-import.md`).

## Private network

- Dockerfile: no change
- CI: changed (.github/workflows/checks.yml): adds the change-note job. GitHub-only, do not port.
- Packages: none
