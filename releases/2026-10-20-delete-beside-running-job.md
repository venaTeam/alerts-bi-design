# Deleting a run while another run's job runs — 2026-10-20

The console refused every Delete run while any manual job or backfill week ran. The worker
holds the shared `alerts-bi-weekly` lock for a whole job, and deletion took that lock and also
refused whenever any job held the active slot. An operator therefore could not delete an
unrelated run until the worker went idle, which for a backfill can be hours.

Accepted decision (2026-10-20, product owner; design `69dc93f`, section 7.12): deletion refuses
only work on the run itself. That means its own pending, running or queued job, its active
model review, or a publication change holding its row. When the shared lock is free, deletion
takes it as before. When it is taken and a job holds the active slot for another run, deletion
goes ahead without it. CLI runs and reports, the weekly schedule, acceptance verification and
synchronous HTTP runs all refuse while a job holds the slot, so the lock's holder can only be
the worker. Deletion locks that job's row (`UPDLOCK, HOLDLOCK`), so the worker cannot finish
and hand the lock to another writer before the deletion commits. When the lock is taken and no
job holds the slot, something without a job record holds it, and deletion still returns 409.
That keeps the 2026-10-13 guarantee that a CLI rerun or report blocks deleting its run. No
migration, contract, console route, library or portal change.

Revisions: admin `922c617` (deletion, tests, README) and `297b923` (snapshot pinned to design
`69dc93f`). All branches are `fix/delete-other-run-while-active` from current `main`. Portal
keeps its pin: none of its code or contracts change.

Executed checks, local SQL Server 2022 and the seeded ES mock:

- New admin integration tests in `test_run_jobs.py`. With a pending job, another stored run
  deletes and the job stays pending. With a worker paused inside its run, holding the shared
  and manual locks, deleting the job's own older result is refused with "This run is pending
  or active". Another run deletes, and the job then completes. Both tests fail on admin `main`
  with 409 and pass on `922c617`.
- Admin `test_run_jobs.py`, `test_console.py` and `test_backfill.py`: **71 passed**. These
  include the existing CLI rerun/report, weekly-lock, model-review, orphan and queued-week
  refusals. Unit **1050 passed** (including the snapshot hashes). Ruff, format and strict mypy
  passed.
- Admin-environment `check_contracts.py --console`: API, CSV, migration and guide contracts
  match. Design `check_docs.py` passed.
- Browser, admin console on `alerts_bi_test`: a real worker job for 17–24 Aug was paused for
  five minutes inside its run. While the page showed it Running, Delete run on the 18–25 Aug
  run returned "Run permanently deleted.". Delete run on the 17–24 Aug run returned "This run
  is pending or active. Try deleting after it finishes.". The job then completed and its run
  remained.

Not run locally: the full admin `scripts/ci_integration.py`. ES-backed modules fail locally on
the current mock mapping (`operator.keyword`), so CI covers them.
