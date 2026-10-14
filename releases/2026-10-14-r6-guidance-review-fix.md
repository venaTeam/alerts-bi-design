# R6 aggregate guidance review fix — 2026-10-14

Portal PR #4 review found that each stored pattern was passed once to a helper expecting
one input per alert. This discarded identity counts and selected by event volume when
different patterns were present. Ten spamming identities with 1,000 events could lose to
one stuck identity with 2,000 events.

Admin `52d6533` and portal `4e326c1` restore the existing ordering: identity count first,
event count second, then flapping/spamming/stuck priority. One shared aggregate helper
also serves the full-input helper, and both the portal R6 banner and shared summary
renderer use it. Neither pattern classification, thresholds nor SQL contracts changed.

Shared 0.1.5 is a new immutable artifact; SHA-256:
`1eec70ec95366e6147cfa608801c3f557028719ddb22967066b6e2d78530e9ab`.
Operations 0.2.2 pins shared 0.1.5; its wheel SHA-256 is
`ccac607fc49ae05ca47524938dcb3a63d6ac5ea18e02789cfca94814588a7c75`.
Prior artifacts remain unchanged. Both consumers pin canonical design `d7701ff` and
their locks match the final artifacts/dependency versions.

Executed checks:

- Admin unit suite: **895 passed**, 17.36 s; includes eight aggregate ranking/parity cases.
- Portal unit suite: **282 passed**, 2.44 s; mixed-pattern rendering covers both admin and
  portal surfaces, stored and complete inputs, and a sample containing only the stuck alert.
- Coordinated installed-package SQL/HTTP suite: **77 passed**, 31.34 s, on real local SQL
  Server and the existing mock service, with small disposable fixtures.
- Both consumers: lint, formatting, strict typing and lock validation passed. API, CSV,
  migration and published SQL-view contracts passed. Canonical documentation checks passed.
- Shared/operations release artifacts and admin source distribution/wheel built. A fresh
  standalone portal environment installed all 17 production dependencies through
  `poetry sync --only main --no-root` and built the portal wheel using only its own inputs.
- Actual browser journeys on 11 synthetic findings: the published portal R6 banner and its
  v1 schema filter displayed send-once guidance; admin detailed analysis displayed the
  same next step in the key finding. The higher-volume stuck alert remained visible as
  its own identity. The rendered portal banner was visually inspected.

One existing upstream Starlette/httpx deprecation warning remains. Only local
`alerts_bi_test` was reset for browser/integration checks. Task web servers and browser
tabs were stopped afterward. No large load, production changes, merge or deployment was
performed. The original admin performance PR #6 was already merged before this correction;
admin PR #7 contains the shared-library follow-up. Portal PR #4 and design PR #6 remain open.
