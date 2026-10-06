# Repository separation — 2026-10-06

The four-repository extraction preserves the run pipeline, portal and admin behavior and
adds schema-readiness checks suitable for separately released consumers. The companion
JSON records exact app commits, design input revision, schema head and library hashes.
Runs preserves the original repository history; the other repos record import provenance.

## Executed verification

| Check | Result |
|---|---|
| `uv run --frozen pytest tests/unit -q` in runs | 780 passed |
| Same command in portal / admin | 219 / 53 passed |
| `pytest tests/integration -q -rs` in runs | 105 passed against real local SQL Server/Elasticsearch |
| `python scripts/run_integration.py --registry <runs-registry>` in design | 62 passed with installed app/library wheels |
| Clean fixture `RESET=1 python scripts/generate_mock_alerts.py`, then `pytest tests/acceptance -q -rs` | 40,125 mock rows; 4 passed against the unchanged hand-authored oracle |
| Ruff formatting/lint and strict mypy in each repo, including both library packages | Passed |
| `python scripts/check_contracts.py --sql` | Original API schema, CSV headers, guides, registry schema, 16 SQL/revision files and 82 SQL view columns match |
| `uv build`, frozen standalone installs, and independent app import checks | Passed; no pipeline/ES/model dependency in portal/admin |
| Docker builds on Python 3.12, network-disabled installed-package smoke checks | All three images passed; migration graph and packaged prompt resources verified |
| Browser smoke against disposable SQL fixture | Portal directory and weekly review, admin team dashboard render correctly with styles |
| Agent setup validation | Parent and four child setups passed path/import validation |

Local unit/integration checks used Python 3.13.5, uv 0.10.8, SQL Server 2022 CU14 and
Elasticsearch 8.15.0. Tests use the deterministic fake LLM; no live model validation,
production Elasticsearch access or cluster deployment is claimed. Runtime readiness
checks column availability/readability; SQL type/nullability parity is checked separately
by the coordinated contract check. Initial extraction is the tested compatibility window.

Observed tooling limitations: Starlette emits a third-party TestClient deprecation warning
for httpx. Some first runs had Windows cache ACL warnings; final unit receipts use an
explicit temporary directory and disable pytest's cache. A transient PyPI timeout during
consumer Docker rebuilds cleared on an unchanged retry. No skipped tests are counted as passes.

## Delivery and recovery

Use the three app commits as a compatible set. Apply database migrations only from runs;
there are no new schema changes in this extraction. Supply the runs registry artifact to
admin, the same SQL settings to both readers, the existing trusted proxy identity boundary
to admin, and the network allowlist to portal. Each app has its own lockfile and image.
Consumers commit immutable library wheels; future library content changes need a new
distribution version and explicit lock updates. No artifact index is assumed.

The local parent is not a Git repository. Its AGENTS.md/WORKSPACE.json route agents to each
tracked repository's instructions. The original checkout, local changes and existing
deployment remain available. No deployment or production-data change was performed.
Before a future deployment, build these commits in the target environment and retain the
previous images for rollback; this split requires no database rollback or data movement.
