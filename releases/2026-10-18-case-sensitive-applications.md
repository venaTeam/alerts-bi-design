# Exact application identity in SQL — 2026-10-18

A team whose window held applications differing only in case, such as `Moby` and `moby`,
could not persist its run. The engine keys alerts on the exact `application` + `key_field`
strings, but every stored `application` column used the database's case-insensitive default
collation. The second spelling violated `pk_run_summaries` or `pk_run_application_daily`,
and `pk_alert_findings` when the `key_field` matched. `persist_run` then rolled the whole run
back, and every rerun failed the same way.

Accepted decision (design `848731a`, amended `bc01ec8`): applications that differ only in case are separate
applications. Admin migration `015_case_sensitive_applications` stores `application` with
`Latin1_General_100_BIN2` in `alert_findings`, `llm_verdicts`, `finding_decisions`,
`run_alert_list`, `run_summaries`, `run_application_daily` and `run_v1_rules`. It recreates
their keys and indexes verbatim and refreshes the portal views. View column types, CSV
outputs, console routes and the shared/operations libraries are unchanged. No library
version and no portal code change.

Revisions: admin `e457943` (migration, readiness, regression test), `b6a3086` (review
follow-up tests) and `9b0678f` (snapshot); design `848731a` (decision, contracts, deployment
note) and `bc01ec8` (release safeguards, visible consequences, coordinated portal test);
portal `adb96bb` (snapshot). Both consumers pin canonical design `bc01ec8`. The portal's
previous pin was `d656e42`, so its refresh also carries the already-merged run-output-file
amendment. Merge design first with a merge commit, not a squash, so the pinned `bc01ec8`
stays reachable on design main; otherwise re-pin both consumers to the merged commit. Then
merge admin, then portal.

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
- Admin integration (`tests/integration`, `tests/engine/integration`, `tests/engine/acceptance`)
  on the final tip: **194 passed**, no skips. An earlier run of the same tip through
  `scripts/ci_integration.py` reported 1 failed and 193 passed, and its failure name was not
  captured; the immediate rerun passed fully. The linked key_field session confirmed that its
  tests were resetting the same local `alerts_bi_test` during that run. Unit **944 passed**. Ruff, format, strict mypy
  and lock validation passed. The first submission ran 192 passed and unit 943.
- Portal unit **283 passed**; ruff, format and strict mypy passed.
- Admin-environment `check_contracts.py --console --sql`: API, CSV, migration bytes, guides,
  console routes and SQL view metadata match.
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
