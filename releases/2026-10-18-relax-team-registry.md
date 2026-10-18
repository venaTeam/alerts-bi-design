# Team registry review fixes — 2026-10-18

This supersedes the initial registry-only verification recorded earlier today.

## Tested revisions and contract

- Admin `28ac22d` (base `03d4c6c453eba35ca7e54f0696daf542abd9e0d4`).
- Portal `a437410` (base `52547da`).
- Both pin design `e19a31f296f2d4c480bb25a67357fcbab3bf6c78`.
- Shared `0.1.8`, operations `0.2.6`; branch `fix/relax-team-registry` in all three repositories.

Duplicate operators remain allowed within v1 lists and across teams. No team ID slug regex
is restored. IDs are exact, case-sensitive, nonempty strings that fit 128 UTF-16 code units;
surrounding whitespace, controls and Unicode surrogates are refused before any ES query.
Migration 017 makes all eight stored team columns binary and refreshes portal views. The
registry data itself is unchanged. Admin remains gated to the standardization team, with no
per-registry-team authorization boundary; shared operators intentionally produce overlapping
alert sets in separate teams' runs.

## Review findings addressed

- P1 case collisions: real-SQL regression tests preserve existing rows through migration,
  verify all team-column/view collations, publish case-only distinct teams in the same week,
  and replace one publication without withdrawing the other. An injected schema-bound
  blocker proves rollback restores indexes, rows and revision, then a retry succeeds.
- P1 whitespace aliases: surrounding whitespace is rejected, rather than relying on BIN2
  to distinguish trailing spaces (SQL Server does not).
- P2 slash routes: one shared reversible URL codec preserves legacy slug links and uses
  reserved-prefix UTF-8 hex segments for other IDs. All admin and portal entry points decode
  once. Summary links and the global New run selector use the same encoded actions.
- P2 storage limit: schema maxLength plus UTF-16-aware validation covers both 128 ASCII
  characters and 64 supplementary-plane characters, rejecting larger IDs.
- Regression guards compare the packaged schema to its pinned contract and check every
  pinned snapshot SHA-256. The portal verifies its immutable wheel against poetry.lock.

## Executed verification

Admin task-local Poetry environment, real local SQL Server `alerts_bi_test` for integration:

- `python -m pytest tests/unit tests/engine/unit -q --basetemp=out/pytest-review-final`:
  **991 passed**.
- `python -m pytest tests/integration tests/engine/integration -q -rs --basetemp=out/pytest-review-integration --maxfail=2`:
  **201 passed**, no skips. The final link changes are additionally covered by final unit
  tests, the targeted HTTP rerun and the browser checks below.
- Targeted `tests/integration/test_team_identity.py`: migration failure/retry, independent
  case-sensitive publication and replacement, real workspace/summary/trigger/backfill
  requests, and stored exact job/backfill IDs.
- Ruff lint and format: pass (248 files formatted); strict mypy: pass (244 files);
  `poetry check --lock`: pass.
- Built admin wheel contains migration 017 and its revision module. Built operations wheel
  source and schema match the checkout. Portal wheel codec bytes match the shared producer.

Portal standalone task-local environment: **283 unit tests passed**, ruff lint/format,
strict mypy (26 files) and lockfile checks passed.

Design integration environment with installed admin and portal:
`python -m pytest tests/integration/test_team_routes.py -q` passed. Seven identities
(`team/a`, `team/a/summary`, `a%2Fb`, `~61`, `..`, `team-a`, `Team-A`) each opened through
team/week routes, all seven tabs, the week picker and their distinct alert details.
`check_contracts.py --console --sql` and `check_docs.py` passed, including migration bytes,
registry, API, output and SQL view contracts. All test data was synthetic.

Browser smoke against both real local apps and SQL: opened the slash team's populated admin
workspace; opened the global Schedule New run dialog, selected `team/a/summary`, and checked
the DOM form action became `/teams/~7465616d2f612f73756d6d617279/trigger`; cancelled it. Opened
the portal directory, slash team's published overview and its alert detail. Both test servers
were stopped after verification. HTTP tests, not the browser smoke, submit the synthetic jobs.
The only test warning was the existing upstream Starlette/httpx deprecation.

Immutable wheel SHA-256 values:

- shared 0.1.8: `e33e859d53bb87d765aa28456eb08f629d4599fa83ffbd8e8fc178db64d283de`
- operations 0.2.6: `64341e8d2ba76e8c9c86a690942f51fbf654ebae47c81335557e7cee37c63367`

## Delivery and rollback

Merge design, then admin and portal. Apply admin migration 017 and deploy both apps with
shared 0.1.8 before installing a registry that uses the expanded ID domain. The production
collation was not inspected; the migration specifies BIN2 independently of that default.
No production database, registry, deployment or merge was changed during verification.

A pre-017 admin image cannot initialize against a 017 database. Recovery needs a compatible
image that still knows 017, or an explicitly authorized restore of the verified pre-migration
database backup with its matching image, manifests and registry; that restore loses later
writes. Downgrade is refused because stored case-only variants could collide. Do not roll
back portal routing while newly encoded team links remain in use. The canonical deployment
runbook covers one backup and a sized maintenance window for all pending revisions 015–017.

## Follow-up review fixes

The next commits correct the migration 017 backup, sizing, maintenance-window and rollback
instructions in the canonical runbook and both application READMEs. The design now explicitly
identifies schema descriptions as normative consumer-enforced semantics; no regex is added.
The coordinated-test setup and the difference between syntax and artifact-hash checks are
now documented. The SQL route test refuses nonlocal databases and skips only a failed SQL
connectivity preflight, not a broken migration.

Executed on these documentation and test changes:

- Portal: 422 unit tests passed, including 139 new codec/link/HTTP cases covering every
  entry point, legacy redirects, slash/percent/space/Unicode/dot/tilde IDs, case distinctions
  and malformed-token 404s before queries. Ruff lint/format and strict mypy (27 files) pass.
  Query boundaries are mocked in these standalone tests; SQL isolation is checked below.
- Admin: 50 targeted registry and snapshot tests passed, including both new empty-operator
  rejection cases; focused ruff lint/format passed.
- Design: real-SQL team-route test passed with no skips, now including 128 ASCII characters
  and 64 supplementary-plane characters persisted and rendered through every portal route.
  Eight existing reader-role tests passed after migration 017, with no skips.
- `check_contracts.py --console --sql` and `check_docs.py` passed. The focused design mypy
  invocation could not resolve the setuptools editable admin/portal packages in this local
  test environment; it is not claimed as passing. App type checks and runtime integration
  remain separate evidence. The README documents wheel installation for a clean environment.

The new design snapshot must be merged with a merge commit before its consumer PRs so its
recorded SHA stays reachable. Merge admin next, then portal. Deployment remains separate.
