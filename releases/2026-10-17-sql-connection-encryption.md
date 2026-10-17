# SQL connection encryption — 2026-10-17

`SQL_ENCRYPT` and `SQL_TRUST_SERVER_CERTIFICATE` were read but never applied by the shared
SQL adapter. This change applies them. It is one of three gaps from a security review. The
other two are not addressed here: the portal allowlist behind the OpenShift router was
skipped by owner decision. The portal still shares admin's read/write SQL login; that risk
and its reader-login option are recorded in the design note of the same date, and nothing
in this change alters the credentials.

Driver findings, against local SQL Server 2022, using `sys.dm_exec_connections.encrypt_option`:

- pymssql 2.3.13 (FreeTDS 1.4.27, previously locked) and 2.4.2 (FreeTDS 1.5.19) connected
  unencrypted with `encryption="require"`, on Windows and manylinux wheels.
- pymssql 2.4.3, which applies the encryption level per connection, and 2.4.4 connected
  encrypted. `sqlcmd -N` confirmed that the server accepts TLS.
- A low-privilege login cannot read its own `encrypt_option`, because it needs VIEW SERVER
  STATE. A post-connect check is therefore not portable, and shared refuses old drivers by
  version instead.

Admin `2b875c8` (shared 0.1.6, operations 0.2.3, pymssql 2.4.4 lock) and `f2d68d6` (snapshot),
portal `0e81673` (vendored shared 0.1.6, pymssql 2.4.4 lock) and `479316e` (snapshot), design
`4d228bf` (amendment) and `ad75759` (portal SQL login note). Both consumers then pin
canonical design `ad75759` (admin `be7dc79`, portal `0781f4d`).

Review fixes (same day): admin `73b9135` (shared 0.1.7, operations 0.2.4, strict `SQL_ENCRYPT`,
Alembic encryption test, encrypted CI smoke step) and `d46899f` (snapshot), portal `6ef7db3`
(vendored shared 0.1.7) and `b22e754` (snapshot), design `0a58a7d` (refusal timing, interception
limit, certificate-validation follow-up). Both consumers pin canonical design `0a58a7d`.

Shared 0.1.6 (`7ff20c81cfc1cb2a7c38d462ac0c1892bd9e8308426465c776971b0257cc29c2`) and
operations 0.2.3 (`cbe3c9732caf97c76a0ed4a0e3443c90fe099387ffaa463bf2525f2a9cabffd3`) were
pushed and hash-verified in review, then superseded before merge. The portal PR no longer
carries the 0.1.6 wheel. Shared 0.1.7 is the release, vendored with SHA-256
`853a985002c337df919b04ba29fbc2df606a882b22ae3ac17644b1e2adf59983`. Operations 0.2.4 pins
shared 0.1.7; SHA-256 `e3f4d849b84f4f9f8a7e7e2169a9966dbcf33c2ff1e5a409dc6b8d9657a92b2f`.
Prior artifacts are unchanged.

Both hashes come from Windows builds, and a Windows rebuild from the committed source
reproduces them. Linux builds hash differently. Admin CI and a clean `python:3.12-slim`
build both produce shared `453ff2b715c78463dfa302433384317d5a98da30a9bbb101d37bf49dfd7fd1f4`
and operations `63a61628c163e2baefb19784d7e5953409836bdda61c1608d6fdfcce8dd77031`. Compared
entry by entry, the Linux and Windows archives differ only in the zip create-system field
(3 versus 0) of every entry. File names, permissions and contents are identical. Admin CI
now publishes its built wheels with a `SHA256SUMS` file for each commit.

Second review round: design `d656e42` adds the encryption rollout order and rollback caveat
to openshift-deployment.md. Admin `1660fa6` publishes CI-built wheels, and `6304017` pins the
snapshot. Portal `05617b4` drops the superseded wheel, `4b8a15f` adds a minimal CI workflow,
and `ff19064` pins the snapshot. Both consumers pin canonical design `d656e42`. Code is
unchanged since the first review round. Admin unit (945) and portal unit (283) suites were
rerun on the re-pinned snapshots. The portal workflow's steps passed in a clean
`python:3.12-slim` container from `git archive HEAD` with no `.env`. Both workflow files
parse with PyYAML.

