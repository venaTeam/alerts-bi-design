"""The import-github-zips script against temporary git repositories and synthetic GitHub ZIPs.

Each test builds a "private clone": GitHub's files plus a private Dockerfile and GitLab CI,
with `origin/main` pointing at its main branch. Merging an import merge request is simulated
on main, the way GitLab would merge it (merge commit, squash, or a later revert).
"""

from __future__ import annotations

import json
import stat
import struct
import subprocess
import sys
import zipfile
from pathlib import Path
from typing import Any

import pytest

SCRIPT = (
    Path(__file__).resolve().parents[2]
    / ".claude/skills/import-github-zips/scripts/github_import.py"
)
NAME = "alerts-bi-design"
PRIVATE_DOCKERFILE = "FROM registry.corp/python\nRUN pip install --index-url $IDX poetry==1\n"
V1 = {
    "app.py": "v1\n",
    "Dockerfile": "FROM python\nRUN pip install poetry==1\n",
    "README.md": "r\n",
}
V2 = {**V1, "app.py": "v2\n", "Dockerfile": "FROM python\nRUN pip install poetry==2\n"}
V2["docs/new.md"] = "new\n"
V3 = {**V2, "app.py": "v1\n"}  # GitHub reverts app.py to its V1 content
C0, C1, C2, C3 = ("0" * 40, "1" * 40, "2" * 40, "3" * 40)


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo), *args], check=True, capture_output=True, text=True
    )
    return result.stdout.strip()


def make_zip(
    folder: Path,
    files: dict[str, str],
    commit: str,
    when: int | None,
    *,
    name: str = NAME,
    symlink: str | None = None,
) -> Path:
    """A ZIP shaped like GitHub's: one <name>-main/ folder, commit id in the comment."""
    path = folder / f"{commit[:4]}-{when}.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr(zipfile.ZipInfo(f"{name}-main/"), b"")
        for inner, text in sorted(files.items()):
            info = zipfile.ZipInfo(f"{name}-main/{inner}", date_time=(2026, 1, 1, 0, 0, 0))
            if when is not None:
                info.extra = struct.pack("<HHBI", 0x5455, 5, 1, when)
            archive.writestr(info, text.encode())
        if symlink:
            info = zipfile.ZipInfo(f"{name}-main/{symlink}")
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            archive.writestr(info, b"app.py")
        archive.comment = commit.encode()
    return path


def run(repo: Path, *args: str) -> tuple[int, dict[str, Any]]:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), *args], capture_output=True, text=True, cwd=repo
    )
    payload: dict[str, Any] = json.loads(result.stdout)
    return result.returncode, payload


def write(repo: Path, files: dict[str, str]) -> None:
    for inner, text in files.items():
        path = repo / inner
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(text.encode())


def publish(repo: Path) -> None:
    """Point origin/main at local main, as after a push or a GitLab merge."""
    git(repo, "update-ref", "refs/remotes/origin/main", "main")


def merge_request(repo: Path, branch: str, how: str = "merge") -> None:
    git(repo, "checkout", "-q", "main")
    if how == "merge":
        git(repo, "merge", "-q", "--no-ff", "-m", f"Merge branch '{branch}'", branch)
    else:
        git(repo, "merge", "-q", "--squash", branch)
        git(repo, "commit", "-q", "-m", f"Squashed {branch}")
    publish(repo)


