# Application selector usability — 2026-10-13

Implemented the product owner's four requested fixes: case-insensitive dropdown search,
Cancel without navigation, unchanged All applications submission, and the first three
selected chips with Show more / Show less. Outside-click and Escape also discard edits;
search preserves checked values outside the results. Explicit subsets and empty scopes
retain their meanings, and Enter in search does not submit.

The canonical design and implementation blueprint permit one same-origin external
selector script. CSP still blocks inline scripts/styles, eval and third-party scripts.
SQL views, publication boundaries and GET-only routing are unchanged. Admin needs no change.
Merge the design amendment before the portal change; neither has been deployed.

## Tested sources and environment

- Portal base: `69765ad` (current main, including Poetry tooling).
- Portal implementation: branch `codex/application-filter-ux`.
- Pinned design inputs: `08d18fda2ae2e4b2e2aba381edde67841f8eed2b`.
- Python 3.13.5, locked Poetry dependencies; local SQL Server and existing synthetic
  published reviews in `alerts_bi_test`. No database reset or data write was performed.
- The existing SQL test container was stopped during initial checks; started it for
  verification. The task portal ran separately on loopback port 8312. No existing app
  listener was replaced. Original checkouts and their edits were preserved.
- The portal's preexisting local Poetry decision amendment was preserved when syncing
  canonical inputs; no tooling downgrade was included.

## Executed verification

| Check | Result |
|---|---|
| `poetry run pytest tests/unit -q` | 272 passed; existing Starlette/httpx deprecation warning |
| `poetry run ruff check .` | Passed |
| `poetry run ruff format --check .` | 24 files passed |
| `poetry run mypy` | 24 source files passed |
| `poetry build` | Wheel and source distribution built |
| `python scripts/check_docs.py` in design | Passed |
| Real SQL / FastAPI HTTP smoke | Health, directory, script asset and 7 tabs × 4 scopes passed |
| Browser, default desktop viewport | Search, hidden checked values, no-results feedback, Enter handling, Apply and Cancel passed |
| Browser dismissal and scope | Cancel preserves expanded disclosure (no reload); Cancel/Escape/outside-click restore checked values and clear search; unchanged and restored-all Apply retain All applications |
| Browser selection and navigation | Empty selection, Show all, explicit four-app scope and Fix list schema preservation passed |
| Browser disclosure and mobile | Three visible chips; remaining chip revealed; Enter/Space disclosure controls passed; 390×844 viewport inspected and restored |
| Browser security console | No warnings/errors observed |

An initial sandboxed test invocation stalled on local test-client calls and was interrupted;
the elevated final suite passed. Build temporary-file permissions required host execution.
The initial backend-unavailable page was resolved by starting the stopped local SQL container.
These environment failures were not counted as passing checks.

No cluster deployment, merge or production validation was performed. Without scripting,
the GET filter form, native Cancel dismissal and disclosure remain usable; live search,
edit rollback and unchanged-all submission require the scoped enhancement.
