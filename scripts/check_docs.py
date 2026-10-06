"""Validate canonical contract syntax and portable instruction entry points."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    for path in (ROOT / "contracts").glob("*.json"):
        json.loads(path.read_text("utf-8"))
    assert (ROOT / "CLAUDE.md").read_text("utf-8").strip() == "@AGENTS.md"
    instructions = (ROOT / "AGENTS.md").read_text("utf-8")
    assert "alerts_bi_design.md" in instructions and "in full" in instructions
    for relative in (
        "docs/alerts_bi_design.md",
        "docs/alerts_bi_flow.md",
        "docs/alerts_bi_implementation_plan.md",
        "docs/outputs.md",
        "decisions/001-repository-separation.md",
    ):
        assert (ROOT / relative).is_file(), relative
    migrations = json.loads((ROOT / "contracts/migrations.json").read_text("utf-8"))
    assert len([name for name in migrations["files"] if name.endswith(".sql")]) == 8
    assert "008_measurement_basis" == migrations["schema_head"]
    print("Canonical contract JSON and instruction entry points are valid")


if __name__ == "__main__":
    main()
