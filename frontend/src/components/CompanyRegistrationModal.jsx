import React, { useState } from "react";
import { CloseIcon, CompanyIcon } from "./Icons";
import { createCompany, createProtectedAsset } from "../api/client";

export function CompanyRegistrationModal({ isOpen, onClose, onCompanyRegistered }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("Technology");
  const [description, setDescription] = useState("");
  const [autoAddAsset, setAutoAddAsset] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg("Company brand name is required.");
      return;
    }

    let cleanDomain = domain.trim();
    if (cleanDomain && !cleanDomain.startsWith("http://") && !cleanDomain.startsWith("https://")) {
      cleanDomain = `https://${cleanDomain}`;
    }

    setIsLoading(true);
    try {
      // 1. Register company
      const newCompany = await createCompany({
        name: cleanName,
        domain: cleanDomain || undefined,
        industry: industry || undefined,
        description: description.trim() || undefined,
      });

      // 2. Optionally register domain as protected asset
      if (cleanDomain && autoAddAsset && newCompany?.id) {
        try {
          await createProtectedAsset({
            company_id: newCompany.id,
            asset_type: "domain",
            value: cleanDomain,
            name: `${cleanName} Official Domain`,
            criticality: "HIGH",
            platform: "Web",
          });
        } catch (assetErr) {
          console.warn("Could not auto-add protected asset:", assetErr);
        }
      }

      setSuccessMsg(`Brand "${cleanName}" successfully registered and protected.`);
      if (onCompanyRegistered) {
        onCompanyRegistered(newCompany);
      }

      setTimeout(() => {
        setName("");
        setDomain("");
        setDescription("");
        setSuccessMsg("");
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || "Failed to register company. Please verify input.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} id="register-company-modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="metric-icon-wrap" style={{ background: "rgba(6, 182, 212, 0.15)", color: "var(--primary-cyan)" }}>
              <CompanyIcon size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.15rem" }}>Register Monitored Brand</h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Add your corporate identity and official domain for attack surface defense
              </p>
            </div>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close modal">
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errorMsg && (
              <div className="alert-banner alert-danger" id="register-error-banner">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="alert-banner alert-success" id="register-success-banner">
                <span>✅</span>
                <span>{successMsg}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="company-name-input">
                Company Brand Name <span className="required">*</span>
              </label>
              <input
                id="company-name-input"
                type="text"
                className="form-input"
                placeholder="e.g. Acme Cyber Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
              <span className="form-helper">The primary trademark or brand name monitored for fraud</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="company-domain-input">
                Official Corporate Domain
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="company-domain-input"
                  type="text"
                  className="form-input"
                  placeholder="https://acme-corp.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <span className="form-helper">Official URL used to whitelist legitimate corporate infrastructure</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="company-industry-select">
                Industry Sector
              </label>
              <select
                id="company-industry-select"
                className="form-select"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={isLoading}
              >
                <option value="Technology">Technology & Software</option>
                <option value="Financial Services">Financial Services & Banking</option>
                <option value="Healthcare">Healthcare & Biotech</option>
                <option value="E-Commerce">E-Commerce & Retail</option>
                <option value="Energy">Energy & Infrastructure</option>
                <option value="Government">Government & Defense</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="company-description-input">
                Organization Description
              </label>
              <textarea
                id="company-description-input"
                className="form-textarea"
                rows={2}
                placeholder="Brief profile of business services and key assets..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
              />
            </div>

            {domain.trim() && (
              <label className="form-checkbox-label" htmlFor="auto-add-asset-checkbox">
                <input
                  id="auto-add-asset-checkbox"
                  type="checkbox"
                  className="form-checkbox"
                  checked={autoAddAsset}
                  onChange={(e) => setAutoAddAsset(e.target.checked)}
                />
                <span>Automatically whitelist official domain as HIGH-criticality protected asset</span>
              </label>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              id="btn-submit-register-company"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  <span>Registering...</span>
                </>
              ) : (
                "Save & Protect Brand"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
