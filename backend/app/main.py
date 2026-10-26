"""FastAPI application: routes, error handling and dependency wiring."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, FastAPI, Query, Request, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import services
from .errors import FeedbackError
from .models import (
    COMMENT_MAX_LENGTH,
    COMMENT_MIN_LENGTH,
    Category,
    Feedback,
    FeedbackCreate,
    FeedbackList,
    Meta,
    SortOption,
    Status,
    StatusUpdate,
    Summary,
    TrendPoint,
)
from .storage import FeedbackStore

logger = logging.getLogger("feedback_tracker")

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DATA_FILE = BACKEND_DIR / "data" / "feedback.json"
DEFAULT_SEED_FILE = BACKEND_DIR / "data" / "seed_feedback.json"
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

api = APIRouter(prefix="/api")


def get_store(request: Request) -> FeedbackStore:
    return request.app.state.store


StoreDep = Annotated[FeedbackStore, Depends(get_store)]


# --------------------------------------------------------------------- routes
@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@api.get("/meta", response_model=Meta)
def get_meta(store: StoreDep) -> Meta:
    products = sorted({item.product for item in store.all()}, key=str.lower)
    return Meta(
        categories=[c.value for c in Category],
        statuses=[s.value for s in Status],
        sort_options=[s.value for s in SortOption],
        products=products,
        comment_min_length=COMMENT_MIN_LENGTH,
        comment_max_length=COMMENT_MAX_LENGTH,
    )


@api.get("/feedback", response_model=FeedbackList)
def list_feedback(
    store: StoreDep,
    product: Optional[str] = Query(None, max_length=120, description="Exact product name"),
    product_search: Optional[str] = Query(None, max_length=120, description="Substring match on product name"),
    rating: Optional[int] = Query(None, ge=1, le=5),
    category: Optional[Category] = None,
    status_filter: Optional[Status] = Query(None, alias="status"),
    sort: SortOption = SortOption.NEWEST,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> FeedbackList:
    matched = services.filter_feedback(
        store.all(),
        product=product,
        product_search=product_search,
        rating=rating,
        category=category,
        status=status_filter,
    )
    ordered = services.sort_feedback(matched, sort)
    page = services.paginate(ordered, limit=limit, offset=offset)
    return FeedbackList(items=page, total=len(ordered), limit=limit, offset=offset)


@api.get("/feedback/summary", response_model=Summary)
def get_summary(store: StoreDep) -> dict:
    return services.compute_summary(store.all())


@api.get("/feedback/trend", response_model=list[TrendPoint])
def get_trend(store: StoreDep, weeks: int = Query(8, ge=1, le=52)) -> list[TrendPoint]:
    today = datetime.now(timezone.utc).date()
    return services.weekly_trend(store.all(), weeks=weeks, today=today)


# Declared after the literal /feedback/* paths so they are matched first.
@api.get("/feedback/{feedback_id}", response_model=Feedback)
def get_feedback(feedback_id: str, store: StoreDep) -> Feedback:
    return store.get(feedback_id)


@api.post("/feedback", response_model=Feedback, status_code=status.HTTP_201_CREATED)
def submit_feedback(payload: FeedbackCreate, store: StoreDep) -> Feedback:
    return store.add(payload)


@api.patch("/feedback/{feedback_id}/status", response_model=Feedback)
def update_status(feedback_id: str, payload: StatusUpdate, store: StoreDep) -> Feedback:
    return store.transition_status(feedback_id, payload.status)


@api.delete("/feedback/{feedback_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_feedback(feedback_id: str, store: StoreDep) -> Response:
    store.delete(feedback_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------ error handlers
def _error_body(
    code: str,
    message: str,
    details: list[dict] | None = None,
    context: dict | None = None,
) -> dict:
    """The single error shape every endpoint returns."""
    return {"error": {"code": code, "message": message, "details": details, "context": context}}


async def handle_feedback_error(_: Request, exc: FeedbackError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.code, exc.message, context=exc.context or None),
    )


HTTP_ERROR_CODES = {404: "not_found", 405: "method_not_allowed"}


async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = HTTP_ERROR_CODES.get(exc.status_code, "http_error")
    return JSONResponse(status_code=exc.status_code, content=_error_body(code, str(exc.detail)))


async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    # Log the full traceback server-side; never expose internals to the client.
    logger.error("Unhandled error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=_error_body("internal_error", "An unexpected error occurred. Please try again."),
    )


async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for issue in exc.errors():
        location = [str(part) for part in issue["loc"] if part not in ("body", "query", "path")]
        message = issue["msg"].removeprefix("Value error, ")
        details.append({"field": ".".join(location) or "request", "message": message})
    first = details[0] if details else {"field": "request", "message": "Invalid request."}
    summary = f"Invalid {first['field']}: {first['message']}."
    return JSONResponse(
        status_code=422,
        content=_error_body("validation_error", summary, details),
    )


# ---------------------------------------------------------------- app factory
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Create the default store on startup so importing this module has no side effects."""
    if getattr(app.state, "store", None) is None:
        data_file = Path(os.environ.get("FEEDBACK_DATA_FILE", DEFAULT_DATA_FILE))
        app.state.store = FeedbackStore(data_file, seed_file=DEFAULT_SEED_FILE)
    yield


def create_app(store: FeedbackStore | None = None) -> FastAPI:
    app = FastAPI(
        title="Customer Feedback Tracker API",
        version="1.1.0",
        description="Record, review and summarise customer feedback. Data is stored in a local JSON file.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.add_exception_handler(FeedbackError, handle_feedback_error)
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_error)
    app.add_exception_handler(Exception, handle_unexpected_error)
    app.include_router(api)
    app.state.store = store
    return app


app = create_app()
