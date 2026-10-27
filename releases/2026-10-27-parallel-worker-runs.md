# Parallel runs across teams — 2026-10-27

The run worker executed one job at a time across all teams, so one team's long run or
multi-week backfill held every other team's New run in the queue.

## Decision and resulting behavior

Accepted 2026-10-27 by the product owner; design section "Parallel runs across teams" and
[decision 011](../decisions/011-parallel-runs-across-teams.md) (final text at design `6aac074`).

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
  then exits (`worker.stopping`).
- **Results stored one at a time** under the transaction lock `alerts-bi-persist` (10-minute
  wait); only the Elasticsearch scan, analysis and model calls overlap.
- **Migration `021_parallel_run_slots`**: slots from 1 and one active job per team; no row
  changes. Roll-forward only, like every migration: undo the feature with
  `WORKER_CONCURRENCY=1`; an earlier image needs the deployment runbook's database restore.
  Console readiness requires it.
- **Console**: a queued run says "A team runs one week at a time, and only a set number of
  teams run at once, so this one waits for the runs ahead of it."
- **Unchanged**: job states, routes, payloads, the queue, cancel and retry rules, CSV outputs,
  portal views and the shared/operations libraries. The portal keeps its pin.

## Revisions

- Design `6aac074` (docs, contracts, decision 011, `check_docs.py`) plus this release note;
  branch `feat/parallel-worker-runs` from `main` `6998540`.
- Admin `736b7e8` (code, migration 021, tests, README, deployment) and `31c68d2` (snapshot
  pinned to design `6aac074`); branch `feat/parallel-worker-runs` from `main` `99576a8`.

## Executed on the final code

Local SQL Server 2022 and the ES mock read through private `scl-appchi-*` indices:

- Admin integration `tests/integration` and `tests/engine/integration`: **232 passed** (source
  identical to `736b7e8` but for one test's formatting), including the new
  `test_parallel_runs.py`: two teams running at once in slots 1 and 2 while the team's second
  week waits; the weekly lock and synchronous `POST /runs` refused and a new submission queued
  while they run; deletion of another run beside them; the database refusing a second active
  job for one team, a taken slot and slot 0; recovery of jobs left running in two slots before
  any claim; and a run refused after waiting on another run's storage lock, then stored.
- Admin `tests/engine/acceptance` with `test_parallel_runs.py` on `736b7e8`: **8 passed**.
- Admin unit `tests/unit` and `tests/engine/unit` on `31c68d2`: **1130 passed**, including
  `test_parallel_worker.py` (side-by-side slots, refill, a poll starting new work, drain on an
  infrastructure error, the 1–8 range and the migration 021 check). Ruff, format and strict
  mypy passed. Design `check_docs.py` passed; `tests/unit/test_design_snapshot.py` matched.
- Real entry points on `alerts_bi_test` after `db reset-test` (all 21 migrations applied):
  - `run-worker --concurrency 9 --once` exited 1: "WORKER_CONCURRENCY must be between 1 and 8,
    got 9".
  - In the console (browser): a New run for Checkout API 17–24 Aug (fake model) showed
    "Waiting for the worker"; a second Checkout API week, 10–17 Aug, was queued and its panel
    showed the new queued sentence; Payments Core 17–24 Aug was queued.
  - `run-worker --concurrency 2 --once` logged `up to 2 jobs at once, one per team`, started
    Checkout API 24 Aug in slot 1 and Payments Core in slot 2 within 150 ms, both stored, and
    only then started Checkout API 17 Aug in slot 1. All three jobs completed with no slot
    left held, and the Teams page showed both teams ready to review.

## Not verified

- A deployment: nothing was deployed, and no cluster setting or memory limit was changed.
- Two real runs contending for `alerts-bi-persist` at the same moment (the local runs stored
  0.6 s apart; the wait and timeout are covered by the lock test).
- The weekly backfill yield with more than one slot is covered by the shared claim function
  and the existing single-slot tests, not by a parallel-specific test.
- Elasticsearch and model load at production volume with several jobs at once.
