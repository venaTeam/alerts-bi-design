#!/usr/bin/env python3
"""Import GitHub ZIP downloads into private clones as snapshot commits.

Each import commits the untouched ZIP contents as a snapshot whose only parent is the
previously imported snapshot, then merges it into a sync branch made from the private
target branch. Git therefore compares GitHub's changes with the previous snapshot:
files changed only on GitHub are taken, files changed only in the private repository
(its Dockerfile, its GitLab CI) are kept, and files changed on both sides conflict or
are merged for review.

Standard library only. Results are JSON on stdout. A refusal exits with status 1 and a
message on stderr; nothing is changed after a refusal.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

SNAPSHOT_TRAILER = "GitHub-Snapshot"
IMPORT_TRAILER = "GitHub-Import"
SNAPSHOT_REF = "refs/github-sync/snapshot"
KNOWN_REPOSITORIES = ("alerts-bi-admin", "alerts-bi-portal", "alerts-bi-design")
# Categories whose differences a baseline is expected to show: the private adaptations.
ADAPTATION_CATEGORIES = ("container", "ci")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
ENV_KEY_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", re.MULTILINE)


class SyncError(Exception):
    """The import must stop; the message says why and what to do."""


@dataclass(frozen=True)
class Snapshot:
    zip_path: Path
    repository: str
    ref: str
    commit: str | None
    files: dict[str, tuple[str, bytes]]  # path -> (git mode, content)


@dataclass(frozen=True)
class Imported:
    snapshot: str  # private commit holding the snapshot
    github_commit: str


# ---- git ----


def git(repo: Path, *args: str, stdin: bytes | None = None, check: bool = True) -> bytes:
    result = subprocess.run(["git", "-C", str(repo), *args], input=stdin, capture_output=True)
    if check and result.returncode != 0:
        detail = result.stderr.decode("utf-8", "replace").strip()
        raise SyncError(f"git {' '.join(args[:3])} failed: {detail}")
    return result.stdout


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).decode("utf-8", "replace").strip()


def git_ok(repo: Path, *args: str) -> bool:
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True).returncode == 0


def resolve(repo: Path, rev: str) -> str:
    if not git_ok(repo, "rev-parse", "--verify", "--quiet", f"{rev}^{{commit}}"):
        raise SyncError(f"{rev} does not exist in {repo}; run git fetch or pass --target")
    return git_text(repo, "rev-parse", f"{rev}^{{commit}}")


def branch_exists(repo: Path, branch: str) -> bool:
    return git_ok(repo, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}")


def require_clean(repo: Path) -> None:
    if git_ok(repo, "rev-parse", "--verify", "--quiet", "MERGE_HEAD"):
        raise SyncError("a merge is already in progress; finish or abort it first")
    if git_text(repo, "status", "--porcelain", "--untracked-files=no"):
        raise SyncError("the working tree has uncommitted changes; ask the user before continuing")


def check_branch(repo: Path, branch: str) -> bool:
    """True when `branch` is checked out to continue; refuses an existing branch elsewhere."""
    if git_text(repo, "branch", "--show-current") == branch:
        return True
    if branch_exists(repo, branch):
        raise SyncError(
            f"branch {branch} already exists; switch to it to continue, or pick a new name"
        )
    return False


def checkout_branch(repo: Path, branch: str, target: str) -> None:
    if not check_branch(repo, branch):
        git(repo, "switch", "--no-track", "-c", branch, target)


def tree(repo: Path, commit: str) -> str:
    return git_text(repo, "rev-parse", f"{commit}^{{tree}}")


def last_import(repo: Path, rev: str, repository: str | None) -> tuple[Imported | None, list[str]]:
    """Newest snapshot of `repository` in rev's history, and every GitHub commit imported."""
    log = git(
        repo,
        "log",
        "--topo-order",
        "--extended-regexp",
        f"--grep=^{SNAPSHOT_TRAILER}: ",
        "--format=%H%x1f%B%x1e",
        rev,
    ).decode("utf-8", "replace")
    found: Imported | None = None
    imported: list[str] = []
    others: set[str] = set()
    pattern = re.compile(rf"^{SNAPSHOT_TRAILER}:\s*(\S+)@([0-9a-f]{{40}})\s*$", re.MULTILINE)
    for record in log.split("\x1e"):
        if "\x1f" not in record:
            continue
        commit, body = record.strip().split("\x1f", 1)
        for name, github_commit in pattern.findall(body):
            if repository is None or name == repository:
                imported.append(github_commit)
                if found is None:
                    found = Imported(commit, github_commit)
                    repository = name
            else:
                others.add(name)
    if found is None and others:
        raise SyncError(
            f"this clone holds imports of {', '.join(sorted(others))}, not {repository}"
        )
    return found, imported


