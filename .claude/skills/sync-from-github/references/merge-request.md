# Push and open the merge request

Push only the sync branch. It carries the snapshot commits with it.

With `glab` installed and authenticated:

```bash
git push -u origin <branch>
glab mr create --source-branch <branch> --target-branch main --title "<title>" --description "$(cat <description file>)" --remove-source-branch --yes
```

Add `--draft` when a check failed or a decision is open. Never pass `--squash-before-merge`.

Without `glab`, let GitLab create the merge request through push options:

```bash
git push -u origin <branch> -o merge_request.create -o merge_request.target=main -o "merge_request.title=<title>" -o merge_request.remove_source_branch
```

Push options cannot carry a multi-line description. Give the user the description to paste,
and the merge request link from the push output. If neither way works, give the user the
branch name and the description.

Title: `Sync <repository> with GitHub <short sha>`, with the prefix `Draft: ` when needed.

## Merge method

GitLab must merge with a merge commit. Squashing, fast-forward merges and rebasing remove
the snapshot from `main`'s history, and the next import then cannot find its base. If the
project's merge method or squash setting would do that, tell the user. If GitLab requires the
branch to be up to date with `main`, run `git merge origin/main` on the sync branch and push
again. Never use rebase.

## Description template

```markdown
## GitHub import

- Repository: <repository>
- GitHub commits: <previous sha> → <new sha>
  (on GitHub: https://github.com/venaTeam/<repository>/compare/<previous sha>...<new sha>)
- Files changed on GitHub: <count>, by category: <category counts>

> Merge with a merge commit. Do not squash, rebase or fast-forward: the next import finds
> its base through the snapshot commit on this branch.

## Private adaptations

- Kept unchanged: <private_changes paths>
- Ported from GitHub: <each Dockerfile or CI change, and how it was ported>
- Conflicts: <path: what you decided and why>
- Local hotfixes: <path: kept, replaced by GitHub's fix, or needs a decision>

## Deploy notes

<one line per category from adaptations.md; "No change" where nothing changed>

## Checks

| Command | Result |
|---|---|
| <command> | <passed / failed: summary> |

Not run: <command: reason>

## Needs a decision

<items, or "Nothing">
```
