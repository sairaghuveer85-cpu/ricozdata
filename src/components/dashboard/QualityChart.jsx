import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "../../context/AppContext";

const TARGET_SCORE = 90;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const score = Number(payload[0]?.value);
  if (!Number.isFinite(score)) return null;

  return (
    <div
      className="min-w-[150px] rounded-xl border px-3.5 py-3 shadow-xl"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text-primary)",
      }}
    >
      <p
        className="text-xs font-medium"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label || "Recorded period"}
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className="text-xs">Quality score</span>
        <span className="text-xl font-bold tabular-nums">
          {score.toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, score))}%`,
            background:
              score >= TARGET_SCORE
                ? "var(--color-success)"
                : "var(--color-brand)",
          }}
        />
      </div>
      <p
        className="mt-2 text-[11px]"
        style={{ color: "var(--color-text-muted)" }}
      >
        {score >= TARGET_SCORE
          ? "Target achieved"
          : `${(TARGET_SCORE - score).toFixed(1)} points below target`}
      </p>
    </div>
  );
}

export default function QualityChart() {
  const { qualityTrends, datasets = [], qualityRules } = useApp();
  const [timeRange, setTimeRange] = useState("Last 6 months");

  const scoredDatasets = useMemo(
    () =>
      Array.isArray(datasets)
        ? datasets.filter(
            (dataset) =>
              dataset.qualityScore != null || dataset.quality != null,
          )
        : [],
    [datasets],
  );

  const averageScore = useMemo(() => {
    if (!scoredDatasets.length) return null;

    const total = scoredDatasets.reduce(
      (sum, dataset) =>
        sum + (Number(dataset.qualityScore ?? dataset.quality) || 0),
      0,
    );

    return total / scoredDatasets.length;
  }, [scoredDatasets]);

  const chartData = useMemo(() => {
    if (!Array.isArray(qualityTrends)) return [];

    const normalized = qualityTrends
      .map((item) => ({
        ...item,
        score: Number(item.score),
      }))
      .filter((item) => Number.isFinite(item.score));

    if (timeRange === "Last 3 months") return normalized.slice(-3);
    if (timeRange === "Last 6 months") return normalized.slice(-6);

    // Use the available series for year-to-date when its entries
    // do not contain enough date information for reliable filtering.
    return normalized;
  }, [qualityTrends, timeRange]);

  const trendDirection = useMemo(() => {
    if (chartData.length < 2) return null;

    const first = chartData[0].score;
    const last = chartData[chartData.length - 1].score;

    return last - first;
  }, [chartData]);

  const gridColor = "var(--color-border)";
  const axisColor = "var(--color-text-muted)";
  const brandColor = "var(--color-brand)";

  const selectStyle = {
    backgroundColor: "var(--color-surface)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-border)",
  };

  return (
    <section
      className="quality-chart-panel flex min-w-0 flex-col"
      aria-label="Data quality analytics"
    >
      {/* Panel heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                color: "var(--color-brand)",
              }}
            >
              <Activity size={18} aria-hidden="true" />
            </span>
            <div>
              <h3
                className="text-sm font-semibold tracking-tight sm:text-base"
                style={{ color: "var(--color-text-primary)" }}
              >
                Data quality trends
              </h3>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Historical quality against your 90% target
              </p>
            </div>
          </div>
        </div>

        <label className="relative inline-flex shrink-0 items-center">
          <CalendarDays
            size={14}
            className="pointer-events-none absolute left-2.5"
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          />
          <select
            value={timeRange}
            onChange={(event) => setTimeRange(event.target.value)}
            className="max-w-full appearance-none rounded-lg py-2 pl-8 pr-8 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            style={selectStyle}
            aria-label="Filter chart timeframe"
          >
            <option>Last 3 months</option>
            <option>Last 6 months</option>
            <option>Year to date</option>
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2.5"
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          />
        </label>
      </div>

      {/* Summary indicators */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div
          className="rounded-xl border p-3.5 sm:p-4"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface-secondary)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck
              size={14}
              style={{ color: "var(--color-success)" }}
              aria-hidden="true"
            />
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              Current average
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              {averageScore == null ? "—" : `${averageScore.toFixed(1)}%`}
            </span>
          </div>
          <p
            className="mt-1 text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {scoredDatasets.length} scored{" "}
            {scoredDatasets.length === 1 ? "dataset" : "datasets"}
          </p>
        </div>

        <div
          className="rounded-xl border p-3.5 sm:p-4"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface-secondary)",
          }}
        >
          <div className="flex items-center gap-1.5">
            {trendDirection == null ? (
              <Clock3
                size={14}
                style={{ color: "var(--color-text-muted)" }}
                aria-hidden="true"
              />
            ) : trendDirection >= 0 ? (
              <ArrowUpRight
                size={14}
                style={{ color: "var(--color-success)" }}
                aria-hidden="true"
              />
            ) : (
              <ArrowDownRight
                size={14}
                style={{ color: "var(--color-warning)" }}
                aria-hidden="true"
              />
            )}
            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              Trend change
            </span>
          </div>
          <div className="mt-2">
            <span
              className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              {trendDirection == null
                ? "—"
                : `${trendDirection > 0 ? "+" : ""}${trendDirection.toFixed(1)}`}
              {trendDirection != null && (
                <span className="ml-0.5 text-sm font-medium">pts</span>
              )}
            </span>
          </div>
          <p
            className="mt-1 text-[11px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {chartData.length > 1
              ? "First to latest point"
              : "More trend data needed"}
          </p>
        </div>
      </div>

      {/* Chart / empty state */}
      <div className="mt-4 min-w-0">
        {chartData.length === 0 ? (
          <div
            className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed px-5 py-4 text-center"
            style={{
              borderColor: "var(--color-border)",
              backgroundColor: "var(--color-surface-secondary)",
            }}
          >
            <span
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                color: "var(--color-brand)",
                backgroundColor:
                  "color-mix(in srgb, var(--color-brand) 12%, transparent)",
              }}
            >
              <Activity size={23} aria-hidden="true" />
            </span>
            <h4
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--color-text-primary)" }}
            >
              Your quality story starts here
            </h4>
            <p
              className="mt-2 max-w-xs text-xs leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Trend data will appear as quality evaluations are recorded for
              your cataloged datasets.
            </p>
            <div
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-medium"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-text-muted)",
                backgroundColor: "var(--color-surface)",
              }}
            >
              <Database size={13} aria-hidden="true" />
              {datasets.length
                ? `${datasets.length} datasets in your workspace`
                : "Connect a data source to get started"}
            </div>
          </div>
        ) : (
          <div className="h-[240px] w-full min-w-0 sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 12, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="qualityTrendFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={brandColor}
                      stopOpacity={0.24}
                    />
                    <stop
                      offset="95%"
                      stopColor={brandColor}
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke={gridColor}
                  strokeDasharray="3 5"
                  vertical={false}
                />

                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisColor, fontSize: 11 }}
                  tickMargin={12}
                />

                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisColor, fontSize: 10 }}
                  width={42}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{
                    stroke: axisColor,
                    strokeDasharray: "4 4",
                    strokeOpacity: 0.6,
                  }}
                />

                <ReferenceLine
                  y={TARGET_SCORE}
                  stroke="var(--color-success)"
                  strokeDasharray="5 5"
                  strokeOpacity={0.9}
                  label={{
                    value: "90% target",
                    position: "insideTopRight",
                    fill: "var(--color-success)",
                    fontSize: 10,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="score"
                  name="Quality score"
                  stroke={brandColor}
                  strokeWidth={2.5}
                  fill="url(#qualityTrendFill)"
                  activeDot={{
                    r: 5,
                    stroke: brandColor,
                    strokeWidth: 2,
                    fill: "var(--color-surface)",
                  }}
                  dot={{
                    r: 3,
                    strokeWidth: 2,
                    stroke: brandColor,
                    fill: "var(--color-surface)",
                  }}
                  connectNulls={false}
                  animationDuration={500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chart footer */}
      <div
        className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: brandColor }}
            />
            Quality score
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <span
              className="h-0.5 w-4 rounded"
              style={{ backgroundColor: "#10B981" }}
            />
            90% target
          </span>
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-[11px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          <CheckCircle2 size={13} aria-hidden="true" />
          {qualityRules?.length || 0} quality rules configured
        </span>
      </div>
    </section>
  );
}