@pytest.fixture
def zips(tmp_path: Path) -> Path:
    folder = tmp_path / "zips"
    folder.mkdir()
    return folder


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A private clone that contains GitHub V1 plus its own Dockerfile and GitLab CI."""
    root = tmp_path / "private"
    root.mkdir()
    git(root, "init", "-q", "-b", "main")
    git(root, "config", "user.name", "Test")
    git(root, "config", "user.email", "test@example.com")
    git(root, "config", "core.autocrlf", "false")
    write(root, {**V1, "Dockerfile": PRIVATE_DOCKERFILE, ".gitlab-ci.yml": "check: {}\n"})
    git(root, "add", "-A")
    git(root, "commit", "-q", "-m", "Private copy of GitHub V1")
    publish(root)
    return root


def baseline(repo: Path, zips: Path, branch: str = "chore/github-baseline") -> None:
    code, out = run(
        repo, "baseline", "--repo", ".", "--zip", str(make_zip(zips, V1, C1, 1000)),
        "--branch", branch, "--confirm",
    )  # fmt: skip
    assert code == 0 and out["recorded"], out


def resolve_dockerfile(repo: Path, poetry: str) -> None:
    write(repo, {"Dockerfile": PRIVATE_DOCKERFILE.replace("poetry==1", f"poetry=={poetry}")})
    git(repo, "add", "Dockerfile")


def import_v2(repo: Path, zips: Path, branch: str) -> dict[str, Any]:
    code, out = run(
        repo, "import", "--repo", ".", "--zip", str(make_zip(zips, V2, C2, 2000)),
        "--branch", branch,
    )  # fmt: skip
    assert code == 0, out
    resolve_dockerfile(repo, "2")
    git(repo, "commit", "-q", "--no-edit")
    return out


def test_baseline_dry_run_lists_only_the_private_adaptations(repo: Path, zips: Path) -> None:
    code, out = run(repo, "baseline", "--repo", ".", "--zip", str(make_zip(zips, V1, C1, 1000)))
    assert code == 0
    assert {entry["path"] for entry in out["expected_differences"]} == {
        ".gitlab-ci.yml",
        "Dockerfile",
    }
    assert out["unexpected_differences"] == [] and not out["recorded"]
    assert git(repo, "branch", "--show-current") == "main"


def test_first_import_continues_the_baseline_branch(repo: Path, zips: Path) -> None:
    baseline(repo, zips, "chore/github-import-22222222")
    code, status = run(repo, "status", "--repo", ".", "--repository", NAME, "--target", "HEAD")
    assert code == 0 and status["last_import"]["github_commit"] == C1
    assert git(repo, "diff", "--name-only", "main", "HEAD") == ".github-import.json"
    code, out = run(
        repo, "import", "--repo", ".", "--zip", str(make_zip(zips, V2, C2, 2000)),
        "--branch", "chore/github-import-22222222",
    )  # fmt: skip
    assert code == 0, out
    assert out["conflicts"] == ["Dockerfile"]
    assert (repo / "app.py").read_text() == "v2\n"
    assert out["github_changes"]["counts"] == {"code": 1, "container": 1, "docs": 1}
    assert [entry["path"] for entry in out["private_changes"]] == [".gitlab-ci.yml", "Dockerfile"]
    resolve_dockerfile(repo, "2")
    git(repo, "commit", "-q", "--no-edit")
    code, verified = run(repo, "verify", "--repo", ".", "--repository", NAME)
    assert code == 0 and verified["verified"], verified


def test_verify_flags_a_github_file_that_was_not_taken(repo: Path, zips: Path) -> None:
    baseline(repo, zips)
    import_v2(repo, zips, "chore/github-baseline")
    write(repo, {"app.py": "private edit\n"})
    git(repo, "commit", "-q", "-am", "Keep a private app.py")
    code, out = run(repo, "verify", "--repo", ".", "--repository", NAME)
    assert code == 2 and "app.py" in out["error"]


def test_refusals_after_imports_reach_main(repo: Path, zips: Path) -> None:
    baseline(repo, zips)
    import_v2(repo, zips, "chore/github-baseline")
    merge_request(repo, "chore/github-baseline")

    def imported(zip_path: Path, branch: str, *extra: str) -> tuple[int, dict[str, Any]]:
        return run(
            repo, "import", "--repo", ".", "--zip", str(zip_path), "--branch", branch, *extra
        )

    assert imported(make_zip(zips, V2, C2, 2000), "b1")[1]["up_to_date"]
    assert "older" in imported(make_zip(zips, V1, C1, 1000), "b2")[1]["error"]
    assert "older" in imported(make_zip(zips, V1, C0, 500), "b3")[1]["error"]
    repacked = make_zip(zips, V3, C3, None)
    code, out = imported(repacked, "b4")
    assert code == 2 and "--confirm-newer" in out["error"]
    assert "Never import into main" in imported(repacked, "main", "--confirm-newer")[1]["error"]
    git(repo, "branch", "existing")
    assert "already exists" in imported(repacked, "existing", "--confirm-newer")[1]["error"]
    code, out = imported(repacked, "b5", "--confirm-newer")
    assert code == 0 and out["github"]["from"] == C2, out


def test_an_ordinary_branch_ahead_of_main_is_never_continued(repo: Path, zips: Path) -> None:
    baseline(repo, zips)
    import_v2(repo, zips, "chore/github-baseline")
    merge_request(repo, "chore/github-baseline")
    git(repo, "checkout", "-q", "-b", "feature")
    write(repo, {"feature.py": "unrelated\n"})
    git(repo, "add", "-A")
    git(repo, "commit", "-q", "-m", "Unrelated work")
    code, out = run(
        repo, "import", "--repo", ".", "--zip", str(make_zip(zips, V3, C3, 3000)),
        "--branch", "feature",
    )  # fmt: skip
    assert code == 2 and "already exists" in out["error"]
    assert git(repo, "log", "-1", "--format=%s") == "Unrelated work"


def test_a_squashed_import_is_detected_and_recorded_again(repo: Path, zips: Path) -> None:
    baseline(repo, zips)
    merge_request(repo, "chore/github-baseline")
    import_v2(repo, zips, "chore/github-import-v2")
    merge_request(repo, "chore/github-import-v2", how="squash")
    code, status = run(repo, "status", "--repo", ".", "--repository", NAME)
    assert status["needs_recovery"]["github_commit"] == C2 and not status["needs_baseline"]
    v3 = make_zip(zips, V3, C3, 3000)
    code, out = run(repo, "import", "--repo", ".", "--zip", str(v3), "--branch", "b")
    assert code == 2 and "squashed" in out["error"] and "baseline --reset" in out["error"]
    v1 = make_zip(zips, V1, C1, 1000)
    reset = ("baseline", "--repo", ".", "--reset", "--branch", "chore/github-import-33333333")
    assert "record the ZIP of that commit" in run(repo, *reset, "--zip", str(v1))[1]["error"]
    code, out = run(repo, *reset, "--zip", str(make_zip(zips, V2, C2, 2000)), "--confirm")
    assert code == 0 and out["recorded"], out
    code, out = run(
        repo, "import", "--repo", ".", "--zip", str(v3), "--branch", "chore/github-import-33333333"
    )
    assert code == 0 and out["github"]["from"] == C2, out
    assert (repo / "app.py").read_text() == "v1\n"  # GitHub's revert is not lost


def test_a_reverted_import_is_detected_and_can_be_imported_again(repo: Path, zips: Path) -> None:
    baseline(repo, zips)
    merge_request(repo, "chore/github-baseline")
    import_v2(repo, zips, "chore/github-import-v2")
    merge_request(repo, "chore/github-import-v2")
    git(repo, "revert", "--no-edit", "-m", "1", "HEAD")
    publish(repo)
    code, status = run(repo, "status", "--repo", ".", "--repository", NAME)
    assert status["needs_recovery"]["github_commit"] == C1
    v2 = make_zip(zips, V2, C2, 2000)
    code, out = run(repo, "import", "--repo", ".", "--zip", str(v2), "--branch", "b")
    assert code == 2 and "reverted" in out["error"]
    code, out = run(
        repo, "baseline", "--repo", ".", "--reset", "--zip", str(make_zip(zips, V1, C1, 1000)),
        "--branch", "chore/github-import-again", "--confirm",
    )  # fmt: skip
    assert code == 0 and out["recorded"], out
    code, out = run(
        repo, "import", "--repo", ".", "--zip", str(v2), "--branch", "chore/github-import-again"
    )
    assert code == 0 and out["conflicts"] == ["Dockerfile"], out
    assert (repo / "app.py").read_text() == "v2\n"


def test_zips_that_did_not_come_from_github_are_refused(repo: Path, zips: Path) -> None:
    linked = make_zip(zips, V1, C1, 1000, symlink="link.py")
    assert "symbolic link" in run(repo, "inspect", str(linked))[1]["error"]
    other = make_zip(zips, V1, C2, 1000, name="alerts-bi-design")
    code, out = run(repo, "inspect", "--repository", "alerts-bi", str(other))
    assert code == 2 and "not repository alerts-bi" in out["error"]
