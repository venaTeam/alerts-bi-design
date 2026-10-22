# Push and open the merge request

Push the branch with git; it carries the snapshot commits with it:

```bash
git -C <clone> push -u origin <branch>
```

Then create the merge request with the GitLab MCP:

- source branch `<branch>`, target branch `main`;
- title `Import GitHub <repository> <old 8>..<new 8>`, prefixed with `Draft: ` when a check
  that this import could break failed, or a decision about this import is still open. Checks
  that could not run here and problems that were already on `main` do not make it a draft;
  list them;
- the description below;
- squash off; deleting the source branch after merge is fine.

If the MCP cannot create merge requests, give the user the branch name, the title and the
description. After creating it, read the merge request's pipeline status once through the MCP
and report it. If the pipeline is still running, report its link.

If GitLab later reports conflicts with `main` or asks for a rebase, never rebase. Run
`git merge origin/main` on the branch, resolve with the same rules, and push again.

## Description

```markdown
## GitHub import

- Repository: <repository>
- GitHub: <old commit> → <new commit> (<compare link from the JSON>)
- Changed on GitHub: <count> files (<category: count, ...>)
- Baseline recorded in this merge request: <commit, or "no">

## Summary

<one line per change note: its title and what changed; "No change notes" if there are none>

> Merge with a merge commit. Do not squash or rebase: the next import finds its starting
> point through the snapshot commit on this branch. The "GitHub snapshot" commits contain
> GitHub's tree as it was and are not meant to be reviewed; review the merge commit.

## Private adaptations

- Kept: <private_changes paths>
- Ported from GitHub: <each Dockerfile or GitLab CI change and how it was written here>
- Conflicts: <path: decision and reason>
- Hotfixes: <path: kept, replaced by GitHub's fix, or needs a decision>

## Deploy notes

<one line per row below; "No change" where nothing changed>

## Checks

| Command | Result |
|---|---|
| <command> | <passed / failed: summary> |

Not run: <command: reason>

## Needs a decision

<items, or "Nothing">
```

## Deploy notes

Start from the change notes' "Deploy" and "Private network" sections, then add what the
import JSON shows and no note mentions. Read other release documents only for changes no note
covers: `releases/*` in design, and `docs/*env-changes.md`, `docs/handoffs/*` and
`docs/upstream/*` in admin and portal. Copy the deployment steps that apply to this
repository. For a step that belongs to another repository, name that repository's merge
request instead of repeating the step. When the release notes give an order across
repositories, state it in every affected merge request. Without one, deploy admin before
portal when both change migrations or contracts.

| JSON | Tell the person deploying |
|---|---|
| `new_migration_files` | The new migrations. Admin applies them with `alerts-bi-admin db setup` (its init container does this on deploy). Migrations are not rolled back, so a database backup must exist first |
| `environment_keys` | Each key added or removed, per template file, and the ConfigMap or Secret entry it needs |
| `github_changes.paths.dependencies` | New or changed packages, and whether Artifactory provided them |
| `github_changes.paths.container` | What changed in the image and what you ported into the private Dockerfile |
| `github_changes.paths.deployment` | Changes under `deploy/` that the private OpenShift configuration may need |
| `github_changes.paths.contracts` | Changed SQL view or API contracts |
| `github_changes.paths.config` | Changes to `config/teams.json` or its schema |
