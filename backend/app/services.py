"""Pure business logic: status workflow, filtering, sorting and summary aggregation.

Everything here operates on plain lists of `Feedback` models so it can be unit tested
without touching storage or HTTP.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta, timezone
from typing import Optional

from .errors import DeleteNotAllowedError, InvalidStatusTransitionError
from .models import Category, Feedback, SortOption, Status, TrendPoint

# Allowed forward transitions. Resolved is terminal.
ALLOWED_TRANSITIONS: dict[Status, Optional[Status]] = {
    Status.NEW: Status.REVIEWED,
    Status.REVIEWED: Status.RESOLVED,
    Status.RESOLVED: None,
}

RATING_LEVELS = (1, 2, 3, 4, 5)


def allowed_next_status(current: Status) -> Optional[Status]:
    """The single status this record may move to next, or None when it is final."""
    return ALLOWED_TRANSITIONS[current]


def validate_status_transition(current: Status, target: Status) -> None:
    """Raise InvalidStatusTransitionError unless current -> target is the next step.

    The error context names the allowed next status so clients can recover without guessing.
    """
    allowed = allowed_next_status(current)
    context = {
        "current_status": current.value,
        "requested_status": target.value,
        "allowed_next_status": allowed.value if allowed else None,
    }
    if current is Status.RESOLVED:
        raise InvalidStatusTransitionError(
            "Resolved feedback is final and its status cannot be changed.", context=context
        )
    if target is current:
        raise InvalidStatusTransitionError(f"Feedback is already '{current.value}'.", context=context)
    if allowed is not target:
        next_text = f"'{allowed.value}'" if allowed else "nothing"
        raise InvalidStatusTransitionError(
            f"Cannot move feedback from '{current.value}' to '{target.value}'. "
            f"The next allowed status is {next_text}.",
            context=context,
        )


def validate_deletable(feedback: Feedback) -> None:
    """Only New feedback may be deleted."""
    if feedback.status is not Status.NEW:
        raise DeleteNotAllowedError(
            f"Only New feedback can be deleted. This item is '{feedback.status.value}'.",
            context={"current_status": feedback.status.value},
        )


def filter_feedback(
    records: Iterable[Feedback],
    *,
    product: str | None = None,
    product_search: str | None = None,
    rating: int | None = None,
    category: Category | None = None,
    status: Status | None = None,
) -> list[Feedback]:
    """Apply optional filters. Product match is exact (case-insensitive);
    product_search is a case-insensitive substring match on the product name."""
    result: list[Feedback] = []
    needle = product_search.strip().lower() if product_search else None
    wanted_product = product.strip().lower() if product else None

    for item in records:
        if wanted_product is not None and item.product.lower() != wanted_product:
            continue
        if needle and needle not in item.product.lower():
            continue
        if rating is not None and item.rating != rating:
            continue
        if category is not None and item.category is not category:
            continue
        if status is not None and item.status is not status:
            continue
        result.append(item)
    return result


def sort_feedback(records: list[Feedback], sort: SortOption) -> list[Feedback]:
    """Return a new list sorted by the requested option. Ties break on ID for stability."""
    if sort is SortOption.NEWEST:
        return sorted(records, key=lambda f: (f.submitted_at, f.id), reverse=True)
    if sort is SortOption.OLDEST:
        return sorted(records, key=lambda f: (f.submitted_at, f.id))
    if sort is SortOption.RATING_HIGH:
        return sorted(records, key=lambda f: (f.rating, f.submitted_at), reverse=True)
    if sort is SortOption.RATING_LOW:
        return sorted(records, key=lambda f: (f.rating, f.submitted_at))
    raise ValueError(f"Unsupported sort option: {sort}")


def paginate(records: list[Feedback], limit: int, offset: int) -> list[Feedback]:
    """Return one page of an already sorted list."""
    return records[offset : offset + limit]


def week_start(day: date) -> date:
    """The Monday that starts the ISO week containing `day`."""
    return day - timedelta(days=day.weekday())


def weekly_trend(records: Iterable[Feedback], weeks: int, today: date) -> list[TrendPoint]:
    """Submission counts for the last `weeks` weeks (UTC, Monday start), oldest first.

    The current week is always the last point, even when it has no submissions yet.
    """
    current = week_start(today)
    starts = [current - timedelta(weeks=weeks - 1 - offset) for offset in range(weeks)]
    counts = dict.fromkeys(starts, 0)

    for record in records:
        bucket = week_start(record.submitted_at.astimezone(timezone.utc).date())
        if bucket in counts:
            counts[bucket] += 1

    return [TrendPoint(week_start=start, count=counts[start]) for start in starts]


def compute_average_rating(records: Iterable[Feedback]) -> float | None:
    """Mean rating rounded to two decimals, or None when there is no feedback."""
    ratings = [f.rating for f in records]
    if not ratings:
        return None
    return round(sum(ratings) / len(ratings), 2)


def compute_summary(records: Iterable[Feedback]) -> dict:
    """Aggregate totals, average rating, and per-category, per-status and per-rating counts.

    Every category, status and rating level is always present in the output (zero-filled)
    so that the frontend never has to handle missing keys.
    """
    items = list(records)

    by_category = {c.value: 0 for c in Category}
    by_status = {s.value: 0 for s in Status}
    by_rating = {str(r): 0 for r in RATING_LEVELS}

    for item in items:
        by_category[item.category.value] += 1
        by_status[item.status.value] += 1
        by_rating[str(item.rating)] += 1

    return {
        "total_count": len(items),
        "average_rating": compute_average_rating(items),
        "count_by_category": by_category,
        "count_by_status": by_status,
        "rating_distribution": by_rating,
    }
