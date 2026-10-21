# Team operators on the team page — 2026-10-21

The product owner asked for the team page in the admin console and the review portal to list
the team's operators. They reviewed the mock in `docs/mockups/team-operators/`, had the portal
card's explanatory sentence (which named the registry version) removed, and asked for it to be
implemented.

Accepted decision (2026-10-21, product owner; design `368510a`, section "Team operators on the
team page"): the admin team page shows the current registry's operators with notes. The notes
cover a selected run whose frozen list differs, a team with no operators, a team no longer in
the registry, and operators another team lists in the same schema. The portal Overview shows
the operators the published week ran with. Migration `020_portal_review_operators` adds
`v1_operators` and `v2_operator` to `portal_reviews`. Section 7.10 "What a reader sees" is
amended: operator values are shown to readers, while the registry version and other registry
fields stay hidden.

Revisions, all on `feat/team-operators-list` from current `main`:

- design `368510a` (decision, outputs, contracts, check_docs) and `7740f3d` (migration contract
  pinned to admin `dd6dac5`).
- admin `dd6dac5` (migration 020, team page panel, tests, README and runbook), `94f4297`
  (snapshot pinned to design `7740f3d`) and `693cdcf` (ruff format of the 020 test only).
- portal `d3576d0` (query, Overview card, tests, snapshot and packaged `sql-views.json` pinned
  to design `7740f3d`, README and runbook).

Shared 0.1.9 and operations 0.2.8 are unchanged, so no library release is needed.

Deployment order: admin first (its init container applies 020), then the portal. A portal
built from this contract stays not ready until 020 is applied. An older portal ignores the new
columns. 020 is view-only and roll-forward only.

Executed checks, local SQL Server 2022 (`alerts_bi_test`, no other session running tests):

- Admin unit (`tests/unit`, `tests/engine/unit`): **1087 passed**. Ruff, format and strict
  mypy passed. New `test_team_operators.py` covers the panel's lists, escaping, notes, shared
  operators within one schema, and the strict snapshot reader.
- Admin integration: `test_migration_020_upgrade.py` migrates 019 → 020 with three published
  weeks (case variants and repeats, an empty v1 list, a non-JSON entry). It checks the new
  values and that every earlier column is unchanged. It passed together with the 016, 018 and
  019 upgrade tests, `test_migrations.py`, `test_deployment_migrations.py` and
  `test_team_identity.py`: **28 passed**.
- Portal unit: **513 passed** (new `test_portal_operators.py` and Overview card tests). Ruff,
  format and strict mypy passed.
- Coordinated: an isolated environment with the admin and portal worktrees, operations 0.2.8
  and shared 0.1.9. `check_contracts.py --sql --console` passed: API, CSV, migration and guide
  contracts and SQL views match. `run_integration.py --registry config/teams.json` passed
  (**82 passed**, no skips, ES on the private `scl-appchi-*` mock indices).
- Design `check_docs.py` passed.
- Browser, on a scratch database `alerts_bi_teamops` with three published fake-LLM runs for
  10–17 Aug 2026:
  - Admin, Legacy Batch Jobs: 3 current operators. The run used an older registry
    (`2026-08-15.1`, 2 operators), so the note named that version and its 2 operators.
  - Portal, the same team: the week's 2 operators and no registry text.
  - Checkout API (2 v1 + v2) and Data Pipeline / ETL (4 v1 + v2) matched in both apps.
  - A registered team with no runs shows its operators.
  - No horizontal scroll at 375 px in either app.

Not run locally: the full admin `scripts/ci_integration.py` and the ES-backed acceptance oracle.
CI covers them.
