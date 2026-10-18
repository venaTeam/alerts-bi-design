# Relaxed team registry validation — 2026-10-18

Implemented the user request to allow duplicate operators and remove the team ID regex.

- Admin base: `03d4c6c453eba35ca7e54f0696daf542abd9e0d4`; implementation: `8ce2fdd`.
- Design base: `ee7d9dd77bfb23215cc53afd932f432c191c2d42`; pinned contract: `789c5b86e4559ed6224a4d58ec58d62a196921c4`.
- Branch in both repositories: `fix/relax-team-registry`.
- Operations package: `0.2.5`; shared stays `0.1.7`. Portal does not consume operations and needs no dependency update.

The registry accepts operators shared across teams and repeated within a v1 list. IDs remain nonempty, unique strings; no character-pattern check or normalization is applied. A selected team independently queries its supplied operators. Matching alerts may therefore appear in separate teams' runs. The source registry data is not edited by this change.

## Executed checks

From the admin task worktree, using its Poetry-created `.venv`:

- `python -m pytest tests/unit tests/engine/unit -q --basetemp=out/pytest-final`: **956 passed**, one upstream Starlette/httpx deprecation warning. `out/` was created first. Earlier sandbox/temp-parent setup failures were resolved before this run.
- `python -m ruff check .`: pass.
- `python -m ruff format --check .`: 242 files already formatted.
- `python -m mypy`: no issues in 238 source files.
- `poetry check --lock`: pass.
- `python ../design/scripts/check_contracts.py --console`: API, CSV, migrations, guides and registry schema match.
- `python scripts/check_docs.py` in design: pass. All admin snapshot SHA-256 values match the pinned files.
- `poetry -C packages/operations build --format wheel --output ../../dist`: built operations 0.2.5. Imported the validator from the wheel, compared its schema bytes to the canonical contract, and loaded the sample registry successfully.
- Wheel SHA-256: `d6508dcde0887784b92522d8ed2c9e60f3c8027d0e826a57174d4c5ea239f8be`.
- Installed `alerts-bi-admin registry check --registry out/registry-smoke.json`: valid, 2 teams. Fixture IDs were `Team_A` and `Team B`, both with v1 `["checkout", "checkout"]` and v2 `"checkout-api"`.
- Browser smoke at loopback port 8238 against real local SQL Server `alerts_bi_test`: Teams listed both entries; opened both workspaces, including URL-encoded spaces; opened and cancelled Team_A's New run dialog. No run was submitted and no test database data was reset.

Unit coverage also checks Unicode, punctuation and slash-containing IDs at the registry boundary. This change removes registry validation restrictions; it does not redesign URL routing or SQL identifier storage. Full analysis, publication and portal workflows were not rerun.

## Delivery

Merge the design contract before the admin implementation. Deploy admin with operations 0.2.5 before supplying a newly permissive registry. Older operations versions reject such registries, so rollback also requires restoring a compatible registry. These branches are prepared for review; nothing is merged or deployed.
