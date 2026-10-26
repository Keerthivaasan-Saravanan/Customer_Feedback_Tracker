"""Unit tests for summary aggregation (average rating and counts)."""

from app.models import Category, Status
from app.services import compute_average_rating, compute_summary

from .conftest import make_feedback


def test_empty_summary_has_zero_counts_and_no_average():
    summary = compute_summary([])

    assert summary["total_count"] == 0
    assert summary["average_rating"] is None
    assert summary["count_by_category"] == {"Bug": 0, "Suggestion": 0, "Compliment": 0, "Other": 0}
    assert summary["count_by_status"] == {"New": 0, "Reviewed": 0, "Resolved": 0}
    assert summary["rating_distribution"] == {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}


def test_average_rating_is_mean_rounded_to_two_decimals():
    records = [
        make_feedback(1, rating=5),
        make_feedback(2, rating=4),
        make_feedback(3, rating=4),
    ]
    assert compute_average_rating(records) == 4.33


def test_average_rating_of_single_record_is_that_rating():
    assert compute_average_rating([make_feedback(1, rating=2)]) == 2.0


def test_counts_by_category_status_and_rating():
    records = [
        make_feedback(1, rating=5, category=Category.BUG, status=Status.NEW),
        make_feedback(2, rating=1, category=Category.BUG, status=Status.REVIEWED),
        make_feedback(3, rating=3, category=Category.COMPLIMENT, status=Status.RESOLVED),
        make_feedback(4, rating=3, category=Category.SUGGESTION, status=Status.NEW),
    ]

    summary = compute_summary(records)

    assert summary["total_count"] == 4
    assert summary["average_rating"] == 3.0
    assert summary["count_by_category"] == {"Bug": 2, "Suggestion": 1, "Compliment": 1, "Other": 0}
    assert summary["count_by_status"] == {"New": 2, "Reviewed": 1, "Resolved": 1}
    assert summary["rating_distribution"] == {"1": 1, "2": 0, "3": 2, "4": 0, "5": 1}


def test_category_counts_always_sum_to_total():
    records = [make_feedback(i, category=list(Category)[i % 4]) for i in range(10)]
    summary = compute_summary(records)

    assert sum(summary["count_by_category"].values()) == summary["total_count"]
    assert sum(summary["count_by_status"].values()) == summary["total_count"]
    assert sum(summary["rating_distribution"].values()) == summary["total_count"]


def test_seed_data_summary_is_consistent(isolated_store):
    summary = compute_summary(isolated_store.all())

    assert summary["total_count"] >= 12
    assert sum(summary["count_by_status"].values()) == summary["total_count"]
    assert 1 <= summary["average_rating"] <= 5