def name_status(repo: Path, old: str, new: str) -> list[dict[str, str]]:
    tokens = git(repo, "diff", "--name-status", "-z", "-M", old, new).decode("utf-8").split("\0")
    entries: list[dict[str, str]] = []
    i = 0
    while i < len(tokens) and tokens[i]:
        status = tokens[i]
        if status[0] in "RC":
            entry = {"status": status[0], "old_path": tokens[i + 1], "path": tokens[i + 2]}
            i += 3
        else:
            entry = {"status": status, "path": tokens[i + 1]}
            i += 2
        entry["category"] = categorize(entry["path"])
        entries.append(entry)
    return entries


def show(repo: Path, rev: str, path: str) -> str | None:
    if not git_ok(repo, "cat-file", "-e", f"{rev}:{path}"):
        return None
    return git(repo, "show", f"{rev}:{path}").decode("utf-8", "replace")


def identity(repo: Path) -> tuple[str, str]:
    def config(key: str, default: str) -> str:
        value = git(repo, "config", key, check=False).decode("utf-8", "replace").strip()
        return re.sub(r"[<>\n]", "", value) or default

    return config("user.name", "GitHub sync"), config("user.email", "github-sync@localhost")


# ---- ZIP archives ----


def split_prefix(prefix: str, repository: str | None, commit: str | None) -> tuple[str, str]:
    """GitHub names the folder <repo>-<ref>; API zipballs use <owner>-<repo>-<short sha>."""
    names = (repository,) if repository else KNOWN_REPOSITORIES
    for name in names:
        if prefix.startswith(f"{name}-"):
            return name, prefix[len(name) + 1 :]
        owner_form = re.match(rf"^[^/]+-{re.escape(name)}-(.+)$", prefix)
        if owner_form:
            return name, owner_form.group(1)
    if repository:
        raise SyncError(f"the ZIP folder {prefix!r} does not belong to {repository}")
    if commit and prefix.endswith(f"-{commit}"):
        return prefix[: -len(commit) - 1], commit
    raise SyncError(f"cannot tell the repository from the ZIP folder {prefix!r}; pass --repository")


def check_path(path: str) -> None:
    parts = PurePosixPath(path).parts
    unsafe = (
        not path
        or path.startswith("/")
        or "\\" in path
        or "\0" in path
        or re.match(r"^[A-Za-z]:", path)
        or any(part in ("", ".", "..") for part in path.split("/"))
        or parts[0] == ".git"
    )
    if unsafe:
        raise SyncError(f"refusing unsafe path in ZIP: {path!r}")


def file_mode(info: zipfile.ZipInfo) -> str:
    unix = info.external_attr >> 16
    if info.create_system == 3 and unix:
        if stat.S_ISLNK(unix):
            return "120000"
        if unix & 0o111:
            return "100755"
    return "100644"


def load_zip(path: Path, repository: str | None, github_commit: str | None) -> Snapshot:
    if not zipfile.is_zipfile(path):
        raise SyncError(f"{path} is not a ZIP archive")
    with zipfile.ZipFile(path) as archive:
        infos = [info for info in archive.infolist() if not info.is_dir()]
        if infos and all(info.filename.lower().endswith(".zip") for info in infos):
            raise SyncError(
                f"{path} only holds other archives; extract it into a new empty directory "
                "outside the clones and pass the GitHub ZIPs inside it"
            )
        prefixes = {info.filename.split("/", 1)[0] for info in archive.infolist()}
        if len(prefixes) != 1 or not infos:
            raise SyncError(f"{path} is not a GitHub ZIP: expected one top-level folder")
        prefix = prefixes.pop()
        comment = archive.comment.decode("ascii", "replace").strip()
        commit = github_commit or (comment if SHA_RE.match(comment) else None)
        name, ref = split_prefix(prefix, repository, commit)
        if commit is None and SHA_RE.match(ref):
            commit = ref
        files: dict[str, tuple[str, bytes]] = {}
        for info in infos:
            relative = info.filename[len(prefix) + 1 :]
            check_path(relative)
            if relative in files:
                raise SyncError(f"{path} lists {relative} twice")
            files[relative] = (file_mode(info), archive.read(info))
    if commit is not None and not SHA_RE.match(commit):
        raise SyncError(f"{commit!r} is not a full 40-character commit SHA")
    return Snapshot(path, name, ref, commit, files)


