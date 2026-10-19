"""The portal keeps applications that differ only in case apart (accepted 2026-10-18).

After admin migration 015, application compares exactly in every view. The selector lists
both spellings, the IN filter and the OPENJSON identity lookups match one spelling only, and
no comparison raises a collation conflict against the database's default collation.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from alerts_bi_admin.engine.config import load_config
from alerts_bi_admin.engine.db.migrate import reset_test_database
from alerts_bi_admin.engine.db.repositories import PersistencePayload, persist_run
from alerts_bi_operations.review.decisions import record_decision
from alerts_bi_operations.review.publication import publish_run
from alerts_bi_portal.app import build_portal
from alerts_bi_portal.application_filter import ApplicationFilter
from alerts_bi_portal.config import PortalSettings
from alerts_bi_portal.queries import team_reviews
from alerts_bi_portal.summary_queries import load_portal_summary
from alerts_bi_shared.db.connection import connect
from fastapi.testclient import TestClient

from tests.helpers.sql import sample_finding, sample_run

pytestmark = pytest.mark.integration

CONFIG = load_config()
DB = CONFIG.sql.test_database
TEAM = "case-team"
RUN_ID = "case".ljust(64, "0")
WEEK = "2026-08-25"
SHARED_KEY = "disk:node-1"
LOCAL = ("10.20.30.40", 50000)
# Distinct messages tell the spellings apart on rendered pages.
ALERTS = (
    ("Moby", SHARED_KEY, "Upper Moby disk full"),
    ("moby", SHARED_KEY, "Lower moby disk full"),
    ("moby", "cpu:node-2", "Lower moby cpu saturated"),
)


def _finding(application: str, key: str, message: str) -> dict[str, object]:
    evidence = [{"rule_id": "R1", "matched_rows": 1, "sample_evidence": {"message": message}}]
    return sample_finding(
        run_id=RUN_ID,
        application=application,
        key_field=key,
        message=message,
        representative_doc=json.dumps({"application": application, "message": message}),
        core_rule_ids="R1",
        findings_evidence=json.dumps(evidence),
        quality_state="rule_flagged",
        llm_principle_id=None,
        llm_confidence=None,
        llm_justification=None,
    )


@pytest.fixture(scope="module")
def portal() -> Iterator[TestClient]:
    # Only an unreachable server may skip. reset_test_database also applies every migration,
    # so a broken 015 must fail these tests rather than read as missing infrastructure.
    try:
        with connect(CONFIG.sql, "master") as master:
            master.query_one("SELECT 1 AS ready")
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"SQL Server is not reachable: {exc}")
    reset_test_database(CONFIG.sql, DB)
    payload = PersistencePayload(
        run=sample_run(run_id=RUN_ID, team_id=TEAM, team_display_name="Case Team"),
        findings=[_finding(*alert) for alert in ALERTS],
    )
    with connect(CONFIG.sql, DB) as db:
        persist_run(db, payload)
        publish_run(db, RUN_ID, published_by="operator", allow_gap=True)
        for application in ("Moby", "moby"):
            record_decision(
                db,
                run_id=RUN_ID,
                alert_schema="v1",
                application=application,
                key_field=SHARED_KEY,
                finding_id="R1",
                state="confirmed",
                note=f"Decision for {application}",
            )
    settings = PortalSettings(sql=CONFIG.sql, database=DB, page_size=10)
    with TestClient(build_portal(settings), client=LOCAL) as client:
        yield client


def test_the_selector_lists_both_spellings_and_the_filter_matches_one(
    portal: TestClient,
) -> None:
    with connect(CONFIG.sql, DB) as db:
        reviews = team_reviews(db, TEAM)
        upper = load_portal_summary(db, TEAM, RUN_ID, ApplicationFilter(("Moby",)))
        lower = load_portal_summary(db, TEAM, RUN_ID, ApplicationFilter(("moby",)))
        both = load_portal_summary(db, TEAM, RUN_ID, ApplicationFilter(("Moby", "moby")))
    assert reviews[-1].applications.options == ("Moby", "moby")
    assert {(a.application, a.key_field) for a in upper.alerts} == {("Moby", SHARED_KEY)}
    assert {(a.application, a.key_field) for a in lower.alerts} == {
        ("moby", SHARED_KEY),
        ("moby", "cpu:node-2"),
    }
    # Selecting both spellings returns all three identities, none merged.
    assert {(a.application, a.key_field) for a in both.alerts} == {
        (application, key) for application, key, _message in ALERTS
    }


def test_the_fix_list_shows_only_the_selected_spelling(portal: TestClient) -> None:
    response = portal.get(
        f"/teams/{TEAM}/weeks/{WEEK}/fix",
        params={"scope": "selected", "apps": "Moby", "show": "all"},
    )
    assert response.status_code == 200, response.text
    assert "Upper Moby disk full" in response.text
    assert "Lower moby" not in response.text


@pytest.mark.parametrize(("application", "other"), [("Moby", "moby"), ("moby", "Moby")])
def test_the_detail_lookup_matches_one_spelling_and_its_decisions(
    portal: TestClient, application: str, other: str
) -> None:
    response = portal.get(
        f"/teams/{TEAM}/weeks/{WEEK}/alert",
        params={"schema": "v1", "application": application, "key": SHARED_KEY},
    )
    assert response.status_code == 200, response.text
    message = next(m for a, k, m in ALERTS if a == application and k == SHARED_KEY)
    assert message in response.text
    assert f"Decision for {application}" in response.text
    assert f"Decision for {other}" not in response.text
