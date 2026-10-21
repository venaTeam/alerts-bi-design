"""Validate canonical contract syntax, portable instruction entry points and design mocks."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


#: A copied app stylesheet names its source app and commit, so a reader can tell it is frozen.
COPIED_CSS = re.compile(r"/\* Copied from alerts-bi-(admin|portal) [0-9a-f]{7,40} ")


def check_mockups() -> None:
    """Each mock folder has a README, its pages' local files exist, and copied CSS says where
    it came from. Mocks are reference material; the design document stays authoritative."""
    for folder in sorted(p for p in (ROOT / "docs/mockups").glob("*") if p.is_dir()):
        assert (folder / "README.md").is_file(), f"{folder.name}: README.md"
        for page in folder.glob("*.html"):
            for target in re.findall(r'(?:href|src)="([^"#:?]+)"', page.read_text("utf-8")):
                assert (folder / target).is_file(), f"{folder.name}/{page.name}: {target}"
        for sheet in folder.glob("*.css"):
            assert COPIED_CSS.match(sheet.read_text("utf-8")), f"{folder.name}/{sheet.name}"


def main() -> None:
    for path in (ROOT / "contracts").glob("*.json"):
        json.loads(path.read_text("utf-8"))
    assert (ROOT / "CLAUDE.md").read_text("utf-8").strip() == "@AGENTS.md"
    instructions = (ROOT / "AGENTS.md").read_text("utf-8")
    assert "alerts_bi_design.md" in instructions and "canonical design" in instructions
    for relative in (
        "docs/alerts_bi_design.md",
        "docs/alerts_bi_flow.md",
        "docs/alerts_bi_implementation_plan.md",
        "docs/outputs.md",
        "docs/async-runs.md",
        "docs/backfill.md",
        "decisions/001-repository-separation.md",
    ):
        assert (ROOT / relative).is_file(), relative
    migrations = json.loads((ROOT / "contracts/migrations.json").read_text("utf-8"))
    assert len([name for name in migrations["files"] if name.endswith(".sql")]) == 20
    assert "020_portal_review_operators" == migrations["schema_head"]
    console = json.loads((ROOT / "contracts/console-http.json").read_text("utf-8"))
    assert console["schema_head"] == migrations["schema_head"]
    check_mockups()
    print("Canonical contract JSON and instruction entry points are valid")


if __name__ == "__main__":
    main()
