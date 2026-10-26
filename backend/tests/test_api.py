"""HTTP-level tests covering filters, validation, workflow errors and persistence."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.storage import FeedbackStore

VALID_PAYLOAD = {
    "customer_name": "Test Customer",
    "customer_email": "test.customer@example.com",
    "product": "Nimbus CRM",
    "rating": 4,
    "category": "Suggestion",
    "comments": "Please add keyboard shortcuts for the pipeline board.",
}


def _first_with_status(client, status):
    items = client.get("/api/feedback", params={"status": status}).json()["items"]
    assert items, f"seed data should contain a {status} record"
    return items[0]


# ------------------------------------------------------------------ listing
def test_list_returns_seed_records(client):
    body = client.get("/api/feedback").json()
    assert body["total"] >= 12
    assert len(body["items"]) == body["total"]


def test_list_filters_by_status_and_category(client):
    body = client.get("/api/feedback", params={"status": "New", "category": "Bug"}).json()
    assert body["items"]
    assert all(item["status"] == "New" and item["category"] == "Bug" for item in body["items"])


def test_list_product_search(client):
    body = client.get("/api/feedback", params={"product_search": "pulse"}).json()
    assert body["items"]
    assert all("pulse" in item["product"].lower() for item in body["items"])


def test_list_rating_filter(client):
    body = client.get("/api/feedback", params={"rating": 5}).json()
    assert body["items"]
    assert all(item["rating"] == 5 for item in body["items"])


def test_list_sort_by_rating_high(client):
    ratings = [i["rating"] for i in client.get("/api/feedback", params={"sort": "rating_high"}).json()["items"]]
    assert ratings == sorted(ratings, reverse=True)


def test_list_invalid_filter_returns_meaningful_422(client):
    response = client.get("/api/feedback", params={"status": "Closed"})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"][0]["field"] == "status"


def test_list_rating_out_of_range_is_rejected(client):
    assert client.get("/api/feedback", params={"rating": 9}).status_code == 422


# ------------------------------------------------------------------ submit
def test_submit_creates_new_feedback(client):
    response = client.post("/api/feedback", json=VALID_PAYLOAD)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "New"
    assert body["id"].startswith("FB-")
    assert body["submitted_at"]


def test_submit_ids_are_unique_and_sequential(client):
    first = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    second = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    assert first != second
    assert int(second[3:]) == int(first[3:]) + 1


def test_submit_rejects_client_supplied_status(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "status": "Resolved"})
    assert response.status_code == 422  # extra fields are forbidden


def test_submit_rejects_fractional_rating(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "rating": 4.5})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "rating"


def test_submit_rejects_rating_out_of_range(client):
    assert client.post("/api/feedback", json={**VALID_PAYLOAD, "rating": 0}).status_code == 422
    assert client.post("/api/feedback", json={**VALID_PAYLOAD, "rating": 6}).status_code == 422


def test_submit_rejects_short_comment(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "comments": "too short"})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "comments"


def test_submit_rejects_long_comment(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "comments": "x" * 501})
    assert response.status_code == 422


def test_submit_rejects_whitespace_only_comment(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "comments": " " * 30})
    assert response.status_code == 422


def test_submit_rejects_invalid_email(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "customer_email": "not-an-email"})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "customer_email"


def test_submit_rejects_unknown_category(client):
    response = client.post("/api/feedback", json={**VALID_PAYLOAD, "category": "Praise"})
    assert response.status_code == 422


def test_submit_requires_name_and_product(client):
    payload = {**VALID_PAYLOAD, "customer_name": "   ", "product": ""}
    response = client.post("/api/feedback", json=payload)
    assert response.status_code == 422
    fields = {d["field"] for d in response.json()["error"]["details"]}
    assert {"customer_name", "product"} <= fields


# ---------------------------------------------------------- status workflow
def test_status_moves_new_to_reviewed_to_resolved(client):
    new_item = client.post("/api/feedback", json=VALID_PAYLOAD).json()
    fid = new_item["id"]

    reviewed = client.patch(f"/api/feedback/{fid}/status", json={"status": "Reviewed"})
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "Reviewed"

    resolved = client.patch(f"/api/feedback/{fid}/status", json={"status": "Resolved"})
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "Resolved"


def test_status_cannot_skip_reviewed(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    response = client.patch(f"/api/feedback/{fid}/status", json={"status": "Resolved"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "invalid_status_transition"


def test_resolved_feedback_cannot_change_status(client):
    resolved = _first_with_status(client, "Resolved")
    response = client.patch(f"/api/feedback/{resolved['id']}/status", json={"status": "Reviewed"})
    assert response.status_code == 409
    assert "final" in response.json()["error"]["message"]


def test_status_update_on_unknown_id_is_404(client):
    response = client.patch("/api/feedback/FB-9999/status", json={"status": "Reviewed"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "feedback_not_found"


def test_status_update_with_invalid_value_is_422(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    response = client.patch(f"/api/feedback/{fid}/status", json={"status": "Closed"})
    assert response.status_code == 422


# ------------------------------------------------------------------ delete
def test_delete_new_feedback_succeeds(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    assert client.delete(f"/api/feedback/{fid}").status_code == 204
    ids =[i["id"] for i in client.get("/api/feedback").json()["items"]]
    assert fid not in ids


def test_delete_reviewed_feedback_is_rejected(client):
    reviewed = _first_with_status(client, "Reviewed")
    response = client.delete(f"/api/feedback/{reviewed['id']}")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "delete_not_allowed"


def test_delete_resolved_feedback_is_rejected(client):
    resolved = _first_with_status(client, "Resolved")
    assert client.delete(f"/api/feedback/{resolved['id']}").status_code == 409


def test_delete_unknown_id_is_404(client):
    assert client.delete("/api/feedback/FB-9999").status_code == 404


# ----------------------------------------------------------------- summary
def test_summary_matches_listing(client):
    summary = client.get("/api/feedback/summary").json()
    listing = client.get("/api/feedback").json()

    assert summary["total_count"] == listing["total"]
    assert sum(summary["count_by_status"].values()) == listing["total"]
    assert sum(summary["count_by_category"].values()) == listing["total"]
    expected_average = round(sum(i["rating"] for i in listing["items"]) / listing["total"], 2)
    assert summary["average_rating"] == expected_average


def test_summary_updates_after_submit(client):
    before = client.get("/api/feedback/summary").json()
    client.post("/api/feedback", json={**VALID_PAYLOAD, "rating": 5})
    after = client.get("/api/feedback/summary").json()

    assert after["total_count"] == before["total_count"] + 1
    assert after["count_by_status"]["New"] == before["count_by_status"]["New"] + 1
    assert after["rating_distribution"]["5"] == before["rating_distribution"]["5"] + 1


def test_summary_average_is_null_when_empty(tmp_path):
    empty_store = FeedbackStore(tmp_path / "empty.json")

    with TestClient(create_app(store=empty_store)) as client:
        summary = client.get("/api/feedback/summary").json()
    assert summary["total_count"] == 0
    assert summary["average_rating"] is None


# -------------------------------------------------------------- persistence
def test_changes_are_persisted_to_json_file(client, isolated_store):
    created = client.post("/api/feedback", json=VALID_PAYLOAD).json()
    client.patch(f"/api/feedback/{created['id']}/status", json={"status": "Reviewed"})

    reloaded = FeedbackStore(isolated_store._data_file)
    record = reloaded.get(created["id"])
    assert record.status.value == "Reviewed"
    assert record.customer_email == VALID_PAYLOAD["customer_email"]


# ------------------------------------------------------------ id stability
def test_ids_are_not_reused_after_delete(client):
    first = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    assert client.delete(f"/api/feedback/{first}").status_code == 204
    second = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    assert second != first


def test_ids_counter_survives_restart(isolated_store):
    data_file = isolated_store._data_file
    with TestClient(create_app(store=isolated_store)) as client:
        created = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
        client.delete(f"/api/feedback/{created}")

    reloaded = FeedbackStore(data_file)
    with TestClient(create_app(store=reloaded)) as client:
        assert client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"] != created


# ----------------------------------------------------------------- trend
def test_trend_returns_requested_number_of_weeks(client):
    points = client.get("/api/feedback/trend", params={"weeks": 6}).json()
    assert len(points) == 6
    assert all({"week_start", "count"} <= set(p) for p in points)
    starts = [p["week_start"] for p in points]
    assert starts == sorted(starts)


def test_trend_counts_sum_to_recent_submissions(client):
    points = client.get("/api/feedback/trend", params={"weeks": 52}).json()
    assert sum(p["count"] for p in points) <= client.get("/api/feedback/summary").json()["total_count"]


def test_trend_rejects_out_of_range_weeks(client):
    assert client.get("/api/feedback/trend", params={"weeks": 0}).status_code == 422
    assert client.get("/api/feedback/trend", params={"weeks": 53}).status_code == 422


def test_trend_route_is_not_captured_by_id_route(client):
    response = client.get("/api/feedback/trend")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


# ------------------------------------------------------------------- meta
def test_meta_lists_dropdown_values(client):
    meta = client.get("/api/meta").json()
    assert meta["categories"] == ["Bug", "Suggestion", "Compliment", "Other"]
    assert meta["statuses"] == ["New", "Reviewed", "Resolved"]
    assert "Nimbus CRM" in meta["products"]
    assert meta["products"] == sorted(meta["products"], key=str.lower)


# -------------------------------------------------------------- pagination
def test_pagination_returns_requested_page(client):
    body = client.get("/api/feedback", params={"limit": 5, "offset": 0}).json()
    assert len(body["items"]) == 5
    assert body["limit"] == 5 and body["offset"] == 0
    assert body["total"] >= 12  # total reflects all matches, not the page size


def test_pages_do_not_overlap(client):
    first = {i["id"] for i in client.get("/api/feedback", params={"limit": 5, "offset": 0}).json()["items"]}
    second = {i["id"] for i in client.get("/api/feedback", params={"limit": 5, "offset": 5}).json()["items"]}
    assert first.isdisjoint(second)


def test_offset_beyond_end_returns_empty_page_with_total(client):
    body = client.get("/api/feedback", params={"offset": 10_000}).json()
    assert body["items"] == []
    assert body["total"] >= 12


def test_pagination_respects_filters(client):
    body = client.get("/api/feedback", params={"category": "Bug", "limit": 2}).json()
    assert len(body["items"]) <= 2
    assert body["total"] == client.get("/api/feedback", params={"category": "Bug"}).json()["total"]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
def test_invalid_paging_values_are_rejected(client, params):
    assert client.get("/api/feedback", params=params).status_code == 422


# ------------------------------------------------------------ single record
def test_get_single_feedback(client):
    fid = _first_with_status(client, "New")["id"]
    response = client.get(f"/api/feedback/{fid}")
    assert response.status_code == 200
    assert response.json()["id"] == fid


def test_get_unknown_feedback_is_404(client):
    response = client.get("/api/feedback/FB-9999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "feedback_not_found"


# ----------------------------------------------------------- status history
def test_status_change_records_timestamp(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    assert client.get(f"/api/feedback/{fid}").json()["status_updated_at"] is None

    client.patch(f"/api/feedback/{fid}/status", json={"status": "Reviewed"})
    record = client.get(f"/api/feedback/{fid}").json()
    assert record["status_updated_at"] is not None


def test_corrupt_data_file_gives_clear_error(tmp_path):
    bad_file = tmp_path / "broken.json"
    bad_file.write_text("{not valid json", encoding="utf-8")
    with pytest.raises(RuntimeError, match="corrupt"):
        FeedbackStore(bad_file)


# ----------------------------------------------------- status history audit
def test_new_record_starts_with_one_history_event(client):
    created = client.post("/api/feedback", json=VALID_PAYLOAD).json()
    assert [e["status"] for e in created["history"]] == ["New"]


def test_history_grows_with_each_status_change(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    client.patch(f"/api/feedback/{fid}/status", json={"status": "Reviewed"})
    client.patch(f"/api/feedback/{fid}/status", json={"status": "Resolved"})

    events = client.get(f"/api/feedback/{fid}").json()["history"]
    assert [e["status"] for e in events] == ["New", "Reviewed", "Resolved"]
    times = [e["at"] for e in events]
    assert times == sorted(times)


def test_rejected_transition_adds_no_history(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    client.patch(f"/api/feedback/{fid}/status", json={"status": "Resolved"})
    assert len(client.get(f"/api/feedback/{fid}").json()["history"]) == 1


def test_seed_records_are_backfilled_with_history(isolated_store):
    resolved = next(r for r in isolated_store.all() if r.status.value == "Resolved")
    assert [e.status.value for e in resolved.history] == ["New", "Resolved"]


# ------------------------------------------------- actionable conflict errors
def test_conflict_error_names_the_allowed_next_status(client):
    fid = client.post("/api/feedback", json=VALID_PAYLOAD).json()["id"]
    body = client.patch(f"/api/feedback/{fid}/status", json={"status": "Resolved"}).json()
    assert body["error"]["code"] == "invalid_status_transition"
    assert body["error"]["context"] == {
        "current_status": "New",
        "requested_status": "Resolved",
        "allowed_next_status": "Reviewed",
    }


def test_final_status_error_has_no_allowed_next(client):
    resolved = _first_with_status(client, "Resolved")
    body = client.patch(f"/api/feedback/{resolved['id']}/status", json={"status": "New"}).json()
    assert body["error"]["context"]["allowed_next_status"] is None


def test_delete_conflict_reports_current_status(client):
    reviewed = _first_with_status(client, "Reviewed")
    body = client.delete(f"/api/feedback/{reviewed['id']}").json()
    assert body["error"]["context"] == {"current_status": "Reviewed"}


# -------------------------------------------------- consistent error bodies
def test_unknown_route_returns_json_error(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_wrong_method_returns_json_error(client):
    response = client.put("/api/health")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"


def test_unexpected_failure_returns_safe_500(isolated_store, monkeypatch):
    def broken():
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(isolated_store, "all", broken)
    with TestClient(create_app(store=isolated_store), raise_server_exceptions=False) as client:
        response = client.get("/api/feedback")
    assert response.status_code == 500
    body = response.json()["error"]
    assert body["code"] == "internal_error"
    assert "disk on fire" not in response.text  # internals are never exposed