Executed checks, review-fix tip:

- Admin unit suite: **945 passed**. This includes strict `SQL_ENCRYPT` parsing and the Alembic
  env encryption test, which was mutation-checked by removing the arguments. Ruff, format,
  strict mypy and lock validation passed.
- Admin `scripts/ci_integration.py` with `SQL_ENCRYPT=true`, zero skips: **192 passed**. The
  new CI smoke-step command (encryption test plus Alembic migration suite, encrypted):
  **17 passed**. GitHub CI runs the default-mode integration and the smoke step on push.
- Portal unit suite: **283 passed** with shared 0.1.7, including `SQL_ENCRYPT=require`
  refusal. Ruff, format, strict mypy and lock validation passed.
- Coordinated installed-wheel checks: contracts matched; **77 passed** in each mode.
- Docker images built from the branch tips run pymssql 2.4.4 (FreeTDS 1.5.19), shared 0.1.7
  and operations 0.2.4. The admin image's encrypted `db setup` on `alerts_bi_test` exited 0
  (up to date). The same image exited 1 for `SQL_TRUST_SERVER_CERTIFICATE=false` and for
  `SQL_ENCRYPT=require`. The portal image served its home and team pages with HTTP 200 and no
  errors; SQL Server reported its session `encrypt_option` TRUE.

Executed checks, first submission:

- Admin unit suite: **936 passed**; ruff, format, strict mypy and lock validation passed.
- Admin `scripts/ci_integration.py` on local SQL Server and ES mock, zero skips: **192 passed**
  with default settings and **192 passed** with `SQL_ENCRYPT=true`. This includes a real-session
  test asserting `encrypt_option` TRUE when enabled and FALSE by default.
- Portal unit suite: **283 passed**; ruff, format, strict mypy and lock validation passed. A
  fresh standalone `poetry sync --only main --no-root` installed pymssql 2.4.4 and shared
  0.1.6 from `vendor/`, and the portal wheel built.
- Coordinated installed-wheel checks: `check_contracts.py --sql --console` matched, and
  `run_integration.py` passed **77** with default settings and **77** with `SQL_ENCRYPT=true`.
- Canonical documentation checks passed.
- Real entry point: `alerts-bi-portal` with `SQL_ENCRYPT=true` and
  `SQL_TRUST_SERVER_CERTIFICATE=false` exited 1 at startup. With `SQL_ENCRYPT=true` against
  `alerts_bi_test` (schema 014), the browser rendered the team list, a team overview and its
  Fix list. SQL Server reported the portal session `encrypt_option` TRUE.

Portal reader login (design note, no code change): on local `alerts_bi_test`, a login created
by `alerts-bi-admin db grant-reader` (member of `alerts_bi_reader` only) ran the portal with
`SQL_ENCRYPT=true`. It served all 31 links of a published team with HTTP 200 and no errors,
read `portal_reviews`, and was denied SELECT on `runs` and DELETE/UPDATE on views and tables.
The probe user and login were dropped afterwards. No request was sent to the database team.

Not verified: behaviour against a SQL Server that refuses TLS (FreeTDS `require` semantics,
not exercised); whether the production SQL Server accepts TLS; whether the live configuration
sets `SQL_TRUST_SERVER_CERTIFICATE=false`. The server certificate is not validated, so active
interception remains a residual risk, and certificate validation is an open follow-up.
pymssql 2.4.4 was released 2026-10-10. Local `alerts_bi_dev` is at schema 008, so portal team
pages return 503 there independently of this change. Only `alerts_bi_test` was reset. No
production change, merge or deployment was performed.
