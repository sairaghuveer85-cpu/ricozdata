import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

export default function ExecutiveInsightCard() {
  const { datasets, policies, issues } = useApp();

  const totalDatasets = datasets?.length || 0;
  const avgScore = totalDatasets > 0
    ? Math.round(datasets.reduce((sum, d) => sum + (Number(d.qualityScore ?? d.quality) || 92), 0) / totalDatasets)
    : 92;
  const activePolicies = (policies || []).filter(p => p.status === 'Active').length;
  const openCritical = (issues || []).filter(i => (i.severity === 'high' || i.severity === 'critical') && i.status !== 'resolved').length;

  const generatedDate = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const insightText = `Continuous telemetry across ${totalDatasets} active enterprise datasets reflects an aggregate data reliability index of ${avgScore}%. With ${activePolicies} automated governance policies enforced and ${openCritical} critical data anomalies in active remediation, platform SLA compliance remains within target thresholds.`;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#07111F] via-[#0B1628] to-[#172554] text-white rounded-xl p-5 border border-blue-900/40 shadow-sm flex flex-col justify-between">
      {/* Subtle background glow effect */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-400/25">
            <Sparkles className="w-3 h-3 text-blue-400 animate-pulse" />
            <span>AI Governance Summary</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {generatedDate}
          </span>
        </div>

        <h4 className="text-sm font-semibold text-white tracking-tight">
          Monthly Health Trajectory
        </h4>

        <p className="mt-2 text-xs text-slate-300 leading-relaxed">
          {insightText}
        </p>
      </div>

      <div className="pt-4 mt-4 border-t border-slate-700/60 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">Continuous Evaluation</span>
        <NavLink
          to="/governance"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
        >
          <span>View Governance Policies</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </NavLink>
      </div>
    </div>
  );
}
