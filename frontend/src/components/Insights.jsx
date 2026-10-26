import { CATEGORY_COLORS, STATUS_COLORS } from "../constants.js";
import { percent } from "../utils/format.js";
import { Skeleton } from "./common.jsx";

const RATING_COLORS = { 1: "#b42318", 2: "#e0623a", 3: "#d98e04", 4: "#4f9d69", 5: "#2f7d4f" };

/** Vertical bar chart of how many responses gave each rating. */
export function RatingHistogram({ distribution, total }) {
  if (!distribution) return <Skeleton className="skeleton--chart" />;
  if (total === 0) return <p className="muted">Ratings will appear once feedback is submitted.</p>;

  const levels = [1, 2, 3, 4, 5];
  const counts = levels.map((level) => distribution[String(level)] ?? 0);
  const max = Math.max(1, ...counts);
  const width = 320;
  const height = 180;
  const baseline = 150;
  const slot = width / levels.length;
  const barWidth = 40;

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Rating distribution bar chart">
      <line x1="0" x2={width} y1={baseline} y2={baseline} className="chart__axis" />
      {levels.map((level, index) => {
        const count = counts[index];
        const barHeight = (count / max) * (baseline - 30);
        const x = index * slot + (slot - barWidth) / 2;
        const y = baseline - barHeight;
        return (
          <g key={level}>
            <title>{`${level} star: ${count} (${percent(count, total)}%)`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(barHeight, 2)} rx="8" fill={RATING_COLORS[level]} />
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" className="chart__value">
              {count}
            </text>
            <text x={x + barWidth / 2} y={baseline + 20} textAnchor="middle" className="chart__label">
              {level} ★
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Donut chart of category share. Segments are drawn with stroke-dasharray. */
export function CategoryDonut({ counts, total }) {
  if (!counts) return <Skeleton className="skeleton--chart" />;
  if (total === 0) return <p className="muted">No categories to show yet.</p>;

  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const entries = Object.entries(counts);

  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" role="img" aria-label="Feedback by category donut chart">
        <circle cx="80" cy="80" r={radius} className="donut__track" />
        {entries.map(([category, count]) => {
          const length = (count / total) * circumference;
          const segment = (
            <circle
              key={category}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={CATEGORY_COLORS[category]}
              strokeWidth="20"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-accumulated}
              transform="rotate(-90 80 80)"
            >
              <title>{`${category}: ${count}`}</title>
            </circle>
          );
          accumulated += length;
          return segment;
        })}
        <text x="80" y="76" textAnchor="middle" className="donut__total">
          {total}
        </text>
        <text x="80" y="96" textAnchor="middle" className="donut__caption">
          total
        </text>
      </svg>
      <ul className="legend">
        {entries.map(([category, count]) => (
          <li key={category}>
            <span className="legend__swatch" style={{ background: CATEGORY_COLORS[category] }} />
            <span className="legend__name">{category}</span>
            <span className="legend__value">
              {count} <span className="muted">· {percent(count, total)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal pipeline showing how many items sit in each workflow stage. */
export function StatusPipeline({ counts, total }) {
  if (!counts) return <Skeleton className="skeleton--chart" />;
  const stages = ["New", "Reviewed", "Resolved"];

  return (
    <ol className="pipeline">
      {stages.map((stage, index) => {
        const count = counts[stage] ?? 0;
        return (
          <li key={stage} className="pipeline__stage">
            <div className="pipeline__head">
              <span className="pipeline__name" style={{ color: STATUS_COLORS[stage] }}>
                {stage}
              </span>
              <span className="pipeline__count">{count}</span>
            </div>
            <div className="pipeline__track" aria-hidden="true">
              <div className="pipeline__fill" style={{ width: `${percent(count, total)}%`, background: STATUS_COLORS[stage] }} />
            </div>
            <span className="pipeline__share">
              {percent(count, total)}% of feedback{index < stages.length - 1 ? "" : ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Column chart of submissions per week. */
export function WeeklyTrend({ buckets }) {
  if (!buckets) return <Skeleton className="skeleton--chart" />;
  const width = 640;
  const height = 220;
  const baseline = 180;
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const slot = width / buckets.length;
  const barWidth = 40;

  return (
    <svg className="chart chart--wide" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Submissions per week">
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <line key={ratio} x1="0" x2={width} y1={baseline - ratio * (baseline - 20)} y2={baseline - ratio * (baseline - 20)} className="chart__grid" />
      ))}
      {buckets.map((bucket, index) => {
        const barHeight = (bucket.count / max) * (baseline - 20);
        const x = index * slot + (slot - barWidth) / 2;
        const isCurrent = index === buckets.length - 1;
        return (
          <g key={bucket.label + index}>
            <title>{`Week of ${bucket.label}: ${bucket.count} submissions`}</title>
            <rect
              x={x}
              y={baseline - barHeight}
              width={barWidth}
              height={Math.max(barHeight, bucket.count ? 3 : 0)}
              rx="7"
              className={isCurrent ? "chart__bar chart__bar--current" : "chart__bar"}
            />
            <text x={x + barWidth / 2} y={baseline - barHeight - 8} textAnchor="middle" className="chart__value">
              {bucket.count}
            </text>
            <text x={x + barWidth / 2} y={baseline + 22} textAnchor="middle" className="chart__label">
              {bucket.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
