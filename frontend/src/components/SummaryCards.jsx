import Icon from "./Icon.jsx";
import { Skeleton, StarRating } from "./common.jsx";

function KpiCard({ tone, icon, label, value, children }) {
  return (
    <article className={`kpi kpi--${tone}`}>
      <div className="kpi__top">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className="kpi__value">{value}</p>
      <div className="kpi__meta">{children}</div>
    </article>
  );
}

function Delta({ value, suffix = "vs last week" }) {
  if (value === null || value === undefined) return null;
  const direction = value > 0 ? "is-up" : value < 0 ? "is-down" : "is-flat";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`delta ${direction}`}>
      {sign}
      {value} {suffix}
    </span>
  );
}

/** Four headline metrics. `weekly` is an array of { count } buckets, oldest first. */
export default function SummaryCards({ summary, weekly }) {
  if (!summary) {
    return (
      <div className="kpi-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <article key={index} className="kpi kpi--loading">
            <Skeleton className="skeleton--line" />
            <Skeleton className="skeleton--big" />
            <Skeleton className="skeleton--line" />
          </article>
        ))}
      </div>
    );
  }

  const byStatus = summary.count_by_status;
  const total = summary.total_count;
  const open = byStatus.New + byStatus.Reviewed;
  const resolutionRate = total ? Math.round((byStatus.Resolved / total) * 100) : 0;
  const thisWeek = weekly?.[weekly.length - 1]?.count;
  const lastWeek = weekly?.[weekly.length - 2]?.count;
  const weekDelta = thisWeek === undefined || lastWeek === undefined ? null : thisWeek - lastWeek;

  return (
    <div className="kpi-grid">
      <KpiCard tone="teal" icon="list" label="Total feedback" value={total}>
        <span className="muted">
          {thisWeek === undefined ? "All submissions" : `${thisWeek} received this week`}
        </span>
        <Delta value={weekDelta} />
      </KpiCard>

      <KpiCard tone="amber" icon="star" label="Average rating" value={summary.average_rating === null ? "—" : summary.average_rating.toFixed(2)}>
        <StarRating value={summary.average_rating} />
        <span className="muted">out of 5</span>
      </KpiCard>

      <KpiCard tone="blue" icon="inbox" label="Open items" value={open}>
        <span className="muted">{byStatus.New} awaiting first review</span>
      </KpiCard>

      <KpiCard tone="green" icon="percent" label="Resolution rate" value={`${resolutionRate}%`}>
        <span className="muted">{byStatus.Resolved} resolved in total</span>
      </KpiCard>
    </div>
  );
}
