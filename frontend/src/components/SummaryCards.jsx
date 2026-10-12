import React from "react";
import {
  CompanyIcon,
  GlobeIcon,
  RadarIcon,
  AlertTriangleIcon,
  AlertOctagonIcon,
} from "./Icons";

export function SummaryCards({ summary, onFilterSeverity, _isLoading, error }) {
  const totalCompanies = summary?.total_companies ?? 0;
  const totalAssets = summary?.total_protected_assets ?? summary?.total_assets ?? 0;
  const totalCandidates = summary?.total_candidates_analyzed ?? summary?.total_candidates ?? 0;
  
  const findingsBySev = summary?.findings_by_severity || summary?.severity_breakdown || {};
  const criticalCount = findingsBySev.critical ?? findingsBySev.CRITICAL ?? 0;
  const highCount = findingsBySev.high ?? findingsBySev.HIGH ?? 0;
  const mediumCount = findingsBySev.medium ?? findingsBySev.MEDIUM ?? 0;
  const lowCount = findingsBySev.low ?? findingsBySev.LOW ?? 0;

  const highRiskTotal = criticalCount + highCount;

  return (
    <div className="summary-section" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error && (
        <div className="alert-banner alert-danger">
          <span>⚠️</span>
          <span>Failed to load summary metrics: {error}</span>
        </div>
      )}
      <div className="summary-grid" id="summary-cards-container">
        {/* Card 1: Monitored Brands */}
        <div className="metric-card accent-cyan" id="card-monitored-brands">
          <div className="metric-header">
            <span className="metric-title">Monitored Brands</span>
            <div className="metric-icon-wrap" style={{ color: "var(--primary-cyan)" }}>
              <CompanyIcon size={20} />
            </div>
          </div>
          <div className="metric-value">{totalCompanies}</div>
          <div className="metric-subtext">
            <span>Corporate brands defended</span>
          </div>
        </div>

        {/* Card 2: Protected Assets */}
        <div className="metric-card accent-blue" id="card-protected-assets">
          <div className="metric-header">
            <span className="metric-title">Protected Digital Assets</span>
            <div className="metric-icon-wrap" style={{ color: "var(--primary-blue)" }}>
              <GlobeIcon size={20} />
            </div>
          </div>
          <div className="metric-value">{totalAssets}</div>
          <div className="metric-subtext">
            <span>Whitelisted domains & profiles</span>
          </div>
        </div>

        {/* Card 3: Suspicious Assets / Threat Signals */}
        <div className="metric-card accent-orange" id="card-suspicious-assets">
          <div className="metric-header">
            <span className="metric-title">Suspicious Assets</span>
            <div className="metric-icon-wrap" style={{ color: "var(--sev-high)" }}>
              <RadarIcon size={20} />
            </div>
          </div>
          <div className="metric-value">{totalCandidates}</div>
          <div className="metric-subtext">
            <span>Threat candidates analyzed</span>
          </div>
        </div>

        {/* Card 4: High-Risk Findings */}
        <div className="metric-card accent-red" id="card-high-risk-findings">
          <div className="metric-header">
            <span className="metric-title">High-Risk Findings</span>
            <div className="metric-icon-wrap" style={{ color: "var(--sev-critical)" }}>
              <AlertOctagonIcon size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: highRiskTotal > 0 ? "var(--sev-critical)" : undefined }}>
            {highRiskTotal}
          </div>
          <div className="metric-subtext">
            <span style={{ color: highRiskTotal > 0 ? "var(--sev-critical)" : undefined }}>
              {criticalCount} Critical • {highCount} High
            </span>
          </div>
        </div>
      </div>

      {/* Severity Breakdown Strip */}
      <div className="severity-banner" id="severity-breakdown-banner">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangleIcon size={18} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-light)" }}>
            Findings Severity Posture:
          </span>
        </div>

        <div className="severity-chips">
          <button
            type="button"
            className="sev-chip critical"
            onClick={() => onFilterSeverity && onFilterSeverity("critical")}
            title="Filter Critical Findings"
          >
            <span className="badge-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sev-critical)" }} />
            Critical: {criticalCount}
          </button>
          <button
            type="button"
            className="sev-chip high"
            onClick={() => onFilterSeverity && onFilterSeverity("high")}
            title="Filter High Findings"
          >
            <span className="badge-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sev-high)" }} />
            High: {highCount}
          </button>
          <button
            type="button"
            className="sev-chip medium"
            onClick={() => onFilterSeverity && onFilterSeverity("medium")}
            title="Filter Medium Findings"
          >
            <span className="badge-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sev-medium)" }} />
            Medium: {mediumCount}
          </button>
          <button
            type="button"
            className="sev-chip low"
            onClick={() => onFilterSeverity && onFilterSeverity("low")}
            title="Filter Low Findings"
          >
            <span className="badge-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--sev-low)" }} />
            Low: {lowCount}
          </button>
        </div>
      </div>
    </div>
  );
}
