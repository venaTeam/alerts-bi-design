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

## Review fixes — 2026-10-26

An independent review of both PRs found no blocker. The owner approved fixing four findings;
the cancel route stays a browser form route.

- **Published while queued.** A queued job whose run the weekly schedule published while it
  waited read the whole week from Elasticsearch, holding the shared slot, before persistence
  refused it, and then advised a retry that is refused too. The worker now checks the
  publication when it claims a job (manual or backfill week) and fails it with "Not run: this
  week was published while the run waited. Withdraw it to run it again." plus a
  `run.job_skipped` warning; the job panel says the published week is unchanged.
- **Queue order.** A submission that found the slot and lock free became pending while an older
  manual job was still queued (between worker polls, or with the worker down) and ran first.
  It now queues behind it.
- **Docs.** `async-runs.md` no longer says queue statements depend on a backfill or that
  admission refuses a busy scheduler lock, and lists `run.job_cancelled` and `run.job_skipped`.
- **Tests.** The duplicate-week 409s in `test_run_jobs.py` assert their message and a
  different week queues; the deletion test queues its manual run without a backfill; new tests
  cover queue order, the published skip, and a manual run refused for a week a backfill queued.

Revisions: design `355d734`; admin `711ff20` (worker, submission, page, tests, README) and
`50cfa7a` (snapshot pinned to design `355d734`).

Executed on the final code, same environment:

- Admin integration `test_backfill.py` and `test_console.py`: **51 passed**;
  `test_run_jobs.py`: **26 passed** after its two new message assertions were changed to read
  the response text (the 409 body is HTML for a client that does not ask for JSON).
- Admin unit **1112 passed** after the worker logging test's fake database gained the
  publication query. Ruff, format, strict mypy and `check_contracts.py --console` passed.
  Design `check_docs.py` passed. No OpenAPI change.
- Browser, admin console on `alerts_bi_test`: with Payments Core's job pending, a Checkout API
  job for 17–24 Aug was queued. The existing 17–24 Aug run was then published with Publish
  week. `run-worker --once` ran Payments Core. A second `--once` logged `run.job_skipped`
  without starting the analysis. The job's panel read "Not run: this week was published while
  the run waited. Withdraw it to run it again." and "The published week is unchanged.", and
  offered no way to start the week.

## PR review follow-ups — 2026-10-26

The posted PR reviews found no blocker. CI was green on admin `50cfa7a` and design `7653397`.
The owner asked for these problems to be fixed:

- **Same-key retry.** On the lock path the recheck reads committed rows only (deployments use
  `READ_COMMITTED_SNAPSHOT ON`). An identical submission queued without the lock could commit
  while the other waited for the team's queue lock and turn the retry into a duplicate-week
  409. A 409 there now re-reads the submission key and returns that job.
- **Backfill weeks skipped as published.** Such a week offers no Retry week, and the panel's
  retry counts only retryable weeks. Retrying all failed weeks leaves out weeks published
  since instead of refusing every week; retrying a published week on its own is still refused.
- **Worker runbook.** Adds a query for aging queued New runs, which is how a stopped worker
  shows up now, and the `run.job_cancelled` and `run.job_skipped` events.

Revisions: design `519fe5c`; admin `5c270a6` (submission, backfill retry, panel, tests) and
`e847316` (snapshot pinned to design `519fe5c`).

Executed on the final code, same environment:

- Admin integration `test_backfill.py`, `test_run_jobs.py` and `test_console.py`: **79
  passed**, including new tests for the same-key retry and for retrying a backfill with one
  week published while queued.
- Admin unit **1113 passed**, including the backfill panel's Retry buttons. Ruff, format, strict
  mypy and `check_contracts.py --console` passed. Design `check_docs.py` passed.
- Browser, admin console on `alerts_bi_test`: a two-week backfill for Checkout API (17–24 Aug
  and 24–31 Aug) was submitted from New runs, and the existing 24–31 Aug run was then published.
  The worker ran 17–24 Aug and logged `run.job_skipped` for 24–31 Aug. The panel showed the
  skipped week's message without Retry week, and offered only Dismiss.

## Second review follow-ups — 2026-10-26

The follow-up reviews found no blocker; CI was green on admin `e847316` and design `a24f234`.

- **Retry by publication.** The backfill panel decided retry from the skip's error text, while
  retry refuses any week that is published now. A week that failed for another reason and was
  published later showed Retry buttons that were refused, and a skipped week the operator
  withdrew, as its message says, showed none. The panel now offers Retry week, and counts
  toward Retry failed weeks, only the failed weeks that are not published, using the same
  query as retry. A failed week published later says "Published since. Withdraw it to run it
  again."
- **Runbook.** Queued rows aging with no active slot also happen while a CLI run, report,
  deletion or long weekly invocation holds the execution lock. The runbook now sends the
  operator to the worker's `worker.idle` reason before treating the worker as stopped.

Revisions: design `d0af05f`; admin `4deafe2` (team page, panel, tests) and `6294942`
(snapshot pinned to design `d0af05f`).

Executed on the final code, same environment:

- Admin integration `test_backfill.py` and `test_console.py`: **53 passed**. The retry test now
  checks the real team page. `test_run_jobs.py` is unaffected by this change and passed at
  `e847316`.
- Admin unit **1113 passed**. Ruff, format, strict mypy and `check_contracts.py --console`
  passed. Design `check_docs.py` passed.
- Browser, admin console on `alerts_bi_test`:
  - A two-week backfill ran 17–24 Aug and skipped 24–31 Aug, which was published while it
    waited. While that week was published, the panel offered only Dismiss.
  - After Withdraw week, the row offered Retry week and the panel offered Retry failed week.
  - Retry week was queued, and the worker completed it.

Not run locally: the full admin `scripts/ci_integration.py` and the ES-backed acceptance
modules; CI covers them. Not deployed.
