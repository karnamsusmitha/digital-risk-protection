import React from "react";
import { CloseIcon, AlertOctagonIcon, ExternalLinkIcon } from "./Icons";

export function FindingDetailModal({ finding, onClose }) {
  if (!finding) return null;

  const reasons = Array.isArray(finding.reasons)
    ? finding.reasons
    : typeof finding.reasons === "string"
    ? [finding.reasons]
    : [];

  const evidence = finding.evidence || {};
  const targetUrl =
    evidence.target_value ||
    evidence.candidate_url ||
    evidence.url ||
    finding.title ||
    "N/A";

  return (
    <div className="modal-overlay" onClick={onClose} id="finding-detail-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="metric-icon-wrap" style={{ background: "rgba(239, 68, 68, 0.15)", color: "var(--sev-critical)" }}>
              <AlertOctagonIcon size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: "1.15rem" }}>{finding.title || `Finding #${finding.id}`}</h3>
                <span className={`badge badge-${finding.severity?.toLowerCase()}`}>
                  {finding.severity}
                </span>
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Finding ID: #{finding.id} • Company ID: #{finding.company_id}
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close modal">
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Key Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ background: "var(--bg-main)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Algorithmic Risk Score
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--primary-cyan)", marginTop: 4 }}>
                {finding.risk_score?.toFixed(1) ?? "0.0"} / 100
              </div>
            </div>

            <div style={{ background: "var(--bg-main)", padding: 12, borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                Triage Status
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, textTransform: "capitalize", marginTop: 8 }}>
                <span className={`badge badge-${finding.status?.toLowerCase() || "pending"}`} style={{ fontSize: "0.85rem", padding: "4px 10px" }}>
                  {finding.status}
                </span>
              </div>
            </div>
          </div>

          {/* Target URL */}
          <div className="form-group">
            <label className="form-label">Identified Threat URL / Target</label>
            <div style={{ background: "var(--bg-main)", padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.86rem", color: "var(--primary-cyan)", wordBreak: "break-all" }}>
                {targetUrl}
              </span>
              {targetUrl.startsWith("http") && (
                <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="btn-icon" title="Open in new tab">
                  <ExternalLinkIcon size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Reasons */}
          <div className="form-group">
            <label className="form-label">Contributing Risk Signals</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {reasons.length > 0 ? (
                reasons.map((r, i) => (
                  <div key={i} style={{ background: "var(--bg-main)", padding: "8px 12px", borderRadius: 6, fontSize: "0.82rem", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--sev-high)" }}>•</span>
                    <span>{r}</span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  {finding.description || "No itemized reasons recorded."}
                </div>
              )}
            </div>
          </div>

          {/* Remediation Guidance */}
          {finding.remediation_guidance && (
            <div className="form-group">
              <label className="form-label">Recommended Remediation Action</label>
              <div style={{ background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.25)", padding: 12, borderRadius: 8, fontSize: "0.84rem", color: "var(--text-light)" }}>
                🛡️ {finding.remediation_guidance}
              </div>
            </div>
          )}

          {/* Raw Evidence Object */}
          {finding.evidence && (
            <div className="form-group">
              <label className="form-label">Telemetry & Scanner Evidence</label>
              <pre style={{ background: "var(--bg-main)", padding: 12, borderRadius: 8, fontSize: "0.75rem", border: "1px solid var(--border-subtle)", color: "#93c5fd", overflowX: "auto", maxHeight: 140 }}>
                {JSON.stringify(finding.evidence, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
