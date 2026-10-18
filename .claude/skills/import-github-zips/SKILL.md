---
name: import-github-zips
description: Imports GitHub "Download ZIP" archives of alerts-bi-admin, alerts-bi-portal and alerts-bi-design into their private-network GitLab clones, keeps the private Dockerfile and GitLab CI, and opens one GitLab merge request per repository. Use inside the private network when the user hands over GitHub ZIPs of these repositories or asks to import, sync or update the code from GitHub.
---

# Import GitHub ZIPs

The code is developed on GitHub. It reaches this network as GitHub **Download ZIP** archives
of `main`: one to three per delivery, and many GitHub commits apart. Each repository here is a
GitLab clone in the workspace folder. Bring in every GitHub change, keep this network's
adaptations, and leave one merge request per repository for the user to review and merge.

What differs here from GitHub:

| Path | Here |
|---|---|
| `Dockerfile` | Same logic as GitHub; private sources: base image registry, Artifactory package index, certificates, proxies |
| `.gitlab-ci.yml` | Exists only here; GitHub uses `.github/workflows/` instead |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Identical to GitHub today; may get private wording later |
| Everything else | Identical to GitHub |

## How the import works

`scripts/github_import.py` (Python 3.9+ and git, no network) does the mechanical part:

1. It commits the ZIP, byte for byte, as a **snapshot** commit whose parent is the previously
   imported snapshot. The ZIP comment holds the GitHub commit id.
2. It merges that snapshot into a new branch made from `origin/main`, so git compares against
   the previous import: a file changed only on GitHub is taken, a file changed only here is
   kept, and a file changed on both sides conflicts.
3. It prints JSON: GitHub's changes by category, this network's own changes, conflicts, files
   to review, added or removed environment keys and new migrations.

The next import finds its starting point through the snapshot that reached `main` with the
merge request. That is why merge requests must be merged with a merge commit, never squashed
or rebased.

## Before you start

- Set `S` to this skill's `scripts/github_import.py`. Run it with `python3` (or `python`).
- Find the ZIPs. GitHub names them `alerts-bi-<name>-main.zip`; browsers may add ` (2)`. Do not
  extract or repack them. If they come inside one outer archive, extract only that outer
  archive, into a new empty folder outside the clones.
- Run `python3 $S inspect <zip>...`. Each ZIP must show a `repository` and a `github_commit`.
  Without a commit id, ask the user for the full GitHub commit id and pass `--github-commit`.
  With two ZIPs of one repository, the older one is a first-run baseline; otherwise ask.
- Find each clone in the workspace (`alerts-bi-admin`, `alerts-bi-portal`, `alerts-bi-design`).
  Ask if one is missing.

## For each repository with a ZIP

Repositories are independent; import each one fully before the next.

1. **Prepare.** Run `git -C <clone> fetch origin`. With the GitLab MCP, look for an open merge
   request from a `chore/github-import-*` branch in this project. If one is open, stop and ask:
   two imports from the same base split the snapshot history. Then run
   `python3 $S status --repo <clone> --repository <name>`. Stop and ask if `clean` is false or
   `merge_in_progress` is true. If `needs_baseline` is true, follow
   [references/first-run.md](references/first-run.md) first.
2. **Import.** Branch name: `chore/github-import-<first 8 characters of github_commit>`.
   `python3 $S import --repo <clone> --zip <zip> --branch <branch>`.
   Keep the JSON: it drives the rest and the merge request. `up_to_date: true` means nothing to
   do for this repository. Exit status 2 prints `error`: do what it says, and never work around
   it by copying files by hand.
3. **Resolve and review**, using the rules below. Look at:
   - every path in `conflicts`;
   - every path in `review_auto_merged`: changed on both sides and merged by git;
   - every entry under `github_changes.by_category` `container` and `ci`, even without a
     conflict, because a cleanly merged Dockerfile line can still point to a public source.
4. **Verify** (see below). Fix what the import broke in further commits on the branch.
5. **Commit.** `git add` the resolved files, then `git commit --no-edit`. The script prepared
   the merge message.
