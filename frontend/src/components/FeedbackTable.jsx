import { ACTION_LABELS, NEXT_STATUS, PAGE_SIZES } from "../constants.js";
import { formatDate, timeAgo } from "../utils/format.js";
import Icon from "./Icon.jsx";
import { Avatar, CategoryPill, EmptyState, Notice, StarRating, StatusBadge } from "./common.jsx";

const HEADERS = ["Customer", "Product", "Rating", "Category", "Feedback", "Status", "Actions"];

function SkeletonRows() {
  return Array.from({ length: 5 }, (_, row) => (
    <tr key={row} aria-hidden="true">
      {HEADERS.map((header) => (
        <td key={header}>
          <span className="skeleton skeleton--line" />
        </td>
      ))}
    </tr>
  ));
}

function Pagination({ total, limit, offset, onOffset, onLimit }) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);

  return (
    <footer className="pager">
      <div className="pager__info">
        Showing <strong>{first}</strong>–<strong>{last}</strong> of <strong>{total}</strong>
      </div>
      <div className="pager__controls">
        <label className="pager__size">
          <span>Rows</span>
          <select className="select select--compact" value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => onOffset(Math.max(0, offset - limit))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" size={16} />
        </button>
        <span className="pager__page">
          Page {currentPage} of {pageCount}
        </span>
        <button
          type="button"
          className="btn btn--icon"
          onClick={() => onOffset(offset + limit)}
          disabled={currentPage >= pageCount}
          aria-label="Next page"
        >
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </footer>
  );
}

export default function FeedbackTable({
  items,
  total,
  limit,
  offset,
  loading,
  error,
  filtersActive,
  busyId,
  selectedId,
  onRetry,
  onClearFilters,
  onOpen,
  onAdvance,
  onDelete,
  onOffset,
  onLimit,
}) {
  const hasItems = items.length > 0;
  const showEmpty = !loading && !error && !hasItems;

  return (
    <section className="card card--flush" aria-labelledby="feedback-table-title">
      <header className="card__header">
        <div>
          <h2 id="feedback-table-title" className="card__title">
            Feedback records
          </h2>
          <p className="card__subtitle">Select a row to view the full message and timeline.</p>
        </div>
        {loading && hasItems && <span className="updating">Updating…</span>}
      </header>

      {error && (
        <div className="card__pad">
          <Notice tone="error" title="We could not load feedback" onRetry={onRetry}>
            {error.message}
          </Notice>
        </div>
      )}

      {!error && (
        <div className="table-wrap">
          <table className={`data-table ${loading && hasItems ? "is-loading" : ""}`}>
            <caption className="sr-only">Customer feedback with status actions</caption>
            <thead>
              <tr>
                {HEADERS.map((header) => (
                  <th key={header} scope="col" className={header === "Actions" ? "col-actions" : undefined}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !hasItems && <SkeletonRows />}

              {hasItems &&
                items.map((item) => {
                  const next = NEXT_STATUS[item.status];
                  const isBusy = busyId === item.id;
                  const isSelected = selectedId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={`row ${isSelected ? "is-selected" : ""} ${isBusy ? "is-busy" : ""}`}
                      onClick={() => onOpen(item)}
                    >
                      <td>
                        <div className="person">
                          <Avatar name={item.customer_name} />
                          <div>
                            <div className="person__name">{item.customer_name}</div>
                            <div className="person__sub">{item.customer_email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="prod">
                          <span className="prod__name">{item.product}</span>
                          <span className="prod__id mono">{item.id}</span>
                        </div>
                      </td>
                      <td>
                        <StarRating value={item.rating} />
                      </td>
                      <td>
                        <CategoryPill category={item.category} />
                      </td>
                      <td className="cell-clamp" title={item.comments}>
                        {item.comments}
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                        <div className="muted small" title={formatDate(item.submitted_at)}>
                          Submitted {timeAgo(item.submitted_at)}
                        </div>
                      </td>
                      <td className="col-actions" onClick={(event) => event.stopPropagation()}>
                        <div className="row-actions">
                          {next ? (
                            <button
                              type="button"
                              className="btn btn--sm btn--primary"
                              onClick={() => onAdvance(item)}
                              disabled={isBusy}
                              title={ACTION_LABELS[next]}
                            >
                              {next === "Reviewed" ? "Review" : "Resolve"}
                            </button>
                          ) : (
                            <span className="muted small">Final</span>
                          )}
                          <button
                            type="button"
                            className="btn btn--icon btn--icon-danger"
                            onClick={() => onDelete(item)}
                            disabled={isBusy || item.status !== "New"}
                            title={item.status === "New" ? "Delete feedback" : "Only New feedback can be deleted"}
                            aria-label={`Delete ${item.id}`}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {showEmpty &&
            (filtersActive ? (
              <EmptyState
                icon="search"
                title="No feedback matches these filters"
                description="Try a different product, category or rating, or clear the filters."
                action={
                  <button type="button" className="btn btn--ghost" onClick={onClearFilters}>
                    Clear filters
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon="inbox"
                title="No feedback yet"
                description="Submitted customer feedback will appear here."
                action={
                  <a className="btn btn--primary" href="#/submit">
                    Submit feedback
                  </a>
                }
              />
            ))}
        </div>
      )}

      {!error && total > 0 && (
        <Pagination total={total} limit={limit} offset={offset} onOffset={onOffset} onLimit={onLimit} />
      )}
    </section>
  );
}
