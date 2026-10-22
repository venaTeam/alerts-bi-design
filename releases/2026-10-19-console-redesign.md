# Operator console redesign — 2026-10-19

Implementation: admin commits 1a145b9 (pages, stylesheet, routes, queries and tests) and f65065b
(design snapshot and README) on feat/admin-console-redesign, based on main 77247ff. Canonical
input: design 663f561 (amendment, decision 006, contract entry) and fc80122 (regenerated console
schema and three settled details) on feat/admin-console-redesign, based on main 561979f. The
admin snapshot is pinned to fc80122. No migration; applied revisions 001–017 keep their exact
bytes. Portal views, shared/operations interfaces, CSV outputs and scoring are unchanged.

## Executed checks

- `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`: passed.
- `poetry run pytest tests/unit tests/engine/unit -q`: 1021 passed, including the new
  `tests/unit/test_console_pages.py`.
- `poetry run pytest tests/integration tests/engine/integration -q`: 201 passed on real local SQL
  Server (disposable alerts_bi_test) and the seeded Elasticsearch mock; no skipped checks.
- `python scripts/check_docs.py`: passed.
- Admin-environment `python ../design/scripts/check_contracts.py --console`: passed, including
  the regenerated console OpenAPI, routes, schema head, migration hashes, outputs and guides.
- `tests/unit/test_design_snapshot.py`: passed against the fc80122 manifest.

One upstream Starlette/httpx deprecation warning is present.

## Browser evidence

The loopback admin server (port 8211, explicit dev identity) and the installed run-worker ran on
a task-local scratch database, alerts_bi_redesign, seeded with six fake-model runs across three
teams. Checked:

- The Teams page with the attention filter.
- The week picker.
- Review → Continue to publish → Publish week, for three back-to-back weeks.
- The published view, the finding page, Record decision, and the Decisions page with filters.
- New runs with two weeks → "Running 2 weeks" → Cancel → Dismiss.
- New runs with one week, processed by one worker pass; the page moved to the finished run on
  its own.
- The empty team, Schedule, the Withdraw dialog and run details with the detailed analysis.

At 1366px and 375px the pages had no horizontal overflow, and there were no console errors. A
re-loaded script with the week list removed raised no error, and the CSP refused `eval`.

The check found and fixed two defects before delivery: the expiring-week warning fired for weeks
before a team's first run, and the Schedule page's next-week card stretched vertically.

## Review fixes

An independent review of the uncommitted change reported one high-severity defect, fixed in
1a145b9 and covered by a unit test: the New runs script threw when no week could run, which
stopped job and backfill polling. The same commit also:

- shows the held unassessed count on the team page;
- keeps the retention note while weeks run;
- hides Run-again buttons for unregistered teams;
- opens a newer pending, queued or running submission by default;
- makes "Run it" check the week its note warns about.

It also fixes an existing time-zone flake in `test_team_identity`, which took "this Monday" from
local time.

## PR review fix

The review of admin #16 at f65065b found that the shared New runs dialog kept an earlier
selection: after opening it from the header, changing weeks and cancelling, "Run this week
again" would start the other week. Admin b7c21be resets the week list on every open (the retry
and Run it openers check only their week; other openers restore the default) and replaces the
retry with an explanation when the failed week can no longer run. Checks on b7c21be: ruff,
format, mypy and 1023 unit tests passed; integration tests for console, run jobs and backfill
passed (69); the cancel-and-reopen journey was repeated in the browser with a failed scratch
week. The design inputs are unchanged, so the snapshot stays pinned to fc80122.

## Not verified

- A live model path (local runs used the fake model).
- The engine acceptance suite (`tests/engine/acceptance`), not run because the engine is unchanged.
- Any cluster deployment.

No merge or deployment was performed.

## Delivery

Coordinated review: [admin #16](https://github.com/venaTeam/alerts-bi-admin/pull/16) and
[design #16](https://github.com/venaTeam/alerts-bi-design/pull/16), both on
feat/admin-console-redesign. Merge together; deploy only with separate authorization. Rolling the
app back restores the previous pages with no data change.
