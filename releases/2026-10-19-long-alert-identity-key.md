# Fixed-width alert identity keys — 2026-10-19

On 2026-10-19 a team's run failed with `run.job_failed` and SQL Server error 1946: "The index
entry of length 986 bytes for the index 'pk_alert_findings' exceeds the maximum length of 900
bytes for clustered indexes." `pk_alert_findings` was `(run_id, alert_schema, application,
key_field)` and `pk_llm_verdicts` was `(application, key_field, prompt_version,
model_version)`. Both are clustered and could reach 1,668 and 1,856 bytes. SQL Server created
them with only a warning, so the limit appeared at insert time. Beside the 64-character run id,
any identity whose `application` and `key_field` together exceeded 384 characters made
`persist_run` roll back the whole run. The failing identity had 427. This is not a regression
from migrations 015–017: collation does not change NVARCHAR's byte width.

Accepted decision (2026-10-19; design `925f482`): every identity that fits its columns is
stored. Admin migration `018_alert_identity_hash` adds a persisted computed `identity_hash
BINARY(32)` to `alert_findings` and `llm_verdicts`: SHA-256 over the byte length of the
right-trimmed `application`, the right-trimmed `application` and the right-trimmed
`key_field`. It rebuilds the keys as `(run_id, alert_schema, identity_hash)` and
`(identity_hash, prompt_version, model_version)`, at most 164 and 352 bytes. Right-trimming
reproduces SQL Server's trailing-space padding under BIN2, so the keys accept and reject
exactly the pairs they did before. The engine's verdict lookups compute the same expression
over their parameters. No view, CSV output, console route or shared/operations interface
changes. No library version and no portal code change.

Revisions: admin `1c1f00c` (migration, readiness, lookups, tests, README) and `56c1033`
(snapshot), design `925f482` (decision, contracts, deployment note), portal `2a42144`
(snapshot). Both consumers pin design `925f482`. All three branches are
`fix/long-alert-identity-key` from current `main`.

Executed checks, local SQL Server 2022 (`SQL_Latin1_General_CP1_CI_AS`) and the seeded ES mock:

- Reproduction: on a 017 schema, persisting a 443-character identity failed with error 1946
  for `pk_alert_findings` (1,018 bytes). After `migrate` applied 018 to that same database,
  the same finding and verdict persisted.
- New admin integration test `test_long_identity.py`: two identities with a 256-character
  application and 512-character keys that differ only in the last character, with non-ASCII
  text, persist through `execute_run` to `alert_findings`, `run_alert_list` and
  `llm_verdicts`. A rerun reuses each identity's own verdict with no model call. After
  publishing, each takes its own decision, which reads back through `portal_alerts`,
  `portal_alert_list` and `portal_decisions`. The hashed key keeps the old comparison:
  case-sensitive, trailing spaces ignored. Every user-table key fits SQL Server's 900-byte
  clustered and 1,700-byte nonclustered limits.
- New `test_migration_018_upgrade.py`: a populated, published 017 database rejects the long
  identity with 1946, upgrades with row counts unchanged, refuses readiness before and passes
  after, finds upgraded verdicts by hash, and then stores the long identity. A failed 018 rolls
  back both keys and columns, and a retry applies it. New unit `test_migration_018.py`: the
  revision follows 017, refuses downgrade, and the lookup expression equals both computed
  column definitions.
- Existing tests that pinned head 017 or wrote verdicts into pre-018 schemas through the
  engine were updated (details in admin `1c1f00c`).
- Admin `scripts/ci_integration.py`, zero skips: **212 passed**. Unit **1025 passed**. Ruff,
  format, strict mypy and `poetry check --lock` passed.
- Admin-environment `check_contracts.py --console --sql`: API, CSV, migration bytes, guides,
  console routes and SQL view metadata match.
- Coordinated `run_integration.py --registry config/teams.json` with the portal worktree
  installed: 78 passed, 4 failed. All four are in `tests/integration/test_admin.py` and assert
  console text that the merged redesign (admin #16) removed, such as "Retry run". The same four
  fail identically with unmodified admin `main` installed, so they predate this change.
- Portal unit **422 passed** on the re-pinned snapshot. Design `check_docs.py` passed.
- Query plans: the insert-if-absent probe seeks `pk_llm_verdicts`. With 100,000 verdicts the
  400-pair `find_verdicts` lookup uses nested loops with a clustered index seek and returned
  exactly the 41 expected matches out of 1,200 probes.
- Browser, against `alerts_bi_test` with a published `checkout-api` week holding a
  503-character key: the admin console listed and opened the finding, and recording a
  confirmed decision through its form succeeded. The portal's Fix list showed the alert as
  Confirmed, and its detail page showed the decision note.
- An over-long value still fails: inserting 513 characters into an NVARCHAR(512) column
  through this driver's session raised error 2628.

Not covered: values longer than their columns still fail the run (design "Not covered"). The
trailing-space limitation is unchanged. Production table sizes were not available, so 018's
one-time hash computation and key rebuild time on production is unmeasured, as is which team
and identity failed. Nothing has been merged or deployed.
