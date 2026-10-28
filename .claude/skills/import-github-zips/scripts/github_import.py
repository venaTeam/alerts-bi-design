"""Import GitHub "Download ZIP" archives into private GitLab clones.

A GitHub ZIP has no history; its archive comment holds the commit it was made from. Each
import commits a ZIP byte for byte as a snapshot commit whose parent is the previously
imported snapshot, then merges that snapshot into a new branch made from the clone's main
branch. Git can then tell what GitHub changed since the last import from what the private
network changed on its own. Every baseline and import merge also writes .github-import.json,
which names the snapshot main should contain; it survives a squash or a revert, so a lost or
reverted snapshot is detected instead of silently becoming the next base.

Commands (each prints one JSON object; exit status 2 means stop, and "error" says why):

  inspect  ZIP...                                   identify archives
  status   --repo CLONE --repository NAME           last imported GitHub commit
  baseline --repo CLONE --zip ZIP [--branch B --confirm] [--reset]
                                                    record what main already contains
  import   --repo CLONE --zip ZIP --branch B [--full] [--confirm-newer]
                                                    merge the ZIP into a new branch
  verify   --repo CLONE --repository NAME           after the merge commit: only private
                                                    paths differ from GitHub's snapshot

Python 3.9+ and git only. Nothing here touches the network.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import zipfile
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any

SNAPSHOT_TRAILER = "GitHub-Commit"
REPOSITORY_TRAILER = "GitHub-Repository"
TIME_TRAILER = "GitHub-Commit-Time"
KIND_TRAILER = "GitHub-Snapshot-Kind"
BASELINE_TRAILER = "GitHub-Baseline"
TEMP_REF = "refs/github-import/tmp"
#: Private-only record of the snapshot main contains; written by every baseline and import.
STATE_FILE = ".github-import.json"
#: Categories reported as counts only (their paths with --full).
COUNT_ONLY = ("code", "tests", "docs")
#: Categories the private network adapts; they may differ from GitHub's snapshot.
ADAPTED = ("container", "ci", "agent-instructions")
#: Differences listed in full by `baseline`; more are counted.
LIST_LIMIT = 50
#: Far above the repositories' size; a ZIP beyond this did not come from them.
MAX_ENTRIES = 50_000
MAX_BYTES = 1 << 30
HEX = re.compile(r"[0-9a-f]{40}|[0-9a-f]{64}")
ENV_KEY = re.compile(rb"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=", re.MULTILINE)


class Stop(Exception):
    """The import must stop; the message says why and what to do."""


class SplitHistory(Stop):
    """Main holds more than one snapshot chain; `baseline --reset` joins them."""


# --------------------------------------------------------------------------- git helpers


def git(repo: Path, *args: str, data: bytes | None = None, check: bool = True) -> bytes:
    env = dict(os.environ, GIT_EDITOR="true", GIT_TERMINAL_PROMPT="0", LC_ALL="C")
    proc = subprocess.run(["git", "-C", str(repo), *args], input=data, capture_output=True, env=env)
    if check and proc.returncode != 0:
        detail = proc.stderr.decode("utf-8", "replace").strip()
        raise Stop(f"git {' '.join(args[:3])} failed: {detail}")
    return proc.stdout


def git_text(repo: Path, *args: str) -> str:
    return git(repo, *args).decode("utf-8", "surrogateescape").strip()


def git_ok(repo: Path, *args: str) -> bool:
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    return (
        subprocess.run(["git", "-C", str(repo), *args], capture_output=True, env=env).returncode
        == 0
    )


def resolve(repo: Path, rev: str) -> str:
    if not git_ok(repo, "rev-parse", "--verify", "--quiet", f"{rev}^{{commit}}"):
        raise Stop(f"{rev} does not exist in {repo}. Run `git fetch origin`, or pass --target.")
    return git_text(repo, "rev-parse", f"{rev}^{{commit}}")


def current_branch(repo: Path) -> str | None:
    name = git(repo, "symbolic-ref", "--quiet", "--short", "HEAD", check=False).decode().strip()
    return name or None


def branch_exists(repo: Path, branch: str) -> bool:
    return git_ok(repo, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}")


def worktree_state(repo: Path) -> dict[str, Any]:
    dirty = git_text(repo, "status", "--porcelain")
    return {
        "clean": not dirty,
        "dirty_paths": dirty.splitlines()[:20],
        "merge_in_progress": git_ok(repo, "rev-parse", "--verify", "--quiet", "MERGE_HEAD"),
        "branch": current_branch(repo),
    }


def require_clean(repo: Path) -> None:
    state = worktree_state(repo)
    if state["merge_in_progress"]:
        raise Stop("A merge is in progress in this clone. Finish or abort it before importing.")
    if not state["clean"]:
        raise Stop(
            "The clone has uncommitted or untracked files: " + "; ".join(state["dirty_paths"])
        )


def object_format(repo: Path) -> str:
    fmt = git(repo, "rev-parse", "--show-object-format", check=False).decode().strip()
    # Older git does not know the option and echoes it back; those repositories are SHA-1.
    return fmt if fmt in ("sha1", "sha256") else "sha1"


# --------------------------------------------------------------------------- ZIP archives


class Archive:
    """A GitHub ZIP: one top folder named <repository>-<ref>, a commit id in the comment."""

    def __init__(self, path: Path, repository: str | None, github_commit: str | None):
        self.path = path
        try:
            self.zip = zipfile.ZipFile(path)
        except (OSError, zipfile.BadZipFile) as error:
            raise Stop(f"{path} is not a readable ZIP: {error}") from error
        infos = self.zip.infolist()
        if len(infos) > MAX_ENTRIES or sum(info.file_size for info in infos) > MAX_BYTES:
            raise Stop(f"{path.name} is far larger than these repositories; refusing it.")
        tops = {info.filename.split("/", 1)[0] for info in infos}
        if len(tops) != 1:
            raise Stop(
                f"{path.name} has {len(tops)} top-level entries; a GitHub ZIP has one folder."
            )
        self.prefix = tops.pop()
        self.repository = self._repository(repository)
        comment = self.zip.comment.decode("ascii", "replace").strip()
        self.comment_commit = comment if HEX.fullmatch(comment) else None
        if github_commit and self.comment_commit and github_commit != self.comment_commit:
            raise Stop(f"--github-commit {github_commit} differs from the ZIP comment {comment}.")
        self.github_commit = self.comment_commit or github_commit
        if self.github_commit and not HEX.fullmatch(self.github_commit):
            raise Stop(f"--github-commit must be a full commit id, not {self.github_commit}.")
        self.entries = []  # (path inside the repository, git mode, ZipInfo)
        self.commit_time: int | None = None
        for info in infos:
            name = info.filename
            if not name.startswith(self.prefix + "/"):
                raise Stop(f"{path.name}: entry {name!r} is outside {self.prefix}/.")
            inner = name[len(self.prefix) + 1 :]
            if not inner or info.is_dir():
                continue
            check_path(inner, path.name)
            if stat.S_ISLNK(info.external_attr >> 16):
                raise Stop(
                    f"{path.name}: {inner} is a symbolic link. GitHub ZIPs contain none, so this "
                    "ZIP was not downloaded from GitHub; refusing it."
                )
            self.entries.append((inner, git_mode(info), info))
            if self.commit_time is None:
                self.commit_time = extended_mtime(info.extra)
        if not self.entries:
            raise Stop(f"{path.name} contains no files.")
        lowered = [entry[0].lower() for entry in self.entries]
        if len(set(lowered)) != len(lowered):
            raise Stop(f"{path.name} has paths that differ only by case; import it by hand.")

    def _repository(self, explicit: str | None) -> str | None:
        ref = r"-(?:main|master|[0-9a-f]{7,64})"
        if explicit:
            if self.prefix != explicit and not re.fullmatch(re.escape(explicit) + ref, self.prefix):
                raise Stop(f"{self.path.name} holds {self.prefix}/, not repository {explicit}.")
            return explicit
        match = re.fullmatch(r"(.+?)" + ref, self.prefix)
        return match.group(1) if match else None

    def require(self) -> tuple[str, str]:
        if not self.repository:
            raise Stop(f"Cannot tell the repository of {self.path.name}; pass --repository.")
        if not self.github_commit:
            raise Stop(
                f"{self.path.name} has no commit id in its comment (was it repacked?). Ask the "
                "user for the full GitHub commit id and pass --github-commit."
            )
        return self.repository, self.github_commit

    def files(self) -> Iterator[tuple[str, str, bytes]]:
        for inner, mode, info in sorted(self.entries, key=lambda entry: entry[0]):
            yield inner, mode, self.zip.read(info)

    def describe(self) -> dict[str, Any]:
        return {
            "zip": str(self.path),
            "folder": self.prefix,
            "repository": self.repository,
            "github_commit": self.github_commit,
            "github_commit_time": iso(self.commit_time),
            "files": len(self.entries),
        }


def check_path(inner: str, archive: str) -> None:
    parts = PurePosixPath(inner).parts
    bad = (
        "\\" in inner
        or "\0" in inner
        or inner.startswith("/")
        or any(part in ("", ".", "..") for part in inner.split("/"))
        or any(part.lower() == ".git" for part in parts)
        or inner == STATE_FILE
    )
    if bad:
        raise Stop(f"{archive}: unsafe path {inner!r}; refusing the archive.")


def git_mode(info: zipfile.ZipInfo) -> str:
    # GitHub leaves the Unix mode 0, so its files become 100644.
    return "100755" if (info.external_attr >> 16) & 0o111 else "100644"


def extended_mtime(extra: bytes) -> int | None:
    """The commit time GitHub writes into each entry's extended timestamp (0x5455)."""
    position = 0
    while position + 4 <= len(extra):
        header = int.from_bytes(extra[position : position + 2], "little")
        size = int.from_bytes(extra[position + 2 : position + 4], "little")
        body = extra[position + 4 : position + 4 + size]
        if header == 0x5455 and len(body) >= 5 and body[0] & 1:
            return int.from_bytes(body[1:5], "little")
        position += 4 + size
    return None


