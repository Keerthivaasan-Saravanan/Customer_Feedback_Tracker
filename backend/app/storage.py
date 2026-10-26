"""JSON-file persistence for feedback records.

Every public mutation runs its business-rule check and its write under one lock, so two
concurrent requests can never both pass a check against the same stale state. The whole
file is rewritten atomically (temp file, then os.replace) after each change.

IDs come from a persisted counter, so a deleted ID is never handed out again.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path

from pydantic import TypeAdapter

from . import services
from .errors import FeedbackNotFoundError
from .models import Feedback, FeedbackCreate, Status, StatusEvent

ID_PREFIX = "FB-"
_FEEDBACK_LIST_ADAPTER = TypeAdapter(list[Feedback])


def _number_from_id(feedback_id: str) -> int:
    digits = feedback_id.removeprefix(ID_PREFIX)
    return int(digits) if digits.isdigit() else 0


def _with_history(record: Feedback) -> Feedback:
    """Backfill the audit trail for records written before history existed."""
    if record.history:
        return record
    events = [StatusEvent(status=Status.NEW, at=record.submitted_at)]
    if record.status is not Status.NEW:
        events.append(StatusEvent(status=record.status, at=record.status_updated_at or record.submitted_at))
    return record.model_copy(update={"history": events})


class FeedbackStore:
    def __init__(self, data_file: Path, seed_file: Path | None = None) -> None:
        self._data_file = Path(data_file)
        self._lock = threading.RLock()
        self._records: list[Feedback] = []
        self._next_number = 1
        self._load_or_seed(seed_file)

    # ------------------------------------------------------------------ setup
    def _load_or_seed(self, seed_file: Path | None) -> None:
        if not self._data_file.exists():
            self._data_file.parent.mkdir(parents=True, exist_ok=True)
            if seed_file is not None and Path(seed_file).exists():
                self._data_file.write_text(Path(seed_file).read_text(encoding="utf-8"), encoding="utf-8")
            else:
                self._records = []
                self._persist()
        self._read_from_disk()

    def _read_from_disk(self) -> None:
        try:
            raw = json.loads(self._data_file.read_text(encoding="utf-8") or "{}")
            records = _FEEDBACK_LIST_ADAPTER.validate_python(raw.get("feedback", []))
        except (json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError(
                f"Feedback data file '{self._data_file}' is corrupt or has an invalid shape. "
                "Fix or delete it (it is recreated from seed data on next start)."
            ) from exc

        highest_used = max((_number_from_id(r.id) for r in records), default=0)
        stored_next = int(raw.get("next_number") or 0)
        self._records = [_with_history(r) for r in records]
        self._next_number = max(stored_next, highest_used + 1, 1)

    def _persist(self) -> None:
        self._data_file.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "next_number": self._next_number,
            "feedback": [record.model_dump(mode="json") for record in self._records],
        }
        fd, tmp_path = tempfile.mkstemp(dir=self._data_file.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2, ensure_ascii=False)
                handle.write("\n")
            os.replace(tmp_path, self._data_file)
        except BaseException:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise

    # ----------------------------------------------------------------- queries
    def all(self) -> list[Feedback]:
        with self._lock:
            return list(self._records)

    def get(self, feedback_id: str) -> Feedback:
        with self._lock:
            return self._records[self._index_of(feedback_id)]

    def _index_of(self, feedback_id: str) -> int:
        for index, record in enumerate(self._records):
            if record.id == feedback_id:
                return index
        raise FeedbackNotFoundError(feedback_id)

    # --------------------------------------------------------------- mutations
    def add(self, payload: FeedbackCreate) -> Feedback:
        with self._lock:
            now = datetime.now(timezone.utc)
            record = Feedback(
                id=f"{ID_PREFIX}{self._next_number:04d}",
                customer_name=payload.customer_name,
                customer_email=payload.customer_email,
                product=payload.product,
                rating=payload.rating,
                category=payload.category,
                comments=payload.comments,
                submitted_at=now,
                status=Status.NEW,
                status_updated_at=None,
                history=[StatusEvent(status=Status.NEW, at=now)],
            )
            self._next_number += 1
            self._records.append(record)
            self._persist()
            return record

    def transition_status(self, feedback_id: str, target: Status) -> Feedback:
        """Check the workflow rule and apply the change atomically."""
        with self._lock:
            index = self._index_of(feedback_id)
            current = self._records[index]
            services.validate_status_transition(current.status, target)
            now = datetime.now(timezone.utc)
            updated = current.model_copy(
                update={
                    "status": target,
                    "status_updated_at": now,
                    "history": [*current.history, StatusEvent(status=target, at=now)],
                }
            )
            self._records[index] = updated
            self._persist()
            return updated

    def delete(self, feedback_id: str) -> None:
        """Check the delete rule and remove the record atomically."""
        with self._lock:
            index = self._index_of(feedback_id)
            services.validate_deletable(self._records[index])
            del self._records[index]
            self._persist()
