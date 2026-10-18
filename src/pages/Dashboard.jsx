import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Calendar,
  Building,
  Database,
  Users,
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import QualityChart from "../components/dashboard/QualityChart";
import DataHealthCard from "../components/dashboard/DataHealthCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import PopularDatasets from "../components/dashboard/PopularDatasets";
import { useApp } from "../context/AppContext";
import DatasetHealthDonut from "../components/dashboard/DatasetHealthDonut";

export default function Dashboard() {
  const navigate = useNavigate();
  const { dashboardMetrics, currentUser, datasets = [] } = useApp();
  const [timeRange, setTimeRange] = useState("Last 30 days");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && dropdownOpen) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  const metrics =
    dashboardMetrics && dashboardMetrics.length > 0
      ? dashboardMetrics
      : [
          {
            id: "total-datasets",
            title: "TOTAL DATASETS",
            value: "0",
            comparison: "0 active",
            isPositive: false,
            trend: "neutral",
          },
          {
            id: "data-quality",
            title: "DATA QUALITY",
            value: "N/A",
            comparison: "No Scans",
            isPositive: false,
            trend: "neutral",
          },
          {
            id: "policy-violations",
            title: "POLICY VIOLATIONS",
            value: "0",
            comparison: "0 open",
            isPositive: true,
            trend: "down",
          },
          {
            id: "active-users",
            title: "ACTIVE USERS",
            value: "0",
            comparison: "0 registered",
            isPositive: false,
            trend: "neutral",
          },
        ];

  const orgName = currentUser?.organization?.name || "Enterprise Workspace";

  return (
    <div className="dashboard-page space-y-5 sm:space-y-6 pb-8">
      {/* Top Header */}
      <div
        className="dashboard-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-xl font-bold tracking-tight leading-tight sm:text-2xl"
              style={{ color: "var(--color-text-primary)" }}
            >
              Enterprise Overview
            </h1>
            <span
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
              style={{
                color: "var(--color-brand)",
                backgroundColor:
                  "color-mix(in srgb, var(--color-brand) 8%, var(--color-surface))",
                borderColor:
                  "color-mix(in srgb, var(--color-brand) 22%, var(--color-border))",
              }}
            >
              <Building className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="max-w-[220px] truncate sm:max-w-[320px]">
                {orgName}
              </span>
            </span>
          </div>
          <p
            className="text-xs mt-0.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            Operational reliability, data governance, and active catalog
            inventory.
          </p>
        </div>

        {/* Date / Time Range Selector */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:flex-nowrap sm:self-auto">
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)",
            }}
          >
            <Calendar
              className="w-3.5 h-3.5"
              style={{ color: "var(--color-text-muted)" }}
              aria-hidden="true"
            />
            <span>
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              <span>{timeRange}</span>
              <ChevronDown
                className="w-3.5 h-3.5"
                style={{ color: "var(--color-text-muted)" }}
                aria-hidden="true"
              />
            </button>

            {dropdownOpen && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-40 rounded-lg py-1 text-xs shadow-lg"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              >
                {[
                  "Last 7 days",
                  "Last 30 days",
                  "Last 90 days",
                  "Year to date",
                ].map((range) => (
                  <button
                    key={range}
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setTimeRange(range);
                      setDropdownOpen(false);
                    }}
                    className="min-h-9 w-full cursor-pointer px-3 py-2 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 dark:hover:bg-[#111E30] dark:focus-visible:bg-[#111E30]"
                    style={{
                      color:
                        timeRange === range
                          ? "var(--color-brand)"
                          : "var(--color-text-secondary)",
                      fontWeight: timeRange === range ? 600 : 400,
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1. Integrated KPI Metric Bar */}
      <div
        data-tour="dashboard-metrics"
        className="dashboard-metrics enterprise-workbench rounded-xl grid grid-cols-2 lg:grid-cols-4 overflow-hidden shadow-2xs"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {metrics.map((metric, idx) => (
          <div
            key={metric.id}
            className={`
              ${idx % 2 === 1 ? "border-l" : ""}
              ${idx >= 2 ? "border-t lg:border-t-0" : ""}
              ${idx > 0 ? "lg:border-l" : ""}
            `}
            style={{
              borderColor: "var(--color-border)",
            }}
          >
            <StatCard
              title={metric.title}
              value={metric.value}
              comparisonText={
                metric.comparisonText ||
                `${metric.comparison} ${metric.id === "policy-violations" ? "resolved" : metric.id === "data-quality" ? "vs target" : "vs last period"}`
              }
              isPositive={metric.isPositive}
              trendType={metric.trendType || "positive"}
            />
          </div>
        ))}
      </div>

      {/* Fresh Workspace Welcome Banner (shown when workspace has no datasets yet) */}
      {datasets.length === 0 && (
        <div className="dashboard-welcome-banner p-5 sm:p-6 rounded-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
                <Building className="w-4 h-4" />
                <span>Fresh Workspace Initialized</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Welcome to your new {orgName} workspace
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl leading-relaxed">
                Your workspace is isolated and ready. Connect your enterprise
                databases, add authorized employees, and start discovering
                catalog assets with real-time governance.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate("/datasources")}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Connect Data Source</span>
              </button>
              {(currentUser?.isMainAdmin ||
                currentUser?.role === "MAIN_ADMIN") && (
                <button
                  type="button"
                  onClick={() => navigate("/users")}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Add Employees</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Data Reliability Studio */}
      <div
        className="dashboard-reliability enterprise-workbench grid grid-cols-1 lg:grid-cols-12 overflow-hidden rounded-xl shadow-2xs divide-y lg:divide-y-0 lg:divide-x"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {/* Primary analytics */}
        <div className="lg:col-span-7 min-w-0 p-4 sm:p-5">
          <QualityChart />
        </div>

        {/* Reliability index */}
        <div
          className="lg:col-span-5 min-w-0 p-4 sm:p-5"
          style={{ backgroundColor: "var(--color-surface-secondary)" }}
        >
          <DataHealthCard />
        </div>
      </div>

      {/* 3. Dataset Health Distribution */}
      <div
        className="enterprise-workbench min-w-0 rounded-xl p-4 sm:p-5"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <DatasetHealthDonut />
      </div>

      {/* 3. Unified Operations Workbench (Activity Stream + High-Demand Assets) */}
      <div
        className="dashboard-operations enterprise-workbench rounded-xl grid grid-cols-1 lg:grid-cols-2 overflow-hidden divide-y lg:divide-y-0 lg:divide-x"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderColor: "var(--color-border)",
        }}
      >
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <RecentActivity />
        </div>
        <div className="p-4 sm:p-5 flex flex-col justify-between">
          <PopularDatasets />
        </div>
      </div>
    </div>
  );
}
