# Deleting a failed run that never stored results — 2026-10-26

After an operator changed `LLM_MAX_BATCH_SIZE`, retrying a failed week failed with
`review settings changed for the same scope; use a new version/trial`. A run's model audit
(`llm_review_scopes`) records its prompt version, model version and settings, including the
batch cap, under the run id, and refuses a later attempt whose settings differ. The run id
includes the prompt and model versions but not the batch cap, the output cap, or the deployment
when a model revision is set. A stored run could be deleted to clear its audit. A run that failed
before storing results has no `runs` row, so Delete run answered "No such run." and the week
could run again only under the old settings, or after deleting audit rows by hand in SQL.

Accepted change (2026-10-26, requested by the operator; design section 7.12, 2026-10-26
amendment): Delete run also accepts a run with no `runs` row when it has a submission. It uses
the same transaction, locks and refusals, and removes the run's submissions, analysis
checkpoint and run-scoped model audit. Shared prompt artifacts and caches remain. The console
offers it on the failed submission's page, which the team page's Run submissions list and a
multi-week run's unpublished failed weeks now link to (Open). The same page offers deleting a
stored run whose rerun failed, with the stored run's own confirmation, only when that attempt
reran it (the stored run started before the attempt did) and it is unpublished. An attempt
skipped because its week was published offers no Delete run. The never-stored confirmation
posts `unstored=1` and is refused if the run has stored results by then. A run that fails on
changed settings now tells the operator: "The model settings changed since this week was first
sent to the model. Delete this run, then run the week again." A weekly, CLI or synchronous HTTP
attempt has no submission, so its message says to run the week from New runs first. The
per-run settings check is unchanged. No migration, library, contract route or portal change.

A subagent code review of the branch found four reachable issues, and a second pass confirmed
the fixes and found one more. All are fixed in admin `9512c26`:

- A stale failed attempt offered deleting a later, even published, stored run.
- A stale never-stored confirmation could delete results stored after the page loaded.
- The settings message named a deletion that weekly and CLI failures could not reach.
- The never-stored team lookup scanned `run_jobs` with `UPDLOCK, HOLDLOCK` before the team
  queue lock, the reverse of submissions' order (a possible deadlock).
- The reran-it test compared with the submission time instead of the attempt's start.

The PR review then found the text overstated which setting changes cause the refusal. The run
id includes the prompt and model versions, so only the batch cap, the output cap, or the
deployment when a model revision is set can change. Design `374f875` and admin `55a278b` say
so.

Revisions: design `26d6072` (amendment), merged with `main` as `252dbb7`, then `79bd5e1`
(review follow-ups) and `374f875` (settings wording). Admin `dc0a1dd` (deletion, console,
message, tests, README), `244c341` (merge of `main` after the queue change), `9512c26` (review
fixes), `c28eef2` (snapshot pinned to design `374f875`) and `55a278b` (message wording). Branches are `feat/delete-failed-runs`. Portal keeps its pin: none
of its code or contracts change.

Executed checks, local SQL Server 2022 and the ES mock's private `scl-appchi-*` indices:

- New admin integration tests in `test_run_jobs.py`. A job fails after its model review and
  before storing. A resubmission with `LLM_MAX_BATCH_SIZE=50` fails with the new message. Its
  page offers Delete run, which removes the run's submissions, checkpoint and model audit and
  keeps the prompt artifacts. The run then completes with `max_batch_size` 50 recorded. A
  failed rerun of a stored week offers the stored run's dialog, and deleting it lets the week
  complete under the new size, and once that run is published the failed attempt offers no
  deletion. A stale failed attempt, older than a later stored result, offers no deletion, and
  its stale never-stored confirmation is refused with the run kept. A refused delete of a
  never-stored run returns to its submission.
- On admin `9512c26`: `test_run_jobs.py`, `test_console.py`, `test_backfill.py` and
  `test_llm_audit.py` **91 passed**. Unit **1120 passed** (including the snapshot hashes).
  Ruff, format and strict mypy passed. Admin-environment `check_contracts.py --console`: API,
  CSV, migration and guide contracts match. Design `check_docs.py` passed.
- The full admin integration suite (`tests/integration tests/engine/integration`): **218
  passed** on the code before its final two console edits and the merge of `main`.
- Browser, admin console on a scratch database with the fake model: a week failed after its
  model review. It was resubmitted with `LLM_MAX_BATCH_SIZE=50` and failed showing the new
  message beside Delete run. The delete dialog named the team, week and run, and confirming it
  showed "Run permanently deleted." with both failed submissions gone. Resubmitting completed
  the run. The Open link in Run submissions reached a failed submission's page with Delete run.

Not run: the stored-run dialog on a failed submission page and the review fixes in a browser
(integration tests only), a live model endpoint, and the full admin suite after the merge of
`main`. CI ran both suites on `244c341`. The lock-order fix is reasoned from the lock order;
no test reproduces the deadlock.
