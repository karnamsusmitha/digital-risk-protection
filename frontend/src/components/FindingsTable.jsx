import React, { useState } from "react";
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  CopyIcon,
  AlertOctagonIcon,
} from "./Icons";
import { updateFinding } from "../api/client";

export function FindingsTable({
  findings = [],
  pagination,
  isLoading,
  error,
  onPageChange,
  severityFilter,
  setSeverityFilter,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  onFindingClick,
  onRefresh,
  onFindingUpdated,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleStatusChange = async (findingId, newStatus) => {
    setUpdatingId(findingId);
    try {
      await updateFinding(findingId, { status: newStatus });
      if (onFindingUpdated) {
        onFindingUpdated(findingId, newStatus);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status: " + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Helper to resolve URL for a finding
  const getFindingUrl = (f) => {
    if (f.evidence && typeof f.evidence === "object") {
      const ev = f.evidence;
      if (ev.target_value) return ev.target_value;
      if (ev.candidate_url) return ev.candidate_url;
      if (ev.url) return ev.url;
      if (ev.source_url) return ev.source_url;
      if (ev.phishing_url) return ev.phishing_url;
    }
    if (f.title && (f.title.includes("http") || f.title.includes(".com") || f.title.includes(".org"))) {
      return f.title;
    }
    return f.candidate?.value || f.asset?.value || "N/A";
  };

  // Helper to resolve Asset Type
  const getFindingAssetType = (f) => {
    if (f.evidence && typeof f.evidence === "object" && f.evidence.asset_type) {
      return f.evidence.asset_type;
    }
    if (f.candidate?.asset_type) return f.candidate.asset_type;
    if (f.asset?.asset_type) return f.asset.asset_type;
    return "domain";
  };

  // Helper to extract reasons array
  const getReasonsList = (f) => {
    if (Array.isArray(f.reasons)) return f.reasons;
    if (typeof f.reasons === "string") {
      try {
        const parsed = JSON.parse(f.reasons);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return [f.reasons];
      }
    }
    if (f.description) return [f.description];
    return ["Algorithmic threat signal detected"];
  };

  const getSeverityBadgeClass = (sev) => {
    switch (String(sev).toLowerCase()) {
      case "critical": return "badge-critical";
      case "high": return "badge-high";
      case "medium": return "badge-medium";
      case "low": return "badge-low";
      default: return "badge-medium";
    }
  };

  const getScoreFillColor = (score) => {
    if (score >= 80) return "var(--sev-critical)";
    if (score >= 60) return "var(--sev-high)";
    if (score >= 40) return "var(--sev-medium)";
    return "var(--sev-low)";
  };

  return (
    <div className="table-card" id="findings-table-card">
      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-title-box">
          <h3>Security Risk Findings</h3>
          <p>
            {pagination?.totalCount ?? findings.length} detected security incidents requiring triage
          </p>
        </div>

        <div className="toolbar-controls">
          {/* Search bar */}
          <div className="search-input-wrap">
            <SearchIcon size={16} />
            <input
              id="findings-search-input"
              type="text"
              className="search-input"
              placeholder="Search keyword, domain, asset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Severity filter */}
          <select
            id="findings-severity-filter"
            className="filter-select"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            aria-label="Filter by Severity"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Status filter */}
          <select
            id="findings-status-filter"
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="open">Open</option>
            <option value="completed">Completed / Resolved</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="table-responsive">
        {isLoading ? (
          <div className="state-container" id="findings-loading-state">
            <div className="spinner spinner-lg" />
            <div className="state-title" style={{ marginTop: 12 }}>Loading security findings...</div>
            <div className="state-desc">Querying threat intelligence database and risk models</div>
          </div>
        ) : error ? (
          <div className="state-container" id="findings-error-state">
            <div className="empty-icon-box" style={{ borderColor: "var(--sev-critical)", color: "var(--sev-critical)" }}>
              <AlertOctagonIcon size={28} />
            </div>
            <div className="state-title">Error Loading Findings</div>
            <div className="state-desc">{error}</div>
            <button className="btn btn-secondary btn-sm" onClick={onRefresh} style={{ marginTop: 10 }}>
              Retry Fetch
            </button>
          </div>
        ) : findings.length === 0 ? (
          <div className="state-container" id="findings-empty-state">
            <div className="empty-icon-box">
              <AlertOctagonIcon size={28} />
            </div>
            <div className="state-title">No Risk Findings Found</div>
            <div className="state-desc">
              {searchQuery || severityFilter !== "all" || statusFilter !== "all"
                ? "No findings match your current filters. Try resetting search or severity."
                : "No threats detected for this scope yet. Ingest threat signals or run a threat scan to evaluate risks."}
            </div>
          </div>
        ) : (
          <table className="drp-table" id="findings-data-table">
            <thead>
              <tr>
                <th style={{ width: "20%" }}>Asset Name</th>
                <th style={{ width: "22%" }}>URL / Target</th>
                <th style={{ width: "12%" }}>Asset Type</th>
                <th style={{ width: "16%" }}>Risk Score</th>
                <th style={{ width: "20%" }}>Reasons</th>
                <th style={{ width: "10%" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((finding) => {
                const url = getFindingUrl(finding);
                const assetType = getFindingAssetType(finding);
                const reasons = getReasonsList(finding);
                const isCopied = copiedId === finding.id;
                const isUpdating = updatingId === finding.id;

                return (
                  <tr key={finding.id} id={`finding-row-${finding.id}`}>
                    {/* Asset Name */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span
                          style={{ fontWeight: 700, color: "var(--text-primary)", cursor: "pointer" }}
                          onClick={() => onFindingClick && onFindingClick(finding)}
                          title="Click to view full details"
                        >
                          {finding.title || `Finding #${finding.id}`}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          ID: #{finding.id} • Co: #{finding.company_id}
                        </span>
                      </div>
                    </td>

                    {/* URL */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: 220 }}>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "0.82rem",
                            color: "var(--primary-cyan)",
                          }}
                          title={url}
                        >
                          {url}
                        </span>
                        {url !== "N/A" && (
                          <>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => handleCopy(url, finding.id)}
                              title={isCopied ? "Copied!" : "Copy URL"}
                              style={{ padding: 3 }}
                            >
                              <CopyIcon size={13} />
                            </button>
                            {url.startsWith("http") && (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-icon"
                                title="Open in new tab"
                                style={{ padding: 3, display: "inline-flex" }}
                              >
                                <ExternalLinkIcon size={13} />
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    {/* Asset Type */}
                    <td>
                      <span className="badge badge-asset-type">
                        {assetType.replace("_", " ")}
                      </span>
                    </td>

                    {/* Risk Score */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <div className="score-pill-wrap">
                          <span className={`badge ${getSeverityBadgeClass(finding.severity)}`}>
                            {finding.severity}
                          </span>
                          <span className="score-num" style={{ color: getScoreFillColor(finding.risk_score) }}>
                            {finding.risk_score?.toFixed(1) ?? "0.0"}
                          </span>
                        </div>
                        <div className="score-bar-bg">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${Math.min(100, Math.max(0, finding.risk_score || 0))}%`,
                              backgroundColor: getScoreFillColor(finding.risk_score),
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Reasons */}
                    <td>
                      <div className="reasons-tags-box">
                        {reasons.slice(0, 2).map((r, idx) => (
                          <span key={idx} className="reason-tag" title={r}>
                            {r.length > 40 ? `${r.slice(0, 40)}…` : r}
                          </span>
                        ))}
                        {reasons.length > 2 && (
                          <span
                            className="reason-tag"
                            style={{ cursor: "pointer", background: "rgba(6, 182, 212, 0.1)", color: "var(--primary-cyan)" }}
                            onClick={() => onFindingClick && onFindingClick(finding)}
                          >
                            +{reasons.length - 2} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td>
                      <select
                        className={`filter-select badge badge-${finding.status?.toLowerCase() || "pending"}`}
                        style={{ cursor: "pointer", padding: "4px 8px", fontSize: "0.74rem" }}
                        value={finding.status?.toLowerCase() || "pending"}
                        onChange={(e) => handleStatusChange(finding.id, e.target.value)}
                        disabled={isUpdating}
                        title="Update finding triage status"
                      >
                        <option value="pending">Pending</option>
                        <option value="open">Open</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Completed</option>
                        <option value="resolved">Resolved</option>
                        <option value="false_positive">False Positive</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div className="table-pagination" id="findings-table-pagination">
          <div>
            Showing Page <strong style={{ color: "var(--text-primary)" }}>{pagination.currentPage}</strong> of{" "}
            <strong style={{ color: "var(--text-primary)" }}>{pagination.totalPages}</strong> (
            {pagination.totalCount} total findings)
          </div>

          <div className="pagination-actions">
            <button
              id="btn-findings-prev-page"
              className="btn btn-secondary btn-sm"
              disabled={pagination.currentPage <= 1 || isLoading}
              onClick={() => onPageChange(pagination.currentPage - 1)}
            >
              <ChevronLeftIcon size={14} />
              <span>Previous</span>
            </button>
            <button
              id="btn-findings-next-page"
              className="btn btn-secondary btn-sm"
              disabled={pagination.currentPage >= pagination.totalPages || isLoading}
              onClick={() => onPageChange(pagination.currentPage + 1)}
            >
              <span>Next</span>
              <ChevronRightIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
