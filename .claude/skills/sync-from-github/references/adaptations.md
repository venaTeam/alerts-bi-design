# Resolving changes and porting adaptations

For any path, read all three versions before deciding. `base` and `snapshot` come from the
import output:

| Command | Shows |
|---|---|
| `git show <base>:<path>` | GitHub at the previous import |
| `git show <snapshot>:<path>` | GitHub now |
| `git show HEAD:<path>` | Private version before this merge |
| `git diff <base> <snapshot> -- <path>` | GitHub's change |
| `git diff <base> HEAD -- <path>` | The private adaptation or hotfix |

## Dockerfile

Keep from the private version everything about where things come from and the platform:

- `FROM` image names, registries and digests;
- package index or mirror settings, proxies and CA certificates;
- other platform setup that the private version added.

Port from GitHub everything that follows the code:

- `COPY` lines for added, removed or renamed paths. Compare against GitHub's `COPY` list:
  every source must exist in the merged tree, and the build must copy every directory that
  GitHub's version copies.
- Build and install commands, such as a Poetry version, an additional package build, or
  install flags. Express them with the private mirror settings.
- `ENV` defaults for application settings, `EXPOSE`, `USER`, `ENTRYPOINT`, `CMD`, runtime
  directories and their permissions.

Stop and ask when GitHub changes the base image or Python version, switches build tool (for
example uv to Poetry), or adds system packages.

Build the private Dockerfile with `docker`, `podman` or `buildah` when one is available.
Otherwise check that every `COPY` source exists, and report the image build as not verified.

## GitLab CI

The private CI is `.gitlab-ci.yml`, together with any files it includes. GitHub's
`.github/workflows/*.yml` shows what GitHub checks. For each change there:

| GitHub change | Private action |
|---|---|
| Added, changed or removed check command (lint, types, tests, build) | Make the same change in the matching GitLab job |
| Tool version (Python, Poetry) | Update it if the private images and mirror provide it; otherwise flag it |
| New service, such as Elasticsearch or SQL Server through docker compose | Port it only if the private CI already runs such services or the user says how; otherwise flag it |
| Published artifacts, such as CI-built wheels and `SHA256SUMS` | GitLab `artifacts:` |
| GitHub-only mechanics (`actions/checkout`, `setup-python`, `permissions`) | Nothing to port; translate the intent, not the syntax |

Keep runner tags, images, variables, caches, rules and includes as they are. Never add secrets
or change CI variables.

## Dependencies

Take GitHub's `pyproject.toml`, `poetry.lock` and `vendor/*.whl`. If `poetry check --lock` or
`poetry sync` fails because the private mirror lacks a package or version, report what is
missing and stop for that repository. Do not relock to other versions or edit pins. The
exception: if `poetry.lock` appears in `private_changes`, this repository regenerates its lock
privately. Then run `poetry lock` after merging `pyproject.toml` and say so in the merge
request.

## Code conflicts: local hotfixes

A code file in `private_changes` was fixed directly in this network. Compare the private
change with GitHub's:

- GitHub's new version already contains the same fix: take GitHub's version.
- The changes are independent: keep both.
- They contradict each other, or you cannot tell: stop and ask.

Name every hotfix in the merge request, so that it can also be made on GitHub if it is
missing there.

## Deploy notes for the merge request

Build these notes from the `upstream_changes` categories. Also read the new or changed GitHub
documents that explain a release:

- `releases/*` in design;
- `docs/upstream/handoffs/*` and `docs/*env-changes.md` in admin and portal.

Summarize their deployment steps.

| Category | Tell the person deploying |
|---|---|
| `migrations` | The new migration files and schema head. Admin's init container applies them with `alerts-bi-admin db setup`. They cannot be rolled back, so a database backup must exist first |
| `environment` | The keys in `environment_keys` that were added or removed, and the OpenShift ConfigMap or Secret entries they need |
| `dependencies` | New or changed packages, and whether the mirror provided them |
| `container` | What changed in the image and what you ported |
| `deployment` | Changes to the `deploy/*.yaml` or compose examples that the private OpenShift configuration may need |
| `contracts` | SQL view or API contract changes. Deploy admin before portal when portal depends on them |
| `registry` | Changes to `config/teams.json` or `teams.schema.json` |
