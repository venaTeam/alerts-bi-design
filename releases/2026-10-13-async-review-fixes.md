# Async run review fixes — 2026-10-13

Implementation: admin 3955413464e36f3a95b01ad90ab7ac72f1d8a979, including code commits
5f9e2f8 and 6a4f964. Canonical snapshot: design 4d5684579bb23e90da4d1f13f715e93872450c93.
Both branches are codex/async-runs and update their existing PR #5.

## Findings and disposition

- The shipped admin manifest now starts the manual run-worker with the same image,
  registry, SQL/ES/model configuration and output mount as the UI. The single pod uses
  Recreate. Local kubectl parsing verified executor parity and proxy-only service exposure.
  Docker Compose is the existing local dependency stack; neither application runs there.
- Exact ASCII submission keys use a binary SHA-256 identity in additive 011_run_job_keys.
  Existing records are backfilled and retain raw audit keys; lookup and uniqueness use the
  digest. Real SQL proves separate case/padding-distinct attempts and duplicate enforcement.
  Applied migration and revision bytes 001–010 are unchanged. Deletion remains 009; jobs 010.
- Restart recovery regenerates every CSV from the committed SQL result under the execution
  locks. Missing, stale and partial files recover correctly. Export failure retains a visible
  completed-with-warning result. No standalone HTML feature is restored.
- Idle polls check the active slot before taking execution locks. Submission, start and
  terminal transitions are logged. Each job regression builds its own disposable database;
  installed-worker and older-result tests no longer depend on previous tests' records.
- GitHub Checks now has a real SQL/ES integration job with pinned mocks and fixed-clock
  seeding. The exact scripts/ci_integration.py entry point requires live local services and
  fails if any selected integration/acceptance check is skipped.
- console-openapi.json captures the actual console, including required idempotency/CSRF
  headers, request schema and typed status responses. The legacy trigger schema keeps its
  factory scope; the live console still disables public documentation endpoints.
- The minimum operational remedy requested for hung jobs is provided in
  docs/manual-worker-runbook.md: age monitoring guidance, existing per-request timeout
  settings, confirmed SQL-session release, supervised restart and compatible rollback.
  There is no new whole-job deadline, heartbeat or configured production alert. Hung jobs
  require operator recovery; no age-based sweep races a live lock-owning worker.
- Queueing behind active work is outside the accepted single-active-job contract. Busy
  admission remains 409 and retains full-lifecycle locks. Authenticated standardization
  operators have access across teams; status reads follow that model and a new regression
  checks it. The team workspace still rejects jobs belonging to another selected team.
- Standalone HTML was explicitly requested to be removed entirely. The accepted 404/422
  removals and release notice remain; temporary HTML compatibility routes are not restored.
  Terminal submission rows are intentionally removed with their permanently deleted run,
  preserving the accepted whole-run deletion policy and existing deletion event audit.

## Executed verification

- Required unit suite: 875 passed.
- Exact new CI integration command: 158 real SQL/ES integration and critical acceptance
  checks passed with zero skips. Targeted isolated job/console coverage: 42 passed.
- Coordinated admin/portal integration: 77 passed; CSV columns and published view metadata
  remain unchanged. Both complete console and legacy API contracts match their producers.
- Ruff lint/format, strict mypy, Poetry lock consistency, app/library builds and wheel resource
  inspection passed. The admin wheel includes exact immutable 001–010 resources and 011.
- Both push and pull-request GitHub workflows passed unit and new integration jobs at
  3955413. The remote jobs actually started SQL/ES, seeded fixtures and executed the suite.

The initial full unit run exposed one obsolete 010 head expectation; it was updated to 011
and the package-boundary test plus complete required suites were repeated. Isolating the job
tests exposed their implicit old-result setup; the deletion case now explicitly seeds that
result. The CI script uses the existing checkout bootstrap convention. These failed attempts
were repaired and their affected checks repeated. One upstream Starlette/httpx warning remains.

## Browser and worker evidence

The loopback console used alerts_bi_test, explicit review-browser-test identity and an isolated
task output root. A fake-model Checkout API run for Monday 2026-08-24 was accepted immediately.
Task-only fault injection exited the actual worker entry point after SQL commit and before
the first CSV write; the expected exit was nonzero. SQL confirmed the job still running with
all three exports absent. Restarting the normal CLI worker recovered the job, cleared its
active slot and produced all three files byte-for-byte equal to the current SQL rendering.
Browser polling opened the completed, unpublished overview, showing all three CSV links.
Keyboard navigation reached the exports. Screenshot outside Git:
../evidence/review-recovered-run.png. Temporary browser/server were closed after verification.

## Rollout boundary

No merge, production SQL update, deployment, cluster restart or production monitor was done.
Stop UI/worker writers, apply through 011 and deploy both from the updated image. Pre-011
writers omit the required digest and cannot accept submissions after this migration; use a
compatible writer or forward repair rather than downgrading schema. Follow the runbook when
pending/running work prevents a controlled rollback. Shared 0.1.3 and operations 0.2.0 remain
unchanged by these fixes.
