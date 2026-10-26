"""Domain enums and Pydantic request/response models."""

from __future__ import annotations

import re
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

COMMENT_MIN_LENGTH = 10
COMMENT_MAX_LENGTH = 500
EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


class Category(str, Enum):
    BUG = "Bug"
    SUGGESTION = "Suggestion"
    COMPLIMENT = "Compliment"
    OTHER = "Other"


class Status(str, Enum):
    NEW = "New"
    REVIEWED = "Reviewed"
    RESOLVED = "Resolved"


class SortOption(str, Enum):
    NEWEST = "newest"
    OLDEST = "oldest"
    RATING_HIGH = "rating_high"
    RATING_LOW = "rating_low"


class FeedbackCreate(BaseModel):
    """Payload accepted when a customer submits feedback."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    customer_name: str = Field(..., min_length=1, max_length=120)
    customer_email: str = Field(..., max_length=254)
    product: str = Field(..., min_length=1, max_length=120)
    rating: int = Field(..., ge=1, le=5, strict=True)
    category: Category
    comments: str = Field(..., min_length=COMMENT_MIN_LENGTH, max_length=COMMENT_MAX_LENGTH)

    @field_validator("customer_email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip()
        if not EMAIL_PATTERN.match(value):
            raise ValueError("must be a valid email address")
        return value


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Status


class StatusEvent(BaseModel):
    """One entry in a record's audit trail: the status it entered and when."""

    status: Status
    at: datetime


class Feedback(BaseModel):
    """A stored feedback record."""

    id: str
    customer_name: str
    customer_email: str
    product: str
    rating: int
    category: Category
    comments: str
    submitted_at: datetime
    status: Status
    status_updated_at: datetime | None = None
    history: list[StatusEvent] = Field(default_factory=list)


class FeedbackList(BaseModel):
    items: list[Feedback]
    total: int = Field(..., description="Number of records matching the filters, before paging")
    limit: int
    offset: int


class Summary(BaseModel):
    total_count: int
    average_rating: float | None
    count_by_category: dict[str, int]
    count_by_status: dict[str, int]
    rating_distribution: dict[str, int]


class Meta(BaseModel):
    categories: list[str]
    statuses: list[str]
    sort_options: list[str]
    products: list[str]
    comment_min_length: int
    comment_max_length: int


class TrendPoint(BaseModel):
    week_start: date
    count: int
