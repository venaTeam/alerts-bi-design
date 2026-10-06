# Alerts BI design and contracts

The canonical product/architecture repository for [runs](https://github.com/venaTeam/alerts-bi-runs),
[portal](https://github.com/venaTeam/alerts-bi-portal), and [admin](https://github.com/venaTeam/alerts-bi-admin).

Read `docs/alerts_bi_design.md` in full, then `docs/alerts_bi_flow.md` and
`docs/alerts_bi_implementation_plan.md`. `docs/outputs.md` defines every output and number.
Accepted separation decisions are in `decisions/`; contracts are in `contracts/`;
tested revision combinations and delivery limitations are in `releases/`.

Applications include pinned documentation snapshots so a standalone clone is usable.
Update canonical documents here and refresh snapshots using `scripts/sync_contracts.py`.
The design revision/hash manifest distinguishes pinned inputs from local edits.

## Local workspace

Clone all four repos beneath a normal directory. Keep the parent's `AGENTS.md` and
`WORKSPACE.json` outside Git; templates live in `workspace/`. Every child repo tracks
its own instructions. Do not initialize a parent Git repository or use submodules.

## Checks

`uv sync --locked` installs documentation tooling only. `uv run python scripts/check_docs.py`
checks local instructions, JSON contracts and links. For integration, create a separate
environment, install all three app wheels and both library wheels, and run
`python scripts/check_contracts.py` then `python scripts/run_integration.py`.
The latter reuses the original integration tests and test helpers; it requires explicit
local SQL/Elasticsearch settings and the disposable `alerts_bi_test` database. It never
uses SQLite. Reuse the mock generator in runs for a clean acceptance fixture load.

No migration tree or independent fixture generator lives here. Runs owns those artifacts.
No deployment is implied by publishing these repositories.
