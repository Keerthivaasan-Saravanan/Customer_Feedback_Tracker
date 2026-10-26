"""Application-level errors that map to meaningful HTTP responses.

Each error carries a stable machine-readable `code` and an optional `context`
object with details a client can act on (for example, the status changes that
are currently allowed).
"""

from __future__ import annotations


class FeedbackError(Exception):
    """Base class for business-rule violations."""

    status_code = 400
    code = "feedback_error"

    def __init__(self, message: str, context: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.context = context or {}


class FeedbackNotFoundError(FeedbackError):
    status_code = 404
    code = "feedback_not_found"

    def __init__(self, feedback_id: str) -> None:
        super().__init__(f"Feedback '{feedback_id}' was not found.", context={"id": feedback_id})


class InvalidStatusTransitionError(FeedbackError):
    status_code = 409
    code = "invalid_status_transition"


class DeleteNotAllowedError(FeedbackError):
    status_code = 409
    code = "delete_not_allowed"
