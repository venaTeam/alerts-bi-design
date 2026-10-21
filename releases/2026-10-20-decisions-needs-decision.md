# Decisions page lists findings that need a decision — 2026-10-20

The global Decisions page listed only decisions already recorded. To find the findings still
waiting for one, a reviewer had to open every team and every published week and look for "No
decision" chips.

Accepted decision (2026-10-20, product owner; design `63fc25e`, section "Decisions page lists
findings that need a decision"): the page opens on Needs a decision. That is every finding of
a currently published week with no decision for that week, across teams: newest week first,
then team, then the alerts with the most events. A switch with counts moves to the recorded
decisions. Pending is a recorded decision. The product owner approved a mock built from the
console's own layout and stylesheet before implementation. `GET /decisions` gains
`view=needed|recorded`; a `state` filter without `view` still opens the recorded list. No
migration, view, CSV output, library or portal change.

Revisions: admin `10ccc46` (query, route, page, tests), `5f92635` (snapshot pinned to design
`63fc25e`) and `c285703` (README). All branches are `feat/decisions-needs-decision` from
current `main`. Portal keeps its pin: none of its code or contracts change.

Executed checks, local SQL Server 2022:

- New admin integration test in `test_console.py`. A run with rule, readiness and model
  findings lists nothing before publication. After publication it lists the four findings and
  not the assessed-good alert. A pending decision removes that one finding and counts as
  recorded. Withdrawing the week empties the list. The existing publication test also checks
  that a decided finding leaves the list, the team filter, and both views.
- Admin `test_console.py`: **30 passed**, twice. On the first run two existing execution-lock
  tests (`test_cli_*_releases_shared_execution_lock`) failed once with "another run … already
  in progress" and then passed in three reruns, alone and in the module. Unit **1058 passed**
  (including the snapshot hashes). Ruff, format and strict mypy passed.
- Admin-environment `check_contracts.py --console`: API, CSV, migration and guide contracts
  match. Design `check_docs.py` passed.
- Browser, admin console on a scratch copy of `alerts_bi_dev` migrated to `019`: 127 findings
  over 11 published weeks and 6 teams. Opening the first row showed that finding with Record
  decision. Recording Confirmed changed the counts to 126 and Recorded · 1, and the decision
  showed in Recorded. The team filter showed 66 for Data Pipeline / ETL. Pages 1–3 held 126
  unique rows. At 375 px there was no horizontal scroll.

Not run locally: the full admin `scripts/ci_integration.py` and `check_contracts.py --sql`.
CI covers them.
