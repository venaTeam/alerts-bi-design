# Bounded reads and reusable analysis — 2026-10-14

Accepted implementation scope is recommendations 1, 2, 5, 7 and 8. Queue concurrency,
retention policy and deployment/fleet UX changes (3, 4 and 6) remain excluded. All three
repositories use task branch `codex/scale-read-path`; canonical consumer input is design
`bf0edccc821621346f9adf72feaabb4db5129315`. Nothing has been deployed or merged.

Admin adds atomic stored summaries, narrow indexed list rows, normalized rule membership,
application daily facts and private completed-analysis checkpoints through additive
migrations 012 and 013. Applied migrations 001–011 remain byte-identical. Shared 0.1.4
provides pooled web connections, bounded summary reads/cache and stable cursor navigation;
operations 0.2.1 consumes it. The independent portal vendors the matching shared wheel and
continues to read only published views. Healthy weekly runs and completed deterministic
analysis can be reused without changing publication, audit or model retry semantics.

## Local performance rehearsal

The user explicitly reduced local test volume after the larger fixture exhausted available
host memory. The unfinished 100-team load was stopped and replaced in disposable
`alerts_bi_test`; it is not capacity evidence. No further large-volume test was run.

Command in the dedicated admin benchmark environment (with the independent portal installed):

```powershell
python scripts/benchmark_reads.py --seed --teams 3 --weeks 27 --heavy-teams 3 --heavy-identities 500 --heavy-events 10000 --concurrency 2 --requests 84 --read-committed-snapshot --output out/laptop-reads.json
```

Windows 11, Python 3.13.5, SQL Server 16.0.4135.4 on local Docker. SQL Server was temporarily
capped at 2 GiB memory to protect the laptop. Only the disposable database enabled committed
row-versioned reads. The fixture contains 81 historical runs / 40,500 findings, plus one
500-finding write during measurement. Event totals are synthetic aggregates in this HTTP
test, not 810,000 streamed raw events. Seeding took 25.387 s; measured ingestion took
1.197 s; benchmark Python peak memory was 127.6 MiB. Data and log files were each 200 MiB.

Timings include actual ASGI routing, SQL queries, rendering and TestClient adapter overhead.
Warm measurements have 12 requests per route with two concurrent readers. The cold phase
clears decoded-summary cache, not SQL buffer cache. All requests succeeded.

| Route | Cold ms | Warm p95 ms | Max during write ms | Requests during write |
|---|---:|---:|---:|---:|
| Admin directory | 166.61 | 18.13 | 23.19 | 4 |
| Admin overview | 342.62 | 131.96 | 160.78 | 4 |
| Admin findings | 235.16 | 106.88 | 128.12 | 3 |
| Portal directory | 108.49 | 18.03 | 36.50 | 3 |
| Portal overview | 395.59 | 131.02 | 150.75 | 3 |
| Portal rule/application filter | 526.25 | 149.36 | 210.28 | 3 |
| Portal legacy page 100 | 228.61 | 168.70 | 176.83 | 3 |

Twenty real durable submission acknowledgements had p95 203.31 ms. Fixture jobs were closed
without execution. The legacy page-100 request exceeds this small fixture's available pages;
it exercises compatibility/empty-page handling, not populated deep-page scale. Actual cursor
next/previous pages were verified separately in both browsers. Concurrent-write sample counts
are small; their maxima are observations, not stable tail-latency estimates. These results
do not prove 100-team capacity, production migration duration or the browser 1.5 s SLO.

Before the user reduced the test, a separate actual streaming benchmark processed 1.2 million
events / 20,000 identities in 42.277 s analysis time, with 233.2 MiB peak process memory.
It does not establish database or UI capacity at that size.

## Browser evidence

Actual loopback admin and portal servers used the small disposable fixture and independent
application environments. The in-app browser verified:

- Admin directory displayed three teams and 27 runs each; overview totals showed separate
  v1/v2 counts; findings advanced from page 1 to 2 and back with evidence and decisions intact.
- Portal directory and overview showed exact totals. Selecting only `bench-000-app-0` changed
  the overview to 50 v2 identities / 1,000 events; the R1 link preserved scope and showed
  17 identities / 967 events.
- Alert detail retained full stored evidence and all 27 weekly decisions. History remained
  accessible back to April; slides rendered the selected application's exact counts.
- Portal cursor navigation displayed identities 1–25, then 26–50, then 1–25 again.

Rendered admin and slide screenshots were inspected. Browser transport was unavailable during
the earlier memory-heavy attempt; it worked after reducing the load. No browser paint-timing
instrumentation was collected. Task-local servers and tabs were stopped after the checks.

## Executed regression checks

- Admin `python -m pytest tests/unit tests/engine/unit -q`: **887 passed** in 17.29 s.
- Portal, in its independent environment, `python -m pytest tests/unit -q`: **277 passed**
  in 2.88 s.
- Admin `python -u scripts/ci_integration.py`: **175 passed**, **zero skipped**, in 527.17 s
  on real local SQL Server and the existing Elasticsearch mock. This includes populated
  migration, stored-read parity, persistence, committed reads during a conflicting write,
  publication/security boundaries, weekly reuse, recovery and critical acceptance coverage.
- Admin environment `python -u ../design/scripts/run_integration.py --registry config/teams.json`:
  **77 passed** in 97.63 s, exercising the coordinated installed admin/portal/shared packages.
- Admin environment `python ../design/scripts/check_contracts.py --console --sql`: passed,
  including API/CSV/guide contracts, exact applied migration hashes and SQL view metadata.
- Both repositories: `ruff check .`, `ruff format --check .`, strict `mypy`, and
  `poetry check --lock`: passed. Canonical `python scripts/check_docs.py`: passed.
- Both applications: `poetry build` produced source distributions and wheels successfully.
- Shared 0.1.4 and operations 0.2.1 wheels were built. The portal's vendored shared wheel
  exactly matches the producer SHA-256
  `b9fa13e06ff268c5bea113fddb6ac50307ab8e3216f1024880a165a2815b9d3c`.

The suites report one existing upstream Starlette/httpx deprecation warning. The earlier
two unit subprocess timeouts under memory pressure passed unchanged after load reduction.
An intermediate database rerun was stopped for memory relief, then the full 175-test suite
passed serially with a 1 GiB SQL memory cap. The original local SQL memory setting and
advanced-options setting were restored after all SQL checks. No application code or test
timeout was weakened to obtain these results. The disposable database's row-versioning
test restores its setting; subsequent resets use the normal test defaults.

## Rollout limits

Apply additive admin schema/read-model production before matching shared and portal consumers.
Rehearse populated migration time, transaction-log growth and storage on a suitably sized
copy before production. Low-latency committed reads during ingestion require the separately
authorized isolation rollout in `docs/read-path-performance.md`; no production setting was
changed. Preserve old raw facts and published-view boundaries for coordinated consumer rollback.
Six-month automatic retention and concurrent execution remain outside this implementation.
