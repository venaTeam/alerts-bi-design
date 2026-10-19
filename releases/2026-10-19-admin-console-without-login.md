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

## Not executed

- The SQL integration and acceptance suites, including the new
  `tests/engine/integration/test_migration_018_upgrade.py`, did not run locally because
  `alerts_bi_test` was in use; the admin CI integration job runs them.
- No `oc`, cluster or deployment. On a real database 018 is irreversible without the pre-018 backup.
