# Customer Feedback Tracker

A full-stack application for recording, reviewing and summarising customer feedback.

- **Backend:** Python 3.11+, FastAPI, Pydantic v2, local JSON storage (no database).
- **Frontend:** React 18 + Vite. Hash-based routing, plain CSS, no UI framework.
- **Authentication:** not required (per the brief).

---

## Project layout

```
customer-feedback-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py           # Routes, error handlers, CORS, lifespan store setup
│   │   ├── models.py         # Enums and Pydantic request/response models
│   │   ├── services.py       # Business rules, filtering, sorting, paging, summary
│   │   ├── storage.py        # JSON persistence (atomic writes, thread lock)
│   │   └── errors.py         # Domain errors mapped to HTTP status codes
│   ├── data/seed_feedback.json   # 15 fictional seed records (tracked)
│   ├── tests/                # pytest: unit tests for rules and summary, API tests
│   ├── pytest.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Shell: route to page, toast host
│   │   ├── pages/                  # DashboardPage, FeedbackPage, SubmitPage
│   │   ├── components/             # Layout, charts, table, drawer, form, shared UI
│   │   ├── context/AppContext.jsx  # Data version (refetch trigger) and toasts
│   │   ├── hooks/                  # Data fetching hooks and hash router
│   │   ├── utils/format.js         # Dates, weekly buckets, CSV helpers
│   │   ├── api.js                  # API client with normalised errors
│   │   ├── feedbackActions.js      # Status change, delete, CSV export
│   │   ├── validation.js           # Form rules mirroring the backend
│   │   └── styles.css              # Design tokens and layout
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Running the application

You need **Python 3.11+** and **Node.js 18+**. Run the backend and frontend in two terminals.

### 1. Backend (FastAPI on port 8000)

**Windows (PowerShell)**

```powershell
cd customer-feedback-tracker\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**macOS / Linux**

```bash
cd customer-feedback-tracker/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: http://127.0.0.1:8000/docs
- On first start, `backend/data/feedback.json` is created from `seed_feedback.json`.

### 2. Frontend (Vite on port 5173)

```bash
cd customer-feedback-tracker/frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the backend, so no CORS setup is needed.

### Tests

```bash
cd backend
pytest              # 89 tests: business rules, store atomicity, history, API behaviour

cd frontend
npm test            # 31 tests: form validation, API client (errors, queries, 204), formatting helpers
```

Backend tests use a temporary copy of the seed file, so they never change real data. Frontend tests use Node's built-in test runner (Node 20 or newer) and need no extra packages.

### Where the business rules live

- `backend/app/services.py`: pure rule checks (status workflow, delete rule), filtering, sorting, summary and trend calculations.
- `backend/app/storage.py`: applies those checks and the write under one lock, so concurrent requests cannot break the workflow.
- `frontend/src/validation.js`: form rules that mirror the backend, so users see errors before submitting. The server remains the authority.

### Resetting the data

Stop the backend, delete `backend/data/feedback.json`, and start it again.

### Production build

```bash
cd frontend
npm run build      # outputs frontend/dist
```

---

## Screens

- **Dashboard:** KPI cards (total with week-over-week change, average rating, open items, resolution rate), a weekly submissions chart, category donut, rating histogram, workflow pipeline and the latest submissions.
- **Feedback:** status tabs with counts, filters (product search, product, category, rating, sort), a table with one-click status actions, pagination (10, 25 or 50 rows), a detail drawer with the full message and progress steps, delete confirmation, and CSV export of the filtered list.
- **Submit feedback:** validated form with a live preview, submission rules, and a confirmation card with the new record ID.

