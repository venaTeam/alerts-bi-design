# Log shipping to Elasticsearch — 2026-10-20

Decision: design section "Log shipping to Elasticsearch" and decision 009 (product owner,
2026-10-20), amended by 5ef2fed after review. Implementation on feat/log-forwarding, stacked on
feat/structured-console-logs (the console log format, not yet merged): admin 4965d8a (shared
0.1.10 and operations 0.2.9), c613dc7 (model group records, run routing), 944458a (OpenShift
collector, runbook section 15) and a46441c (design snapshot); portal 06d7768 (vendored shared
0.1.10) and 2ed4474 (design snapshot); design e34e15d and 5ef2fed. Both applications are pinned
to 5ef2fed. The SQL, HTTP and CSV contracts are unchanged.

Artifacts: `alerts_bi_shared-0.1.10-py3-none-any.whl` sha256
`dcbfcd313e93435a0f3e2640b5b596cf3534899d4a8460fc2e9c209e1b9169e1` (vendored by the portal, its 36
files byte-identical to admin `packages/shared/src`); `alerts_bi_operations-0.2.9-py3-none-any.whl`
sha256 `fbc93caff137973da08f87a0bd5f06c55e2f15e30c20ade76644d7c6c732eeb5`; collector image
`docker.io/fluent/fluent-bit:5.1.2`, index digest
`sha256:d792375ca8e53be72fc25716c28f291f32c6fc6f4f31d12d0d14bc78cefe9226`.

## Executed checks

- Admin: `poetry run pytest tests/unit tests/engine/unit -q` 1098 passed (new
  `test_log_forwarding.py`, `test_llm_group_logging.py` and collector deploy tests); `ruff
  check`, `ruff format --check` and `mypy` passed; from the admin environment
  `scripts/check_contracts.py --console` passed.
- Portal: `poetry run pytest tests/unit -q` 508 passed; `ruff check`, `ruff format --check`,
  `mypy` and `poetry check --lock` passed.
- Design: `scripts/check_docs.py` passed.
- Collector, locally: `fluent-bit.conf` ran in `fluent/fluent-bit:5.1.2` as UID 1000750000 (as
  OpenShift's restricted SCC would) against the local Elasticsearch 8.15, with empty and filled
  credentials. Verified: JSON arrays accepted; the URL path selects the index; an unknown path is
  dropped; the records' own `@timestamp` is kept and `received_at` added; daily indices created;
  `/api/v1/uptime` and `/api/v1/health` answer; the runbook's check record and metrics commands
  work as written; an unreachable Elasticsearch shows `failed to flush chunk ... retry in`.
- Integration with forwarding on: `tests/integration/test_run_jobs.py`, `test_backfill.py`,
  `tests/engine/integration/test_llm_audit.py`, `test_weekly.py`, `test_pipeline.py` and
  `tests/engine/acceptance` on `alerts_bi_test`, every process sending to the local collector:
  81 passed. The collector received 2,310 records and Elasticsearch holds exactly 2,310 (1,001
  runs, 1,307 admin, 2 portal), with no output errors, retries or rejected documents.
- Real entry points on a scratch database: a run submitted from the console in the browser and
  processed by `run-worker --once`, a `weekly` invocation and the portal. Searches returned one
  run's complete story by its 16-character id (`runs`), a team's runs, one alert's group records
  by `alerts.application` and `alerts.key_field` (18 runs for one alert of the test data),
  console actions in `admin` and portal requests in `portal`. The console showed no group lines
  at the default level.

## Defects found during verification and review

- The first integration run with forwarding lost about 80 of 2,332 records to mapping errors: three
  records logged a count named `alerts`, colliding with the groups' list of alerts, and a weekly
  outcome without a week wrote `-` into a date field. Fluent Bit then retried those chunks without
  limit. Fixed before the commits above: counts are `alert_count`, only a list of objects is
  lifted to `alerts`, a missing week is null, and the collector drops a chunk after
  `LOGS_RETRY_LIMIT` tries (default 60, about eight hours of backoff).
- Independent review: a non-URL error (for example a bad port in `LOG_FORWARD_URL`) would have
  stopped the sender thread silently; it now counts the batch as dropped and goes on, and a bad
  port is refused at startup. Drops are reported on idle ticks too; `HTTP_PROXY` is ignored;
  URL credentials are removed from every string and non-finite numbers written as null. The
  runbook now restarts the collector after a Secret, ConfigMap or CA change, says to add (not
  only uncomment) `LOG_FORWARD_URL` in an exported `config.env`, and notes that a resumed run logs
  its groups again with the same `batch_id`.

## Merged with the updated base (2026-10-21)

The base branch feat/structured-console-logs merged `main`, which gained the Decisions page
needs-a-decision view. Design 45c38e2 merges it cleanly, and admin 011476d and portal 6efe884
re-pin their snapshots to 45c38e2. After the merge, admin unit 1099 passed (including main's
new tests); `ruff`, `ruff format --check`, `mypy` and `check_contracts.py --console` passed.
Portal unit 508 passed; `ruff`, `mypy` and `poetry check --lock` passed.

## Not run

- Nothing was deployed. `logging.yaml` was not rendered with `oc process` (no cluster); its
  structure is checked by the deploy tests and the configuration ran in the real image locally.
- Elasticsearch with authentication and TLS: the local Elasticsearch has security off, so the
  401/403 and certificate troubleshooting rows are not exercised.
- The full admin integration suite with forwarding (only the six modules above), and this
  repository's coordinated `scripts/run_integration.py`, whose tests read no log output.
