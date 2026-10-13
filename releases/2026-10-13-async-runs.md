# Durable manual execution — 2026-10-13

Implementation: admin commit e1e7016238d8cebffe5e454c702445e87be848ac on codex/async-runs,
based on main 4e05c27. Canonical input: design e71236c4b4e8c9ac3f2917da633094317be77188,
based on main 7efa9e8. Both task branches preserve the merged Monday-window and deletion
requirements. The job migration is additive 010_run_jobs; applied revisions 001–009 retain
their exact bytes. Portal/public library contracts are unchanged.

## Executed checks

- `poetry run pytest tests/unit tests/engine/unit -q`: 921 passed.
- `poetry run pytest tests/integration tests/engine/integration tests/engine/acceptance -q -rs`:
  150 passed on real local SQL Server and seeded Elasticsearch; no skipped checks.
- `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`: passed.
- `poetry check --lock`, `poetry build`, `poetry run python scripts/build_libraries.py`: passed.
  Standalone wheel inclusion of job/worker source and migration resources was checked.
- `python scripts/check_docs.py`: passed in canonical design.
- Admin-environment `python ../design/scripts/check_contracts.py --console --sql`: passed,
  including exact immutable migration bytes and unchanged published-view metadata.

One upstream Starlette/httpx deprecation warning is present; no application warning was hidden.
Tests use only the disposable alerts_bi_test database and existing local mocks. No production
database or Elasticsearch dataset was modified. Task-local test servers were stopped.

## Browser evidence

The actual loopback admin server ran on port 18210 with explicit test identity and the test
database. Browser forms accepted a registered team, Monday boundary and fake model, immediately
redirecting to a pending submission. The installed run-worker --once executed the same engine
against SQL/ES; polling automatically opened the completed, unpublished result. Leaving the
page and returning also displayed the committed result. Scorecard links rendered from SQL,
with CSV-only run directories. Final Monday-boundary flow was repeated after main integration.

Desktop and 390×844 viewport checks confirmed visible completion, readable cards and retained
navigation. No browser console errors were observed. Local screenshots are retained in the task's
`evidence/completed-final.png` and `evidence/completed-final-mobile.png`; they are not production data.

Controlled integration checks hold the real worker at its execution boundary to verify that
status, team navigation and idempotent resubmission remain responsive, while conflicting work
is refused. Restart checks distinguish committed results from older runs with the same ID.
Changed registry/model inputs fail before scanning; a CSV error after commit preserves completed
analysis with an export warning. Pending jobs block deletion; terminal jobs disappear with the
confirmed parent-run deletion. Existing CLI/report/deletion race checks were repeated.

## Delivery and rollout

The task pushes review branches and opens coordinated PRs under standing workspace authorization.
No merge or OpenShift deployment is performed. Apply migration 010 before updating the UI and
starting one dedicated run-worker with matching settings. Use the explicit output-root
remove-run-html command for older generated HTML, preserving all CSV exports and unrelated files.
Rollback UI/worker together, resolve pending submissions first, and preserve the additive SQL table.
