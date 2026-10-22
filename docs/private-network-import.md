# Importing GitHub changes into the private network

Development happens on GitHub. Deployment happens in a private network with its own GitLab,
Artifactory, OpenShift and Claude Code agent. Code crosses as GitHub ZIP downloads of `main`,
not commit by commit. Inside, the
[`import-github-zips`](../.claude/skills/import-github-zips/SKILL.md) skill imports the ZIPs
and opens one GitLab merge request per repository.

## Each delivery

1. On GitHub, download each repository that changed from `main` with **Code → Download
   ZIP**: one to three ZIPs. Keep them as GitHub made them, because each ZIP's comment
   records its commit. For an exact commit, use
   `https://github.com/venaTeam/<repository>/archive/<commit>.zip`.
2. Carry the ZIPs into the private network.
3. Start Claude Code in the private workspace folder that holds the three clones, and ask it
   to import the ZIPs from GitHub.
4. Review each merge request. Its description lists conflicts, adaptations it ported,
   hotfixes, checks and deploy notes. **Merge with a merge commit, never squash or rebase.**
   Then deploy as usual.

## What stays private

- `Dockerfile`: the same logic as GitHub's, with private sources (base image registry,
  Artifactory, certificates).
- `.gitlab-ci.yml`: exists only in the private repositories.

Everything else comes from GitHub, including `.github/`, `AGENTS.md` and `CLAUDE.md`. If the
private copies of the agent instructions get their own wording later, the import keeps it.
A change made directly inside to any other file is a hotfix. The agent keeps it, lists it in
the merge request, and it should also be made on GitHub.

## How the agent tells the two apart

A ZIP has no history. The import commits each ZIP, untouched, as a snapshot commit on top of
the previously imported snapshot, and merges it into a new branch made from `main`. Git then
compares both sides against the previous import:

- changed only on GitHub: taken;
- changed only in the private network: kept;
- changed on both sides: a conflict. The agent resolves it by the skill's rules, usually by
  writing GitHub's Dockerfile change with the private sources.

The snapshot reaches `main` through the merge commit, and the next import starts from it. A
squashed or rebased merge request removes it. The next import then asks for a new baseline.

## Change notes

A ZIP carries no commit messages or pull request descriptions. So every pull request on
GitHub adds a short note, `changes/<date>-<description>.md`, in each repository it changes.
The format is in that repository's `changes/README.md`. The note says what changed, how to
deploy it, and what the private network must do.

The import lists the notes added since the last import. The agent reads them first and builds
the merge request's summary and deploy notes from them. Notes explain intent only: git still
decides what is imported, and the agent flags any note that disagrees with the actual changes.

## First delivery

The private repositories were updated by hand until now, so the first run needs a baseline:
ZIPs of the GitHub commits the private code contains, normally the ZIPs of the last manual
import. Bring them along with the new ZIPs. The agent lists every file where the private code
differs from them. Only the Dockerfile and `.gitlab-ci.yml` should differ; if anything else
does, it stops and asks before recording the baseline.

## Installing the skill

The skill travels in the design ZIP at `.claude/skills/import-github-zips/`. Copy that folder
to `.claude/skills/import-github-zips/` in the private workspace folder, or to
`~/.claude/skills/`. The first time, take it from the design ZIP itself. After each design
import, the agent says when the installed copy is out of date.

The agent needs `git` with push access to GitLab, Python 3.9 or later, Poetry with
Artifactory configured, `docker` or `podman` for image checks, and the GitLab MCP for merge
requests.

## Making imports smooth from this side

- Add a change note to every pull request. Put new settings, migrations, deploy order and
  new packages in it; the agent copies them into the deploy notes.
- Keep Dockerfile changes about logic: what is copied, built and run, and say in the note
  what to port. A change to base images or package sources needs a person inside to
  decide.
- GitHub ZIPs carry no executable bits, so every file is imported as a regular file. No
  repository has executable files today.