Toast notifications report every action. Loading, empty, no-match and API-error states are shown on each data view. The detail drawer includes a status history timeline. An error boundary keeps a rendering failure on one view from blanking the whole app.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/feedback` | List feedback, paged. Query: `product`, `product_search`, `rating` (1–5), `category`, `status`, `sort` (`newest`, `oldest`, `rating_high`, `rating_low`), `limit` (1–100, default 25), `offset` (default 0). |
| GET | `/api/feedback/{id}` | One record, including its `history` (every status event with its timestamp). |
| POST | `/api/feedback` | Submit feedback. Returns `201` with the record (status `New`). |
| PATCH | `/api/feedback/{id}/status` | Move status forward. Body: `{"status": "Reviewed" \| "Resolved"}`. |
| DELETE | `/api/feedback/{id}` | Delete. Only allowed while `New` (`204`). |
| GET | `/api/feedback/summary` | Total, average rating, counts by category, status and rating. |
| GET | `/api/feedback/trend?weeks=8` | Submissions per week (UTC, Monday start), oldest first, current week last. `weeks` is 1–52. |
| GET | `/api/meta` | Dropdown values and comment length limits. |
| GET | `/api/health` | Liveness check. |

List responses have the shape `{"items": [...], "total": N, "limit": L, "offset": O}`. `total` is the number of matches before paging.

### Error format

Every error uses the same shape:

```json
{
  "error": {
    "code": "invalid_status_transition",
    "message": "Cannot move feedback from 'New' to 'Resolved'. Status must follow New -> Reviewed -> Resolved.",
    "details": null,
    "context": {
      "current_status": "New",
      "requested_status": "Resolved",
      "allowed_next_status": "Reviewed"
    }
  }
}
```

`details` lists per-field problems for validation errors. `context` carries the values a client needs to react (for example, the allowed next step after a rejected status change) and is `null` when there is nothing extra to report.

| HTTP | Code | When |
|---|---|---|
| 422 | `validation_error` | Bad input or query value. `details` lists each field. |
| 404 | `feedback_not_found` | Unknown ID. |
| 404 | `not_found` | Unknown route. |
| 405 | `method_not_allowed` | Wrong HTTP method for a known route. |
| 409 | `invalid_status_transition` | Skipped or backwards change, a no-op change, or any change to Resolved feedback. `context` gives the current status, the requested status and the allowed next status. |
| 409 | `delete_not_allowed` | Deleting feedback that is not New. `context` gives the current status. |
| 500 | `internal_error` | Unexpected failure. The traceback is logged on the server and never sent to the client. |

---

## Business rules

- Rating is a whole number from 1 to 5. Fractional values such as `4.5` are rejected.
- Comments must be 10 to 500 characters after trimming surrounding whitespace.
- Customer name and product are required. Customer email must be a valid address.
- Category must be `Bug`, `Suggestion`, `Compliment` or `Other`.
- Status flows `New` → `Reviewed` → `Resolved`. Resolved is final.
- Only `New` feedback can be deleted.
- The average rating is calculated by the backend, rounded to two decimals, and `null` when there is no feedback.

---

## Assumptions

1. **Single user, no authentication.** Anyone who can reach the app can change any record, as the brief allows.
2. **Local JSON storage.** All data lives in one file. This suits one running server process, not several writers at once.
3. **Summary is global.** The KPI cards and charts describe all feedback, not the filtered list. The filtered count is shown in the table footer.
4. **Product filter vs. product search.** The dropdown matches a product name exactly. The search box matches any part of the name, ignoring case.
5. **Customer emails are not unique.** One customer may submit several feedback items.
6. **IDs** are sequential (`FB-0001`, …) and never reused. A persisted counter (`next_number` in the data file) keeps numbering going even after deletes and restarts.
7. **Timestamps** are stored in UTC and shown in the viewer's local time.
8. **One status step at a time.** The UI offers only the next step, and the API rejects skipped or same-status changes with `409`.
9. **`status_updated_at`** records the last status change. It is empty for records that have never changed status. The `history` list keeps every step with its time, starting with the `New` event at submission. Records saved before history existed get it back-filled when loaded.
10. **Dashboard trend** is computed by the backend over the whole dataset, so it is not limited by the list page size.
11. **Seed data** is 15 fictional records covering every category, status and rating, with no real personal information.
