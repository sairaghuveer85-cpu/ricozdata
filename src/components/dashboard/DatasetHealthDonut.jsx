import React, { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity, ArrowUpRight, CircleHelp } from "lucide-react";
import { useApp } from "../../context/AppContext";

const SEGMENTS = [
  { name: "Healthy", color: "var(--color-success)" },
  { name: "Needs review", color: "var(--color-warning)" },
  { name: "Critical", color: "var(--color-danger)" },
  { name: "Not assessed", color: "var(--color-text-muted)" },
];

function HealthTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  return (
    <div
      className="rounded-xl border px-3 py-2.5 shadow-lg"
      style={{
        background: "var(--color-surface)",
        color: "var(--color-text-primary)",
        borderColor: "var(--color-border)",
      }}
    >
      <p className="text-xs font-medium">{item.name}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {item.value} {item.value === 1 ? "dataset" : "datasets"}
      </p>
    </div>
  );
}

export default function DatasetHealthDonut() {
  const { datasets = [] } = useApp();
  const [activeSegment, setActiveSegment] = useState(null);

  const distribution = useMemo(() => {
    const result = {
      Healthy: 0,
      "Needs review": 0,
      Critical: 0,
      "Not assessed": 0,
    };

    datasets.forEach((dataset) => {
      const rawScore = dataset.qualityScore ?? dataset.quality;
      const score = Number(rawScore);

      if (
        rawScore == null ||
        rawScore === "" ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100
      ) {
        result["Not assessed"] += 1;
      } else if (score >= 90) {
        result.Healthy += 1;
      } else if (score >= 80) {
        result["Needs review"] += 1;
      } else {
        result.Critical += 1;
      }
    });

    return SEGMENTS.map((segment) => ({
      ...segment,
      value: result[segment.name],
    }));
  }, [datasets]);

  const total = datasets.length;
  const assessed =
    total -
    (distribution.find((item) => item.name === "Not assessed")?.value || 0);
  const healthy =
    distribution.find((item) => item.name === "Healthy")?.value || 0;
  const healthyPercent = assessed
    ? Math.round((healthy / assessed) * 100)
    : null;

  return (
    <section
      className="dataset-health-panel flex h-full min-w-0 flex-col"
      aria-label="Dataset health distribution"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
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
                Dataset health
              </h3>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                Quality score distribution
              </p>
            </div>
          </div>
        </div>

        <span
          className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium tabular-nums"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          {total} total
        </span>
      </div>

      {total === 0 ? (
        <div
          className="mt-3 flex min-h-[100px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-3 text-center"
          style={{
            borderColor: "var(--color-border)",
            background: "var(--color-surface-secondary)",
          }}
        >
          <CircleHelp
            size={28}
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          />
          <p
            className="mt-3 text-sm font-semibold"
            style={{ color: "var(--color-text-primary)" }}
          >
            No datasets yet
          </p>
          <p
            className="mt-1 max-w-xs text-xs leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
          >
            Add datasets to see their quality distribution here.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-2 h-[180px] w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution.filter((item) => item.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="88%"
                  paddingAngle={3}
                  stroke="none"
                  cornerRadius={4}
                  onMouseEnter={(item) => setActiveSegment(item.name)}
                  onMouseLeave={() => setActiveSegment(null)}
                  isAnimationActive
                  animationDuration={500}
                >
                  {distribution
                    .filter((item) => item.value > 0)
                    .map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                </Pie>
                <Tooltip content={<HealthTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-3xl font-semibold tracking-tight tabular-nums"
                style={{ color: "var(--color-text-primary)" }}
              >
                {healthyPercent == null ? "—" : `${healthyPercent}%`}
              </span>
              <span
                className="mt-1 text-[11px] font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Healthy · assessed
              </span>
              <span
                className="mt-1 text-[10px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                {assessed} assessed
              </span>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {distribution.map((item) => {
              const isActive = activeSegment === item.name;

              return (
                <button
                  key={item.name}
                  type="button"
                  onMouseEnter={() => setActiveSegment(item.name)}
                  onMouseLeave={() => setActiveSegment(null)}
                  onFocus={() => setActiveSegment(item.name)}
                  onBlur={() => setActiveSegment(null)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  style={{
                    background: isActive
                      ? "var(--color-surface-secondary)"
                      : "transparent",
                  }}
                  aria-label={`${item.name}: ${item.value} datasets`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span
                      className="truncate text-xs font-medium"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {item.name}
                    </span>
                  </span>

                  <span
                    className="shrink-0 text-xs font-semibold tabular-nums"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {item.value}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="mt-3 flex items-start gap-2 border-t pt-3 text-[11px] leading-relaxed"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text-muted)",
            }}
          >
            <ArrowUpRight
              size={14}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            Scores: 90+ healthy, 80–89 needs review, below 80 critical. Unscored
            datasets are counted separately.
          </div>
        </>
      )}
    </section>
  );
}
