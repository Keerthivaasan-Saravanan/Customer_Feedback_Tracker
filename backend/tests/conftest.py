from __future__ import annotations

import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import create_app  # noqa: E402
from app.models import Category, Feedback, Status  # noqa: E402
from app.storage import FeedbackStore  # noqa: E402

SEED_FILE = BACKEND_DIR / "data" / "seed_feedback.json"


def make_feedback(
    index: int,
    *,
    product: str = "Nimbus CRM",
    rating: int = 3,
    category: Category = Category.OTHER,
    status: Status = Status.NEW,
    day: int = 1,
) -> Feedback:
    return Feedback(
        id=f"FB-{index:04d}",
        customer_name=f"Customer {index}",
        customer_email=f"customer{index}@example.com",
        product=product,
        rating=rating,
        category=category,
        comments="This is a sample comment for testing.",
        submitted_at=datetime(2026, 1, day, 12, 0, tzinfo=timezone.utc),
        status=status,
    )


@pytest.fixture
def isolated_store(tmp_path: Path) -> FeedbackStore:
    """A store backed by a temporary copy of the seed file, so tests never touch real data."""
    data_file = tmp_path / "feedback.json"
    shutil.copyfile(SEED_FILE, data_file)
    return FeedbackStore(data_file)


@pytest.fixture
def client(isolated_store: FeedbackStore) -> TestClient:
    app = create_app(store=isolated_store)
    with TestClient(app) as test_client:
        yield test_client
