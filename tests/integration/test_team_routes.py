"""Published free-form and case-distinct team IDs through the installed portal."""

import os
from datetime import datetime, timedelta

import pytest
from alerts_bi_admin.engine.config import load_config
from alerts_bi_admin.engine.db.migrate import reset_test_database
from alerts_bi_admin.engine.db.repositories import PersistencePayload, persist_run
from alerts_bi_operations.review.publication import publish_run
from alerts_bi_portal.app import build_portal
from alerts_bi_portal.config import PortalSettings
from alerts_bi_portal.pages import team_url, week_url
from alerts_bi_shared.db.connection import connect
from fastapi.testclient import TestClient

from tests.helpers.sql import sample_finding, sample_run

pytestmark = pytest.mark.integration


def test_portal_routes_preserve_slash_percent_dot_and_case_identity() -> None:
    config = load_config()
    database = config.sql.test_database
    if config.sql.host not in ("localhost", "127.0.0.1") or database != "alerts_bi_test":
        pytest.fail("Team-route integration requires local SQL Server and alerts_bi_test")
    # Exploratory runs may skip unavailable SQL; release checks must fail closed.
    try:
        with connect(config.sql, "master") as master:
            master.query_one("SELECT 1 AS ready")
    except Exception as exc:  # pragma: no cover - environment dependent
        if os.environ.get("REQUIRE_SQL", "") not in ("", "0"):
            pytest.fail(f"Required SQL preflight failed ({type(exc).__name__})", pytrace=False)
        pytest.skip(f"SQL Server is not reachable: {exc}")
    reset_test_database(config.sql, database)
    teams = [
        "team/a",
        "team/a/summary",
        "a%2Fb",
        "~61",
        "..",
        "team-a",
        "Team-A",
        "a" * 128,
        "😀" * 64,
    ]
    end = datetime(2026, 10, 12)
    with connect(config.sql, database) as db:
        for n, team in enumerate(teams):
            run_id = str(n + 1) * 64
            persist_run(
                db,
                PersistencePayload(
                    run=sample_run(
                        run_id=run_id,
                        team_id=team,
                        team_display_name=team,
                        run_at=end,
                        window_end=end,
                        window_start=end - timedelta(days=7),
                    ),
                    findings=[sample_finding(run_id=run_id, message=f"Distinct message {n}")],
                ),
            )
            publish_run(db, run_id, published_by="route-test", allow_gap=True)
    settings = PortalSettings(config.sql, database)
    with TestClient(build_portal(settings), client=("127.0.0.1", 50000)) as client:
        home = client.get("/")
        assert home.status_code == 200
        for n, team in enumerate(teams):
            assert team_url(team) in home.text
            assert client.get(team_url(team)).status_code == 200
            week = week_url(team, end.date()).split("?")[0]
            for suffix in (
                "",
                "/fix",
                "/volume",
                "/dashboards",
                "/migration",
                "/history",
                "/slides",
            ):
                response = client.get(week + suffix)
                assert response.status_code == 200, (team, suffix, response.text)
            detail = client.get(
                week + "/alert",
                params={
                    "schema": "v1",
                    "application": "checkout-api",
                    "key": "checkout-api:cart:node-1",
                },
            )
            assert detail.status_code == 200 and f"Distinct message {n}" in detail.text
            assert (
                client.get(
                    team_url(team) + "/weeks", params={"week": end.date().isoformat()}
                ).status_code
                == 200
            )
        assert client.get("/teams/~ff").status_code == 404
