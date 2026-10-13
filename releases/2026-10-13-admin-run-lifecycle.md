# Admin run lifecycle — verification and delivery, 2026-10-13

Implemented Monday 00:00 UTC manual boundaries, confirmed permanent run deletion and
removal of the admin publication gap override. Canonical intent is design section 7.12
and decision 004. Skipping/deleting weeks can still create gaps; the admin retains its
missing-week check, while CLI recovery and scheduler retention exceptions remain.

## Tested revisions and ownership

- Admin base: `d93865fd0e91720bff00ced531a06c8033decea2`.
- Admin implementation: `2f62e7c`; pinned inputs commit: `d3dec4d`.
- Canonical design and contracts: `be58a4b0a5899759daac1197c7217164b538cd89`.
- No portal or shared/operations library source change. Portal SQL-view metadata remains
  identical to the pinned contract. Existing migration 001–008 bytes are unchanged.
- New migration head: `009_run_deletion`. The checked decision foreign key prevents
  orphan inserts; only a connection/run-scoped whole-run deletion allowance permits
  decision cleanup. Ordinary decision updates/deletes remain rejected.

## Executed verification

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
