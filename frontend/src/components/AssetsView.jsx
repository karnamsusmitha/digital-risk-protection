import React, { useState } from "react";
import { GlobeIcon, PlusIcon, TrashIcon, CloseIcon } from "./Icons";
import { createProtectedAsset, deleteProtectedAsset } from "../api/client";

export function AssetsView({
  assets = [],
  companies = [],
  isLoading,
  onAssetAdded,
  onAssetDeleted,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id || "");
  const [assetType, setAssetType] = useState("domain");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [criticality, setCriticality] = useState("HIGH");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!companyId) {
      setErrorMsg("Please select an organization.");
      return;
    }
    if (!value.trim()) {
      setErrorMsg("Asset value/URL is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newAsset = await createProtectedAsset({
        company_id: companyId,
        asset_type: assetType,
        value: value.trim(),
        name: name.trim() || undefined,
        criticality: criticality,
        platform: assetType === "domain" ? "Web" : "General",
      });

      if (onAssetAdded) onAssetAdded(newAsset);
      setValue("");
      setName("");
      setIsModalOpen(false);
    } catch (err) {
      setErrorMsg(err.message || "Failed to create protected asset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, val) => {
    if (!window.confirm(`Delete protected asset "${val}"?`)) return;
    try {
      await deleteProtectedAsset(id);
      if (onAssetDeleted) onAssetDeleted(id);
    } catch (err) {
      alert("Failed to delete asset: " + err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem" }}>Protected Digital Assets</h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
            Whitelisted corporate domains, trademarks, and social profiles defended by DRP
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (companies.length > 0 && !companyId) setCompanyId(companies[0].id);
            setIsModalOpen(true);
          }}
          disabled={companies.length === 0}
        >
          <PlusIcon size={16} />
          <span>Add Protected Asset</span>
        </button>
      </div>

      {isLoading ? (
        <div className="state-container">
          <div className="spinner spinner-lg" />
          <div className="state-title" style={{ marginTop: 12 }}>Loading protected assets...</div>
        </div>
      ) : assets.length === 0 ? (
        <div className="table-card">
          <div className="state-container">
            <div className="empty-icon-box">
              <GlobeIcon size={28} />
            </div>
            <div className="state-title">No Protected Assets Registered</div>
            <div className="state-desc">
              Protected assets serve as the source of truth to prevent false positives and verify impersonation.
            </div>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <table className="drp-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Value / URL</th>
                <th>Company</th>
                <th>Criticality</th>
                <th style={{ width: 80 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const comp = companies.find((c) => c.id === asset.company_id);
                return (
                  <tr key={asset.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{asset.name || "Official Asset"}</span>
                    </td>
                    <td>
                      <span className="badge badge-asset-type">
                        {asset.asset_type?.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "var(--primary-cyan)", fontSize: "0.84rem" }}>
                        {asset.value}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                        {comp ? comp.name : `#${asset.company_id}`}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${asset.criticality?.toLowerCase() || "high"}`}>
                        {asset.criticality || "HIGH"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: "#ef4444" }}
                        onClick={() => handleDelete(asset.id, asset.value)}
                        title="Delete asset"
                      >
                        <TrashIcon size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Asset Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: "1.15rem" }}>Add Protected Corporate Asset</h3>
              <button type="button" className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <CloseIcon size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="alert-banner alert-danger">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Brand / Organization <span className="required">*</span></label>
                  <select
                    className="form-select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    required
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Asset Type <span className="required">*</span></label>
                  <select
                    className="form-select"
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                  >
                    <option value="domain">Official Domain</option>
                    <option value="brand_name">Brand Name / Trademark</option>
                    <option value="social_profile">Verified Social Handle</option>
                    <option value="mobile_app">Official Mobile App</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Asset Value / URL <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://acme.org or @acme_official"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Friendly Label / Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Primary Banking Portal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Criticality</label>
                  <select
                    className="form-select"
                    value={criticality}
                    onChange={(e) => setCriticality(e.target.value)}
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add to Whitelist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
