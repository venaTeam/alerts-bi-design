# Alerts BI design and contracts

Canonical requirements for [admin](https://github.com/venaTeam/alerts-bi-admin) and the
standalone [portal](https://github.com/venaTeam/alerts-bi-portal). Admin owns execution,
migrations, scheduling, registry, mock tooling and shared/operations library production.
The former runs repository is historical; see `docs/runs-retirement.md`.

The supported local workspace has three checkouts: admin, portal and design. A local runs
checkout is unnecessary and may be removed after preserving local work and any dependent
worktrees. GitHub archival and service cutover remain separate actions.

Use `docs/source-map.md` to navigate. `docs/alerts_bi_design.md` defines behavior,
`docs/alerts_bi_flow.md` and `docs/alerts_bi_implementation_plan.md` explain execution,
and `docs/outputs.md` defines outputs. Decisions and contracts live in their named folders;
executed compatibility evidence belongs in `releases/`.

Applications pin snapshots from a committed design revision through `scripts/sync_contracts.py`.
Keep parent workspace routing outside Git; `workspace/workspace-spec.json` is the portable index.

## Checks

`uv sync --frozen` and `uv run python scripts/check_docs.py` validate documentation inputs.
For coordinated checks, install the admin and portal wheels plus shared/operations wheels
into an isolated environment. Run `python scripts/check_contracts.py --sql --console`, then
`python scripts/run_integration.py --registry <admin-registry-artifact>`. Provide only local
SQL/ES test settings. Suites reset only `alerts_bi_test` and run serially. The original mock
generator and oracle are maintained in admin; no duplicate fixture system lives here.

PR delivery is separate from deployment, merge and eventual repository archival.
