import React from "react";
import { PlusIcon, RefreshIcon } from "./Icons";

export function Header({
  activeTab,
  companies = [],
  selectedCompanyId,
  setSelectedCompanyId,
  onRefresh,
  isRefreshing,
  onOpenRegisterModal,
  onToggleSidebar,
}) {
  const getTabTitles = () => {
    switch (activeTab) {
      case "overview":
        return {
          title: "Executive Security Dashboard",
          subtitle: "Continuous digital risk posture, threat candidates, and verified findings",
        };
      case "findings":
        return {
          title: "Security Risk Findings",
          subtitle: "Triage detected threats, domain lookalikes, and impersonation attempts",
        };
      case "brands":
        return {
          title: "Monitored Brands & Entities",
          subtitle: "Corporate entities defended across web, domain registrars, and social",
        };
      case "assets":
        return {
          title: "Protected Digital Assets",
          subtitle: "Legitimate corporate assets, official domains, apps, and verified profiles",
        };
      case "scanner":
        return {
          title: "Threat Radar & Live Analysis",
          subtitle: "Automated AI Vision, NLP similarity, and algorithmic risk scoring engine",
        };
      default:
        return {
          title: "Digital Risk Protection",
          subtitle: "Attack surface monitoring and threat mitigation platform",
        };
    }
  };

  const { title, subtitle } = getTabTitles();

  return (
    <header className="top-header" id="top-header">
      <div className="header-left">
        <button
          className="btn-icon mobile-menu-btn"
          id="btn-mobile-menu"
          onClick={onToggleSidebar}
          style={{ display: "none" }}
          aria-label="Toggle Navigation"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="header-title-box">
          <h1 id="page-main-heading">{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {companies.length > 0 && (
          <select
            id="company-scope-select"
            className="company-filter-select"
            value={selectedCompanyId || ""}
            onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
            aria-label="Filter by Company"
          >
            <option value="">All Monitored Brands ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.domain ? `(${c.domain})` : ""}
              </option>
            ))}
          </select>
        )}

        <button
          id="btn-refresh-data"
          className="btn btn-secondary btn-icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh live data"
          aria-label="Refresh Data"
        >
          <div className={isRefreshing ? "spinner" : ""}>
            <RefreshIcon size={18} />
          </div>
        </button>

        <button
          id="btn-open-register-brand"
          className="btn btn-primary"
          onClick={onOpenRegisterModal}
        >
          <PlusIcon size={16} />
          <span>Register Brand</span>
        </button>
      </div>
    </header>
  );
}
