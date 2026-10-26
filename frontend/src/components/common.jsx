import { useEffect, useRef } from "react";
import { initials } from "../utils/format.js";
import Icon from "./Icon.jsx";

export function StatusBadge({ status }) {
  return (
    <span className={`status status--${status.toLowerCase()}`}>
      <span className="status__dot" aria-hidden="true" />
      {status}
    </span>
  );
}

export function CategoryPill({ category }) {
  return <span className={`cat cat--${category.toLowerCase()}`}>{category}</span>;
}

export function StarRating({ value, showValue = false }) {
  if (value === null || value === undefined) {
    return <span className="muted">No ratings yet</span>;
  }
  const rounded = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon key={star} name="star" size={14} className={star <= rounded ? "star star--on" : "star"} />
      ))}
      {showValue && <span className="stars__value">{value.toFixed(2)}</span>}
    </span>
  );
}

export function Avatar({ name, tone = "teal" }) {
  return (
    <span className={`avatar avatar--${tone}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Notice({ tone = "info", title, children, onRetry }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <Icon name={tone === "error" ? "alert" : "message"} size={18} />
      <div className="notice__body">
        {title && <strong>{title}</strong>}
        <span>{children}</span>
      </div>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, description, action }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel, busy }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    confirmRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={busy ? undefined : onCancel}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="modal__icon">
          <Icon name="trash" size={20} />
        </span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
