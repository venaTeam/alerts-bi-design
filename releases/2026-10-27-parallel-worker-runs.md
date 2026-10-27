# Parallel runs across teams — 2026-10-27

The run worker executed one job at a time across all teams, so one team's long run or
multi-week backfill held every other team's New run in the queue.

## Decision and resulting behavior

Accepted 2026-10-27 by the product owner; design section "Parallel runs across teams" and
[decision 011](../decisions/011-parallel-runs-across-teams.md), with the corrections from five
rounds of code review on the PRs; final text at design `8af3293`.

- **`WORKER_CONCURRENCY`** (or `run-worker --concurrency`), 1 to 8, default 1: how many jobs
  the worker runs at once. 1 keeps the existing one-job path; another value stops the worker
  at startup, and above 1 it refuses to start without migration 021.
- **Different teams side by side, one week per team.** Jobs hold numbered slots; a queued job
  whose team has one running waits, and the next other team's job starts instead. Claim order
  is otherwise unchanged. A freed slot is refilled at once, and work submitted meanwhile starts
  within one poll.
- **One worker process.** Jobs run on threads, each on its own SQL connection. The worker keeps
  the shared execution locks while any job runs and recovers interrupted jobs before its first
  claim, so CLI runs, reports, the weekly schedule, acceptance verification and synchronous
  `POST /runs` still refuse, busy submissions still queue, and deletion still goes ahead only
  beside other runs' jobs. An infrastructure error stops claims, lets the other jobs finish,
  then exits (`worker.stopping` names the job and slot; `worker.job_lost` each further one). A
  failed claim (a deadlock with a deletion, which the deletion wins through the worker
  session's low deadlock priority) is logged as `worker.claim_failed` and retried at the next
  poll; three in a row, or one that lost the worker's SQL session (and with it the execution
  lock), stop the worker. `--once` runs only its first claims, one per slot.
- **Results stored one at a time** under the transaction lock `alerts-bi-persist`, waited for
  up to 10 minutes in 500 ms requests (the driver ends any statement after
  `SQL_REQUEST_TIMEOUT_MS`); only the Elasticsearch scan, analysis and model calls overlap.
- **Deployment**: `WORKER_CONCURRENCY` in `config.env`, and the run-worker container's own
  `WORKER_MEMORY_REQUEST`/`WORKER_MEMORY_LIMIT` in `values.env` (the weekly job and admin jobs
  keep `ANALYSIS_MEMORY_*`); the deploy README's "Run several jobs at once" gives the steps.
- **Migration `021_parallel_run_slots`**: slots from 1 and one active job per team; no row
  changes. Roll-forward only, like every migration: undo the feature with
  `WORKER_CONCURRENCY=1`; an earlier image needs the deployment runbook's database restore.
  Console readiness requires it.
- **Console**: a queued run says "A team runs one week at a time, and only a set number of
  teams run at once, so this one waits for the runs ahead of it."
- **Unchanged**: job states, routes, payloads, the queue, cancel and retry rules, CSV outputs,
  portal views and the shared/operations libraries. The portal keeps its pin.

## Revisions

- Design `8af3293` (docs, contracts, decision 011) plus this release note, on branch
  `feat/parallel-worker-runs` from `main` `6998540`:
  - `6aac074`: docs, contracts and decision 011;
  - `ed52e85`: round-1 fixes, with the 021 hashes from admin `11c3bf3`;
  - `ca677f1`: round-2 fixes;
  - `5b6e180`: round 3;
  - `c8fc766`: round 4, `console-http.json` rules for parallel slots;
  - `8af3293`: round 5, the runtime flow's 2026-10-27 summary and the per-team qualification
    of "before the next backfill week".
- Admin `b4427ad` (code) and `dcb8834` (snapshot pinned to design `8af3293`), on branch
  `feat/parallel-worker-runs` from `main` `99576a8`:
  - `736b7e8`: code, migration 021, tests, README and deployment;
  - `11c3bf3`: round-1 fixes (lock wait in short requests, rollback wording, `worker.stopping`
    context, `--once`, `WORKER_MEMORY_*`);
  - `86d1a41`: round-2 fixes (claim retry and deadlock priority, `worker.job_lost`, runbook
    steps);
  - `9355597`: round 3, a claim that lost the worker's session stops the worker;
  - `b4427ad`: round 5, a lock check before each fill (a session lost in a rollback, then
    reconnected, claims nothing) and the queued-run log text;
  - the earlier snapshot pins `31c68d2`, `9a50ed2`, `770003b`, `2d60383` and `c4b6922`.
