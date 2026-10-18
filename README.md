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

### Reproducing the team-identity integration check

The documentation environment intentionally does not declare application packages as runtime
dependencies. The coordinated test needs explicitly selected admin and portal release wheels,
shared 0.1.8 and operations 0.2.6; those packages are not fetched from an assumed public index.
Build the apps at the revisions recorded in `releases/2026-10-18-relax-team-registry.md` and
collect their wheels and the producer's shared/operations wheels in a local artifact directory.
From a clean Python 3.12+ virtual environment, install those exact files and the test tools:

```powershell
python -m pip install <artifacts>/alerts_bi_shared-0.1.8-py3-none-any.whl <artifacts>/alerts_bi_operations-0.2.6-py3-none-any.whl <artifacts>/alerts_bi_admin-0.1.0-py3-none-any.whl <artifacts>/alerts_bi_portal-0.1.0-py3-none-any.whl pytest httpx
$env:SQL_HOST = '127.0.0.1'
$env:SQL_TEST_DATABASE = 'alerts_bi_test'
$env:REQUIRE_SQL = '1'
# Supply SQL_USER, SQL_PASSWORD and SQL_ENCRYPT for the local disposable SQL Server.
python -m pytest tests/integration/test_team_routes.py -q -rs
python scripts/check_contracts.py --console --sql
```

Run serially with no other test resetting `alerts_bi_test`. This targeted test needs SQL only,
refuses a nonlocal server or another database name, and resets that disposable database.
The release command sets `REQUIRE_SQL=1`: every preflight failure, including bad credentials
or unavailable SQL, fails the check instead of skipping. Without the flag, exploratory runs
may skip a failed SQL preflight; schema or migration failures always fail. Release evidence
must show an executed pass with no skips. The full coordinated suite uses `run_integration.py` above,
which fails on missing infrastructure instead of allowing a skipped release gate.

`check_docs.py` checks canonical syntax and navigation only. `check_contracts.py` verifies
all SQL and revision-module SHA-256 entries against the installed admin artifact, plus API,
registry and view contracts. Passing the former alone is not compatibility evidence. There is
currently no design-repository CI job provisioning both application artifacts and SQL; run
this coordinated gate before delivery and record the exact revisions. Portal's own CI runs
its standalone team-route regression tests against its pinned shared wheel on every PR.

PR delivery is separate from deployment, merge and eventual repository archival.