6. **Push with git:** `git push -u origin <branch>`. Never push the branch's files through
   the GitLab MCP; that creates new commits and loses the snapshot history.
7. **Open the merge request** with the GitLab MCP, as described in
   [references/merge-request.md](references/merge-request.md).

## Rules

**Dockerfile.** Start from the private version. Keep every line that says where things come
from: `FROM` registries and digests, Artifactory index settings, certificates, proxies. Port
GitHub's logic changes into it: `COPY` lines, build and install steps, tool versions, `ENV`
application defaults, `EXPOSE`, `USER`, `ENTRYPOINT`, `CMD`. Write them with the private
sources. Afterwards, the merged Dockerfile must not reference a registry or index the private
version did not already use (for example `docker.io`, `ghcr.io`, `pypi.org`,
`files.pythonhosted.org`). Every `COPY` source must exist in the merged tree.

**`.gitlab-ci.yml`.** Keep it. When GitHub adds, changes or removes a check command in
`.github/workflows/`, such as lint, type checks, tests or a build step, make the same change in
the matching GitLab job. Do not add services, runners, images or variables; list such needs
in the merge request instead.

**`.github/`.** Take GitHub's version as it is. It does not run here.

**Agent instructions** (`AGENTS.md`, `CLAUDE.md`, `.claude/`). If they are not in
`private_changes`, take GitHub's version. If they are, the private wording wins: keep it, and
add GitHub's new guidance unless it is about GitHub, its workspace or its tooling.

**Everything else** (code, tests, docs, contracts, migrations, `pyproject.toml`,
`poetry.lock`, `vendor/` wheels, `config/`, `deploy/`): GitHub wins. Never edit dependency
pins or relock to work around Artifactory. A path of this kind in `private_changes` is a
private **hotfix**:
- GitHub's new version already contains the same fix: take GitHub's version.
- The changes are independent: keep both.
- They contradict each other, or you cannot tell: stop and ask.

Name every hotfix in the merge request, so that it can also be made on GitHub.

## Verify

Run what this repository's `.gitlab-ci.yml` runs, as far as the tools and services here allow.
Usually that means:

- `poetry check --lock` and `poetry install`, which proves Artifactory provides every
  dependency;
- `ruff check .`, `ruff format --check .` and `mypy` through `poetry run`;
- the unit tests (`poetry run pytest tests/unit` or what CI runs);
- `docker build` (or `podman build`) with the private Dockerfile, for admin and portal.

Integration tests need SQL Server and the Elasticsearch mock; run them only where CI here does
and the services exist. Design has no image; run its docs check. Record each command and
result, and name every check you could not run and why. If Artifactory lacks a package or
version, list the exact `name==version` and stop for that repository: someone must request it.

## Stop and ask

- `status` shows a dirty clone or a merge in progress, or an import merge request is already
  open.
- A first run finds differences beyond the Dockerfile, `.gitlab-ci.yml` and `.github/`.
- GitHub changes the base image or Python version, switches build tool, or adds a system
  package or a CI service that this network may not provide.
- A dependency cannot be installed from Artifactory.
- You cannot tell how to resolve a conflict from the three versions.

## Never

- Copy ZIP contents into a clone by hand, or edit, amend, rebase or squash snapshot commits
  and import merges.
- Import into `main`, push to `main`, merge a merge request, deploy, force-push or delete
  branches.
- Change CI variables, runners or secrets, or write credentials into files or descriptions.

## Report

For each repository: the GitHub range and compare link, the merge request link, conflicts and
how you resolved them, adaptations you ported, hotfixes, checks run and skipped, deploy notes,
and decisions the user must make. Repositories without a ZIP or already up to date: say so.

## Keep this skill current

This skill's source is `.claude/skills/import-github-zips/` in alerts-bi-design. After you
import design, compare that folder in the design clone with the copy you are running. If they
differ, tell the user and offer to replace the installed copy.
