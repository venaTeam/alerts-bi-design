# Recovery and timestamp review fixes

Implementation: admin `49199895a8a9f8cd078d9195f1b61b4742f17acb`, including
reservation commit `f86c34ef55b2e81f75fb531936d4545a032c0fe1`.
Canonical recovery contract: design `efada879a4277e34f5fda5bb176c19729123675f`.
Both continue branch `codex/async-runs` and their existing PR 5.

The reviewed recovery defect let CLI/weekly execution replace an abandoned worker's
deterministic run ID after its sessions closed, before reconciliation. The durable
pending/running slot now remains an execution reservation: run writers check it
under the shared scheduler lock and refuse until the worker finishes or reconciles.
Job admission/recovery rechecks under its existing locks. Browser deletion retains
its own transactional active-job refusal and redirect.

Self-review traced every application persistence entry point and found acceptance
verification bypassed the shared lock. It now protects the complete multi-team
persistence/export lifecycle and closes its Elasticsearch client. Review also
checked affected recovery, API, authentication, polling, exports, deployment and
compatibility paths; no further actionable defect was identified in those paths.

A subsequent comment identified naive SQL timestamps in job POST/GET JSON. They
now use the existing shared UTC instant formatter with milliseconds and trailing
`Z`; absent timestamps remain null. The declared date-time schema is unchanged.

Verification at the implementation revision:

- 877 unit tests, 170 real SQL/ES integration and critical acceptance tests, with
  zero skips; 77 coordinated admin/portal tests.
- Installed-command regressions cover run, weekly, report and verification writers
  for both pending and abandoned jobs, interrupted recovery and successful CLI
  retry after reconciliation. The pre-fix installed writer race was reproduced.
- Real SQL tests check pre-job schema lock compatibility and the actual submission,
  running and terminal JSON instants. The naive POST response was reproduced before
  fixing serialization.
- Browser submission returned immediately; simulated crash before persistence
  retained the reservation, the installed CLI refused, and worker reconciliation
  made polling display the interruption message. The temporary server/tab stopped.
- Ruff, formatting, strict types, application/library builds, exact API/CSV/SQL
  contracts, local manifest parsing and immutable migration wheel resources pass.
  All GitHub unit/integration checks are green.

No new migration or applied 001-011 revision change is required. Deploy compatible
versions for all run-writing entry points, including CLI and weekly scheduling;
older writers cannot enforce the new reservation guard. Automatic deployment init
remains as previously implemented. No merge, cluster rollout or production action
was performed; production environment validation remains separate.
