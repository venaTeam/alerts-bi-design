"""Compare installed producers with the approved extraction contracts."""

from __future__ import annotations

import argparse
import hashlib
import json
from importlib.resources import files
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sql", action="store_true", help="Check local disposable SQL metadata")
    parser.add_argument(
        "--console", action="store_true", help="Check the consolidated console routes"
    )
    args = parser.parse_args()
    from alerts_bi_admin.engine.api.app import build_app
    from alerts_bi_admin.engine.config import ApiSettings, load_config
    from alerts_bi_admin.engine.db.ledger import MIGRATIONS_DIR
    from alerts_bi_admin.engine.db.migrate import heads
    from alerts_bi_operations.registry import SCHEMA_PATH
    from alerts_bi_operations.report.csv_export import (
        DAILY_METRIC_HEADERS,
        RULE_COUNT_HEADERS,
        WORKLIST_HEADERS,
    )
    from alerts_bi_operations.report.render import OUTPUT_FILES

    config = load_config()
    assert SCHEMA_PATH.read_bytes() == (ROOT / "contracts/teams.schema.json").read_bytes(), (
        "Registry schema drift"
    )
    expected_api = json.loads((ROOT / "contracts/trigger-openapi.json").read_text("utf-8"))
    assert build_app(ApiSettings(config=config)).openapi() == expected_api, "Trigger API drift"
    if args.console:
        from alerts_bi_admin.app import build_admin
        from alerts_bi_admin.config import AdminConfig, AdminSettings

        contract = json.loads((ROOT / "contracts/console-http.json").read_text("utf-8"))
        app = build_admin(
            AdminSettings(AdminConfig(config.sql), config.sql.test_database, "contract-check-" * 3)
        )
        assert app.openapi() == json.loads(
            (ROOT / "contracts/console-openapi.json").read_text("utf-8")
        ), "Console API drift"
        routes = {
            (method.upper(), path)
            for path, operations in app.openapi()["paths"].items()
            for method in operations
        }
        for path in contract["read_routes"]:
            assert ("GET", path) in routes, f"Missing console read: {path}"
        for path in contract["write_routes"]:
            assert ("POST", path) in routes, f"Missing console write: {path}"
        assert ("GET", "/csrf") in routes
        assert heads() == [contract["schema_head"]]
    outputs = json.loads((ROOT / "contracts/outputs.json").read_text("utf-8"))
    assert outputs["files"] == list(OUTPUT_FILES), "Output filenames changed"
    assert outputs["on_demand"] == [], "Standalone outputs must remain removed"
    assert outputs["headers"] == {
        "DAILY_METRIC_HEADERS": list(DAILY_METRIC_HEADERS),
        "RULE_COUNT_HEADERS": list(RULE_COUNT_HEADERS),
        "WORKLIST_HEADERS": list(WORKLIST_HEADERS),
    }, "CSV columns changed"
    migration = json.loads((ROOT / "contracts/migrations.json").read_text("utf-8"))
    assert heads() == [migration["schema_head"]]
    for relative, expected in migration["files"].items():
        assert hashlib.sha256((MIGRATIONS_DIR / relative).read_bytes()).hexdigest() == expected, (
            relative
        )
    for name in ("Alerting_Guide_Appchi_EN.md", "what_is_an_incorrect_alert_EN.md"):
        packaged = (
            files("alerts_bi_admin.engine").joinpath("resources", "guides", name).read_bytes()
        )
        assert packaged == (ROOT / "docs" / name).read_bytes(), f"Guide drift: {name}"
    if args.sql:
        from alerts_bi_shared.db.connection import connect

        assert config.sql.host in ("localhost", "127.0.0.1")
        assert config.sql.test_database == "alerts_bi_test"
        with connect(config.sql, config.sql.test_database) as db:
            rows = db.query(
                "SELECT TABLE_NAME AS view_name, COLUMN_NAME AS column_name, "
                "ORDINAL_POSITION AS position, DATA_TYPE AS data_type, IS_NULLABLE AS nullable, "
                "CHARACTER_MAXIMUM_LENGTH AS max_length, NUMERIC_PRECISION AS precision, "
                "NUMERIC_SCALE AS scale, DATETIME_PRECISION AS datetime_precision "
                "FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME LIKE 'portal[_]%' "
                "ORDER BY TABLE_NAME, ORDINAL_POSITION"
            )
        assert rows == json.loads((ROOT / "contracts/sql-views.json").read_text("utf-8")), (
            "SQL drift"
        )
    print(
        "API, CSV, migration and guide contracts match" + ("; SQL views match" if args.sql else "")
    )


if __name__ == "__main__":
    main()
