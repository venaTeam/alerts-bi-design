# Push and open the merge request

Push the branch with git; it carries the snapshot commits with it:

```bash
git -C <clone> push -u origin <branch>
```

Then create the merge request with the GitLab MCP:

- source branch `<branch>`, target branch `main`;
- title `Import GitHub <repository> <old 8>..<new 8>`, prefixed with `Draft: ` when a check
  failed or a decision is still open;
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

Build them from the import JSON. Also read new or changed GitHub documents that describe a
release: `releases/*` in design, and `docs/*env-changes.md`, `docs/handoffs/*` and
`docs/upstream/*` in admin and portal. Copy their deployment steps.

| JSON | Tell the person deploying |
|---|---|
| `new_migrations` | The new migration files. Admin applies them with `alerts-bi-admin db setup` (its init container does this on deploy). Migrations are not rolled back, so a database backup must exist first |
| `environment_keys` | Each key added or removed, and the ConfigMap or Secret entry it needs |
| `dependencies` | New or changed packages, and whether Artifactory provided them |
| `container` | What changed in the image and what you ported into the private Dockerfile |
| `deployment` | Changes under `deploy/` that the private OpenShift configuration may need |
| `contracts` | Changed SQL view or API contracts. Deploy admin before portal when portal depends on them |
| `config` | Changes to `config/teams.json` or its schema |
