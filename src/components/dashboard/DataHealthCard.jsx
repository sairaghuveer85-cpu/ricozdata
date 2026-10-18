import React from "react";
import { Activity, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import { useApp } from "../../context/AppContext";

export default function DataHealthCard() {
  const { dataHealthSummary, datasets } = useApp();

  const scoredDatasets = Array.isArray(datasets)
    ? datasets.filter((d) => d.qualityScore != null || d.quality != null)
    : [];

  const hasHealthData =
    scoredDatasets.length > 0 && (dataHealthSummary?.score || 0) > 0;

  const score = hasHealthData ? dataHealthSummary.score : null;
  const maxScore = dataHealthSummary?.maxScore ?? 100;

  const status = hasHealthData
    ? score >= 90
      ? "Excellent"
      : score >= 80
        ? "Good"
        : "Needs Review"
    : "No Data";

  const dimensions =
    hasHealthData &&
    dataHealthSummary?.dimensions &&
    dataHealthSummary.dimensions.length > 0
      ? dataHealthSummary.dimensions
      : [];

  const statusConfig = {
    Excellent: {
      color: "var(--color-success)",
      background: "color-mix(in srgb, var(--color-success) 10%, transparent)",
      border: "color-mix(in srgb, var(--color-success) 24%, transparent)",
      icon: CheckCircle2,
    },
    Good: {
      color: "var(--color-brand)",
      background: "color-mix(in srgb, var(--color-brand) 10%, transparent)",
      border: "color-mix(in srgb, var(--color-brand) 24%, transparent)",
      icon: CheckCircle2,
    },
    "Needs Review": {
      color: "var(--color-warning)",
      background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
      border: "color-mix(in srgb, var(--color-warning) 24%, transparent)",
      icon: AlertCircle,
    },
    "No Data": {
      color: "var(--color-text-muted)",
      background: "var(--color-surface-secondary)",
      border: "var(--color-border)",
      icon: MinusCircle,
    },
  };

  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;

  return (
    <section className="data-health-card flex h-full min-w-0 flex-col">
      <div>
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              color: "var(--color-brand)",
              backgroundColor:
                "color-mix(in srgb, var(--color-brand) 10%, transparent)",
            }}
          >
            <Activity size={16} strokeWidth={1.8} aria-hidden="true" />
          </span>

          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Reliability Index
            </p>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Overall data quality
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              {hasHealthData ? score : "N/A"}
            </span>

            {hasHealthData && (
              <span
                className="text-xs font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                / {maxScore}
              </span>
            )}
          </div>

          <span
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold"
            style={{
              color: currentStatus.color,
              backgroundColor: currentStatus.background,
              borderColor: currentStatus.border,
            }}
          >
            <StatusIcon size={13} aria-hidden="true" />
            {status}
          </span>
        </div>

        {hasHealthData && (
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--color-surface-tertiary)" }}
            role="progressbar"
            aria-label="Overall data reliability"
            aria-valuemin={0}
            aria-valuemax={maxScore}
            aria-valuenow={Math.max(0, Math.min(maxScore, score))}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (score / maxScore) * 100),
                )}%`,
                backgroundColor: currentStatus.color,
              }}
            />
          </div>
        )}
      </div>

      <div
        className="mt-6 border-t pt-5"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3
            className="text-[10px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Quality Dimensions
          </h3>

          {dimensions.length > 0 && (
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              {dimensions.length} metrics
            </span>
          )}
        </div>

        {!hasHealthData || dimensions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-7 text-center"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-surface-secondary)",
            }}
          >
            <span
              className="mb-2 flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                color: "var(--color-text-muted)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <Activity size={16} aria-hidden="true" />
            </span>

            <p
              className="text-xs font-medium"
              style={{ color: "var(--color-text-secondary)" }}
            >
              No health metrics yet
            </p>
            <p
              className="mt-1 max-w-[220px] text-[11px] leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              Quality dimensions will appear when health data is available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {dimensions.map((dim) => {
              const dimensionScore = Number(dim.score);
              const safeScore = Number.isFinite(dimensionScore)
                ? Math.max(0, Math.min(100, dimensionScore))
                : 0;

              const dimensionColor =
                safeScore >= 90
                  ? "var(--color-success)"
                  : safeScore >= 80
                    ? "var(--color-brand)"
                    : "var(--color-warning)";

              return (
                <div key={dim.name} className="min-w-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span
                      className="truncate text-xs font-medium"
                      style={{ color: "var(--color-text-secondary)" }}
                      title={dim.name}
                    >
                      {dim.name}
                    </span>

                    <span
                      className="shrink-0 text-xs font-semibold tabular-nums"
                      style={{ color: "var(--color-text-primary)" }}
                    >
                      {dim.score}%
                    </span>
                  </div>

                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full"
                    style={{
                      backgroundColor: "var(--color-surface-tertiary)",
                    }}
                    role="progressbar"
                    aria-label={`${dim.name} quality`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={safeScore}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${safeScore}%`,
                        backgroundColor: dimensionColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
