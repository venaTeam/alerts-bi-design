"""Copy immutable design inputs into explicitly supplied application checkouts."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path


def sync(root: Path, targets: list[Path]) -> None:
    revision = subprocess.check_output(
        ["git", "-C", str(root), "rev-parse", "HEAD"], text=True
    ).strip()
    dirty = subprocess.check_output(
        ["git", "-C", str(root), "status", "--porcelain", "--", "docs", "contracts", "decisions"],
        text=True,
    )
    if dirty:
        raise SystemExit("Commit canonical design inputs before creating snapshots")
    for target in targets:
        if not (target / "pyproject.toml").is_file():
            raise SystemExit(f"Not an application repository: {target}")
        hashes: dict[str, str] = {}
        for folder in ("docs", "contracts", "decisions"):
            for source in sorted((root / folder).rglob("*")):
                if not source.is_file():
                    continue
                relative = source.relative_to(root)
                destination = target / "docs/upstream" / relative
                # Keep direct docs/upstream/alerts_bi_design.md as the documented entry point.
                if folder == "docs":
                    destination = target / "docs/upstream" / source.relative_to(root / "docs")
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, destination)
                hashes[destination.relative_to(target).as_posix()] = hashlib.sha256(
                    source.read_bytes()
                ).hexdigest()
        (target / "docs/upstream/manifest.json").write_text(
            json.dumps(
                {
                    "repository": "https://github.com/venaTeam/alerts-bi-design",
                    "revision": revision,
                    "sha256": hashes,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"Pinned {target.name} to design {revision}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repositories", nargs="+", type=Path)
    sync(Path(__file__).resolve().parents[1], parser.parse_args().repositories)
