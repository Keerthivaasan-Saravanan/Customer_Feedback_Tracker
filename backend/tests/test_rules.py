"""Unit tests for workflow enforcement, filtering, sorting, trends and store-level rules."""

from datetime import date, datetime, timezone

import pytest

from app.errors import DeleteNotAllowedError, InvalidStatusTransitionError
from app.models import Category, FeedbackCreate, SortOption, Status
from app.services import (
    filter_feedback,
    sort_feedback,
    validate_deletable,
    validate_status_transition,
    week_start,
    weekly_trend,
)

from .conftest import make_feedback


# ----------------------------------------------------------- status workflow
@pytest.mark.parametrize(
    ("current", "target"),
    [(Status.NEW, Status.REVIEWED), (Status.REVIEWED, Status.RESOLVED)],
)
def test_allowed_forward_transitions(current, target):
    validate_status_transition(current, target)  # must not raise


@pytest.mark.parametrize(
    ("current", "target"),
    [
        (Status.NEW, Status.RESOLVED),       # cannot skip Reviewed
        (Status.REVIEWED, Status.NEW),       # cannot move backwards
        (Status.NEW, Status.NEW),            # no-op is rejected
        (Status.REVIEWED, Status.REVIEWED),
    ],
)
def test_invalid_transitions_are_rejected(current, target):
    with pytest.raises(InvalidStatusTransitionError):
        validate_status_transition(current, target)


@pytest.mark.parametrize("target", list(Status))
def test_resolved_feedback_is_terminal(target):
    with pytest.raises(InvalidStatusTransitionError, match="final"):
        validate_status_transition(Status.RESOLVED, target)


# ------------------------------------------------------------- delete rule
def test_only_new_feedback_is_deletable():
    validate_deletable(make_feedback(1, status=Status.NEW))

    for status in (Status.REVIEWED, Status.RESOLVED):
        with pytest.raises(DeleteNotAllowedError):
            validate_deletable(make_feedback(2, status=status))


# --------------------------------------------------------------- filtering
@pytest.fixture
def sample_records():
    return [
        make_feedback(1, product="Nimbus CRM", rating=5, category=Category.COMPLIMENT, status=Status.NEW),
        make_feedback(2, product="Nimbus CRM", rating=2, category=Category.BUG, status=Status.REVIEWED),
        make_feedback(3, product="Pulse Analytics", rating=4, category=Category.SUGGESTION, status=Status.NEW),
        make_feedback(4, product="Ledger Pro", rating=1, category=Category.BUG, status=Status.RESOLVED),
    ]


def test_no_filters_returns_everything(sample_records):
    assert len(filter_feedback(sample_records)) == 4


def test_product_filter_is_exact_and_case_insensitive(sample_records):
    result = filter_feedback(sample_records, product="nimbus crm")
    assert [r.id for r in result] == ["FB-0001", "FB-0002"]


def test_product_search_is_substring_and_case_insensitive(sample_records):
    result = filter_feedback(sample_records, product_search="ANA")
    assert [r.id for r in result] == ["FB-0003"]


def test_combined_filters_are_anded(sample_records):
    result = filter_feedback(
        sample_records,
        category=Category.BUG,
        status=Status.REVIEWED,
    )
    assert [r.id for r in result] == ["FB-0002"]


def test_rating_and_status_filters(sample_records):
    assert [r.id for r in filter_feedback(sample_records, rating=5)] == ["FB-0001"]
    assert [r.id for r in filter_feedback(sample_records, status=Status.NEW)] == ["FB-0001", "FB-0003"]


def test_filter_with_no_matches_returns_empty(sample_records):
    assert filter_feedback(sample_records, product="Unknown") == []


# ----------------------------------------------------------------- sorting
def test_sort_newest_and_oldest(sample_records):
    newest = [r.id for r in sort_feedback(sample_records, SortOption.NEWEST)]
    oldest = [r.id for r in sort_feedback(sample_records, SortOption.OLDEST)]
    assert newest == list(reversed(oldest))


def test_sort_by_rating_high_and_low(sample_records):
    high = [r.rating for r in sort_feedback(sample_records, SortOption.RATING_HIGH)]
    low = [r.rating for r in sort_feedback(sample_records, SortOption.RATING_LOW)]
    assert high == [5, 4, 2, 1]
    assert low == [1, 2, 4, 5]


def test_sort_does_not_mutate_input(sample_records):
    original = [r.id for r in sample_records]
    sort_feedback(sample_records, SortOption.RATING_LOW)
    assert [r.id for r in sample_records] == original


# ------------------------------------------------------------ weekly trend
def test_week_start_is_monday():
    assert week_start(date(2026, 10, 26)) == date(2026, 10, 26)  # Monday
    assert week_start(date(2026, 10, 30)) == date(2026, 10, 26)  # Friday
    assert week_start(date(2026, 10, 25)) == date(2026, 10, 19)  # Sunday belongs to prior week


def _submitted_at(index: int, when: datetime):
    return make_feedback(index).model_copy(update={"submitted_at": when})


def test_weekly_trend_buckets_and_order():
    today = date(2026, 10, 28)  # Wednesday
    records = [
        _submitted_at(1, datetime(2026, 10, 27, 9, tzinfo=timezone.utc)),   # current week
        _submitted_at(2, datetime(2026, 10, 26, 23, tzinfo=timezone.utc)),  # current week (Monday late)
        _submitted_at(3, datetime(2026, 10, 19, 1, tzinfo=timezone.utc)),   # previous week
        _submitted_at(4, datetime(2026, 1, 1, tzinfo=timezone.utc)),        # outside the window
    ]
    points = weekly_trend(records, weeks=3, today=today)

    assert [p.week_start for p in points] == [date(2026, 10, 12), date(2026, 10, 19), date(2026, 10, 26)]
    assert [p.count for p in points] == [0, 1, 2]


def test_weekly_trend_always_includes_current_empty_week():
    points = weekly_trend([], weeks=4, today=date(2026, 10, 28))
    assert len(points) == 4
    assert points[-1].week_start == date(2026, 10, 26)
    assert all(p.count == 0 for p in points)


# ------------------------------------------------- store-level atomic rules
def _payload() -> FeedbackCreate:
    return FeedbackCreate(
        customer_name="Store Test",
        customer_email="store@example.com",
        product="Ledger Pro",
        rating=3,
        category="Other",
        comments="Store level rule test comment.",
    )


def test_store_rejects_invalid_transition_without_changing_record(isolated_store):
    record = isolated_store.add(_payload())
    with pytest.raises(InvalidStatusTransitionError):
        isolated_store.transition_status(record.id, Status.RESOLVED)
    assert isolated_store.get(record.id).status is Status.NEW


def test_store_delete_rule_is_enforced_inside_store(isolated_store):
    record = isolated_store.add(_payload())
    isolated_store.transition_status(record.id, Status.REVIEWED)
    with pytest.raises(DeleteNotAllowedError):
        isolated_store.delete(record.id)
    assert isolated_store.get(record.id).status is Status.REVIEWED
