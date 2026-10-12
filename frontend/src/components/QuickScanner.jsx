import React, { useState } from "react";
import { RadarIcon, AlertOctagonIcon, CheckCircleIcon } from "./Icons";
import { analyzeThreat } from "../api/client";

export function QuickScanner({
  companies = [],
  onScanCompleted,
}) {
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [candidateName, setCandidateName] = useState("Typosquat Lookalike Portal");
  const [domain, setDomain] = useState("https://acme-secure-login.suspicious-domain.com");
  const [nameSimilarity, setNameSimilarity] = useState(0.92);
  const [logoSimilarity, setLogoSimilarity] = useState(0.88);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanResult, setScanResult] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setScanResult(null);

    if (!companyId) {
      setErrorMsg("Please select a target company.");
      return;
    }
    if (!domain.trim()) {
      setErrorMsg("Suspicious domain / URL is required.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await analyzeThreat({
        companyId,
        candidateName,
        domain: domain.trim(),
        nameSimilarity,
        logoSimilarity,
      });

      setScanResult(result);
      if (onScanCompleted) {
        onScanCompleted(result);
      }
    } catch (err) {
      setErrorMsg(err.message || "Threat analysis failed. Please verify inputs.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: "1.25rem" }}>Threat Radar & Live Risk Scoring</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          Simulate threat signal ingestion, AI Vision / NLP similarity evaluation, and automated severity classification
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Scanner Form */}
        <div className="table-card" style={{ padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div className="metric-icon-wrap" style={{ background: "rgba(6, 182, 212, 0.15)", color: "var(--primary-cyan)" }}>
              <RadarIcon size={20} />
            </div>
            <h3 style={{ fontSize: "1.1rem" }}>Ingest Threat Signal</h3>
          </div>

          <form onSubmit={handleScan} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {errorMsg && (
              <div className="alert-banner alert-danger">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Target Monitored Brand</label>
              <select
                className="form-select"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.domain ? `(${c.domain})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Candidate Threat Title</label>
              <input
                type="text"
                className="form-input"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Suspicious Domain / Phishing URL</label>
              <input
                type="text"
                className="form-input"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                required
              />
            </div>

            {/* Simulators */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">
                  Brand Name Similarity: <strong>{(nameSimilarity * 100).toFixed(0)}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={nameSimilarity}
                  onChange={(e) => setNameSimilarity(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--primary-cyan)" }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Logo Similarity: <strong>{(logoSimilarity * 100).toFixed(0)}%</strong>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={logoSimilarity}
                  onChange={(e) => setLogoSimilarity(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--primary-cyan)" }}
                />
              </div>
            </div>

            <button
              id="btn-run-threat-analysis"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || companies.length === 0}
              style={{ marginTop: 8 }}
            >
              {isLoading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  <span>Evaluating Risk Models...</span>
                </>
              ) : (
                "Run Threat Analysis"
              )}
            </button>
          </form>
        </div>

        {/* Live Result Output */}
        <div className="table-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 14 }}>Real-Time Scoring Result</h3>

          {scanResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  background: scanResult.is_official_asset_match
                    ? "var(--sev-low-bg)"
                    : "var(--sev-critical-bg)",
                  border: `1px solid ${
                    scanResult.is_official_asset_match
                      ? "var(--sev-low-border)"
                      : "var(--sev-critical-border)"
                  }`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>
                      Severity Classification
                    </span>
                    <div style={{ fontSize: "1.4rem", fontWeight: 800, textTransform: "uppercase" }}>
                      {scanResult.recommended_severity}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, color: "var(--text-muted)" }}>
                      Calculated Score
                    </span>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-cyan)" }}>
                      {scanResult.estimated_risk_score?.toFixed(1)} / 100
                    </div>
                  </div>
                </div>
              </div>

              {scanResult.is_official_asset_match ? (
                <div className="alert-banner alert-success">
                  <CheckCircleIcon size={18} />
                  <span>
                    Whitelisted Official Asset Match! Exact match with legitimate corporate infrastructure. Risk score capped at 0.0.
                  </span>
                </div>
              ) : (
                <div className="alert-banner alert-danger">
                  <AlertOctagonIcon size={18} />
                  <span>
                    Impersonation Finding Created! Converted into high-priority actionable finding #{scanResult.finding_id}.
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Algorithm Rationale</label>
                <div style={{ background: "var(--bg-main)", padding: 12, borderRadius: 8, fontSize: "0.82rem", border: "1px solid var(--border-subtle)" }}>
                  {scanResult.rationale}
                </div>
              </div>

              {scanResult.recommended_remediation && (
                <div className="form-group">
                  <label className="form-label">Remediation Guidance</label>
                  <div style={{ background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.25)", padding: 12, borderRadius: 8, fontSize: "0.82rem" }}>
                    🛡️ {scanResult.recommended_remediation}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="state-container" style={{ padding: "40px 10px" }}>
              <div className="empty-icon-box">
                <RadarIcon size={26} />
              </div>
              <div className="state-title" style={{ fontSize: "0.95rem" }}>Ready to Evaluate</div>
              <div className="state-desc" style={{ fontSize: "0.8rem" }}>
                Select a company, adjust similarity signals, and run analysis to test the backend's algorithmic scoring.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
