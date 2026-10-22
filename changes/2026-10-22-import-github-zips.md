# Add the import-github-zips skill and change notes

Branch: feat/import-github-zips

## What changed

Adds the `import-github-zips` skill, which imports these repositories into the private network
from GitHub ZIPs, and `docs/private-network-import.md`, which describes the process. Adds this
`changes/` folder: every pull request now leaves a note for that import.

## Deploy

- Migrations: none
- Settings: none
- Order: any
- Other steps: install the skill by copying `.claude/skills/import-github-zips/` into
  `.claude/skills/` of the private workspace folder. The first import records a baseline from
  the ZIPs of the last manual import (see `docs/private-network-import.md`).

## Private network

- Dockerfile: no change
- CI: no change
- Packages: none
