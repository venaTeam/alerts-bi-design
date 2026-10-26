# Deleting a failed run that never stored results — 2026-10-26

After an operator changed `LLM_MAX_BATCH_SIZE`, retrying a failed week failed with
`review settings changed for the same scope; use a new version/trial`. A run's model audit
(`llm_review_scopes`) records its prompt version, model version and settings, including the
batch cap, under the run id, and refuses a later attempt whose settings differ. The run id does
not include those settings. A stored run could be deleted to clear its audit. A run that failed
before storing results has no `runs` row, so Delete run answered "No such run." and the week
could run again only under the old settings, or after deleting audit rows by hand in SQL.

Accepted change (2026-10-26, requested by the operator; design section 7.12, 2026-10-26
amendment): Delete run also accepts a run with no `runs` row when it has a submission. It uses
the same transaction, locks and refusals, and removes the run's submissions, analysis
checkpoint and run-scoped model audit. Shared prompt artifacts and caches remain. The console
offers it on the failed submission's page, which the team page's Run submissions list and a
multi-week run's unpublished failed weeks now link to (Open). The same page offers deleting a
stored run whose rerun failed, with the stored run's own confirmation. An attempt skipped
because its week was published offers no Delete run. A run that fails on changed settings now
tells the operator: "The model settings changed since this week was first sent to the model.
Delete this run, then run the week again." The per-run settings check is unchanged. No
migration, library, contract route or portal change.

Revisions: design `26d6072` (amendment), merged with `main` as `252dbb7`. Admin `dc0a1dd`
(deletion, console, message, tests, README) and `244c341` (merge of `main` after the queue
change, snapshot pinned to design `252dbb7`). Branches are `feat/delete-failed-runs`. Portal
keeps its pin: none of its code or contracts change.

Executed checks, local SQL Server 2022 and the ES mock's private `scl-appchi-*` indices:

- New admin integration tests in `test_run_jobs.py`. A job fails after its model review and
  before storing. A resubmission with `LLM_MAX_BATCH_SIZE=50` fails with the new message. Its
  page offers Delete run, which removes the run's submissions, checkpoint and model audit and
  keeps the prompt artifacts. The run then completes with `max_batch_size` 50 recorded. A
  failed rerun of a stored week offers the stored run's dialog, and deleting it lets the week
  complete under the new size. A refused delete of a never-stored run returns to its
  submission.
- On admin `244c341`: `test_run_jobs.py`, `test_console.py`, `test_backfill.py` and
  `test_llm_audit.py` **90 passed**. Unit **1120 passed** (including the snapshot hashes).
  Ruff, format and strict mypy passed. Admin-environment `check_contracts.py --console`: API,
  CSV, migration and guide contracts match. Design `check_docs.py` passed.
- The full admin integration suite (`tests/integration tests/engine/integration`): **218
  passed** on the code before its final two console edits and the merge of `main`.
- Browser, admin console on a scratch database with the fake model: a week failed after its
  model review. It was resubmitted with `LLM_MAX_BATCH_SIZE=50` and failed showing the new
  message beside Delete run. The delete dialog named the team, week and run, and confirming it
  showed "Run permanently deleted." with both failed submissions gone. Resubmitting completed
  the run. The Open link in Run submissions reached a failed submission's page with Delete run.

Not run: the stored-run dialog on a failed submission page in a browser (integration test only),
a live model endpoint, and the full admin suite after the merge of `main`.