def iso(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    stamp = datetime.fromtimestamp(seconds, timezone.utc)  # noqa: UP017 (runs on Python 3.9+)
    return stamp.isoformat().replace("+00:00", "Z")


# --------------------------------------------------------------------------- snapshots


def trailers(message: str) -> dict[str, str]:
    found = {}
    for line in message.splitlines():
        match = re.fullmatch(r"([A-Za-z-]+): (.+)", line.strip())
        if match:
            found[match.group(1)] = match.group(2).strip()
    return found


def imported_snapshots(repo: Path, rev: str, repository: str) -> list[dict[str, Any]]:
    """Snapshot commits of `repository` reachable from `rev`."""
    raw = git(repo, "log", f"--grep=^{SNAPSHOT_TRAILER}: ", "--format=%H%x00%P%x00%B%x1e", rev)
    snapshots: list[dict[str, Any]] = []
    for record in raw.decode("utf-8", "replace").split("\x1e"):
        record = record.strip("\n")
        if not record:
            continue
        sha, parents, message = record.split("\x00", 2)
        found = trailers(message)
        if found.get(REPOSITORY_TRAILER) != repository or SNAPSHOT_TRAILER not in found:
            continue
        time_value = found.get(TIME_TRAILER, "")
        snapshots.append(
            {
                "snapshot": sha,
                "parents": parents.split(),
                "github_commit": found[SNAPSHOT_TRAILER],
                "github_commit_time": int(time_value) if time_value.isdigit() else None,
                "kind": found.get(KIND_TRAILER, "baseline" if not parents else "import"),
            }
        )
    # A real snapshot's parents are snapshots of the same repository, or it has none. A squash
    # or rebase commit that copied a snapshot's message has a private parent; drop it, and
    # anything built on it, so it can never become a merge base.
    valid = {snap["snapshot"] for snap in snapshots}
    while True:
        keep = {
            snap["snapshot"]
            for snap in snapshots
            if snap["snapshot"] in valid and all(parent in valid for parent in snap["parents"])
        }
        if keep == valid:
            break
        valid = keep
    return [snap for snap in snapshots if snap["snapshot"] in valid]


def recorded_repositories(repo: Path, rev: str) -> set[str]:
    raw = git(repo, "log", f"--grep=^{REPOSITORY_TRAILER}: ", "--format=%B%x1e", rev).decode(
        "utf-8", "replace"
    )
    found = (trailers(message).get(REPOSITORY_TRAILER) for message in raw.split("\x1e"))
    return {name for name in found if name}


def snapshot_tips(snapshots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    parents = {parent for snap in snapshots for parent in snap["parents"]}
    return [snap for snap in snapshots if snap["snapshot"] not in parents]


def last_import(
    repo: Path, rev: str, repository: str
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """The tip of the snapshot chain reachable from `rev`, and the chain back to its baseline."""
    snapshots = imported_snapshots(repo, rev, repository)
    if not snapshots:
        return None, []
    tips = snapshot_tips(snapshots)
    if len(tips) != 1:
        listed = ", ".join(tip["github_commit"][:12] for tip in tips)
        raise SplitHistory(
            f"{rev} contains {len(tips)} separate import chains for {repository} ({listed}). "
            "Two imports were probably merged from the same base. Ask the user which GitHub "
            "commit main really contains, then record it again with `baseline --reset` "
            "(references/first-run.md)."
        )
    by_sha = {snap["snapshot"]: snap for snap in snapshots}
    chain = [tips[0]]
    while chain[-1]["kind"] != "baseline":
        parent = next((p for p in chain[-1]["parents"] if p in by_sha), None)
        if parent is None:
            break
        chain.append(by_sha[parent])
    return tips[0], chain


def read_state(repo: Path, rev: str) -> dict[str, Any] | None:
    raw = blob(repo, rev, STATE_FILE)
    if raw is None:
        return None
    try:
        state = json.loads(raw)
    except ValueError as error:
        raise Stop(f"{STATE_FILE} in {rev} is not valid JSON: {error}") from error
    return state if isinstance(state, dict) else None


def state_problem(
    repo: Path, rev: str, repository: str, tip: dict[str, Any] | None
) -> dict[str, str] | None:
    """Why main's recorded state and its snapshot history disagree, and the commit to re-record."""
    state = read_state(repo, rev)
    if state is not None and state.get("repository") != repository:
        raise Stop(f"{STATE_FILE} records {state.get('repository')}, not {repository}.")
    if tip is None and state is None:
        return None
    if tip is not None and state is None:
        return {
            "reason": f"{STATE_FILE} is missing from main although imports are recorded.",
            "github_commit": "",
        }
    assert state is not None
    recorded = str(state.get("github_commit", ""))
    if tip is not None and state.get("snapshot") == tip["snapshot"]:
        return None
    reachable = {snap["snapshot"] for snap in imported_snapshots(repo, rev, repository)}
    if state.get("snapshot") not in reachable:
        reason = (
            f"main contains GitHub {recorded[:12]} according to {STATE_FILE}, but that import's "
            "snapshot is not in main's history: its merge request was squashed or rebased."
        )
    else:
        reason = (
            f"main contains GitHub {recorded[:12]} according to {STATE_FILE}, but the newer "
            f"import of {tip['github_commit'][:12] if tip else '?'} is still in main's history: "
            "that import was reverted."
        )
    return {"reason": reason, "github_commit": recorded}


def require_consistent(repo: Path, rev: str, repository: str, tip: dict[str, Any] | None) -> None:
    problem = state_problem(repo, rev, repository, tip)
    if problem:
        needed = problem["github_commit"] or "the GitHub commit main contains (ask the user)"
        raise Stop(
            f"{problem['reason']} The next import would compare against the wrong base. Record "
            f"the base again with `baseline --reset` and the ZIP of {needed} "
            "(references/first-run.md)."
        )


def quote_path(path: str) -> bytes:
    """C-style quoting understood by git fast-import, safe for any path."""
    out = bytearray(b'"')
    for byte in path.encode("utf-8"):
        if byte in (0x22, 0x5C):
            out += b"\\" + bytes([byte])
        elif byte == 0x0A:
            out += b"\\n"
        elif byte < 0x20 or byte == 0x7F:
            out += b"\\%03o" % byte
        else:
            out.append(byte)
    return bytes(out + b'"')


def write_snapshot(repo: Path, archive: Archive, parents: list[str], kind: str) -> str:
    """Commit the ZIP contents exactly, without touching the index or working tree."""
    repository, commit = archive.require()
    ident = git_text(repo, "var", "GIT_COMMITTER_IDENT")
    lines = [
        f"GitHub snapshot {repository}@{commit[:12]}",
        "",
        "Exact contents of the GitHub ZIP download. Created by the import-github-zips",
        "skill; never edit, amend, rebase or squash this commit.",
        "",
        f"{REPOSITORY_TRAILER}: {repository}",
        f"{SNAPSHOT_TRAILER}: {commit}",
        f"{KIND_TRAILER}: {kind}",
    ]
    if archive.commit_time is not None:
        lines.append(f"{TIME_TRAILER}: {archive.commit_time}")
    message = ("\n".join(lines) + "\n").encode("utf-8")
    stream = bytearray()
    stream += f"commit {TEMP_REF}\nauthor {ident}\ncommitter {ident}\n".encode()
    stream += b"data %d\n" % len(message) + message
    # The previous tip; a --reset snapshot joining split chains has several.
    for index, parent in enumerate(parents):
        stream += f"{'from' if index == 0 else 'merge'} {parent}\n".encode()
    stream += b"deleteall\n"
    for inner, mode, content in archive.files():
        stream += b"M " + mode.encode() + b" inline " + quote_path(inner) + b"\n"
        stream += b"data %d\n" % len(content) + content + b"\n"
    stream += b"done\n"
    git(repo, "update-ref", "-d", TEMP_REF, check=False)
    git(repo, "fast-import", "--quiet", "--done", "--force", data=bytes(stream))
    snapshot = git_text(repo, "rev-parse", TEMP_REF)
    git(repo, "update-ref", "-d", TEMP_REF)
    verify_snapshot(repo, snapshot, archive)
    return snapshot


def verify_snapshot(repo: Path, snapshot: str, archive: Archive) -> None:
    algorithm = object_format(repo)
    expected = {}
    for inner, mode, content in archive.files():
        digest = hashlib.new(algorithm, b"blob %d\0" % len(content) + content).hexdigest()
        expected[inner] = (mode, digest)
    actual = {}
    for record in git(repo, "ls-tree", "-r", "-z", "--full-tree", snapshot).split(b"\0"):
        if record:
            meta, path = record.split(b"\t", 1)
            mode, _kind, digest = meta.decode().split()
            actual[path.decode("utf-8", "surrogateescape")] = (mode, digest)
    if actual != expected:
        missing = sorted(set(expected) ^ set(actual))[:5]
        raise Stop(f"Snapshot {snapshot[:12]} does not match the ZIP byte for byte ({missing}).")


def write_state(repo: Path, repository: str, commit: str, snapshot: str) -> None:
    """Record, in the merge being prepared, which snapshot main will contain."""
    state = {
        "repository": repository,
        "github_commit": commit,
        "snapshot": snapshot,
        "note": "Written by the import-github-zips skill on every import. Never edit it.",
    }
    Path(repo, STATE_FILE).write_bytes((json.dumps(state, indent=2) + "\n").encode("utf-8"))
    git(repo, "add", "--", STATE_FILE)


# --------------------------------------------------------------------------- change reports


def category(path: str) -> str:
    """What a changed path means for the private network."""
    name = path.rsplit("/", 1)[-1]
    first = path.split("/", 1)[0]
    if (
        name.startswith(("Dockerfile", "Containerfile"))
        or name.endswith(".Dockerfile")
        or name == ".dockerignore"
    ):
        return "container"
    if first in (".github", ".gitlab") or name == ".gitlab-ci.yml":
        return "ci"
    if name in ("AGENTS.md", "CLAUDE.md") or first == ".claude":
        return "agent-instructions"
    if "/migrations/" in f"/{path}" or name == "alembic.ini":
        return "migrations"
    if name == ".env.example" or name.endswith(".env.example"):
        return "environment"
    if (
        name in ("pyproject.toml", "poetry.lock", "uv.lock")
        or first == "vendor"
        or name.startswith("requirements")
    ):
        return "dependencies"
    if first == "deploy" or re.fullmatch(r"(docker-)?compose.*\.ya?ml", name):
        return "deployment"
    if first == "contracts" or "/contracts/" in path:
        return "contracts"
    if first == "config":
        return "config"
    if first in ("tests", "test"):
        return "tests"
    if first == "changes" and name.endswith(".md") and name != "README.md":
        return "change-notes"
    if first == "releases" or "/handoffs/" in f"/{path}" or name.endswith("env-changes.md"):
        return "release-notes"  # listed: the fallback when no change note covers a change
    if first in ("docs", "decisions") or name.endswith(".md"):
        return "docs"
    return "code"


def name_status(repo: Path, old: str, new: str) -> list[dict[str, str]]:
    parts = git(repo, "diff", "--name-status", "-z", "--find-renames", old, new).split(b"\0")
    entries = []
    index = 0
    while index < len(parts) and parts[index]:
        status = parts[index].decode()
        index += 1
        entry = {"status": status[0]}
        if status[0] in "RC":
            entry["from"] = parts[index].decode("utf-8", "surrogateescape")
            index += 1
        entry["path"] = parts[index].decode("utf-8", "surrogateescape")
        index += 1
        entry["category"] = category(entry["path"])
        if "from" in entry and category(entry["from"]) in ADAPTED:
            entry["category"] = category(entry["from"])  # a renamed Dockerfile is still one
        if entry["path"] != STATE_FILE:
            entries.append(entry)
    return entries


def touched(entries: list[dict[str, str]]) -> set[str]:
    paths = set()
    for entry in entries:
        paths.add(entry["path"])
        if "from" in entry:
            paths.add(entry["from"])
    return paths


def blob(repo: Path, rev: str, path: str) -> bytes | None:
    out = subprocess.run(
        ["git", "-C", str(repo), "cat-file", "blob", f"{rev}:{path}"], capture_output=True
    )
    return out.stdout if out.returncode == 0 else None


def environment_keys(
    repo: Path, old: str, new: str, entries: list[dict[str, str]]
) -> dict[str, dict[str, list[str]]]:
    """Settings added to or removed from each changed .env template."""
    changes = {}
    for entry in entries:
        if entry["category"] != "environment":
            continue
        before = set(ENV_KEY.findall(blob(repo, old, entry.get("from", entry["path"])) or b""))
        after = set(ENV_KEY.findall(blob(repo, new, entry["path"]) or b""))
        if before != after:
            changes[entry["path"]] = {
                "added": sorted(key.decode() for key in after - before),
                "removed": sorted(key.decode() for key in before - after),
            }
    return changes


def grouped(entries: list[dict[str, str]], full: bool) -> dict[str, Any]:
    """Counts for every category; paths only where the private side may have to act.

    GitHub's code, tests and docs merge as they are, so their paths are left out unless `full`.
    """
    counts: dict[str, int] = {}
    paths: dict[str, list[dict[str, str]]] = {}
    for entry in entries:
        counts[entry["category"]] = counts.get(entry["category"], 0) + 1
        if full or entry["category"] not in COUNT_ONLY:
            paths.setdefault(entry["category"], []).append(
                {key: value for key, value in entry.items() if key != "category"}
            )
    return {
        "count": len(entries),
        "counts": dict(sorted(counts.items())),
        "paths": dict(sorted(paths.items())),
    }


# --------------------------------------------------------------------------- commands


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, indent=2, ensure_ascii=True) + "\n")


def clone(path: str) -> Path:
    repo = Path(path).resolve()
    if not git_ok(repo, "rev-parse", "--is-inside-work-tree"):
        raise Stop(f"{repo} is not a git clone.")
    return Path(git_text(repo, "rev-parse", "--show-toplevel"))


def cmd_inspect(args: argparse.Namespace) -> None:
    emit(
        {"archives": [Archive(Path(item), args.repository, None).describe() for item in args.zips]}
    )


def cmd_status(args: argparse.Namespace) -> None:
    repo = clone(args.repo)
    target = resolve(repo, args.target)
    payload = {"repository": args.repository, "target": args.target, "target_commit": target}
    payload.update(worktree_state(repo))
    try:
        tip, chain = last_import(repo, target, args.repository)
        problem = state_problem(repo, target, args.repository, tip)
    except SplitHistory as split:
        state = read_state(repo, target) or {}
        tip, chain = None, []
        problem = {"reason": str(split), "github_commit": str(state.get("github_commit", ""))}
    payload["needs_baseline"] = tip is None and problem is None
    if problem:
        payload["needs_recovery"] = problem
    if tip:
        payload["last_import"] = {
            "github_commit": tip["github_commit"],
            "github_commit_time": iso(tip["github_commit_time"]),
            "snapshot": tip["snapshot"],
        }
        payload["imports_since_baseline"] = len(chain) - 1
    emit(payload)


def protected_branch(branch: str, target: str) -> None:
    if branch in ("main", "master", target.split("/", 1)[-1]):
        raise Stop(
            f"Never import into {branch}; pass a new branch name such as chore/github-import-<sha>."
        )


def start_branch(repo: Path, branch: str, target: str) -> str | None:
    """Create `branch` from `target` and switch to it; returns the branch to go back to."""
    protected_branch(branch, target)
    if branch_exists(repo, branch):
        raise Stop(f"Branch {branch} already exists. Use a new branch name for every import.")
    require_clean(repo)
    previous = current_branch(repo)
    git(repo, "checkout", "--quiet", "--no-track", "-b", branch, target)
    return previous


def remove_branch(repo: Path, branch: str, previous: str | None, target: str) -> None:
    """Undo `start_branch` after a failure, so a retry is not refused as an existing branch."""
    git(repo, "merge", "--abort", check=False)
    git(repo, "reset", "--quiet", "--hard", check=False)
    if previous and previous != branch:
        git(repo, "checkout", "--quiet", previous, check=False)
    else:
        git(repo, "checkout", "--quiet", "--detach", target, check=False)
    git(repo, "branch", "-D", branch, check=False)


def is_fresh_baseline(repo: Path, repository: str, target: str) -> bool:
    """HEAD is the merge that `baseline --confirm` just made on top of the target."""
    found = trailers(git_text(repo, "log", "-1", "--format=%B", "HEAD"))
    parents = git_text(repo, "log", "-1", "--format=%P", "HEAD").split()
    return (
        found.get(REPOSITORY_TRAILER) == repository
        and BASELINE_TRAILER in found
        and len(parents) == 2
        and git_ok(repo, "merge-base", "--is-ancestor", parents[0], target)
        and git_text(repo, "diff", "--name-only", parents[0], "HEAD") == STATE_FILE
    )


def cmd_baseline(args: argparse.Namespace) -> None:
    repo = clone(args.repo)
    archive = Archive(Path(args.zip), args.repository, args.github_commit)
    repository, commit = archive.require()
    target = resolve(repo, args.target)
    if args.branch:
        protected_branch(args.branch, args.target)
    # Every current tip becomes a parent of the new snapshot, so --reset also joins split chains.
    tips = snapshot_tips(imported_snapshots(repo, target, repository))
    state = read_state(repo, target)
    if (tips or state) and not args.reset:
        raise Stop(
            f"{args.target} already records imports of {repository}. Use `import`; after a "
            "squashed, rebased or reverted import use `baseline --reset` (references/first-run.md)."
        )
    if args.reset and state and state.get("github_commit") != commit:
        raise Stop(
            f"main contains GitHub {str(state.get('github_commit'))[:12]} according to "
            f"{STATE_FILE}; record the ZIP of that commit, not {commit[:12]}."
        )
    others = recorded_repositories(repo, target) - {repository}
    if others:
        raise Stop(f"This clone records imports of {', '.join(sorted(others))}, not {repository}.")
    snapshot = write_snapshot(repo, archive, [tip["snapshot"] for tip in tips], "baseline")
    differences = name_status(repo, snapshot, target)
    expected = [entry for entry in differences if entry["category"] in ("container", "ci")]
    unexpected = [entry for entry in differences if entry["category"] not in ("container", "ci")]
    payload: dict[str, Any] = {
        "repository": repository,
        "github_commit": commit,
        "github_commit_time": iso(archive.commit_time),
        "target": args.target,
        "snapshot": snapshot,
        "note": (
            "A: only in the private repository; D: only on GitHub; M: differs. A dry run "
            "writes only an unreferenced snapshot object; --confirm writes a new one."
        ),
        "expected_differences": expected[:LIST_LIMIT],
        "unexpected_differences": unexpected[:LIST_LIMIT],
        "unexpected_count": len(unexpected),
        "recorded": False,
    }
    if args.confirm:
        if not args.branch:
            raise Stop("--confirm needs --branch.")
        previous = start_branch(repo, args.branch, target)
        try:
            message = (
                f"Record GitHub {repository}@{commit[:12]} as the imported baseline\n\n"
                "Keeps every private file unchanged. Later imports compare GitHub against this "
                "snapshot.\n\n"
                f"{REPOSITORY_TRAILER}: {repository}\n"
                f"{BASELINE_TRAILER}: {commit}\n"
            )
            merge = ["merge", "--quiet", "--no-ff", "--no-commit", "-s", "ours", "-m", message]
            if not tips:
                merge.append("--allow-unrelated-histories")
            git(repo, *merge, snapshot)
            write_state(repo, repository, commit, snapshot)
            git(repo, "commit", "--quiet", "--no-edit")
        except Stop as stop:
            remove_branch(repo, args.branch, previous, target)
            raise Stop(
                f"{stop} Branch {args.branch} was removed; fix the cause and retry."
            ) from stop
        payload.update(
            {
                "recorded": True,
                "branch": args.branch,
                "merge_commit": git_text(repo, "rev-parse", "HEAD"),
            }
        )
    emit(payload)


def cmd_import(args: argparse.Namespace) -> None:
    repo = clone(args.repo)
    archive = Archive(Path(args.zip), args.repository, args.github_commit)
    repository, commit = archive.require()
    target = resolve(repo, args.target)
    protected_branch(args.branch, args.target)
    continuing = current_branch(repo) == args.branch and is_fresh_baseline(repo, repository, target)
    require_clean(repo)
    if not continuing and branch_exists(repo, args.branch):
        raise Stop(
            f"Branch {args.branch} already exists. Use a new branch name for every import; only "
            "a branch that `baseline --confirm` just created can be continued."
        )
    start = "HEAD" if continuing else target
    tip, chain = last_import(repo, start, repository)
    require_consistent(repo, start, repository, tip)
    if tip is None:
        others = recorded_repositories(repo, start) - {repository}
        if others:
            raise Stop(
                f"This clone records imports of {', '.join(sorted(others))}, not {repository}. "
                "The ZIP and the clone do not belong together."
            )
        raise Stop(
            f"No earlier import of {repository} is recorded in {args.target}. This is the first "
            "run: record a baseline first (references/first-run.md)."
        )
    if tip["github_commit"] == commit:
        emit({"repository": repository, "up_to_date": True, "github_commit": commit})
        return
    if any(snap["github_commit"] == commit for snap in chain):
        raise Stop(
            f"GitHub {commit[:12]} was imported before {tip['github_commit'][:12]}; this ZIP is older."
        )
    if archive.commit_time is None or tip["github_commit_time"] is None:
        if not args.confirm_newer:
            raise Stop(
                f"Cannot tell from commit times whether GitHub {commit[:12]} is newer than the last "
                f"import {tip['github_commit'][:12]} (a repacked ZIP has none). Ask the user; if "
                "they confirm it is newer, rerun with --confirm-newer and say so in the merge "
                "request."
            )
    elif archive.commit_time < tip["github_commit_time"]:
        raise Stop(
            f"This ZIP ({iso(archive.commit_time)}) is older than the last import "
            f"{tip['github_commit'][:12]} ({iso(tip['github_commit_time'])})."
        )
    base = tip["snapshot"]
    snapshot = write_snapshot(repo, archive, [base], "import")
    previous = None if continuing else start_branch(repo, args.branch, target)
    try:
        payload = merge_import(repo, args, repository, archive, tip, snapshot)
    except Stop as stop:
        if continuing:
            git(repo, "merge", "--abort", check=False)
            raise
        remove_branch(repo, args.branch, previous, target)
        raise Stop(f"{stop} Branch {args.branch} was removed; fix the cause and retry.") from stop
    emit(payload)


def merge_import(
    repo: Path,
    args: argparse.Namespace,
    repository: str,
    archive: Archive,
    tip: dict[str, Any],
    snapshot: str,
) -> dict[str, Any]:
    base = tip["snapshot"]
    private_head = git_text(repo, "rev-parse", "HEAD")
    old, new = tip["github_commit"], archive.require()[1]
    compare = f"https://github.com/{args.github_owner}/{repository}/compare/{old[:12]}...{new[:12]}"
    message = (
        f"Import GitHub {repository} {old[:8]}..{new[:8]}\n\n"
        f"Merges the GitHub snapshot of {new} into the private branch.\n"
        f"On GitHub: {compare}\n\n"
        f"{REPOSITORY_TRAILER}: {repository}\n"
        f"GitHub-Import: {old}..{new}\n"
    )
    merge = subprocess.run(
        ["git", "-C", str(repo), "merge", "--no-ff", "--no-commit", "-m", message, snapshot],
        capture_output=True,
        env=dict(os.environ, GIT_EDITOR="true", LC_ALL="C"),
    )
    conflicts = sorted(
        path
        for path in git(repo, "diff", "--name-only", "-z", "--diff-filter=U")
        .decode("utf-8", "surrogateescape")
        .split("\0")
        if path
    )
    if merge.returncode != 0 and not conflicts:
        raise Stop("git merge failed: " + merge.stderr.decode("utf-8", "replace").strip())
    write_state(repo, repository, new, snapshot)
    merge_msg = Path(repo, git_text(repo, "rev-parse", "--git-path", "MERGE_MSG"))
    merge_msg.write_bytes(message.encode("utf-8"))
    github_changes = name_status(repo, base, snapshot)
    private_changes = name_status(repo, base, private_head)
    both = sorted(touched(github_changes) & touched(private_changes))
    return {
        "repository": repository,
        "branch": args.branch,
        "target": args.target,
        "up_to_date": False,
        "github": {
            "from": old,
            "to": new,
            "to_time": iso(archive.commit_time),
            "compare": compare,
        },
        "base_snapshot": base,
        "snapshot": snapshot,
        "change_notes": [
            entry["path"]
            for entry in github_changes
            if entry["category"] == "change-notes" and entry["status"] != "D"
        ],
        "conflicts": conflicts,
        "review_auto_merged": [path for path in both if path not in conflicts],
        "github_changes": grouped(github_changes, args.full),
        "private_changes": private_changes,
        "environment_keys": environment_keys(repo, base, snapshot, github_changes),
        "new_migration_files": [
            entry["path"]
            for entry in github_changes
            if entry["category"] == "migrations" and entry["status"] == "A"
        ],
        "next": (
            "Resolve the conflicts, review, then `git add` and `git commit --no-edit`."
            if conflicts
            else "Review, then `git commit --no-edit`."
        )
        + f" Afterwards run `verify --repo <clone> --repository {repository}`.",
    }


def cmd_verify(args: argparse.Namespace) -> None:
    """Fail unless HEAD equals the imported snapshot outside the private network's own paths."""
    repo = clone(args.repo)
    target = resolve(repo, args.target)
    state = worktree_state(repo)
    if state["merge_in_progress"] or not state["clean"]:
        raise Stop("Commit the import merge first (`git commit --no-edit`), then run verify.")
    tip, chain = last_import(repo, "HEAD", args.repository)
    if tip is None or len(chain) < 2:
        raise Stop("HEAD contains no import of this repository to verify.")
    require_consistent(repo, "HEAD", args.repository, tip)
    base = chain[1]["snapshot"]
    allowed = touched(name_status(repo, base, target))
    differences = name_status(repo, tip["snapshot"], "HEAD")
    unexpected = [
        entry
        for entry in differences
        if entry["category"] not in ADAPTED and not touched([entry]) <= allowed
    ]
    if unexpected:
        listed = ", ".join(entry["path"] for entry in unexpected[:LIST_LIMIT])
        raise Stop(
            "These files differ from GitHub's snapshot although the private network never "
            f"changed them, so GitHub's version was not taken: {listed}. Take GitHub's version "
            f"(`git checkout {tip['snapshot'][:12]} -- <path>`) in a further commit, or explain "
            "each one in the merge request."
        )
    emit(
        {
            "repository": args.repository,
            "verified": True,
            "github_commit": tip["github_commit"],
            "private_differences": [entry["path"] for entry in differences],
        }
    )


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    commands = root.add_subparsers(dest="command", required=True)

    inspect = commands.add_parser("inspect", help="identify GitHub ZIPs")
    inspect.add_argument("zips", nargs="+")
    inspect.add_argument("--repository")
    inspect.set_defaults(run=cmd_inspect)

    for name, runner, help_text in (
        ("status", cmd_status, "last imported GitHub commit of a clone"),
        ("verify", cmd_verify, "after the merge commit, check that GitHub's version was taken"),
    ):
        command = commands.add_parser(name, help=help_text)
        command.add_argument("--repo", required=True, help="path of the private clone")
        command.add_argument("--repository", required=True, help="GitHub repository name")
        command.add_argument("--target", default="origin/main")
        command.set_defaults(run=runner)

    for name, runner, help_text in (
        ("baseline", cmd_baseline, "record the GitHub commit main already contains"),
        ("import", cmd_import, "merge a GitHub ZIP into a new branch"),
    ):
        command = commands.add_parser(name, help=help_text)
        command.add_argument("--repo", required=True, help="path of the private clone")
        command.add_argument("--zip", required=True)
        command.add_argument("--repository", help="GitHub repository name (default: from the ZIP)")
        command.add_argument("--github-commit", help="full commit id when the ZIP comment lacks it")
        command.add_argument("--target", default="origin/main")
        command.add_argument("--branch", required=(name == "import"))
        command.add_argument("--github-owner", default="venaTeam")
        if name == "baseline":
            command.add_argument(
                "--confirm", action="store_true", help="create the branch and record it"
            )
            command.add_argument(
                "--reset",
                action="store_true",
                help="record again after a squashed, rebased or reverted import",
            )
        else:
            command.add_argument(
                "--full", action="store_true", help="also list code, test and doc paths"
            )
            command.add_argument(
                "--confirm-newer",
                action="store_true",
                help="the user confirmed this ZIP is newer than the last import",
            )
        command.set_defaults(run=runner)
    return root


def main() -> int:
    args = parser().parse_args()
    try:
        args.run(args)
    except Stop as stop:
        emit({"error": str(stop)})
        return 2
    except Exception as error:  # still JSON, never a bare traceback the agent cannot parse
        emit({"error": f"Unexpected failure ({type(error).__name__}): {error}"})
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
