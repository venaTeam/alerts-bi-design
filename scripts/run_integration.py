"""Run coordinated tests only against explicitly selected local disposable services."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    args = parser.parse_args()
    if not args.registry.is_file():
        raise SystemExit("The runs registry artifact must exist")
    os.environ["INTEGRATION_REGISTRY_PATH"] = str(args.registry.resolve())
    from alerts_bi_runs.config import load_config
    from alerts_bi_shared.db.connection import connect

    config = load_config()
    if (
        config.sql.host not in ("localhost", "127.0.0.1")
        or config.sql.test_database != "alerts_bi_test"
    ):
        raise SystemExit("Integration requires local SQL Server and alerts_bi_test")
    if config.es.url.rstrip("/") not in ("http://localhost:9200", "http://127.0.0.1:9200"):
        raise SystemExit("Integration requires the explicit local Elasticsearch mock")
    # Fail before pytest can skip for missing infrastructure.
    with connect(config.sql, config.sql.test_database) as db:
        db.query_one("SELECT 1 AS ready")
    return subprocess.call([sys.executable, "-m", "pytest", str(root / "tests"), "-q", "-rs"])


if __name__ == "__main__":
    raise SystemExit(main())
