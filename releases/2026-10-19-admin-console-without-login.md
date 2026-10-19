# Admin console without login — 2026-10-19

Decision: design section "Admin console without login" and decision 007 (product owner,
2026-10-19). Implementation on feat/remove-admin-login, stacked on feat/openshift-deployment-runbook:
admin 150466c (console, CLI, operations 0.2.7, migration 018, templates, runbook, tests) and
bb0866d (design snapshot); portal acb1ce3 (decision history names nobody) and 431fc4c (design
snapshot); design 8f220e4 (decision, amendments, contracts). Both applications are pinned to
8f220e4. The shared library and the portal view contract are unchanged.

## Executed checks

- Admin: `poetry run pytest tests/unit tests/engine/unit -q` 1035 passed before and after the pin;
  `ruff check`, `ruff format --check` and `mypy` passed.
- Portal: `poetry run pytest tests/unit -q` 428 passed before and after the pin; `ruff check`,
  `ruff format --check` and `mypy` passed.
- Design: `scripts/check_docs.py` passed; from the admin environment,
  `scripts/check_contracts.py --console` passed (routes, regenerated console OpenAPI, migration
  hashes including 018, outputs and guides).
- Local SQL Server, on a scratch database of this task (not `alerts_bi_test`, which another session
  was using): migrations 001–018 applied to a fresh database; a database built at 017 and seeded
  with names in publications, a withdrawal, a decision, a backfill, colliding and unique submission
  keys and a named cancel message upgraded to 018 with every name blank, `weekly-schedule` kept,
  colliding keys stored as `#<job id>`, the cancel message scrubbed, readiness passing and decisions
  still refusing UPDATE.
- Browser, same scratch database, no identity header or `--dev-user`: Teams, team week, publish,
  record decision, Decisions page, withdraw, New runs plus `run-worker --once`, Delete run; no page
  names a person, and stored rows hold `''`. At 375px there is no horizontal overflow.
- The OpenShift templates rendered with a local `oc process` stand-in; structural checks passed
  (no proxy, Role or allowlist; edge Route; Service 8200; TCP probes).

## Defect found during verification

The first browser withdrawal failed with HTTP 500: `ck_review_publications_withdrawn` requires
`withdrawn_by` on a withdrawn row, and the change first wrote NULL. Withdrawals and migration 018
now store `''`; the migration's integration test expects it.

## Review follow-up (PR review and CI)

- Admin CI's integration job failed two console tests that still expected "alice" in the decision
  history and activity (the second only because the first stopped before its cleanup). Fixed in
  admin; locally `pytest tests/integration tests/engine/integration tests/engine/acceptance` then
  passed 207 with none skipped on `alerts_bi_test`, including `test_migration_018_upgrade.py`.
- This repository's coordinated tests still passed operator names to operations 0.2.7 and expected
  401s, user-bound tokens and stored names. They now expect no login and no names, and keep the
  missing-token, forged-token and cross-site refusals. `scripts/run_integration.py` with the admin
  registry, admin and portal of this change installed and local SQL: 80 passed, 2 failed. The two
  failures (`test_the_workspace_defaults_to_the_latest_run_including_failures` and
  `test_a_failed_run_is_visible_with_retry_and_no_publication`) also fail with the original tests
  against the base revisions (4 failed there); they come from the 2026-10-19 console redesign, not
  from this change. The decision test now opens the finding's own page, where the redesigned
  console shows a decision's note.
- Second PR review (admin cf02ff8), fixed in admin 185b4f1. `publish_run` still stored any
  `published_by` it was given; it now accepts only "" or the scheduler's `weekly-schedule` and
  refuses anything else, and this repository's coordinated tests no longer pass a name. Job and
  backfill retries looked only at `requested_by = ''`, so a retry with a key that 018 had kept
  apart as `#<id>` stored a second submission; a retry now matches the key across every
  requester value, returns the one row with its own options, and is refused with 409 when two
  rows still match. The runbook's rollback to the login-proxy release now sets a new
  `COOKIE_SECRET`, which 7.6 removed and 7.1 does not export. Admin: unit 1046 passed, `ruff`,
  `ruff format --check` and `mypy` passed, and `pytest tests/integration tests/engine/integration
  tests/engine/acceptance` passed 207 with none skipped on `alerts_bi_test`, its 018 upgrade test
  now checking retries on migrated keys. Coordinated tests here: 80 passed and the same 2 failed
  as above.

## Not executed

- No `oc`, cluster or deployment. On a real database 018 is irreversible without the pre-018 backup.
