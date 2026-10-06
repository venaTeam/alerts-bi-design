# Flat application source — 2026-10-06

Application modules now live directly in each repository's `src/`. Relative imports work
for local source checks, and setuptools maps the source directory to each distinct installed
service namespace. The migration-only import bridge is in runs `compat/src/`. Console commands,
shared-library releases, schema/migration bytes, prompt/resources and runtime behavior remain
compatible. [Decision 002](../decisions/002-flat-application-source.md) records the layout choice.

The companion JSON pins the exact app commits, design input and locally built artifact hashes.
All three working trees were clean after committing. Consumer vendor wheels and the hand-authored
acceptance oracle are unchanged.

| Executed check | Result |
|---|---|
| Frozen unit suites: runs / portal / admin | 780 / 219 / 53 passed |
| Runs SQL Server/Elasticsearch integration | 105 passed |
| Existing clean mock acceptance oracle | 4 passed; fixture reused without reseeding |
| Coordinated integration with final installed app wheels | 62 passed |
| Ruff formatting/lint and strict mypy in all four repos | Passed |
| Frozen app lockfile checks, wheel and source-archive builds | Passed |
| Standalone source archive inputs and wheel resources | Verified |
| Docker builds and network-disabled imports outside each checkout | All three passed |
| API, CSV, SQL, registry schema, migration and guide contracts | Matched |
| Restarted localhost app health/pages | 200 on ports 8000, 8100 and 8200 |

Local tests use Python 3.13.5, Docker images Python 3.12, and the existing local SQL Server/
Elasticsearch mock. Tests use the deterministic fake LLM. The existing Starlette/httpx
TestClient deprecation warning remains. No production, cluster or live-model claim is made.

No database migration is needed for this layout. Restore the prior compatible commits/images
from the separation release for recovery; no SQL rollback or data movement is required.
