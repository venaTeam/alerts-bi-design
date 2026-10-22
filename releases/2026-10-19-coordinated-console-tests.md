# Coordinated admin tests for the redesigned console — 2026-10-19

Four tests in `tests/integration/test_admin.py` still asserted pages that the operator console
redesign ([admin #16](https://github.com/venaTeam/alerts-bi-admin/pull/16), decision 006)
removed or renamed. They failed identically against admin main with and without the
long-alert-identity-key change. Only the tests change; no product behavior, contract or snapshot
changes.

## Tested revisions

- Admin `012c5ea7538bc19cdb1b73323d7ecf1830190956` (origin/main, merge of admin #16).
- Portal `e77facd5818f28bdf31a80ac8f510a824420d13c` (origin/main), installed into the admin
  task-local Poetry environment.
- Design `a6878cdf0248f49060f0a86ee436298a1963d043` (origin/main) plus the test change on
  `fix/coordinated-console-tests`.
- Shared `0.1.8` and operations `0.2.6` from the admin checkout.

## What each test now checks

- `test_publishing_withdrawing_and_deciding_are_recorded_under_the_operator`: the published
  week lists the finding with its Confirmed decision, and the finding's own page, opened from
  that list, shows the decision and its note. The decision note is no longer on the list.
- `test_the_workspace_defaults_to_the_latest_run_including_failures`: the week picker marks the
  failed run as current, the current step shows its error and "Only completed runs can be
  published", and the run details carry its run id. The `#selected-run` section is gone.
- `test_the_summary_of_a_published_week_reads_its_published_history`: the pace text is
  unchanged. It failed only because the publishing test stopped before its withdrawal.
  `Published</span>` now matched only the week picker, so the test checks the selected week's
  "In the portal since" note instead.
- `test_a_failed_run_is_visible_with_retry_and_no_publication`: "Retry run" is now "Run this
  week again" for the failed week, and New runs opens with that week checked. The console
  offers it only while the week is inside the 84-day retention. The failed fixture run
  therefore ends one week before the latest complete week. With the former fixed 2026-08-31
  end, the button would have disappeared on 2026-11-16. The run is still the team's newest.

## Executed checks

- From the admin worktree:
  `poetry run python ../design/scripts/run_integration.py --registry config/teams.json`,
  against local SQL Server `alerts_bi_test` and the seeded Elasticsearch mock. Result:
  **82 passed**, no failures or skips. Before the change: 78 passed, 4 failed.
- `tests/integration/test_admin.py` alone: 21 passed. Before the change: 17 passed, 4 failed.
- Ruff check and format check on the changed test: pass.
- Strict mypy on the changed test: no new errors. The environment's editable installs leave
  the seven app imports unresolved (`import-not-found`) with or without the change.

One upstream Starlette/httpx deprecation warning is present. `check_contracts.py` was not
rerun because no contract or snapshot changed. No merge or deployment was performed.
