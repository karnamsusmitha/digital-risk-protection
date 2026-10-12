import React from "react";
import { CompanyIcon, GlobeIcon, PlusIcon, TrashIcon, ExternalLinkIcon } from "./Icons";
import { deleteCompany } from "../api/client";

export function BrandsView({
  companies = [],
  isLoading,
  onOpenRegisterModal,
  onCompanyDeleted,
  onSelectBrand,
}) {
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete brand "${name}"? This will remove associated assets and findings.`)) {
      return;
    }
    try {
      await deleteCompany(id);
      if (onCompanyDeleted) onCompanyDeleted(id);
    } catch (err) {
      alert("Failed to delete company: " + err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem" }}>Monitored Corporate Brands</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Organizations currently enrolled in attack surface monitoring & fraud protection
          </p>
        </div>
        <button className="btn btn-primary" onClick={onOpenRegisterModal}>
          <PlusIcon size={16} />
          <span>Register New Brand</span>
        </button>
      </div>

      {isLoading ? (
        <div className="state-container">
          <div className="spinner spinner-lg" />
          <div className="state-title" style={{ marginTop: 12 }}>Loading monitored brands...</div>
        </div>
      ) : companies.length === 0 ? (
        <div className="table-card">
          <div className="state-container">
            <div className="empty-icon-box">
              <CompanyIcon size={28} />
            </div>
            <div className="state-title">No Brands Registered Yet</div>
            <div className="state-desc">
              Register your organization and official domain to begin automated threat detection and impersonation monitoring.
            </div>
            <button className="btn btn-primary" onClick={onOpenRegisterModal} style={{ marginTop: 12 }}>
              <PlusIcon size={16} />
              <span>Register First Brand</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {companies.map((c) => (
            <div key={c.id} className="metric-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="metric-icon-wrap" style={{ color: "var(--primary-cyan)" }}>
                    <CompanyIcon size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.05rem" }}>{c.name}</h3>
                    <span className="badge badge-asset-type" style={{ fontSize: "0.68rem" }}>
                      {c.industry || "General Industry"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-icon"
                  style={{ color: "#ef4444" }}
                  onClick={() => handleDelete(c.id, c.name)}
                  title="Delete brand"
                >
                  <TrashIcon size={16} />
                </button>
              </div>

              {c.domain ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.84rem", color: "var(--primary-cyan)" }}>
                  <GlobeIcon size={15} />
                  <a
                    href={c.domain.startsWith("http") ? c.domain : `https://${c.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "inherit", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <span>{c.domain}</span>
                    <ExternalLinkIcon size={12} />
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  No official domain registered
                </div>
              )}

              {c.description && (
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {c.description}
                </p>
              )}

              <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Risk Score: <strong style={{ color: c.overall_risk_score > 50 ? "var(--sev-high)" : "var(--sev-low)" }}>{c.overall_risk_score?.toFixed(1) || "0.0"}</strong>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onSelectBrand && onSelectBrand(c.id)}
                >
                  View Findings
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
