---
name: sync-from-github
description: Imports GitHub ZIP downloads of alerts-bi-design, alerts-bi-admin and alerts-bi-portal into their private-network GitLab clones, keeping the private adaptations (Dockerfile, GitLab CI), and opens one GitLab merge request per repository. Use in the private network when the user hands over GitHub ZIPs of these repositories or asks to update, sync or migrate their code from GitHub.
---

# Sync from GitHub

The code is developed on GitHub and arrives here as GitHub "Download ZIP" archives. Each
private repository adapts a few files to this network: its Dockerfile, and GitLab CI
(`.gitlab-ci.yml`) in place of GitHub Actions. Bring in every GitHub change, keep those
adaptations, and leave one merge request per repository for the user to review.

## How the import tracks what changed

`scripts/github_sync.py` (Python 3 standard library) commits each ZIP, untouched, as a
*snapshot* commit whose parent is the previously imported snapshot. It then merges that
snapshot into a sync branch made from `main`, so git compares GitHub's changes with the
previous snapshot:

- changed only on GitHub → taken (code, tests, docs, wheels, deletions, renames)
- changed only here → kept (the adaptations, plus any local hotfix)
- changed on both sides → a conflict, or an automatic merge that you must still review

Only the script writes snapshots. Never copy ZIP contents into a clone, edit a snapshot
commit, or rebase a sync branch. The merge request must be merged with a merge commit and
never squashed or rebased, because the next import finds its base through the snapshot in
`main`'s history.

## Before you start

- Get one GitHub ZIP per repository, such as `alerts-bi-admin-main.zip` or
  `alerts-bi-admin-<sha>.zip`. If the user gives one outer archive, extract it into a new
  empty directory outside the clones. Do not repack the GitHub ZIPs: the commit SHA
  is stored in each ZIP's comment.
- Locate the private clone of each repository (GitLab `origin`); ask if it is unclear.
- Set `S` to this skill's `scripts/github_sync.py` and identify the archives:
  `python3 $S inspect <zip>...`. An archive without a `github_commit` needs the full SHA
  from the user, passed as `--github-commit`.

## For each repository, in order: design, admin, portal

1. **Prepare the clone.** Run `git fetch origin` and use `origin/main` as the target (check
   `git symbolic-ref refs/remotes/origin/HEAD` if the default branch is not `main`). Then run
   `python3 $S status --repo <clone> --repository <name>`. Stop and ask if `clean` is false, a
   merge is in progress, or local `main` has commits that `origin/main` lacks. If
   `needs_baseline` is true, this is the first import: follow
   [references/first-run.md](references/first-run.md), then continue here.
2. **Import.** Name the branch `chore/sync-github-<first 8 characters of the GitHub commit>`:
   `python3 $S import --repo <clone> --repository <name> --zip <zip> --branch <branch>`.
   Save the JSON output: it drives the rest of the work and the merge request description.
   `up_to_date: true` means there is nothing to do for this repository.
3. **Resolve and review**, following the rules below and
   [references/adaptations.md](references/adaptations.md):
   - every path in `conflicts`;
   - every path in `review_auto_merged`: both sides changed it and git merged it, so check
     the result;
   - every `container` and `ci` entry in `upstream_changes`, even without overlap. A new top-level
     directory may need a `COPY`, and a new GitHub check may need a GitLab job.
4. **Verify.** Run the commands this repository's `.gitlab-ci.yml` runs, locally, as far as
   the available tools and services allow. Typically that is `poetry check --lock`,
   `poetry sync`, `ruff format --check .`, `ruff check .`, `mypy`, unit tests and
   `poetry build`, plus a `docker` or `podman` build of the private Dockerfile. Record each
   command and its result, and name every check that could not run and why.
5. **Commit.** Run `git commit --no-edit`; the script prepared the merge message. Put any extra
   fix in a further commit on the same branch.
6. **Push and open the merge request** as described in
   [references/merge-request.md](references/merge-request.md). Open it as a draft when a
   check failed or a decision is still open, and say why.

Finish with a report to the user for each repository: the GitHub commit range, the merge
request link, conflicts and how you resolved them, adaptations you ported, checks run and
skipped, deploy notes, and decisions the user must make.

## Rules

- GitHub wins for code, tests, docs, contracts, migrations, dependency files and vendored
  wheels, unless the private side changed the same file (`private_changes`).
- The private side wins for its adaptations: the Dockerfile's environment lines (base image
  registry, package mirror, proxy, CA certificates) and `.gitlab-ci.yml`. Port GitHub's
  structural intent into them; never copy GitHub's version over them.
- A file in `private_changes` that is not an adaptation is a local hotfix. If GitHub's new
  version already contains the same fix, take GitHub's version. Otherwise keep both changes
  and flag the file in the merge request. If you cannot tell, ask.
- `.github/` is not used here. Take GitHub's changes to it as they come; if the private
  repository deleted it, keep it deleted. Translate meaningful workflow changes into
  `.gitlab-ci.yml`.
- When GitHub adds a file that its private counterparts adapt, such as another Dockerfile or
  workflow, adapt it the same way or flag it.

## Stop and ask

- The ZIP belongs to a different repository than the clone's earlier imports, or it is older
  than the last import (the script refuses both).
- On a first run, the private tree differs from the baseline ZIP beyond the adaptations.
- GitHub changes the base image or Python version, switches build tooling, or adds a system
  package or a CI service that this network may not provide.
- A dependency cannot be installed from the private package mirror.
- You cannot determine the right resolution of a conflict from both versions.

## Never

- Push to `main`, merge a merge request, deploy, or delete branches.
- Force-push, `git reset --hard`, rebase, or amend snapshot commits.
- Change CI variables, runners or secrets, or write credentials into files or descriptions.

## Keep this skill current

This skill lives in `alerts-bi-design` at `.claude/skills/sync-from-github/`. After importing
design, compare that folder with the copy you are running. If they differ, tell the user to
replace the installed copy.
