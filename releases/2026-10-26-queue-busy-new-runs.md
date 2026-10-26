# New runs queue while another run is in progress — 2026-10-26

Runs execute one at a time across all teams. A New run submitted while another run held the
active slot or the shared execution lock was refused with 409 unless a backfill was in
progress, so an operator starting team B's week while team A's run was going had to wait and
submit again.

Accepted decision (2026-10-26, product owner; design `02cf77a`, section "New runs queue while
another run is in progress"):

- A busy job submission (New runs with one week, or `POST /run-jobs`) is accepted as `queued`
  whatever holds the slot or lock: a job, a CLI run or report, the weekly schedule or a
  deletion. The worker's claim order is unchanged: pending, then queued manual jobs by
  submission, then backfill weeks.
- A submission for a week the team already has queued, pending or running is refused with 409
  ("Already queued or running for this team"), busy or not.
- `POST /run-jobs/{job_id}/cancel` also removes a queued manual job; a started job is refused.
  The team page offers Remove on queued runs.
- The weekly retry is unchanged. Synchronous `POST /runs`, CLI runs, reports and acceptance
  verification still refuse while busy. No migration, route, library or portal change.

Revisions: design `02cf77a` (design, async-runs, backfill, flow, blueprint, worker runbook,
console contracts); admin `0fae358` (submission, duplicate refusal, cancel, team page, README,
OpenShift rollback note, tests) and `16ac280` (snapshot pinned to design `02cf77a`). Both
branches are `feat/always-queue-runs` from current `main`. Portal keeps its pin: none of its
code or contracts change.

Executed checks, local SQL Server 2022 and the ES mock read through private `scl-appchi-*`
indices:

- Admin integration `test_backfill.py` and `test_run_jobs.py`: **44 passed**. `test_console.py`:
  **30 passed** after updating `test_form_and_json_trigger_share_gate`, whose form submission under a held
  execution lock is now queued (and then removed) while `POST /runs` still returns 409. The
  first run failed that test and the next one, which then found the leftover queued week a
  duplicate, as the new behavior requires. New tests cover queueing behind a pending job for
  another team and another week, the duplicate-week 409 with either model mode, execution in
  submission order, resubmission after completion, queueing behind the shared lock held
  without a job, and console removal (queued removed, pending refused, repeat refused, missing
  form token 403). `test_slow_worker_keeps_status_and_navigation_responsive` now expects 202
  `queued` for another week while the worker runs.
- Admin unit **1111 passed** (including the snapshot hashes and new page tests). Ruff, format
  and strict mypy passed. Admin-environment `check_contracts.py --console`: API, CSV,
  migration and guide contracts match. Design `check_docs.py` passed. The regenerated
  `console-openapi.json` differs only in the `POST /run-jobs` 409 description.
- Browser, admin console on `alerts_bi_test` with no worker running: a New run for Checkout
  API (17–24 Aug) stayed pending. A New run for Payments Core (17–24 Aug) then returned "Run
  queued. It starts when the runs ahead of it finish." and showed "17 Aug – 24 Aug 2026 is
  queued" with Remove; Remove returned "Run removed from the queue.". `POST /run-jobs` for the
  same week returned 202 `queued`, and submitting that week from the dialog opened before it
  returned "Already queued or running for this team: 17 Aug – 24 Aug 2026.". `run-worker
  --once` ran Checkout API first and a second `--once` ran Payments Core; the open page
  reloaded itself into the completed run. The queued panel also fits at 375 px.

Not run locally: the full admin `scripts/ci_integration.py` and the ES-backed acceptance
modules; CI covers them. Not deployed.
