import { COMMENT_MAX_LENGTH } from "../validation.js";
import { RATING_OPTIONS } from "../constants.js";
import Icon from "./Icon.jsx";
import { Notice } from "./common.jsx";

function Field({ id, label, error, hint, children, wide = false }) {
  return (
    <div className={`form-field ${wide ? "form-field--wide" : ""} ${error ? "has-error" : ""}`}>
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      {children}
      {error ? (
        <span className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="form-field__hint">{hint}</span>
      )}
    </div>
  );
}

/** Controlled form: all state lives in the parent so a live preview can read it. */
export default function FeedbackForm({ values, errors, onChange, onSubmit, submitting, apiError, onDismissError, products, categories }) {
  const commentLength = values.comments.trim().length;
  const overLimit = commentLength > COMMENT_MAX_LENGTH;

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      {apiError && (
        <Notice tone="error" title="Feedback was not saved">
          {apiError.message}
        </Notice>
      )}

      <fieldset className="form-section">
        <legend>Customer</legend>
        <div className="form-grid">
          <Field id="customer_name" label="Full name" error={errors.customer_name}>
            <input
              id="customer_name"
              className="input"
              value={values.customer_name}
              onChange={(e) => onChange("customer_name", e.target.value)}
              aria-invalid={Boolean(errors.customer_name)}
              autoComplete="off"
              maxLength={120}
              placeholder="e.g. Priya Nair"
            />
          </Field>
          <Field id="customer_email" label="Email address" error={errors.customer_email}>
            <input
              id="customer_email"
              type="email"
              className="input"
              value={values.customer_email}
              onChange={(e) => onChange("customer_email", e.target.value)}
              aria-invalid={Boolean(errors.customer_email)}
              autoComplete="off"
              placeholder="name@company.com"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Feedback</legend>
        <div className="form-grid">
          <Field id="product" label="Product" error={errors.product}>
            <input
              id="product"
              list="product-options"
              className="input"
              value={values.product}
              onChange={(e) => onChange("product", e.target.value)}
              aria-invalid={Boolean(errors.product)}
              autoComplete="off"
              maxLength={120}
              placeholder="Choose or type a product"
            />
            <datalist id="product-options">
              {(products ?? []).map((product) => (
                <option key={product} value={product} />
              ))}
            </datalist>
          </Field>

          <Field id="category" label="Category" error={errors.category}>
            <select
              id="category"
              className="select"
              value={values.category}
              onChange={(e) => onChange("category", e.target.value)}
              aria-invalid={Boolean(errors.category)}
            >
              <option value="">Select a category</option>
              {(categories ?? []).map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className={`form-field form-field--wide ${errors.rating ? "has-error" : ""}`}>
          <span className="form-field__label" id="rating-label">
            Rating
          </span>
          <div className="rating-chips" role="radiogroup" aria-labelledby="rating-label">
            {RATING_OPTIONS.slice()
              .reverse()
              .map((rating) => {
                const selected = values.rating === rating;
                return (
                  <label key={rating} className={`rating-chip ${selected ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="rating"
                      value={rating}
                      checked={selected}
                      onChange={() => onChange("rating", rating)}
                    />
                    <Icon name="star" size={14} className={selected ? "star star--on" : "star"} />
                    <span>{rating}</span>
                  </label>
                );
              })}
          </div>
          {errors.rating && (
            <span className="form-field__error" role="alert">
              {errors.rating}
            </span>
          )}
        </div>

        <Field
          id="comments"
          label="Comments"
          wide
          error={errors.comments}
          hint="Between 10 and 500 characters. Be specific so the team can act on it."
        >
          <textarea
            id="comments"
            className="input textarea"
            rows={5}
            value={values.comments}
            onChange={(e) => onChange("comments", e.target.value)}
            aria-invalid={Boolean(errors.comments)}
            maxLength={COMMENT_MAX_LENGTH + 50}
            placeholder="Describe the experience, the problem or the idea…"
          />
          <span className={`char-count ${overLimit ? "is-over" : ""}`}>
            {commentLength}/{COMMENT_MAX_LENGTH}
          </span>
        </Field>
      </fieldset>

      <div className="form__footer">
        <button type="button" className="btn btn--ghost" onClick={onDismissError} hidden={!apiError}>
          Dismiss error
        </button>
        <button type="submit" className="btn btn--primary btn--lg" disabled={submitting}>
          {submitting ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}
