import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import Card, { CardHeader, CardTitle, CardDescription, CardContent } from '../common/Card';
import Badge from '../common/Badge';
import { BarChart3, PieChart as PieIcon, Info } from 'lucide-react';

const SEVERITY_COLORS = {
  Critical: '#e11d48', // rose-600
  High: '#f59e0b',     // amber-500
  Medium: '#eab308',   // yellow-500
  Low: '#3b82f6'       // blue-500
};

// Custom tooltip for Bar Chart
function CustomBarTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans animate-fade-in">
        <p className="font-semibold text-slate-200">{data.level}</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <span className="text-slate-400">Identified Candidates:</span>
          <span className="font-mono font-bold text-white text-sm">{data.count}</span>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 border-t border-slate-800 pt-1">
          Synthetic demonstration benchmark
        </p>
      </div>
    );
  }
  return null;
}

// Custom tooltip for Category Breakdown
function CustomCategoryTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-sans animate-fade-in">
        <p className="font-semibold text-slate-200">{data.category}</p>
        <div className="mt-1 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Total Candidates:</span>
            <span className="font-mono font-bold text-white">{data.candidates}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Critical Detections:</span>
            <span className="font-mono font-bold text-rose-400">{data.criticalCount}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Avg Risk Rating:</span>
            <span className="font-mono font-bold text-amber-300">{data.avgScore}/100</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export default function RiskDistributionChart({
  severityData = [],
  categoryData = [],
  className = ''
}) {
  const [chartMode, setChartMode] = useState('severity'); // 'severity' | 'category' | 'donut'

  return (
    <Card className={`flex flex-col justify-between ${className}`}>
      <CardHeader
        action={
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setChartMode('severity')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                chartMode === 'severity'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bar Chart by Severity"
              aria-label="View by severity"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Severity</span>
            </button>
            <button
              onClick={() => setChartMode('donut')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                chartMode === 'donut'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Donut Chart"
              aria-label="View as donut chart"
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              onClick={() => setChartMode('category')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                chartMode === 'category'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Bar Chart by Perimeter Asset"
              aria-label="View by asset category"
            >
              <span>By Asset</span>
            </button>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <CardTitle>Risk Severity Distribution</CardTitle>
          <Badge variant="blue" size="xs">
            Demo Data
          </Badge>
        </div>
        <CardDescription>
          Correlated threat severity spread across monitored candidate assets.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 flex-1 min-h-[300px]">
        {chartMode === 'severity' && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={severityData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <XAxis
                  dataKey="level"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {severityData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill || SEVERITY_COLORS[entry.badge] || '#2563eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartMode === 'donut' && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomBarTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => (
                    <span className="text-xs text-slate-600 font-medium">{value}</span>
                  )}
                />
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="level"
                >
                  {severityData.map((entry, index) => (
                    <Cell
                      key={`donut-cell-${index}`}
                      fill={entry.fill || SEVERITY_COLORS[entry.badge] || '#2563eb'}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartMode === 'category' && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryData}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <Tooltip content={<CustomCategoryTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
                <Bar dataKey="candidates" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px]">
              Simulated demonstration telemetry. Risk scores computed via synthetic lexical and fingerprint rules.
            </span>
          </div>
          <span className="font-mono text-[11px] font-semibold text-slate-700 hidden sm:inline">
            34 Total Sample Candidates
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
