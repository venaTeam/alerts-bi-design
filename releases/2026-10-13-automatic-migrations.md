# Automatic admin deployment migrations

The normal admin deployment now runs `alerts-bi-admin db setup` in a regular
`migrate` init container. It uses the same admin image and common SQL settings as
the UI and worker, selecting `ADMIN_DATABASE`, then `SQL_DATABASE`, then the
application default. All application containers wait for successful completion.
One replica and `Recreate` stop the previous pod before upgrade initialization.

Canonical contract revision: `11957d4ada52e4d0750bd0932bcd08be947de8db`.
Implementation revision: `349ca45a8e983c9dd98421899a8cd5ced07b1817`.
Both use branch `codex/async-runs` and their existing PR 5.

The migration CLI applies missing revisions and preserves existing records.
Applied migration resources 001-011 are unchanged; the schema head remains
`011_run_job_keys`. The separate migration Job is optional maintenance tooling,
to be used with UI and worker stopped and without concurrent deployment init.

Verification includes 875 unit tests and 160 real SQL/ES integration and critical
acceptance tests, with zero skips. The new integration tests execute the exact
shipped init shell command: upgrading a populated 010 database to 011, preserving
its job record, repeating setup without another application, selecting both
database environment fallbacks, and returning failure when SQL is unreachable.
Ruff, strict mypy, Poetry lock validation, application/library builds, immutable
migration wheel resources, and local Kubernetes manifest parsing pass.

The UI loaded and its New run dialog opened after setup against the disposable
test database. The temporary server was stopped. Canonical documentation, exact
API/CSV/SQL contracts and the coordinated admin/portal regression suite are
required final checks recorded with this release's task evidence. GitHub admin
unit and integration workflows passed at the implementation revision.

Operators must build and publish the updated image, put the same digest into the
migration init, UI and worker entries, and deploy the updated manifest with their
existing namespace, secrets and configuration. The SQL login needs permission
to perform the pending schema changes. Updating only the running image without
adding the init container does not enable automatic migration.

No cluster apply, production migration, merge or deployment was performed.
Actual cluster admission, registry access and production SQL permissions remain
deployment-environment checks.