def require_commit(snapshot: Snapshot) -> str:
    if snapshot.commit is None:
        raise SyncError(
            f"{snapshot.zip_path} does not record its GitHub commit (no ZIP comment); "
            "ask the user for the full SHA and pass --github-commit"
        )
    return snapshot.commit


def fast_import_path(path: str) -> bytes:
    if path.startswith('"') or "\n" in path:
        escaped = path.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        return f'"{escaped}"'.encode()
    return path.encode()


def write_snapshot(repo: Path, snapshot: Snapshot, parent: str | None) -> str:
    """Commit the ZIP contents byte for byte, without touching the working tree."""
    commit = require_commit(snapshot)
    message = (
        f"GitHub snapshot {snapshot.repository}@{commit[:12]}\n\n"
        f"Untouched contents of {snapshot.zip_path.name} (GitHub ref {snapshot.ref}).\n"
        "Do not edit; private adaptations belong on the merge side.\n\n"
        f"{SNAPSHOT_TRAILER}: {snapshot.repository}@{commit}\n"
    ).encode()
    name, email = identity(repo)
    stream = bytearray()
    stream += f"reset {SNAPSHOT_REF}\ncommit {SNAPSHOT_REF}\n".encode()
    stream += f"committer {name} <{email}> {int(time.time())} +0000\n".encode()
    stream += b"data %d\n%s\n" % (len(message), message)
    if parent:
        stream += f"from {parent}\n".encode()
    stream += b"deleteall\n"
    for path in sorted(snapshot.files):
        mode, data = snapshot.files[path]
        stream += b"M %s inline %s\ndata %d\n%s\n" % (
            mode.encode(),
            fast_import_path(path),
            len(data),
            data,
        )
    stream += b"done\n"
    git(repo, "fast-import", "--quiet", "--force", "--done", stdin=bytes(stream))
    created = resolve(repo, SNAPSHOT_REF)
    verify_snapshot(repo, created, snapshot)
    return created


def verify_snapshot(repo: Path, commit: str, snapshot: Snapshot) -> None:
    algorithm = git_text(repo, "rev-parse", "--show-object-format") or "sha1"
    expected = {
        path: (mode, hashlib.new(algorithm, b"blob %d\0" % len(data) + data).hexdigest())
        for path, (mode, data) in snapshot.files.items()
    }
    actual: dict[str, tuple[str, str]] = {}
    for line in git(repo, "ls-tree", "-r", "-z", "--full-tree", commit).decode("utf-8").split("\0"):
        if line:
            meta, path = line.split("\t", 1)
            mode, _kind, blob = meta.split()
            actual[path] = (mode, blob)
    if actual != expected:
        differing = sorted(set(actual.items()) ^ set(expected.items()))[:5]
        raise SyncError(f"snapshot does not match the ZIP byte for byte: {differing}")


# ---- reporting ----


def categorize(path: str) -> str:
    """Group a changed path by what it means for the private network."""
    p = PurePosixPath(path)
    name, top, folders = p.name, p.parts[0], p.parts[:-1]
    if name.startswith(("Dockerfile", "Containerfile")) or name == ".dockerignore":
        return "container"
    if top in (".github", ".gitlab") or name == ".gitlab-ci.yml":
        return "ci"
    if "migrations" in folders or name == "alembic.ini":
        return "migrations"
    if name in ("pyproject.toml", "poetry.lock", "uv.lock") or top == "vendor":
        return "dependencies"
    if name.startswith("requirements") and name.endswith(".txt"):
        return "dependencies"
    if name.startswith(".env") or name == "config.py" or p.match("config/env.py"):
        return "environment"
    if top == "deploy" or name.startswith(("docker-compose", "compose.")):
        return "deployment"
    if "contracts" in folders or name in ("sql-views.json", "teams.schema.json"):
        return "contracts"
    if path == "config/teams.json":
        return "registry"
    if name in ("AGENTS.md", "CLAUDE.md") or top == ".claude":
        return "agent-instructions"
    if top in ("tests", "test"):
        return "tests"
    if top in ("docs", "decisions", "releases") or name.endswith(".md"):
        return "docs"
    return "code"


def by_category(entries: list[dict[str, str]]) -> dict[str, list[dict[str, str]]]:
    grouped: dict[str, list[dict[str, str]]] = {}
    for entry in entries:
        grouped.setdefault(entry["category"], []).append(entry)
    return dict(sorted(grouped.items()))


