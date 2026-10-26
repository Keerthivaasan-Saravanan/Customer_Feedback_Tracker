import { useEffect, useRef } from "react";
import { ACTION_LABELS, NEXT_STATUS, STATUS_STEPS } from "../constants.js";
import { useFeedbackRecord } from "../hooks/useFeedbackData.js";
import { formatDateTime } from "../utils/format.js";
import Icon from "./Icon.jsx";
import { Avatar, CategoryPill, Notice, Skeleton, StarRating, StatusBadge } from "./common.jsx";

/**
 * Side panel showing one feedback record. The record is fetched by ID on every
 * data change, so the panel always reflects the server rather than a list copy.
 */
export default function FeedbackDrawer({ itemId, busy, onClose, onAdvance, onDelete }) {
  const closeRef = useRef(null);
  const { data: item, error, loading, reload } = useFeedbackRecord(itemId);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer__header">
          <div>
            <p className="eyebrow">{itemId}</p>
            <h2 id="drawer-title">{item?.product ?? "Feedback details"}</h2>
          </div>
          <button ref={closeRef} type="button" className="btn btn--icon" onClick={onClose} aria-label="Close details">
            <Icon name="x" size={18} />
          </button>
        </header>

        {error && (
          <div className="drawer__body">
            <Notice tone="error" title="Could not load this record" onRetry={reload}>
              {error.message}
            </Notice>
          </div>
        )}

        {!error && !item && loading && (
          <div className="drawer__body" aria-busy="true">
            <Skeleton className="skeleton--line" />
            <Skeleton className="skeleton--block" />
          </div>
        )}

        {item && <DrawerContent item={item} busy={busy} onAdvance={onAdvance} onDelete={onDelete} />}
      </aside>
    </>
  );
}

function DrawerContent({ item, busy, onAdvance, onDelete }) {
  const next = NEXT_STATUS[item.status];
  const currentStep = STATUS_STEPS.indexOf(item.status);
  const canDelete = item.status === "New";

  return (
    <>
      <div className="drawer__body">
        <div className="drawer__badges">
          <StatusBadge status={item.status} />
          <CategoryPill category={item.category} />
          <StarRating value={item.rating} showValue />
        </div>

        <section className="drawer__section">
          <h3>Customer</h3>
          <div className="person">
            <Avatar name={item.customer_name} tone="blue" />
            <div>
              <div className="person__name">{item.customer_name}</div>
              <a className="person__link" href={`mailto:${item.customer_email}`}>
                <Icon name="mail" size={14} />
                {item.customer_email}
              </a>
            </div>
          </div>
        </section>

        <section className="drawer__section">
          <h3>Feedback</h3>
          <blockquote className="quote">{item.comments}</blockquote>
        </section>

        <section className="drawer__section">
          <h3>Progress</h3>
          <ol className="steps" aria-label={`Current status: ${item.status}`}>
            {STATUS_STEPS.map((step, index) => (
              <li
                key={step}
                className={`steps__item ${index <= currentStep ? "is-done" : ""} ${index === currentStep ? "is-current" : ""}`}
              >
                <span className="steps__dot">{index < currentStep ? <Icon name="check" size={12} /> : index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <dl className="facts">
            <div>
              <dt>Submitted</dt>
              <dd>{formatDateTime(item.submitted_at)}</dd>
            </div>
            <div>
              <dt>Last status change</dt>
              <dd>{item.status_updated_at ? formatDateTime(item.status_updated_at) : "No changes since submission"}</dd>
            </div>
          </dl>
        </section>

        <section className="drawer__section">
          <h3>History</h3>
          <ol className="history">
            {[...(item.history ?? [])].reverse().map((event, index) => (
              <li key={`${event.status}-${event.at}-${index}`} className="history__item">
                <span className={`history__dot history__dot--${event.status.toLowerCase()}`} aria-hidden="true" />
                <div>
                  <div className="history__status">{event.status}</div>
                  <time className="history__time" dateTime={event.at}>
                    {formatDateTime(event.at)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="drawer__footer">
        {next ? (
          <button type="button" className="btn btn--primary" onClick={() => onAdvance(item)} disabled={busy}>
            <Icon name="check" size={16} />
            {ACTION_LABELS[next]}
          </button>
        ) : (
          <span className="muted small">Resolved feedback is final.</span>
        )}
        <button
          type="button"
          className="btn btn--danger-ghost"
          onClick={() => onDelete(item)}
          disabled={busy || !canDelete}
          title={canDelete ? "Delete feedback" : "Only New feedback can be deleted"}
        >
          <Icon name="trash" size={16} />
          Delete
        </button>
      </footer>
    </>
  );
}
