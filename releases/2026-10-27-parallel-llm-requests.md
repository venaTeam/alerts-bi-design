# Parallel model requests within a run — 2026-10-27

A run sent its model batches one at a time, so each request, and each wait before a retry,
held up every later batch of the run.

## Decision and resulting behavior

Accepted 2026-10-27 by the product owner, who chose a per-run limit over one worker-wide total;
design section "Parallel model requests within a run" and
[decision 012](../decisions/012-parallel-model-requests.md).

- **`LLM_CONCURRENCY`**, 1 to 8, default 1: how many of one run's batches wait on the model at
  once, for every run whatever started it. Another value stops any command that loads the
  model settings. 1 keeps the existing one-at-a-time path on the caller's thread. The
  evaluation script still sends one batch at a time.
- **Each batch unchanged**: grouping, the 200-alert ceiling, request bytes, three attempts,
  retry waits and the audit entry committed before every request. The audit journal stays on
  the run's one connection (which keeps the `llm-review` session lock); its batch writes take
  a lock, so only the requests and retry waits overlap.
- **Same results**: batch outcomes are combined in batch order, so stored attempts, verdicts,
  outcomes, CSVs and identifiers match a run at 1. `llm.group` records can appear out of order
  above 1 and keep their "Group N of M" numbering.
- **Load**: up to `WORKER_CONCURRENCY` times `LLM_CONCURRENCY` requests at once; raise it one
  step at a time while watching the endpoint (deploy README "Send a run's model requests in
  parallel").
- **Not a recorded model setting**: changing it never raises the run audit's settings refusal.
- **Unchanged**: migrations, routes, job states, CSV outputs, portal views and the
  shared/operations libraries. The portal keeps its pin.

## Revisions

- Stacked on decision 011's branches (`feat/parallel-worker-runs`); merge those first.
- Design branch `feat/parallel-llm-requests` from `ca677f1`: `d12fc5b` (design section, flow,
  runbook, OpenShift settings, decision 012), then this release note.
- Admin branch `feat/parallel-llm-requests` from `770003b`: `bfcb36d` (snapshot pin of design
  `d12fc5b`), `312f3e7` (setting, parallel assessment, journal lock, tests, deploy examples,
  README).

## Executed

Local SQL Server 2022 and the ES mock read through private `scl-appchi-*` indices, on admin
`312f3e7`:

- `poetry run pytest tests/unit tests/engine/unit -q`: 1150 passed.
- `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`: clean.
- `poetry run pytest tests/engine/integration/test_llm_audit.py -m integration`: 9 passed,
  including the shared journal at concurrency 3, replay of the same scope at concurrency 1
  with no model call and no settings refusal, and three interrupted in-flight requests each
  consuming one attempt on recovery.
- `LLM_CONCURRENCY=4 poetry run python scripts/ci_integration.py` (integration and acceptance
  suites, zero skips allowed): 239 passed.
- Design: `poetry run python scripts/check_docs.py` passed.

Not executed: a live model endpoint (section 7.2's capacity measurement remains open), and
no deployment.
