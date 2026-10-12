import React from "react";
import {
  ShieldIcon,
  DashboardIcon,
  CompanyIcon,
  GlobeIcon,
  AlertOctagonIcon,
  RadarIcon,
} from "./Icons";

export function Sidebar({
  activeTab,
  setActiveTab,
  summary,
  health,
  isOpen,
  onClose,
}) {
  const navItems = [
    {
      id: "overview",
      label: "Overview Dashboard",
      icon: DashboardIcon,
      count: summary?.total_findings ?? null,
    },
    {
      id: "findings",
      label: "Risk Findings",
      icon: AlertOctagonIcon,
      count: summary?.open_findings ?? (summary?.total_findings ?? null),
      highlight: (summary?.findings_by_severity?.critical || 0) > 0,
    },
    {
      id: "brands",
      label: "Monitored Brands",
      icon: CompanyIcon,
      count: summary?.total_companies ?? null,
    },
    {
      id: "assets",
      label: "Protected Assets",
      icon: GlobeIcon,
      count: summary?.total_protected_assets ?? null,
    },
    {
      id: "scanner",
      label: "Threat Radar & Scan",
      icon: RadarIcon,
      badge: "LIVE",
    },
  ];

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`} id="app-sidebar">
      <div className="sidebar-header">
        <div className="brand-icon-box">
          <ShieldIcon size={24} />
        </div>
        <div className="brand-text-box">
          <h2>AEGIS DRP</h2>
          <span className="brand-badge">Enterprise Sec</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Navigation</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              className={`nav-item ${isActive ? "active" : ""}`}
              onClick={() => {
                setActiveTab(item.id);
                if (onClose) onClose();
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="brand-badge" style={{ marginLeft: "auto", fontSize: "0.6rem" }}>
                  {item.badge}
                </span>
              )}
              {item.count !== null && item.count !== undefined && !item.badge && (
                <span
                  className="nav-badge-count"
                  style={
                    item.highlight
                      ? { background: "rgba(239, 68, 68, 0.25)", color: "#f87171" }
                      : {}
                  }
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="health-status-card" id="api-health-card">
          <div className="health-indicator">
            <span className={`pulse-dot ${health?.healthy ? "" : "offline"}`} />
            <div>
              <div style={{ color: health?.healthy ? "#10b981" : "#ef4444", fontSize: "0.8rem", fontWeight: 700 }}>
                {health?.healthy ? "FastAPI Online" : "Backend Offline"}
              </div>
              <div style={{ fontSize: "0.68rem", color: "#64748b" }}>
                {health?.data?.version ? `v${health.data.version} • SQLite` : "Checking 127.0.0.1:8000"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