def environment_keys(
    repo: Path, old: str, new: str, entries: list[dict[str, str]]
) -> dict[str, Any]:
    """Settings added to or removed from .env templates between two commits."""
    changes: dict[str, Any] = {}
    for entry in entries:
        if not PurePosixPath(entry["path"]).name.startswith(".env"):
            continue
        before = set(
            ENV_KEY_RE.findall(show(repo, old, entry.get("old_path", entry["path"])) or "")
        )
        after = set(ENV_KEY_RE.findall(show(repo, new, entry["path"]) or ""))
        if before != after:
            changes[entry["path"]] = {
                "added": sorted(after - before),
                "removed": sorted(before - after),
            }
    return changes


def emit(payload: dict[str, Any]) -> None:
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")


# ---- commands ----


def cmd_inspect(args: argparse.Namespace) -> None:
    results: list[dict[str, Any]] = []
    for path in args.zips:
        try:
            snapshot = load_zip(Path(path), args.repository, None)
            results.append(
                {
                    "zip": path,
                    "repository": snapshot.repository,
                    "ref": snapshot.ref,
                    "github_commit": snapshot.commit,
                    "files": len(snapshot.files),
                }
            )
        except SyncError as error:
            results.append({"zip": path, "error": str(error)})
    emit({"archives": results})


def cmd_status(args: argparse.Namespace) -> None:
    repo = Path(args.repo)
    target = resolve(repo, args.target)
    found, imported = last_import(repo, target, args.repository)
    emit(
        {
            "target": args.target,
            "target_commit": target,
            "current_branch": git_text(repo, "branch", "--show-current"),
            "clean": not git_text(repo, "status", "--porcelain", "--untracked-files=no"),
            "merge_in_progress": git_ok(repo, "rev-parse", "--verify", "--quiet", "MERGE_HEAD"),
            "last_import": None
            if found is None
            else {"snapshot": found.snapshot, "github_commit": found.github_commit},
            "imports_in_history": len(imported),
            "needs_baseline": found is None,
        }
    )


def cmd_baseline(args: argparse.Namespace) -> None:
    repo = Path(args.repo)
    snapshot = load_zip(Path(args.zip), args.repository, args.github_commit)
    commit = require_commit(snapshot)
    target = resolve(repo, args.target)
    history = "HEAD" if check_branch(repo, args.branch) else target
    found, _ = last_import(repo, history, snapshot.repository)
    if found is not None:
        raise SyncError(
            f"{history} already records GitHub {snapshot.repository}@{found.github_commit}; "
            "use the import command"
        )
    seed = write_snapshot(repo, snapshot, parent=None)
    differences = name_status(repo, seed, resolve(repo, history))
    expected = [entry for entry in differences if entry["category"] in ADAPTATION_CATEGORIES]
    unexpected = [entry for entry in differences if entry["category"] not in ADAPTATION_CATEGORIES]
    result: dict[str, Any] = {
        "repository": snapshot.repository,
        "github_commit": commit,
        "target": args.target,
        "snapshot": seed,
        "differences_from_github": {"expected": expected, "unexpected": unexpected},
        "confirmed": False,
    }
    if not args.confirm:
        result["next"] = (
            "Show the user these differences. Rerun with --confirm only after they agree that "
            "the private target contains exactly this GitHub commit plus its adaptations."
        )
        emit(result)
        return
    require_clean(repo)
    checkout_branch(repo, args.branch, target)
    message = (
        f"Record GitHub {snapshot.repository}@{commit[:12]} as the imported baseline\n\n"
        "The private tree is kept unchanged; later imports merge GitHub changes made after\n"
        "this commit.\n\n"
        f"{IMPORT_TRAILER}: {snapshot.repository}@{commit}\n"
    )
    git(repo, "merge", "--no-ff", "--allow-unrelated-histories", "-s", "ours", "-m", message, seed)
    result.update(confirmed=True, branch=args.branch, baseline_commit=resolve(repo, "HEAD"))
    result["next"] = "Run import with the same --branch for a newer ZIP, or push this branch."
    emit(result)


