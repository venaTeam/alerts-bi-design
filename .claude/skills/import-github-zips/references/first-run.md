# First run: record the baseline

`status` reports `needs_baseline: true` when no import is recorded in `main`. That happens on
the first run, and after a merge request was squashed or rebased. Before importing, record the
GitHub commit that the private code already contains, called the baseline. A wrong baseline
causes lasting damage without any error: later imports would skip GitHub changes or undo
private work. Never guess it.

1. Ask the user which GitHub commit each repository currently contains, and get a ZIP of
   exactly that commit. If the private code was last updated by hand from a GitHub ZIP, that
   ZIP is the baseline. A ZIP of any commit can be downloaded outside as
   `https://github.com/venaTeam/<repository>/archive/<commit>.zip`.
2. Dry run, which changes nothing:
   `python3 $S baseline --repo <clone> --zip <baseline zip>`.
   It lists every file where `origin/main` differs from the ZIP (`A` exists only here, `D`
   exists only on GitHub, `M` differs):
   - `expected_differences`: the Dockerfile, `.gitlab-ci.yml` and `.github/`;
   - `unexpected_differences`: everything else.
3. Show both lists to the user. If `unexpected_differences` is not empty, stop and ask. Either
   the ZIP is not the commit the private code contains, and the user should bring another
   ZIP, or the files are private hotfixes that the user accepts as such.
4. After the user confirms, record the baseline on a new branch. If a newer ZIP came with this
   delivery, name the branch for that import (`chore/github-import-<8 characters of the newer
   commit>`); otherwise use `chore/github-baseline-<8 characters of the baseline commit>`:
   `python3 $S baseline --repo <clone> --zip <baseline zip> --branch <branch> --confirm`.
   This adds the snapshot and a merge commit that keeps every private file unchanged.
5. With a newer ZIP, run `import` with the same `--branch`. It continues on that branch. Go on
   with step 3 of the skill, and mention the baseline in the merge request.
6. Without a newer ZIP, push the branch and open a merge request titled
   `Record GitHub <repository>@<8 characters> as the import baseline`. It changes no files, and
   it must also be merged with a merge commit.
