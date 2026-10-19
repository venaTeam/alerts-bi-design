# OpenShift deployment runbooks — 2026-10-19

Implementation, all on feat/openshift-deployment-runbook: admin 0ede189 (deploy/openshift
Templates, value files, runbook and test) and fe54147 (design snapshot), based on main 012c5ea;
portal ed87382 (deploy/openshift Template, value file, runbook and test) and f5f21cf (design
snapshot), based on main e77facd. Canonical input: design ee5be41 (openshift-deployment.md
requirements, runs-retirement.md, unified-console-deployment.md and source-map.md), based on main
a6878cd. Both applications are pinned to ee5be41. No application code, migration, contract or
output changed; the deleted admin `deploy/*.yaml` are replaced by `deploy/openshift/`.

## Executed checks

- Admin: `poetry run ruff check .`, `poetry run ruff format --check .`, `poetry run mypy`: passed.
  `poetry run pytest tests/unit tests/engine/unit -q`: 1031 passed, including the new
  `tests/unit/test_openshift_deploy.py`, before and after the snapshot pin.
- Portal: the same three checks passed. `poetry run pytest tests/unit -q`: 427 passed, including
  the new `tests/unit/test_openshift_deploy.py`, before and after the snapshot pin.
- Design: `poetry run python scripts/check_docs.py`: passed.
- A local stand-in for `oc process --local` (oc's parameter syntax and its param-file parser,
  read from the oc source; kubectl's `--from-env-file` rules) rendered admin.yaml, admin-job.yaml
  and portal.yaml from the example values. Structural checks passed: object kinds and names,
  one admin digest for every admin container, the unchanged init command, the proxy
  SubjectAccessReview JSON with the namespace, Service and Route ports, both allowlist
  annotations, security contexts, resources, volume and ConfigMap/Secret references, probe
  syntax, the suspend boolean, and empty required parameters failing.
- The new unit tests were seen to fail when a values default or a config value format drifted.

One upstream Starlette/httpx deprecation warning is present in both unit suites.

## Not executed

- No real `oc` (not installed on the development machine) and no cluster: neither
  `oc process`, `oc apply --dry-run=server` nor any apply ran. The runbooks make rendering and
  the server dry run the first steps on the cluster.
- `tests/integration/test_deployment_migrations.py`, whose manifest path changed, did not run
  locally (no local SQL Server); the admin CI integration job runs it.
- Probe behaviour, the `/oauth/healthz` path, the `openshift/oauth-proxy` image stream on a
  disconnected cluster and the OVN-Kubernetes source addresses seen by the portal are taken from
  OpenShift documentation and behaviour, not observed.

## Review fixes

An independent review of the uncommitted change reported 13 findings, all addressed before
these commits. The one-off Job ran under a ServiceAccount that a fresh install does not have
yet; it now uses the project's default account. The Job helper read the status before the
controller set it, and the `/healthz` expectation named a check that appears only on failure.
The migration gate asked for a backup before the writers were stopped; the backup now follows
stopping every writer, the console included. Upgrades now keep the live weekly schedule, model
switch, sizing, allowlists, SQL Secret and page size, diff the Secret's keys, and stop on
unexpected proxy arguments or several RoleBinding subjects. Routes set `ip_whitelist` too,
because older routers ignore `ip_allowlist`.

The review also found that the proxy check (`get` on the `alerts-bi-admin` Service) is passed by
holders of the built-in `view`, `edit` and `admin` roles, not only the operator Group. This is
the existing access model; the documents now state it, and changing it is left to the product
owner.
