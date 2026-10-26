import { useMemo } from "react";
import Layout from "../components/Layout.jsx";
import Icon from "../components/Icon.jsx";
import { CategoryPill, EmptyState, Notice, StarRating, StatusBadge } from "../components/common.jsx";
import SummaryCards from "../components/SummaryCards.jsx";
import { CategoryDonut, RatingHistogram, StatusPipeline, WeeklyTrend } from "../components/Insights.jsx";
import { useApp } from "../context/AppContext.jsx";
import { useFeedbackList, useSummary, useTrend } from "../hooks/useFeedbackData.js";
import { timeAgo, trendBuckets } from "../utils/format.js";

export default function DashboardPage() {
  const { refresh } = useApp();
  const summary = useSummary();
  const recent = useFeedbackList({ sort: "newest", limit: 5 });
  const trend = useTrend(8);

  const buckets = useMemo(() => (trend.data ? trendBuckets(trend.data) : null), [trend.data]);
  const data = summary.data;
  const failed = summary.error || recent.error || trend.error;

  return (
    <Layout
      route="/dashboard"
      title="Dashboard"
      subtitle="A live view of customer sentiment, workload and resolution progress."
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={refresh}>
            <Icon name="refresh" size={16} />
            Refresh
          </button>
          <a className="btn btn--primary" href="#/submit">
            <Icon name="plus" size={16} />
            New feedback
          </a>
        </>
      }
    >
      {failed && (
        <Notice tone="error" title="Some dashboard data could not be loaded" onRetry={refresh}>
          {failed.message}
        </Notice>
      )}

      <SummaryCards summary={data} weekly={buckets} />

      <div className="dash-grid">
        <section className="card col-8">
          <header className="card__header">
            <div>
              <h2 className="card__title">Submissions per week</h2>
              <p className="card__subtitle">Last eight weeks, grouped Monday to Sunday</p>
            </div>
          </header>
          <div className="card__pad">
            <WeeklyTrend buckets={buckets} />
          </div>
        </section>

        <section className="card col-4">
          <header className="card__header">
            <div>
              <h2 className="card__title">By category</h2>
              <p className="card__subtitle">Share of all feedback</p>
            </div>
          </header>
          <div className="card__pad">
            <CategoryDonut counts={data?.count_by_category} total={data?.total_count} />
          </div>
        </section>

        <section className="card col-6">
          <header className="card__header">
            <div>
              <h2 className="card__title">Rating distribution</h2>
              <p className="card__subtitle">{data ? `${data.total_count} responses` : "Loading…"}</p>
            </div>
          </header>
          <div className="card__pad">
            <RatingHistogram distribution={data?.rating_distribution} total={data?.total_count} />
          </div>
        </section>

        <section className="card col-6">
          <header className="card__header">
            <div>
              <h2 className="card__title">Workflow pipeline</h2>
              <p className="card__subtitle">Where feedback sits in the New → Reviewed → Resolved flow</p>
            </div>
          </header>
          <div className="card__pad">
            <StatusPipeline counts={data?.count_by_status} total={data?.total_count} />
          </div>
        </section>

        <section className="card col-12" aria-labelledby="recent-title">
          <header className="card__header">
            <div>
              <h2 id="recent-title" className="card__title">
                Latest submissions
              </h2>
              <p className="card__subtitle">The five most recent items across all products</p>
            </div>
            <a className="btn btn--ghost btn--sm" href="#/feedback">
              View all
              <Icon name="arrowRight" size={14} />
            </a>
          </header>

          {recent.loading && !recent.data && (
            <div className="card__pad">
              <span className="skeleton skeleton--block" aria-hidden="true" />
            </div>
          )}

          {recent.data && recent.data.items.length === 0 && (
            <EmptyState icon="inbox" title="No feedback yet" description="New submissions will show up here." />
          )}

          {recent.data && recent.data.items.length > 0 && (
            <ul className="recent">
              {recent.data.items.map((item) => (
                <li key={item.id}>
                  <a className="recent__row" href="#/feedback">
                    <div className="recent__main">
                      <span className="recent__product">{item.product}</span>
                      <span className="recent__text">{item.comments}</span>
                    </div>
                    <div className="recent__meta">
                      <StarRating value={item.rating} />
                      <CategoryPill category={item.category} />
                      <StatusBadge status={item.status} />
                      <span className="muted small recent__time">{timeAgo(item.submitted_at)}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  );
}
