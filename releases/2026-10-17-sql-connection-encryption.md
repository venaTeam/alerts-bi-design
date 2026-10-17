# SQL connection encryption — 2026-10-17

`SQL_ENCRYPT` and `SQL_TRUST_SERVER_CERTIFICATE` were read but never applied by the shared
SQL adapter. This change applies them. It is one of three gaps from a security review. The
other two are not addressed here: the portal allowlist behind the OpenShift router was
skipped by owner decision, and the portal still shares admin's read/write SQL login.

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
`4d228bf` (amendment). Both consumers pin canonical design `4d228bf`.

Shared 0.1.6 is a new immutable artifact; SHA-256:
`7ff20c81cfc1cb2a7c38d462ac0c1892bd9e8308426465c776971b0257cc29c2` (a rebuild from the
committed source reproduced it). Operations 0.2.3 pins shared 0.1.6; SHA-256:
`cbe3c9732caf97c76a0ed4a0e3443c90fe099387ffaa463bf2525f2a9cabffd3`. Prior artifacts unchanged.

Executed checks:

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

Not verified: behaviour against a SQL Server that refuses TLS (FreeTDS `require` semantics,
not exercised); whether the production SQL Server accepts TLS; Docker image builds. The
server certificate is not validated, so active interception remains a residual risk.
pymssql 2.4.4 was released 2026-10-10. Local `alerts_bi_dev` is at schema 008, so portal team
pages return 503 there independently of this change. Only `alerts_bi_test` was reset. No
production change, merge or deployment was performed.
