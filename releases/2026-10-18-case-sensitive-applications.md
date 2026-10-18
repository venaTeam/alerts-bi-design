# Exact application identity in SQL — 2026-10-18

A team whose window held applications differing only in case, such as `Moby` and `moby`,
could not persist its run. The engine keys alerts on the exact `application` + `key_field`
strings, but every stored `application` column used the database's case-insensitive default
collation. The second spelling violated `pk_run_summaries` or `pk_run_application_daily`,
and `pk_alert_findings` when the `key_field` matched. `persist_run` then rolled the whole run
back, and every rerun failed the same way.

Accepted decision (design `848731a`): applications that differ only in case are separate
applications. Admin migration `015_case_sensitive_applications` stores `application` with
`Latin1_General_100_BIN2` in `alert_findings`, `llm_verdicts`, `finding_decisions`,
`run_alert_list`, `run_summaries`, `run_application_daily` and `run_v1_rules`. It recreates
their keys and indexes verbatim and refreshes the portal views. View column types, CSV
outputs, console routes and the shared/operations libraries are unchanged. No library
version and no portal code change.

Revisions: admin `e457943` (migration, readiness, regression test) and `bd007fd` (snapshot),
design `848731a` (decision, contracts, deployment note), portal `56f005d` (snapshot). Both
consumers pin canonical design `848731a`. The portal's previous pin was `d656e42`, so its
refresh also carries the already-merged run-output-file amendment.

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
- Admin `scripts/ci_integration.py`, zero skips: **192 passed** (190 before plus the two new
  tests). Unit **943 passed**. Ruff, format, strict mypy and lock validation passed.
- Portal unit **283 passed**; ruff, format and strict mypy passed.
- Admin-environment `check_contracts.py --console --sql`: API, CSV, migration bytes, guides,
  console routes and SQL view metadata match.
- Coordinated `run_integration.py --registry config/teams.json` with the portal worktree
  installed: **77 passed**.
- Browser, against `alerts_bi_test` with a published week holding `Moby`, `moby` and `Other`:
  the portal selector listed all three, applying only `Moby` showed its single alert, `moby`
  showed its two, and the `moby` detail for the shared key rendered `moby`'s row. The admin
  console showed the run as completed and published.
- OPENJSON identity and application filters compare correctly against the BIN2 column, with
  no collation conflict. The values take the column's collation and match exactly.

Not covered: `key_field` keeps the default collation, and SQL Server equality ignores trailing
spaces even under BIN2. Neither has been observed. Production table sizes were not available,
so the one-time key rebuild's duration on production is unmeasured. Nothing has been merged
or deployed.