def cmd_import(args: argparse.Namespace) -> None:
    repo = Path(args.repo)
    snapshot = load_zip(Path(args.zip), args.repository, args.github_commit)
    commit = require_commit(snapshot)
    target = resolve(repo, args.target)
    history = "HEAD" if check_branch(repo, args.branch) else target
    found, imported = last_import(repo, history, snapshot.repository)
    if found is None:
        raise SyncError(f"no GitHub import recorded in {args.target}; record a baseline first")
    result: dict[str, Any] = {
        "repository": snapshot.repository,
        "github_commit": commit,
        "previous_github_commit": found.github_commit,
        "target": args.target,
    }
    if commit == found.github_commit:
        emit({**result, "up_to_date": True})
        return
    if commit in imported:
        raise SyncError(
            f"GitHub {commit} was imported before {found.github_commit}; this ZIP is older"
        )
    require_clean(repo)
    created = write_snapshot(repo, snapshot, parent=found.snapshot)
    if tree(repo, created) == tree(repo, found.snapshot):
        emit({**result, "up_to_date": True, "note": "the ZIP has no file changes"})
        return
    checkout_branch(repo, args.branch, target)
    head = resolve(repo, "HEAD")
    message = (
        f"Merge GitHub {snapshot.repository}@{commit[:12]} into {args.target.removeprefix('origin/')}\n\n"
        f"Previous import: {snapshot.repository}@{found.github_commit}\n\n"
        f"{IMPORT_TRAILER}: {snapshot.repository}@{commit}\n"
    )
    merge = subprocess.run(
        ["git", "-C", str(repo), "merge", "--no-ff", "--no-commit", "-m", message, created],
        capture_output=True,
    )
    conflicts = [
        path
        for path in git(repo, "diff", "--name-only", "--diff-filter=U", "-z").decode().split("\0")
        if path
    ]
    if merge.returncode != 0 and not conflicts:
        raise SyncError(f"git merge failed: {merge.stderr.decode('utf-8', 'replace').strip()}")
    base = git_text(repo, "merge-base", head, created)
    upstream = name_status(repo, base, created)
    private = name_status(repo, base, head)
    both = {entry["path"] for entry in upstream} & {entry["path"] for entry in private}
    result.update(
        up_to_date=False,
        branch=args.branch,
        snapshot=created,
        base=base,
        base_is_previous_snapshot=base == found.snapshot,
        merge_status="conflicts" if conflicts else "merged, not committed",
        conflicts=conflicts,
        review_auto_merged=sorted(both - set(conflicts)),
        upstream_changes=by_category(upstream),
        upstream_change_count=len(upstream),
        private_changes=private,
        environment_keys=environment_keys(repo, base, created, upstream),
        next="Resolve conflicts, review container/ci changes, run checks, then git commit --no-edit",
    )
    emit(result)


def cmd_impact(args: argparse.Namespace) -> None:
    repo = Path(args.repo)
    old, new = resolve(repo, args.old), resolve(repo, args.new)
    entries = name_status(repo, old, new)
    emit(
        {
            "from": old,
            "to": new,
            "changes": by_category(entries),
            "environment_keys": environment_keys(repo, old, new, entries),
        }
    )


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = root.add_subparsers(dest="command", required=True)

    inspect = commands.add_parser("inspect", help="identify GitHub ZIPs")
    inspect.add_argument("zips", nargs="+")
    inspect.add_argument("--repository")
    inspect.set_defaults(run=cmd_inspect)

    def clone_options(command: argparse.ArgumentParser) -> None:
        command.add_argument("--repo", required=True, help="path of the private clone")
        command.add_argument("--target", default="origin/main", help="private branch to merge into")
        command.add_argument("--repository", help="GitHub repository name, e.g. alerts-bi-admin")

    status = commands.add_parser("status", help="show the last imported GitHub commit")
    clone_options(status)
    status.set_defaults(run=cmd_status)

    for name, run, help_text in (
        ("baseline", cmd_baseline, "first run: record a ZIP as already contained in the target"),
        ("import", cmd_import, "commit a ZIP snapshot and merge it into the sync branch"),
    ):
        command = commands.add_parser(name, help=help_text)
        clone_options(command)
        command.add_argument("--zip", required=True)
        command.add_argument("--branch", required=True, help="sync branch to create or continue")
        command.add_argument("--github-commit", help="full SHA when the ZIP lacks its comment")
        if name == "baseline":
            command.add_argument("--confirm", action="store_true")
        command.set_defaults(run=run)

    impact = commands.add_parser("impact", help="categorize the changes between two commits")
    impact.add_argument("--repo", required=True)
    impact.add_argument("old")
    impact.add_argument("new")
    impact.set_defaults(run=cmd_impact)
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        args.run(args)
    except SyncError as error:
        print(f"github_sync: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
