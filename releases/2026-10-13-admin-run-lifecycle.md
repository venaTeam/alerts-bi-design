# Admin run lifecycle — verification and delivery, 2026-10-13

Implemented Monday 00:00 UTC manual boundaries, confirmed permanent run deletion and
removal of the admin publication gap override. Canonical intent is design section 7.12
and decision 004. Skipping/deleting weeks can still create gaps; the admin retains its
missing-week check, while CLI recovery and scheduler retention exceptions remain.

The concurrency follow-up below supersedes the initial locking coverage and tested heads.

## Initial tested revisions and ownership

- Admin base: `d93865fd0e91720bff00ced531a06c8033decea2`.
- Admin implementation: `2f62e7c`; pinned inputs commit: `d3dec4d`.
- Canonical design and contracts: `be58a4b0a5899759daac1197c7217164b538cd89`.
- No portal or shared/operations library source change. Portal SQL-view metadata remains
  identical to the pinned contract. Existing migration 001–008 bytes are unchanged.
- New migration head: `009_run_deletion`. The checked decision foreign key prevents
  orphan inserts; only a connection/run-scoped whole-run deletion allowance permits
  decision cleanup. Ordinary decision updates/deletes remain rejected.

## Initial executed verification

On Python 3.13 with Poetry 2.3.1, locked dependencies, real local SQL Server and the existing
Elasticsearch mock; writes/resets targeted only disposable `alerts_bi_test`.

| Command / journey | Result |
|---|---|
| `poetry run pytest tests/unit tests/engine/unit tests/integration tests/engine/integration tests/engine/acceptance -q -rs` | 1,044 passed; no skips |
| `poetry run alerts-bi-admin verify-acceptance --database alerts_bi_test` | 843 hand-authored checks passed; oracle unchanged |
| `poetry run ruff check .` | Passed |
| `poetry run ruff format --check .` | 205 files already formatted |
| `poetry run mypy` | 202 source files; passed |
| `poetry check --lock` | Passed |
| `python scripts/check_docs.py` in design | Passed |
| `poetry run python ../design/scripts/check_contracts.py --console --sql` from admin | API, CSV, migrations, guides, console routes and SQL views match |
| `poetry build`, followed by wheel byte inspection | Includes deletion module, migration 009 SQL/revision and installed migration bridge |

The full suite emitted one existing Starlette TestClient/httpx deprecation warning.
Initial sandbox runs could not create temporary directories; host runs above completed.
Recorded command receipts describe the tested precommit Git state. The same source content
was subsequently committed without implementation edits.

SQL lifecycle tests cover published, unpublished, withdrawn and failed deletion, all
run-owned result/publication/decision/activity/model-audit rows, neighboring-run and shared
prompt-artifact preservation, report cleanup, confirmation and actor-bound/cross-site
CSRF checks, rollback after parent deletion, forbidden ordinary decision changes, orphan
insert refusal, manual/model/scheduler locks and forged gap override refusal.

Real browser verification used the isolated admin on localhost:18200 with `alerts_bi_test`:
non-Monday selection cannot submit; Monday 24 August covers 17 August 00:00 to 24 August
00:00 UTC; publication has no gap option; publishing and recording a decision work;
unchecked deletion and cancellation preserve the run; confirmed deletion removes a
published run and its decision; the team returns to zero runs; old reports return 404.
Schedule team selection and the global Decisions page were also exercised. The trigger
and delete dialogs fit the 390×844 viewport, cancellation restores focus, and the viewport
was reset. The create/publish/decide/delete journey was repeated after the final FK/scoped
deletion revision. SQL and disk checks confirmed the deleted browser run has no remaining
run-owned rows or configured reports.

Local screenshots are retained in the task admin worktree's ignored `out/`:
`monday-window.png`, `monday-window-mobile.png`, `delete-dialog-mobile.png`,
`deletion-complete-final.png`. The temporary admin listener was stopped after verification.

## Delivery and operational limits

Merge the design and admin PRs together. Before enabling deletion, apply migration 009
through the authorized database setup path; readiness fails without it. No development
or production data was deleted, and no merge or deployment was performed by this task.

Deletion cannot restore human decisions. SQL cleanup is atomic; file cleanup follows
commit and reports failure distinctly. Shared caches/prompt artifacts survive, and custom
CLI export paths are not tracked for cleanup. Scheduler enrollment remains; a deleted due
week can be recreated. Rolling back the application does not remove the additive migration.

