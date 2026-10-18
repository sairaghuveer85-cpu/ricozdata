import React from "react";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

export default function StatCard({
  title,
  value,
  comparisonText,
  isPositive = true,
  trendType = "positive",
}) {
  const getTrendStyle = () => {
    if (trendType === "warning") {
      return {
        text: "var(--color-warning)",
        background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
        border: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
        icon: AlertTriangle,
      };
    }

    if (isPositive) {
      return {
        text: "var(--color-success)",
        background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
        border: "color-mix(in srgb, var(--color-success) 24%, transparent)",
        icon: TrendingUp,
      };
    }

    return {
      text: "var(--color-danger)",
      background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
      border: "color-mix(in srgb, var(--color-danger) 24%, transparent)",
      icon: TrendingDown,
    };
  };

  const trend = getTrendStyle();
  const TrendIcon = trend.icon;
  const comparison = String(comparisonText ?? "");

  return (
    <article
      className="premium-stat-card flex h-full min-w-0 flex-col justify-between p-4 sm:p-5"
      style={{
        backgroundColor: "var(--color-surface)",
        color: "var(--color-text-primary)",
      }}
    >
      <p
        className="truncate text-[11px] font-semibold uppercase tracking-[0.09em]"
        style={{ color: "var(--color-text-muted)" }}
        title={title}
      >
        {title}
      </p>

      <div className="my-4 flex min-w-0 items-baseline gap-2">
        <span
          className="truncate text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl"
          style={{ color: "var(--color-text-primary)" }}
        >
          {value}
        </span>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold"
          style={{
            color: trend.text,
            backgroundColor: trend.background,
            borderColor: trend.border,
          }}
        >
          <TrendIcon size={12} aria-hidden="true" />
          {comparison.split(" ")[0] || "—"}
        </span>

        <span
          className="min-w-0 truncate text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
          title={comparison}
        >
          {comparison.split(" ").slice(1).join(" ")}
        </span>
      </div>
    </article>
  );
}
