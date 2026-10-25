# Log data streams — 2026-10-25

Decision: design section "Log shipping to Elasticsearch" as amended 2026-10-25 and decision 010
(product owner, 2026-10-25). Implementation on feat/log-data-streams: design ecbb909; admin
1503559 (collector configuration, runbook section 15 and 15.8, deploy test) and ce09c8d (design
snapshot); portal ced798e (README lines and design snapshot). Both applications pin
ecbb909, which also brings design's `docs/mockups/team-operators` that the f8c021d pins had
left out. No application or library code changes; the SQL, HTTP and CSV contracts are
unchanged, and the collector image stays `docker.io/fluent/fluent-bit:5.1.2`.

## Executed checks

- Admin: `poetry run pytest tests/unit tests/engine/unit -q` 1110 passed; after the snapshot
  sync `tests/unit/test_openshift_deploy.py` and `test_design_snapshot.py` 17 passed; `ruff
  check`, `ruff format --check` and `mypy` passed.
- Portal: `poetry run pytest tests/unit -q` 505 passed, 8 skipped; `ruff check`, `ruff format
  --check`, `mypy` and `poetry check --lock` passed.
- Design: `scripts/check_docs.py` passed.
- Collector, locally: `fluent-bit.conf` ran in `fluent/fluent-bit:5.1.2` as UID 1000750000 with
  a tmpfs buffer, against throwaway Elasticsearch 8.15 containers, with index templates that
  set `data_stream` for `dstest-runs` and `dstest-admin`. Verified: records reached the data
  streams (backing indices `.ds-dstest-<stream>-2026.10.25-000001`) with their own
  `@timestamp`, including one dated the previous UTC day, and Fluent Bit's `received_at`;
  records from the shared sender (`worker`, `ui` and `portal` processes, an `llm.group` record
  with its `alerts` list and an error record) landed in `runs`, `admin` and `portal`; with no
  template, `dstest-portal` became a plain index while the counters showed no error, which the
  runbook's 15.4 check now detects; a chunk with one good record and one without `@timestamp`
  wrote the good one exactly once across retries (Elasticsearch answered 409 for the repeat,
  which Fluent Bit did not count as an error) and dropped the chunk after `LOGS_RETRY_LIMIT`;
  `GET dstest-runs*/_count` covered a daily index and the data stream together, and
  `dstest-runs-*` only the daily index.
- Accounts, locally, on a second throwaway Elasticsearch 8.15 with security on: an account with
  only `create_doc` and `auto_configure` on the three names created the data streams from their
  templates and wrote to them; an account with `create_index`, `create_doc` and
  `auto_configure` on `dstest-<stream>-*` (the earlier grants) was refused with `"status":403`
  and `security_exception` inside the bulk items, which the runbook's troubleshooting row now
  names.

## Not run

- Nothing was deployed. The runbook's 15.8 move was not exercised on OpenShift (no cluster); its
  commands are 15.3's, and the configuration ran in the real image locally.
- Elasticsearch over TLS, and index templates with explicit mappings or lifecycle policies: the
  data streams were tested with default mappings and no rollover policy.
- Integration suites with forwarding on: the applications and their sender are unchanged.