- Portal keeps its pin: none of its code or contracts change.

## Executed

Local SQL Server 2022 and the ES mock read through private `scl-appchi-*` indices.

On admin `770003b` (code of `86d1a41`): all of `tests/integration`,
`tests/engine/integration` and `tests/engine/acceptance`: **237 passed**, no errors.

On the final worker code (admin `b4427ad`): unit **1137 passed**, including a session that
no longer holds the execution lock claiming nothing; ruff, format and mypy clean;
`test_parallel_runs.py` **5 passed** (the real worker session reports its lock as held).

On admin `9355597`: unit **1136 passed**, including a lost worker session stopping claims at
once; `test_parallel_runs.py` **5 passed**.

On admin `86d1a41`:

- Unit `tests/unit` and `tests/engine/unit`: **1135 passed**. `test_parallel_worker.py`
  covers:
  - side-by-side slots, refill, and a poll starting new work;
  - draining on an infrastructure error, with every lost job named;
  - `--once` claiming only once, and the deadlock priority;
  - a failed claim retried, and three failures stopping the worker;
  - the 1–8 range and the migration 021 check.

  Ruff, format and strict mypy passed. Design `check_docs.py` passed, and
  `test_design_snapshot.py` matched.
- Integration `test_parallel_runs.py`, `test_run_jobs.py` and `test_backfill.py`: **59
  passed**. A first combined run had 4 setup errors (55 passed) that did not recur when the
  modules were re-run (30 and 29 passed). `test_parallel_runs.py` covers:
  - two teams running at once in slots 1 and 2 while the team's second week waits;
  - the weekly lock and synchronous `POST /runs` refused, and a new submission queued, while
    they run;
  - deletion of another run beside them;
  - the database refusing a second active job for a team, a taken slot and slot 0;
  - recovery of jobs left in two slots before any claim;
  - the storage lock timing out, and a 2.5 s wait under a 1 s `SQL_REQUEST_TIMEOUT_MS`
    storing the run. With a single 10-minute lock request, that test fails with "DBPROCESS
    is dead".
- Real entry points on `alerts_bi_test` after `db reset-test`, with three runs queued through
  the console's admission (`submit_job`): Checkout API 24 Aug (pending), Checkout API 17 Aug
  and Payments Core 24 Aug (both queued).
  - `run-worker --concurrency 2 --once` started Checkout API 24 Aug in slot 1 and Payments
    Core in slot 2, 84 ms apart. Both completed, and it exited without starting Checkout API
    17 Aug.
  - A second `--once` ran that week in slot 1.

On admin `11c3bf3` (round-1 fixes): integration `test_parallel_runs`,
`test_deployment_migrations`, `test_run_jobs`, `test_migrations`,
`test_migration_020_upgrade` and `test_persistence`: **73 passed**.

On admin `736b7e8`, before the review fixes (the worker loop and storage lock changed since):

- All of `tests/integration` and `tests/engine/integration`: **232 passed**.
- `tests/engine/acceptance` with `test_parallel_runs.py`: **8 passed**.
- `run-worker --concurrency 9 --once` exited 1: "WORKER_CONCURRENCY must be between 1 and 8,
  got 9".
- In the console in a browser:
  - a New run for Checkout API showed "Waiting for the worker";
  - a second Checkout API week was queued and its panel showed the new queued sentence;
  - a Payments Core week was queued.

  `src/pages.py` has not changed since.
- `run-worker --concurrency 2 --once` ran Checkout API and Payments Core at once, and the
  Teams page showed both ready to review.

## Not verified

- A deployment: nothing was deployed, and no cluster setting or memory limit was changed.
- The full integration and acceptance suites after `86d1a41`; the round-3 and round-5
  changes touch only the claim path, covered by unit tests and `test_parallel_runs.py`.
- A real SQL Server failover during a claim; the lost-session handling is covered by a unit
  test with an invalidated connection.
- A real deadlock between a deletion and a claim. The claim's low deadlock priority and retry
  are covered by unit tests, not by reproducing the deadlock.
- Two real runs contending for `alerts-bi-persist` at the same moment; the wait and timeout are
  covered by the lock tests.
- The weekly backfill yield with more than one slot. It goes through the shared claim function
  that the existing single-slot tests cover.
- Elasticsearch and model load at production volume with several jobs at once.
