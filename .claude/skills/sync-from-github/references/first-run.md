# First run: record the baseline

A clone without any `GitHub-Snapshot` commit in its history has not been imported with this
skill. Before the first import, record which GitHub commit the private code already contains.
A wrong baseline is silent and lasting: every later import would skip GitHub changes, or undo
private work. Do not guess it.

1. Ask the user which GitHub commit each private repository currently matches. You need a ZIP
   of exactly that commit (`https://github.com/venaTeam/<repository>/archive/<sha>.zip`). If
   the private code was last updated from the ZIP being imported now, that ZIP is also the
   baseline.
2. Dry run:
   `python3 $S baseline --repo <clone> --repository <name> --zip <baseline zip> --branch <branch>`.
   It lists every file where the private target differs from that ZIP:
   - `expected`: container and CI files, such as the Dockerfile, `.gitlab-ci.yml` and a
     deleted `.github/`;
   - `unexpected`: everything else.
3. Show the user both lists. If `unexpected` is not empty, either the private code is not at
   that GitHub commit, or it carries local hotfixes. Stop and ask: the user may need a ZIP of
   another commit, or may accept the files as hotfixes.
4. After the user confirms, rerun the same command with `--confirm`. It creates the branch and
   a merge commit that records the snapshot without changing any private file.
5. If a newer ZIP came with this delivery, run `import` with the same `--branch`. It continues
   on that branch; then resume at step 3 of the skill. Otherwise push the branch and open a
   merge request titled `Record GitHub <repository>@<short sha> as the imported baseline`.
