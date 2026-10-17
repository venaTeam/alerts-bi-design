# Run output files removed — 2026-10-17

Runs no longer write CSV files. Manual HTTP and worker runs, worker orphan recovery and the
weekly scheduler persist to SQL only. The three CSV downloads were already rendered from
committed SQL on every request and are unchanged (routes, filenames, columns). The deployed
output directory was an emptyDir wiped on every restart.

Removed: the post-commit export warning and `export_warning` log field, recovery-time CSV
regeneration, deletion-time report cleanup and its failure message, `remove-run-html`,
`ADMIN_OUT_DIR`/`API_OUT_DIR`, and the output emptyDir mounts in deploy/admin.yaml and
deploy/weekly.yaml (weekly no longer passes `--out`). `POST /runs` drops the `out_dir` field
and `X-Alerts-BI-Out-Dir` header; the product owner chose removal over an empty string. This
breaks any consumer reading `out_dir`; no caller exists in the design, admin or portal
repositories, and external callers must be confirmed before release. Kept: `report` (`--out`,
default `out/<run id prefix>`), `run --out`, `weekly --out` and acceptance `--out`. Deleting a
run removes nothing from disk, so CSVs an operator exported (including `alert_worklist.csv`)
stay until removed by hand.

Implementation: admin refactor/stop-writing-csv-files (5dc70ac, 2aa0633, 2efa5fc, 278afb1,
58453b9) from main 0ca2b9a. Canonical input: design 902c9a7 from main 1c27931; the admin
snapshot is pinned to 902c9a7. No migration; applied revisions, SQL views, CSV columns, contract
JSON and the shared/operations libraries are unchanged.

## Executed checks

- `poetry run pytest tests/unit tests/engine/unit -q`: 925 passed (two cleanup tests removed).
- `poetry run python scripts/ci_integration.py` (integration, engine integration, acceptance;
  skips refused): 187 passed on local SQL Server and the seeded ES mock. The first run failed two
  new tests that changed the working directory and lost the relative registry; the tests were
  fixed (58453b9) and the full suite repeated.
- `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`: passed.
- Admin-environment `python ../design/scripts/check_contracts.py --console --sql`: passed.
- Admin-environment `scripts/run_integration.py --registry config/teams.json`: 77 passed, with
  portal origin/main 9873363 installed without dependencies into the admin task environment.
- `uv run python scripts/check_docs.py`: passed.

One upstream Starlette/httpx deprecation warning remains. Only the disposable alerts_bi_test
database and local mocks were used, under the workspace test-database lock.

## Browser verification

The admin server ran on loopback port 18212 against alerts_bi_test with an explicit dev
identity. New run for Checkout API, week ending 2026-08-24, fake model: the submission showed
pending. The installed `run-worker --once`, started from an empty directory, completed it and
left the directory empty. The workspace opened the completed, unpublished run with three CSV
links; each returned 200 `text/csv` as an attachment. An authenticated JSON `POST /runs` returned
the summary and `files` links with no `out_dir` key or `X-Alerts-BI-Out-Dir` header. The server
and tab were closed afterwards.

## Delivery and rollout

Merge the design PR before the admin PR, with a merge commit so the admin pin stays on main;
otherwise re-pin admin to the new design main before merging it. Ship the manifest changes
(no ADMIN_OUT_DIR, no output mounts, weekly without `--out`) with the image that contains this
change. A rollback redeploys the previous manifests with the previous image, because earlier
images write files after every run. CSVs on an old emptyDir are discarded with its pod. No
merge, deployment or production operation was performed.

## Review fixes

Review of design#9 and admin#12 found deployment docs that still required writable output
(runs-retirement, unified console, async runs, design consolidation note); they are corrected.
Deletion leaving explicit CLI exports on disk, and rollback with the previous manifests, are
now documented. A test covers the interrupted backfill week ("Retry this week."), and the
manual recovery test asserts that no files are written.
