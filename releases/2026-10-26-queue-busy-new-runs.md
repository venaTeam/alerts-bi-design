# New runs queue while another run is in progress — 2026-10-26

Runs execute one at a time across all teams. A New run submitted while another run held the
active slot or the shared execution lock was refused with 409 unless a backfill was in
progress, so an operator starting one team's week while another run was going had to wait and
submit again.

## Decision and resulting behavior

Accepted 2026-10-26 by the product owner; design section "New runs queue while another run is
in progress" (final text at design `11bc8e1`).

- **A busy submission is queued.** A single New run (New runs with one week, or
  `POST /run-jobs`) that finds the slot taken or the execution lock held is accepted as
  `queued`, whatever holds the lock: a job, a CLI run or report, the weekly schedule or a
  deletion. It also queues while an older manual job is still queued, so runs start in
  submission order. The worker's claim order is unchanged: pending, then queued manual jobs by
  submission, then backfill weeks.
- **One active job per team and week.** A submission for a week the team already has queued,
  pending or running is refused with 409 "Already queued or running for this team: <week>.
  Wait for it to finish." (adding "or remove it from the queue" when that job is queued). A
  retry with the same submission key returns the existing job, also when two identical
  submissions race for the team's queue lock. A resubmitted form says what became of its run.
- **A queued run can be removed.** `POST /run-jobs/{job_id}/cancel` (browser form route) also
  cancels a queued manual job; one already with the worker runs to completion. The team page
  offers Remove on queued runs.
- **A week published while its job waited is not run.** The worker fails such a job (manual or
  backfill week) with "Not run: this week was published while the run waited. Withdraw it to
  run it again." and a `run.job_skipped` warning, without reading Elasticsearch. Backfill retry
  is offered, and Retry failed weeks counts a week, only while the week is not published;
  retrying every failed week leaves published weeks out.
- **Unchanged:** the weekly retry, synchronous `POST /runs`, CLI runs, reports and acceptance
  verification (still refused while busy), the locks, the active-slot constraint and the
  deletion rules. No migration, route, library or portal change. The worker runbook covers
  aging queued rows and the new `run.job_cancelled` and `run.job_skipped` events.

## Revisions

- Design `11bc8e1` (docs, contracts, decision 005) plus this release note; branch
  `feat/always-queue-runs` from `main` `7f1f034`.
- Admin `15b420f` (code, tests, README) and `c15c334` (snapshot pinned to design `11bc8e1`);
  branch `feat/always-queue-runs` from `main` `698141c`.
- Portal keeps its pin: none of its code or contracts change.

## Executed on the final code

Admin `c15c334` and design `11bc8e1`, local SQL Server 2022 and the ES mock read through
private `scl-appchi-*` indices:

- Admin integration `test_backfill.py`, `test_run_jobs.py` and `test_console.py`: **80 passed**.
  They cover queueing behind a job, behind a lock without a job and behind an unclaimed queued
  job; the duplicate-week refusal (busy or not, either model mode, a week a backfill queued)
  and its advice; the same-key race; submission-order execution; the published skip with its
  `run.job_skipped` record; backfill retry with one or every failed week published, and on the
  real team page; and console removal, including refusal for pending and finished jobs and the
  `run.job_cancelled` record.
- Admin unit `tests/unit` and `tests/engine/unit`: **1118 passed**, including the panels' Remove
  and Retry buttons and the resubmitted-form messages. Ruff, format and strict mypy passed.
  Admin-environment `check_contracts.py --console` matched; the regenerated
  `console-openapi.json` differs from `main` only in the `POST /run-jobs` 409 description.
  Design `check_docs.py` passed.
- Browser, admin console on `alerts_bi_test`, with a Payments Core job holding the slot:
  - A New run for Checkout API from the dialog was queued ("Run queued. It starts when the
    runs ahead of it finish.") and showed "17 Aug – 24 Aug 2026 is queued" with Remove.
  - Another submission for that week returned "Already queued or running for this team: 17 Aug
    – 24 Aug 2026. Wait for it to finish, or remove it from the queue."
  - Remove returned "Run removed from the queue."; replaying the same form then returned "This
    form was already submitted, and that run was removed from the queue."
  - Posting Remove for the pending Payments Core job returned "Only a queued run can be
    removed. This one is already with the worker and runs to completion, or was already
    removed."
  - A two-week backfill showed "Next of these weeks" for its first queued week.

Earlier browser journeys on the same flow, each on the revision current at the time:

- `0fae358`: queueing behind another team, Remove, the duplicate refusal from a dialog opened
  before the week was queued, submission-order execution by `run-worker --once`, and the
  queued panel at 375 px.
- `711ff20`: a queued run skipped after its week was published from the console.
- `4deafe2`: a backfill week skipped as published offered no retry until Withdraw week, after
  which Retry week was queued and completed.

## Review history

Four review rounds and a final full review found no blocker; each round's fixes are in the
revisions above.

- An independent review found that a week published while queued was read in full before being
  refused, that a submission between worker polls could start before an older queued one, and
  stale `async-runs.md` wording (design `355d734`, admin `711ff20`).
- PR reviews found the same-key race on the lock path, Retry offered on weeks skipped as
  published, and missing runbook monitoring (design `519fe5c`, admin `5c270a6`), then retry
  decided by error text rather than publication and the runbook's reading of idle queues
  (design `d0af05f`, admin `4deafe2`), then the second idle reason (design `d90b422`). An earlier
  version of this note said `test_run_jobs.py` was unaffected by `4deafe2`; it loads the team
  page, whose handler changed, and it passed 26 of 26 at `6294942`.
- The final full review of code and documents corrected operator messages, docstrings, the
  409 description, test coverage of the new log events and refusals, unmarked old wording in
  `backfill.md`, the flow and `async-runs.md`, and the runbook's quoted log text (design
  `11bc8e1`, admin `15b420f`).

Not run locally: the full admin `scripts/ci_integration.py` and the ES-backed acceptance
modules; CI covers them. Not deployed.