PRs: [admin #4](https://github.com/venaTeam/alerts-bi-admin/pull/4) and
[design #4](https://github.com/venaTeam/alerts-bi-design/pull/4). Both use
`codex/admin-weekly-delete`; neither has been merged by this task.

## Concurrency review follow-up — 2026-10-13

Addressed [the admin P2 finding](https://github.com/venaTeam/alerts-bi-admin/pull/4#discussion_r4258205547).
The original 1,044-test run checked held locks directly and missed a real manual CLI rerun.
A new regression reproduced the failure on real SQL/Elasticsearch: pause `--no-llm` before
persistence, delete the completed stored run (303), then observe the CLI reinsert the same
deterministic id and rewrite reports.

Admin fix `e729d31` makes manual CLI and HTTP/API runs take the existing `alerts-bi-weekly`
SQL session lock before scanning, retaining it through persistence and all report writing.
The scheduler and deletion already take that resource. The lock uses its own connection,
so data commits and model-audit lock release cannot end protection early. HTTP contention
returns 409, CLI contention fails promptly, and failures release the lock. Update manual
CLI clients alongside the app; older CLI versions remain uncoordinated. No migration,
portal, library, API payload or resource-name change was introduced by this follow-up.
Admin snapshot `ec9f9ba` pins canonical contract `e57be7c775258f72b114575f5229f530383ab00e`.

Verification on the same disposable SQL/local Elasticsearch environment:

- Full unit/integration/acceptance suite: **1,051 passed**, no skips, one existing
  Starlette TestClient/httpx deprecation warning.
- Six real CLI rerun cases pause before scanning, persistence and report writing,
  with `--no-llm` and `--fake-llm`; independent SQL sessions must refuse deletion and a
  competing API run, then allow deletion after the rerun finishes. A seventh case checks
  lock release after a failed CLI execution.
- After correcting a strict-mypy test import, all seven focused cases passed again.
  Production logic did not change after the full suite. Ruff lint/format, strict mypy
  (202 source files), lockfile, canonical/producer contracts and standalone build passed.
- A separate process invoked the installed CLI against `alerts_bi_test`, pausing before
  persistence with assessment off. The real browser showed the existing run as completed,
  submitted confirmed deletion and received **409**. After resuming and joining the CLI,
  browser deletion succeeded. A subsequent browser fake-model trigger and deletion also
  succeeded. SQL/disk checks confirmed both runs were absent and a neighboring run survived.
- Local screenshots: admin task worktree `out/cli-race-delete-refused.png` and
  `out/cli-race-delete-succeeded.png`. The verification CLI and temporary listener stopped.

Both existing PRs are updated; merging and deployment remain outside this task's authority.

CI caught two output-path unit cases that mocked the data connection but not the new
execution-lock connection. The available local SQL Server masked this unit-test isolation
gap. Admin commit `390dfba` stubs both adapters for these path-only tests; production code
and the real-SQL concurrency cases are unchanged. The complete 915-test unit suite passed
again, and all four output-path cases passed with an intentionally unavailable `SQL_HOST`.
Both Linux/Python 3.12 GitHub checks passed on `390dfba`: [push run](https://github.com/venaTeam/alerts-bi-admin/actions/runs/38401655296)
and [PR run](https://github.com/venaTeam/alerts-bi-admin/actions/runs/38401662314).

## Standalone report review follow-up — 2026-10-13

Addressed the duplicate [standalone-report P2 findings](https://github.com/venaTeam/alerts-bi-admin/pull/4#discussion_r4258975601).
The previous concurrency checks missed `report`: it read SQL without the shared lock,
then could recreate the configured report files after deletion succeeded. A new real-SQL
regression paused after `build_run_outputs` returned, before directory creation/writes;
before the fix deletion returned 303 and reporting rewrote all four files.

Admin fix `cae0fa8` takes the existing SQL session lock before standalone report run-id/team lookup
through the last file write. The busy message includes active reporting. Both selectors
and release after an injected write failure have regression coverage. No migration, library,
output payload or portal contract changed. Canonical contract `ff4be6e` is pinned in admin;
updated CLI clients still need to roll out alongside the app.

Executed verification:

- Full suite: **1,054 passed**, no skips, one existing Starlette/httpx warning.
- After the final busy-message and formatting edits, all **57 console/API integration
  tests passed** again. All four output-path unit cases passed with an unavailable SQL host.
- Ruff lint/format, strict mypy (202 source files), lockfile, canonical documentation,
  producer contracts including SQL views, and standalone build passed.
- A separate installed `report` CLI process paused after SQL rendering against disposable
  `alerts_bi_test`. Confirmed deletion through the live browser returned **409**, including
  the report-busy message. After reporting completed, browser deletion succeeded. Final
  SQL/disk checks confirmed the run and configured report directory were absent, while
  a neighboring run remained. The temporary listener and CLI process stopped.
- Local screenshots: admin task worktree `out/report-race-refused.png` and
  `out/report-race-deleted.png`.

Both PRs remain unmerged; deployment was not performed.
