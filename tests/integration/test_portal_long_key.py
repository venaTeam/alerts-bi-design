"""The portal reads keys up to 800 characters (accepted 2026-10-28).

After admin migration 022, key_field holds 800 characters. The portal's work list, its
OPENJSON identity lookups, the decision badges and the alert page must neither truncate nor
refuse such a key. The two keys differ only in their last character, so a lookup that compared
a 512-character prefix would match both or neither.
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
from alerts_bi_portal.config import PortalSettings
from alerts_bi_portal.queries import latest_decisions, worklist
from alerts_bi_shared.db.connection import connect
from fastapi.testclient import TestClient

from tests.helpers.sql import sample_finding, sample_run

pytestmark = pytest.mark.integration

CONFIG = load_config()
DB = CONFIG.sql.test_database
TEAM = "long-key-team"
RUN_ID = "longkey".ljust(64, "0")
WEEK = "2026-08-25"
APPLICATION = "checkout-api"
PREFIX = ("k8s:prod/checkout/pod-" * 40)[:799]
LOCAL = ("10.20.30.40", 50000)
# Distinct messages tell the keys apart on rendered pages; the row counts fix their order.
ALERTS = (
    (PREFIX + "a", "Pod a crash looping", 9),
    (PREFIX + "b", "Pod b crash looping", 3),
)


def _finding(key: str, message: str, rows: int) -> dict[str, object]:
    evidence = [{"rule_id": "R1", "matched_rows": rows, "sample_evidence": {"message": message}}]
    return sample_finding(
        run_id=RUN_ID,
        application=APPLICATION,
        key_field=key,
        message=message,
        row_count=rows,
        representative_doc=json.dumps({"application": APPLICATION, "message": message}),
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
    # so a broken 022 must fail these tests rather than read as missing infrastructure.
    try:
        with connect(CONFIG.sql, "master") as master:
            master.query_one("SELECT 1 AS ready")
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"SQL Server is not reachable: {exc}")
    reset_test_database(CONFIG.sql, DB)
    payload = PersistencePayload(
        run=sample_run(run_id=RUN_ID, team_id=TEAM, team_display_name="Long Key Team"),
        findings=[_finding(*alert) for alert in ALERTS],
    )
    with connect(CONFIG.sql, DB) as db:
        persist_run(db, payload)
        publish_run(db, RUN_ID, allow_gap=True)
        for key, message, _rows in ALERTS:
            record_decision(
                db,
                run_id=RUN_ID,
                alert_schema="v1",
                application=APPLICATION,
                key_field=key,
                finding_id="R1",
                state="confirmed",
                note=f"Decision on {message}",
            )
    settings = PortalSettings(sql=CONFIG.sql, database=DB, page_size=10)
    with TestClient(build_portal(settings), client=LOCAL) as client:
        yield client


def test_the_work_list_shows_each_long_key_with_its_own_decision(portal: TestClient) -> None:
    response = portal.get(f"/teams/{TEAM}/weeks/{WEEK}/fix", params={"show": "all"})
    assert response.status_code == 200, response.text
    for _key, message, _rows in ALERTS:
        assert message in response.text
    with connect(CONFIG.sql, DB) as db:
        page = worklist(db, RUN_ID, attention_only=False, schema=None, page=1, page_size=10)
        decisions = latest_decisions(db, RUN_ID, page.rows)
    assert [row.key_field for row in page.rows] == [key for key, _message, _rows in ALERTS]
    assert {identity[2]: found["R1"].note for identity, found in decisions.items()} == {
        key: f"Decision on {message}" for key, message, _rows in ALERTS
    }


def test_paging_past_a_long_key_reaches_the_next_alert(portal: TestClient) -> None:
    # The shared cursor carries text of at most 512 characters, so the next link's cursor is
    # ignored and its page number selects the page.
    with connect(CONFIG.sql, DB) as db:
        first = worklist(db, RUN_ID, attention_only=False, schema=None, page=1, page_size=1)
        second = worklist(
            db,
            RUN_ID,
            attention_only=False,
            schema=None,
            page=2,
            page_size=1,
            cursor=first.next_cursor,
        )
    assert [row.key_field for row in first.rows] == [ALERTS[0][0]]
    assert [row.key_field for row in second.rows] == [ALERTS[1][0]]


@pytest.mark.parametrize(("index", "other"), [(0, 1), (1, 0)])
def test_the_alert_page_matches_one_long_key_and_its_decisions(
    portal: TestClient, index: int, other: int
) -> None:
    key, message, _rows = ALERTS[index]
    response = portal.get(
        f"/teams/{TEAM}/weeks/{WEEK}/alert",
        params={"schema": "v1", "application": APPLICATION, "key": key},
    )
    assert response.status_code == 200, response.text
    assert message in response.text
    assert f"Decision on {message}" in response.text
    assert f"Decision on {ALERTS[other][1]}" not in response.text


def test_the_alert_page_refuses_a_key_longer_than_the_column(portal: TestClient) -> None:
    response = portal.get(
        f"/teams/{TEAM}/weeks/{WEEK}/alert",
        params={"schema": "v1", "application": APPLICATION, "key": PREFIX + "ab"},
    )
    assert response.status_code == 422
