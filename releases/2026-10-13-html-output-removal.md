# Complete standalone HTML output removal — 2026-10-13

The accepted follow-up removes standalone run HTML entirely. Completed analyses still appear
in the authenticated admin workspace. Only daily_metrics.csv, rule_counts.csv and
alert_worklist.csv are exported. POST /runs returns JSON without a scorecard field even when
HTML is requested. The bare run/scorecard routes are removed; CSV filename validation rejects
scorecard and scorecard.html. Legacy generated-file cleanup remains available.

Implementation: admin 7ee326556238efe7fa108f50f8b131088a1bfbb0 on codex/async-runs.
Canonical input pinned by admin: design 10c504c1f27fbfb3141e7062b000c1bce50eedc2.
Coordinated test update: design f81c6f4127c993d57ac5c27ccc641f4700780569.
Operations 0.2.0 removes report.html and changes the public renderer to three CSVs. Shared
0.1.3 and published portal views remain unchanged. Previously built immutable versions are
not rewritten. Consumers of the removed module need to use the workspace or CSV renderer.

## Executed verification

- `poetry run pytest tests/unit tests/engine/unit -q`: 874 passed.
- `poetry run pytest tests/integration tests/engine/integration tests/engine/acceptance -q -rs`:
  150 passed on real local SQL Server and the seeded Elasticsearch mock, with no skips.
- `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`,
  `poetry check --lock`, `poetry build`, and `poetry run python scripts/build_libraries.py`: passed.
- Operations 0.2.0 wheel and installed package were checked for absence of report/html.py;
  admin wheel metadata pins operations 0.2.0 and operations still pins shared 0.1.3.
- Admin-environment `python ../design/scripts/check_contracts.py --console --sql`: passed,
  covering exact API/CSV names and columns, applied migration bytes and portal view metadata.
- Canonical `scripts/check_docs.py` plus Ruff lint/format: passed.
- Coordinated `scripts/run_integration.py --registry ../admin/config/teams.json`: 77 passed,
  using the existing immutable portal wheel in the task environment. A stale V1_INDEX test
  import was updated to the current configured ES index so the end-to-end portal totals check ran.

The first application integration run exposed five remaining assertions for the removed
HTML contract; they were updated to assert HTML rejection and CSV behavior, and the full
affected suite was repeated successfully. The standalone design environment lacked app
packages; coordinated checks ran in the admin task environment with the existing portal wheel.
One upstream Starlette/httpx deprecation warning remains. Only the explicitly disposable
alerts_bi_test database and local mocks were used.

## Browser verification

The actual admin server ran on loopback port 18210 with an explicit test identity. The browser
submitted Checkout API for the Monday boundary 2026-08-24 with the fake model and immediately
displayed a pending submission. `alerts-bi-admin run-worker --database alerts_bi_test --once`
executed it; polling opened the completed, unpublished run in the normal workspace.
Overview, run versions, detailed charts and findings remained accessible. The expanded export
area contained exactly the three CSV links, with no scorecard link. Daily metrics downloaded
successfully. Task-local screenshot: `../evidence/html-removal-csv-exports.png` outside Git.
The temporary browser tab and server were closed after verification.

## Delivery and rollout

Updates existing admin/design PRs #5 on codex/async-runs. Merge the canonical contract before
the application change. The combined async feature still requires additive migration
010_run_jobs and one manual run-worker with the UI's registry/SQL/ES/model/output settings.
No extra migration is needed for HTML removal. Applied migrations 001–010 and CSV columns
are unchanged by this follow-up. No merge, deployment or production operation was performed.
