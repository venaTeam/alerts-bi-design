# Moving GitHub changes into the private network

Development happens on GitHub. Deployment happens in a private network that has its own
GitLab, OpenShift and a Claude Code agent. Code crosses as GitHub ZIP downloads. In the
private network, the [`sync-from-github`](../.claude/skills/sync-from-github/SKILL.md) skill
imports them and opens one GitLab merge request per repository.

Each private repository keeps a few adaptations that never come from GitHub: its Dockerfile
(internal base image registry, package mirror, certificates) and GitLab CI
(`.gitlab-ci.yml`) in place of `.github/workflows`. Everything else is GitHub's code.

## Each delivery

1. On GitHub, download each changed repository from `main` with **Code → Download ZIP**.
   For an exact commit, use `https://github.com/venaTeam/<repository>/archive/<sha>.zip`.
   Keep the ZIPs as GitHub made them, because each ZIP's comment records its commit SHA.
   Putting them together in one outer archive is fine.
2. Carry the ZIPs into the private network.
3. Give them to Claude Code there, with the private clones of the repositories at hand. Ask
   it to sync them from GitHub.
4. Review each merge request: its description lists conflicts, adaptations it ported, checks
   and deploy notes. **Merge with a merge commit, not squash or rebase.** Then deploy as
   usual.

## How the agent tells our changes from private adaptations

A GitHub ZIP has no history. So the import commits each ZIP, untouched, as a *snapshot*
commit on top of the previous snapshot, and merges it into a branch from `main`. Git then
compares GitHub's change with the previous snapshot:

- a file changed only on GitHub is taken;
- a file changed only in the private network is kept;
- a file changed on both sides is a conflict, which the agent resolves by the skill's rules.
  It keeps the private adaptation and ports GitHub's structural change, such as a new `COPY`
  or a new check step in GitLab CI.

The snapshot reaches `main` through the merge commit, and the next import uses it as its
starting point. A squashed or rebased merge request removes it, and the next import then
starts from an older snapshot.

## First time

A private repository that was never imported this way needs a baseline: the GitHub commit
its code currently contains. Bring a ZIP of exactly that commit. The agent lists every file
where the private code differs from it, and asks before recording it. Only the Dockerfile and
CI files should differ.

## Installing the skill in the private network

The skill arrives with the `alerts-bi-design` ZIP at `.claude/skills/sync-from-github/`. Do
one of the following:

- Copy that folder to `~/.claude/skills/sync-from-github/` on the private machine. Replace it
  when the agent reports that the imported copy has changed.
- Start Claude Code in the private design clone and add the other clones with `--add-dir`.

The skill needs `git` and Python 3. `glab` lets it create merge requests with a full
description. Without `glab`, it creates them through GitLab push options and hands you the
description to paste.

## Making imports smooth from this side

- When a change needs new settings, migrations or deployment steps, describe them in the
  repository: for example, `docs/admin-env-changes.md` or a handoff under `docs/handoffs/`.
  The agent copies these into the merge request's deploy notes.
- When a Dockerfile or CI change is needed here, state its intent in the commit message (for
  example "copy the new compat/ directory"). The agent ports the intent, not the text.
