import { useState } from "react";
import Layout from "../components/Layout.jsx";
import Icon from "../components/Icon.jsx";
import FeedbackForm from "../components/FeedbackForm.jsx";
import { CategoryPill, StarRating } from "../components/common.jsx";
import { useApp } from "../context/AppContext.jsx";
import { useMeta } from "../hooks/useFeedbackData.js";
import { api, ApiError } from "../api.js";
import {
  COMMENT_MAX_LENGTH,
  COMMENT_MIN_LENGTH,
  EMPTY_FORM,
  fieldErrorsFromApi,
  validateFeedbackForm,
} from "../validation.js";

const GUIDELINES = [
  "Rating is a whole number from 1 to 5.",
  `Comments must be ${COMMENT_MIN_LENGTH} to ${COMMENT_MAX_LENGTH} characters.`,
  "Every submission starts as New and moves to Reviewed, then Resolved.",
  "Only New feedback can be deleted, so reviewed items stay on record.",
];

function LivePreview({ values }) {
  const hasRating = values.rating > 0;
  const comment = values.comments.trim();
  return (
    <div className="preview">
      <p className="eyebrow">Live preview</p>
      <div className="preview__product">{values.product.trim() || "Product name"}</div>
      <div className="preview__row">
        {hasRating ? <StarRating value={values.rating} /> : <span className="muted">No rating selected</span>}
        {values.category ? <CategoryPill category={values.category} /> : null}
      </div>
      <p className={`preview__comment ${comment ? "" : "muted"}`}>
        {comment || "Your comments will appear here as you type."}
      </p>
      <div className="preview__from">
        <span className="muted small">From</span>
        <strong>{values.customer_name.trim() || "Customer name"}</strong>
      </div>
    </div>
  );
}

export default function SubmitPage() {
  const { notify, refresh } = useApp();
  const meta = useMeta();
  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [created, setCreated] = useState(null);

  const handleChange = (name, value) => {
    const next = { ...values, [name]: value };
    setValues(next);
    if (attempted) setErrors(validateFeedbackForm(next));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setApiError(null);
    setAttempted(true);

    const validation = validateFeedbackForm(values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      const record = await api.createFeedback({
        customer_name: values.customer_name.trim(),
        customer_email: values.customer_email.trim(),
        product: values.product.trim(),
        rating: values.rating,
        category: values.category,
        comments: values.comments.trim(),
      });
      setCreated(record);
      setValues(EMPTY_FORM);
      setErrors({});
      setAttempted(false);
      notify("success", "Feedback submitted", `${record.id} has been added to the queue.`);
      refresh();
    } catch (err) {
      const error = err instanceof ApiError ? err : new ApiError(err.message);
      setApiError(error);
      if (error.details.length) setErrors(fieldErrorsFromApi(error.details));
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnother = () => {
    setCreated(null);
    setApiError(null);
  };

  return (
    <Layout
      route="/submit"
      title="Submit feedback"
      subtitle="Record a customer comment so it can be triaged and resolved."
      actions={
        <a className="btn btn--ghost" href="#/feedback">
          <Icon name="list" size={16} />
          View all feedback
        </a>
      }
    >
      {created ? (
        <section className="card success-card" role="status">
          <span className="success-card__icon">
            <Icon name="check" size={28} />
          </span>
          <h2>Thank you, feedback recorded</h2>
          <p>
            Reference <strong className="mono">{created.id}</strong> is now in the <strong>New</strong> queue for {created.product}.
          </p>
          <div className="success-card__actions">
            <a className="btn btn--primary" href="#/feedback">
              View feedback list
            </a>
            <button type="button" className="btn btn--ghost" onClick={submitAnother}>
              Submit another
            </button>
          </div>
        </section>
      ) : (
        <div className="submit-grid">
          <section className="card card--pad">
            <header className="card__header card__header--flat">
              <div>
                <h2 className="card__title">Feedback details</h2>
                <p className="card__subtitle">Fields marked by the form are required.</p>
              </div>
            </header>
            <FeedbackForm
              values={values}
              errors={errors}
              onChange={handleChange}
              onSubmit={handleSubmit}
              submitting={submitting}
              apiError={apiError}
              onDismissError={() => setApiError(null)}
              products={meta.data?.products}
              categories={meta.data?.categories}
            />
          </section>

          <aside className="submit-side">
            <section className="card card--pad">
              <LivePreview values={values} />
            </section>
            <section className="card card--pad">
              <h2 className="card__title card__title--small">
                <Icon name="shield" size={16} />
                Submission rules
              </h2>
              <ul className="guide-list">
                {GUIDELINES.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </Layout>
  );
}
