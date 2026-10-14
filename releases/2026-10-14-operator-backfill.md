# Operator backfill — 2026-10-14

Implementation: admin commits 66469d6 (migration 014), 137c05c (backfill feature) and 49e9fad
(documentation and snapshot) on codex/backfill, based on main c85d231. Canonical input: design
05962a3 (amendment) and 9ff276e (contracts) on codex/backfill, based on main a22ca48. The
admin snapshot is pinned to 9ff276e. Migration 014_backfills is additive; applied revisions
001–013 keep their exact bytes. Portal views and shared/operations interfaces are unchanged.

## Executed checks

- `poetry run pytest tests/unit tests/engine/unit -q`: 927 passed.
- `poetry run pytest tests/integration tests/engine/integration -q`: 181 passed on real local SQL
  Server and the seeded Elasticsearch mock; no skipped checks. Includes 10 new backfill tests.
- `poetry run pytest tests/engine/acceptance -q`: 4 passed.
- `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`,
  `poetry check --lock`: passed. `poetry build` wheel contains engine/api/backfill.py and both
  014 migration files.
- `uv run python scripts/check_docs.py`: passed.
- Admin-environment `python ../design/scripts/check_contracts.py --console --sql`: passed,
  including the regenerated console OpenAPI, routes, schema head, migration hashes and
  unchanged published-view metadata.

One upstream Starlette/httpx deprecation warning is present. Tests and browser checks used only
the disposable alerts_bi_test database and existing local mocks; task-local servers were stopped.

## Browser evidence

The loopback admin server (port 8211, explicit dev identity) and the installed run-worker ran on
a seeded alerts_bi_test with two published weeks and one unpublished run. The dialog showed
Sunday-first calendars, locked published weeks, the expiring-week warning, select-all, the run
order and the model select. A 7-week fake-model backfill was executed by the real worker oldest
first; the panel polled and reloaded to Finished, runs showed source Backfill, and the gap banner
recounted. A second backfill exercised Remove, an injected registry change (failed week),
Retry (attempt 2), Cancel and Dismiss. A 375px viewport showed no horizontal overflow; console
errors were limited to refused polls during deliberate server restarts.

The check found and fixed three defects before delivery: the shared portal `.missing` rule
recoloured calendar days (state classes are now `is-*`), redirects anchored below the
confirmation message, and the dialog claimed an unpublished run is always replaced (it is
replaced only when its deterministic identity is unchanged; backfill.md was clarified).

## Not verified

The live model path with a real model (local mock runs with LLM_ENABLED=false), the weekly wait
inside a real CronJob (covered by SQL integration tests with an injected clock), and any cluster
deployment. No merge or deployment was performed.

## Delivery

Coordinated review: [admin #10](https://github.com/venaTeam/alerts-bi-admin/pull/10) and
[design #7](https://github.com/venaTeam/alerts-bi-design/pull/7), both on codex/backfill.
Merge together; deploy only with separate authorization. Deployment initialization applies 014
before the UI and worker start. Before an application rollback, stop new submissions and drain
or terminalize every queued job, including New runs queued behind a backfill (worker runbook).

## Review fixes

The review of admin #10 at 49e9fad reported two issues, both reproduced by new tests that
failed on that revision. Admin 3f15e4c claims queued manual runs by submission time instead of
reporting week, and makes every run job insert and run deletion take the team's
transaction-scoped queue lock `alerts-bi-queue:{team_id}`, so a deletion paused after its
checks can no longer remove a week accepted before its cleanup (backfill and queued manual
admission). Design a1f5a71 records the lock; admin e473a81 pins that snapshot.

Re-run on the final admin tree: ruff check, ruff format --check and strict mypy passed;
927 unit tests passed; `tests/integration tests/engine/integration tests/engine/acceptance`:
188 passed with no skips; `check_contracts.py --console --sql` passed. Browser recheck on a
seeded alerts_bi_test: a 9-week backfill was accepted and a run deletion succeeded while all
nine queued weeks remained.

A second review at admin e473a81 found that a dismissed backfill retried from a stale form, or
an older backfill retried after a newer one finished, ran without a visible panel. Admin
e94b67a (snapshot 9040883) shows an active backfill ahead of finished ones and clears the
dismissal on retry; dismissal takes the team queue lock. Design c6f35e5 records the display rule.
A dismiss-then-retry regression test failed on e473a81 and passes. Final re-run: lint, format
and strict mypy passed; 927 unit; 189 integration and acceptance with no skips;
`check_contracts.py --console --sql` passed; a two-tab browser recheck on alerts_bi_test showed
the retried backfill with its Cancel/Remove controls.

A third review found two more issues. Admin: backfill job submission keys were numbered from the
surviving job rows, so after run deletion removed an earlier attempt a later retry reused an
existing key and failed on `uq_run_jobs_submission_hash`. Admin 0ec621a derives keys from each
job's own ID; a regression test reproducing the delete-between-retries sequence failed on
9040883 and passes. Design a7a6855 (admin snapshot 85564db): the rollback guidance now requires
stopping new submissions and draining or terminalizing every queued job, including New runs
queued behind a backfill, in the contract, runbook, decision 005 and this record. Final re-run:
lint, format and strict mypy passed; 927 unit; 190 integration and acceptance with no skips;
`check_contracts.py --console --sql` passed; browser retry recheck on alerts_bi_test.

