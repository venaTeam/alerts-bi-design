# Exact key_field identity in SQL — 2026-10-18

The exact-application release (`2026-10-18-case-sensitive-applications.md`) left `key_field` on
the database's case-insensitive default collation. Within one exact application, two keys
that differ only in case, such as `disk:Node-1` and `disk:node-1`, were two identities in the
engine and one value in SQL. The second spelling violated `pk_alert_findings` and
`persist_run` rolled the whole run back. `llm_verdicts`' insert-if-absent also kept a verdict
for only one spelling. This has not been observed in data.

Accepted decision (product owner, 2026-10-18; design `e5c02d1`): key_fields that differ only in
case are separate alert identities. Admin migration `016_case_sensitive_key_fields` stores
`key_field` with `Latin1_General_100_BIN2` in `alert_findings`, `llm_verdicts`,
`finding_decisions` and `run_alert_list`. It recreates `pk_alert_findings`, `pk_llm_verdicts`,
`ix_finding_decisions_identity`, `ix_run_alert_list_order` and `ix_run_alert_list_events`
verbatim and refreshes `portal_alerts`, `portal_alert_list` and `portal_decisions`. View column
types, CSV outputs, console routes and the shared/operations libraries are unchanged. No library
version and no portal code change. Decisions and stored verdicts attach to the exact key
spelling, and work-list ties broken by `key_field` now sort uppercase before lowercase.

The dependent objects come from the catalog of an `alerts_bi_test` migrated to 015: the five
keys and indexes above, one auto-created statistic per table, and the three views. No foreign
key, check constraint, computed column or schema-bound module references `key_field`.

Revisions: admin `3b2ea1f` (migration, readiness, tests) and `97d2b01` (snapshot), design
`e5c02d1` (decision, contracts, deployment note), portal `5c0bda0` (snapshot). Both consumers
pin design `e5c02d1`. All three branches are `fix/case-sensitive-key-fields`, stacked on the
open 015 branches `fix/case-sensitive-applications` (admin `9b0678f`, design `e2c1c53`, portal
`adb96bb`). Adding 016 required one change to the 015 branch's tests:
`test_migration_015_upgrade.py` migrated to head, so it now stops at revision 015 explicitly
and expects readiness to name 016.

Executed checks, local SQL Server 2022 (`SQL_Latin1_General_CP1_CI_AS`) and the seeded ES mock:

- New admin integration test `test_key_field_case.py`: one application with `disk:Node-1` and
  `disk:node-1` on the same day persists both to `alert_findings`, `run_alert_list` and
  `llm_verdicts` with exact equality. A rerun reuses each spelling's own verdict with no model
  call. After publishing, a decision on each spelling reads back only through its own identity
  in `portal_alerts`, `portal_alert_list` and `portal_decisions`. Every `key_field` column
  (4 tables, 3 views) reports BIN2.
- New `test_migration_016_upgrade.py`: a populated, published 015 database with a decision
  upgrades to 016 with row counts unchanged. Readiness refuses before and passes after, the
  decision reads back by exact key, and the case-only key variant's verdict now fits beside the
  upgraded row. New unit `test_migration_016.py`: the revision follows 015 and refuses
  downgrade.
- Mutation check: with the 016 files removed, all five new integration tests fail. The
  persistence tests fail with the original `pk_alert_findings` duplicate key for
  `(case-app, disk:node-1)`.
- `db setup` upgraded an existing `alerts_bi_test` built by the acceptance verification at
  015 (8 runs, 477 findings, 441 verdicts) to 016. Row counts and reader grants were unchanged,
  all 7 `key_field` columns (4 tables, 3 views) report BIN2, and the five rebuilt keys and
  indexes have the same key columns, order and clustering as before. This ran before the
  rebase onto the 015 review follow-up, which changed only 015 tests and docs, so the 015 and
  016 migration bytes were the same.
- With the 016 files removed, `db setup` against the migrated database stops with `Can't
  locate revision identified by '016_case_sensitive_key_fields'`. This is the roll-forward-only
  behavior recorded in openshift-deployment.md.
- Admin `scripts/ci_integration.py`, zero skips: **199 passed** (194 on the 015 branch plus
  the five new integration tests).
- Unit **945 passed**. Ruff, format, strict mypy and lock validation passed.
- Portal unit **283 passed**; ruff, format and strict mypy passed.
- Admin-environment `check_contracts.py --console --sql`: API, CSV, migration bytes, guides,
  console routes and SQL view metadata match.
- Coordinated `run_integration.py --registry config/teams.json` with the portal worktree
  installed: **81 passed**.
- Browser, against `alerts_bi_test` with a published week holding `disk:Node-1` and
  `disk:node-1` in `case-app`, each with its own confirmed decision: the portal's Fix list
  showed two alerts, and each alert's detail showed only its own decision. The admin console's
  Findings tab listed both, and selecting each showed its own key and decision.

Not covered: SQL Server equality still ignores trailing spaces under BIN2. It has not been
observed. Production table sizes were not available, so the one-time key rebuild's duration on
production is unmeasured. Nothing has been merged or deployed.
