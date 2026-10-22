<!-- eng-project-setup -->
## alerts-bi-design: agent navigation

Canonical product design, contracts, accepted decisions, and coordinated release evidence.

### Sources of authority

- design: `docs/alerts_bi_design.md` — Authoritative behavior; consult affected sections before behavior/boundary changes.
- design: `docs/alerts_bi_flow.md` — Approved runtime flow.
- design: `docs/alerts_bi_implementation_plan.md` — Implementation blueprint.
- design: `docs/outputs.md` — Output and API meanings.
- design: `docs/async-runs.md` — Durable manual submissions, worker/recovery, HTTP compatibility and output storage.
- design: `docs/backfill.md` — Operator multi-week backfill: selection, queued job states, worker claim order and weekly priority.

### Verification

- docs: `["poetry", "run", "python", "scripts/check_docs.py"]` in `.` (observed; scripts/check_docs.py; validation result recorded in releases/).

### Project invariants

- Read scoped instructions and source indexes first; consult the relevant canonical design, flow and blueprint for affected behavior or boundaries. Expand when dependencies or contradictions emerge. If required authority is unavailable, report the blocker.
- Design > approved flow > implementation blueprint > code. Read outputs.md before changing exports, report rendering or API contracts. Read both alerting guides completely for rule, scoring, prompt or alert-quality work.
- This repository is the canonical design authority. Application snapshots are pinned inputs, not competing specifications. Keep contract updates explicit and publish exact tested revision combinations separately from intended behavior.
- The supported local workspace contains design, admin and portal only. Do not require or recreate an alerts-bi-runs checkout for setup or development. Admin owns its former tooling; consult docs/runs-retirement.md for local recovery and the separate operational cutover.
- If a parent AGENTS.md exists in a multi-repository workspace, read it explicitly for routing. The repository remains buildable and understandable without it. Parent instructions never become a runtime dependency.
- Inspect local changes before edits, preserve others work, and keep KeepHQ excluded. Do not install GitHub or Figma plugins. Use the selected main model.
- Use Python 3.12+, Poetry 2.3.1, committed poetry.lock, pytest, ruff and strict mypy. SQLAlchemy Core with pymssql targets real SQL Server; never SQLite or an in-memory integration substitute. No Node.js build/test dependency.
- Keep one selected team per run, app+key identity, exact UTC windows, separate v1/v2 counts and SQL-only output rendering. Preserve R6 episode boundaries, suppression safety, LLM audit/retry behavior, prompt text, and deterministic identifiers.
- Do not edit applied SQL/revision files or regenerate the hand-authored expected-results oracle. Admin owns the sole migration chain. Changes to immutable prompt/catalog/instant formats require their approved version process.
- No secrets, alert documents or complete model payloads in normal logs or commits. Use environment settings and placeholders. Read deployment credentials only for the authorized task.
- Use eng-coordinate for cross-repository work and establish contracts before parallel implementation. At most three useful children, no recursive delegation, bounded ownership, one integrator. Subagents read the complete design and report files, commands, assumptions and actual results.
- Run the affected checks and coordinated contracts; report missing services and skipped checks honestly. Reset only the explicit local mock and disposable alerts_bi_test database. Never delete development or production data. Deployment, merges and external messaging need existing authorization.
- AGENTS.md is the only instruction body; CLAUDE.md stays a short @AGENTS.md pointer. Record accepted product decisions in canonical design in the same task, with a date, and reconcile affected flow/contracts.

Use this project guidance with more specific area instructions. Requirements and decisions remain in their linked sources.
Preserve local changes; use the narrowest meaningful checks and report what actually ran. Setup does not grant deployment authority.
<!-- /eng-project-setup -->
