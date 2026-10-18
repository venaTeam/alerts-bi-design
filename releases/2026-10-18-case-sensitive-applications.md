# Exact application identity in SQL — 2026-10-18

A team whose window held applications differing only in case, such as `Moby` and `moby`,
could not persist its run. The engine keys alerts on the exact `application` + `key_field`
strings, but every stored `application` column used the database's case-insensitive default
collation. The second spelling violated `pk_run_summaries` or `pk_run_application_daily`,
and `pk_alert_findings` when the `key_field` matched. `persist_run` then rolled the whole run
back, and every rerun failed the same way.

Accepted decision (design `848731a`, amended `bc01ec8` and `3e8d0f2`): applications that differ
only in case are separate applications. Admin migration `015_case_sensitive_applications` stores `application` with
`Latin1_General_100_BIN2` in `alert_findings`, `llm_verdicts`, `finding_decisions`,
`run_alert_list`, `run_summaries`, `run_application_daily` and `run_v1_rules`. It recreates
their keys and indexes verbatim and refreshes the portal views. View column types, CSV
outputs, console routes and the shared/operations libraries are unchanged. No library
version and no portal code change.

Revisions: admin `e457943` (migration, readiness, regression test), `b6a3086`, `3e1f322` and
`3761be3` (review follow-up tests) and `741f39f` (snapshot); design `848731a` (decision,
contracts, deployment note), `bc01ec8` (release safeguards, visible consequences, coordinated
portal test), `1c38716` (portal test fixture fails on a broken migration) and `3e8d0f2` (no
timeout may cut the rebuild short); portal `2798285` (snapshot). Both consumers pin canonical
design `3e8d0f2`. The portal's original pin was `d656e42`, so its refresh also carries the
already-merged run-output-file amendment. Merge design first with a merge commit, not a squash,
so the pinned `3e8d0f2` stays reachable on design main; otherwise re-pin both consumers to the
merged commit. Then merge admin, then portal.

Visible consequences, recorded in the design: decisions and stored verdicts attach to the
exact spelling, so a source that changes an application's casing between weeks loses the
earlier decisions for it and its alerts are classified again. Ordering by `application` is by
code point (uppercase before lowercase), which changes the portal's application options and
the work-list CSV row order for mixed-case names.

Executed checks, local SQL Server 2022 (`SQL_Latin1_General_CP1_CI_AS`) and the seeded ES mock:

- New admin integration test `test_application_case.py`: one run with `Moby` and `moby`
  sharing a `key_field` on the same day persists both identities to every table, equality is
  exact, each keeps its own verdict, and a rerun reuses both with no model call. With the 015
  files removed, it fails with the original `pk_alert_findings` duplicate key for `moby`.
- `db setup` upgraded an existing `alerts_bi_test` (8 runs, 477 findings, 441 verdicts) to
  015. Row counts were unchanged, all 13 `application` columns (7 tables, 6 views) report BIN2,
  every key and index was rebuilt, and the reader grants were kept.
- With the 015 files removed, the previous release's `db setup` against the migrated database
  stops with `Can't locate revision identified by '015_case_sensitive_applications'`. This is
  the roll-forward-only behavior now recorded in openshift-deployment.md.
- Review follow-up tests (admin `b6a3086`): the persistence test publishes a rule-flagged
  Moby/moby run, records a decision for each spelling, and reads both through every portal view
  and the OPENJSON decision-history lookup; the verdict test owns its run and asserts each
  spelling's verdict; a schema test requires BIN2 on all 13 `application` columns; a
  populated-upgrade test migrates to 014, seeds a published run with a decision and verdict,
  sees readiness refuse 014, upgrades through `migrate()` and keeps every row; a unit test
  checks the downgrade refusal. With 015 removed, the persistence tests fail on the
  `pk_alert_findings` duplicate key and the schema test fails.
- Second review round (admin `3e1f322`): the verdict test marks each spelling's stored verdict
  with its own justification and requires the rerun to carry it. With the verdict lookup
  lowercasing `application`, it fails with `Moby` carrying `moby`'s marker. The schema test
  also requires all nine rebuilt keys and indexes. A member of `alerts_bi_reader` reads all six
  refreshed views. At 014, a schema-bound view on `alert_findings.application` makes 015 fail
  after its keys were dropped. The database stays at 014, with no 015 ledger row, unchanged
  counts, all five primary keys and the old collation. Once the view is dropped, `migrate()`
  applies 015.
- Final admin tip `3e1f322`, on a quiet `alerts_bi_test`: `scripts/ci_integration.py`
  **196 passed**, zero skips. Unit **944 passed**. Ruff, format, strict mypy and lock
  validation passed. Two earlier runs on intermediate tips overlapped with the linked key_field
  session on the same local test database. One overlapped its resets and reported 1 failure.
  The other overlapped its 016 `db setup`. Neither is counted as evidence. The first
  submission ran 192 passed and unit 943.
- Migration timeouts: the Alembic engine in `env.py` passes no query timeout, so
  `SQL_REQUEST_TIMEOUT_MS` does not apply to migrations, and pymssql 2.4.4 defaults to none.
  The admin Deployment sets no `activeDeadlineSeconds` (only the weekly CronJob has one), so the
  `migrate` init container is not cut short during a long rebuild. Design `3e8d0f2` puts this in
  openshift-deployment.md, with when to run deploy/migrate.yaml by hand instead.
- Third review round (admin `3761be3`, design `1c38716`): the rollback test drops its blocker in
  a `finally` block; the keys check requires exactly the nine rebuilt keys and indexes on
  `application` in `dbo`; the portal case test skips only on a failed `SELECT 1`, so reset and
  migration errors fail it, and it covers selecting both spellings. With an invalid statement
  appended to 015, that test reports 4 errors and no skips. Both admin modules pass (6 tests).
  GitHub CI runs the full admin suite on push.
- Portal unit **283 passed**; ruff, format and strict mypy passed.
- Admin-environment `check_contracts.py --console --sql` on the final tips: API, CSV, migration
  bytes, guides, console routes and SQL view metadata match.
- Coordinated `run_integration.py --registry config/teams.json` with the portal worktree
  installed: **81 passed**, including the new `test_portal_application_case.py` (selector lists
  both spellings, IN filter and fix list match one, OPENJSON detail and decision lookups return
  only the exact spelling). With admin 015 removed, its fixture fails on `pk_alert_findings`.
  The first submission ran 77 passed.
- Browser, against `alerts_bi_test` with a published week holding `Moby`, `moby` and `Other`:
  the portal selector listed all three, applying only `Moby` showed its single alert, `moby`
  showed its two, and the `moby` detail for the shared key rendered `moby`'s row. The admin
  console showed the run as completed and published.
- OPENJSON identity and application filters compare correctly against the BIN2 column, with
  no collation conflict: in a direct probe on a database whose default is case-insensitive,
  `OPENJSON ... WITH (a NVARCHAR(256))` and the default `value` column both took the BIN2
  column's collation and matched `Moby` only. That is consistent with OPENJSON values being
  coercible, so the stored column's collation decides; the coordinated portal test repeats the
  lookups end to end. Production's database default was not inspected.

Not covered: `key_field` keeps the default collation, and SQL Server equality ignores trailing
spaces even under BIN2. Neither has been observed. Production table sizes were not available,
so the one-time key rebuild's duration on production is unmeasured; the deployment doc now
requires a verified backup, row counts and log headroom, and a maintenance window first.
`contracts/migrations.json` keeps `source_commit` at the extraction commit, as the 013 and 014
amendments did. Nothing has been merged or deployed.
