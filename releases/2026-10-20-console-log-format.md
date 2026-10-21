# Console log format — 2026-10-20

Decision: design section "Console log format" and decision 008 (product owner, 2026-10-20).
Implementation on feat/structured-console-logs from current `main` of each repository:
admin ede73d6 (shared 0.1.9 and operations 0.2.8), 9bcdedb (call sites, worker, weekly,
console, migrations, deploy example and runbook) and 9ea9cdb (design snapshot); portal 4549146
(vendored shared 0.1.9, request logging) and 5644a36 (design snapshot); design 72c54f5
(decision, design section, LOG_FORMAT row). Both applications are pinned to 72c54f5. The SQL,
HTTP and CSV contracts are unchanged.

Library artifacts, built with admin `scripts/build_libraries.py` (rebuilds are byte-identical):
`alerts_bi_shared-0.1.9-py3-none-any.whl` sha256
`a70dabae9b222d8d9dce44b345493ffb4ccdeafeffec8df26aa92b80d8275b41` (vendored by the portal, its
35 files byte-identical to admin `packages/shared/src`) and
`alerts_bi_operations-0.2.8-py3-none-any.whl` sha256
`53dd899557b80d5800183a68721b02f0e98bb063bbaa8eaf73b6dba18d957308`.

## Executed checks

- Admin: `poetry run pytest tests/unit tests/engine/unit -q` 1078 passed, including the new
  `test_logging_setup.py` and `test_worker_logging.py`; `ruff check`, `ruff format --check` and
  `mypy` passed. `pytest tests/integration tests/engine/integration` 213 passed on
  `alerts_bi_test`; after the review fixes `test_run_jobs.py`, `test_backfill.py`,
  `test_deployment_migrations.py` and `tests/engine/acceptance` 49 passed. Elasticsearch was
  the local mock reseeded into separate indices `scl-appchi-v1`/`scl-appchi-v2`
  (`ES_V1_INDEX`/`ES_V2_INDEX`), because the shared `appchi-*` indices still map `operator`
  without the `operator.keyword` the reader filters on; the shared indices were not touched.
- Portal: `poetry run pytest tests/unit -q` 508 passed before and after the pin; `ruff check`,
  `ruff format --check`, `mypy` and `poetry check --lock` passed.
- Design: `scripts/check_docs.py` passed; from the admin environment,
  `scripts/check_contracts.py --console` passed.
- Real commands on a scratch database of this task (`alerts_bi_scl_scratch`; another session was
  running integration tests on `alerts_bi_test`): `db migrate` of a new database (19 migrations,
  each with its duration, then the total); `run --fake-llm`; a run submitted from the console in
  the browser and processed by `run-worker --once` (submission, request id, claim with queue wait,
  Elasticsearch totals, analysis and model summaries, persistence, finish); the same with a
  missing index (one `ERROR` naming stage `es:v1`, the error, its cause with origin and the
  application's frames, then the failed finish); an interrupted job recovered as failed; idle
  heartbeats; `weekly` publishing two teams and holding one (`WARN` outcome, exit 1); `db setup`
  against an unreachable server (`ERROR` with stage `migrate`); a portal at `LOG_LEVEL=debug`
  (startup line, page reads at debug, a POST refused 405 at info with the matching
  `X-Request-ID`); and a 500 under real uvicorn logged once, without uvicorn's own traceback.

## Review follow-up

An independent review of the diff found no correctness or content-safety defect of high
severity and four low ones, all fixed before the commits above: a malformed `ES_URL` port
stopped the worker before its first poll (now shown as `(invalid ES_URL)`); a job's failure
record was written after the job row update, so a failed update lost it (now written first,
with a regression test); `verify-acceptance` carried one team's run id onto the next team's
records (now cleared per team); and the migration end record had no total duration and a
failed migration named no stage (both added). Exercising `db setup` against an unreachable
server then showed pymssql's compiled frame counted as the application's; frames with a relative
source name now count as library frames, and shared 0.1.9 was rebuilt before it was vendored.

## Merged with main (2026-10-21)

Design, admin and portal `main` gained the Decisions page needs-a-decision view (design #23,
admin #24) while these PRs were open. Design cf1e4f2 merges design `main`, keeping both new
sections at the top of the design document. Admin 7da3545 merges admin `main`: the code merged
cleanly, and its snapshot is re-pinned to cf1e4f2. Portal b1f48ff re-pins to cf1e4f2 (portal
`main` had not moved). After the merge, admin unit 1079 passed (including main's new tests);
`ruff`, `ruff format --check`, `mypy` and `check_contracts.py --console` passed. Portal unit 508
passed, and `check_docs.py` passed.

## Not run

- This repository's coordinated `scripts/run_integration.py`. Its tests read no log output, and
  no SQL view, HTTP route or CSV contract changed; `check_contracts.py --console` passed.
- The OpenShift templates were not rendered or applied; only comments and the example value
  file changed. Nothing was deployed.
- `LOG_FORMAT` defaults to `console`. Whether anything in the cluster parses the pods' former
  JSON output is not known here; if something does, set `LOG_FORMAT=json` in `alerts-bi-config`
  with this release.
