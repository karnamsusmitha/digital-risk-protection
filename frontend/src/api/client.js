/**
 * Digital Risk Protection (DRP) API Client
 * Connects React Frontend with FastAPI Backend
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1").replace(/\/+$/, "");

// Derive root URL for health checks
export const BACKEND_ROOT_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, "");

/**
 * Core HTTP Request Wrapper
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 204 No Content
    if (response.status === 204) {
      return { data: null, headers: response.headers };
    }

    const contentType = response.headers.get("content-type") || "";
    let body = null;
    if (contentType.includes("application/json")) {
      body = await response.json().catch(() => null);
    } else {
      body = await response.text().catch(() => null);
    }

    if (!response.ok) {
      let errorMessage = `Request failed (${response.status})`;
      if (body) {
        if (typeof body === "string") {
          errorMessage = body;
        } else if (body.detail) {
          if (Array.isArray(body.detail)) {
            errorMessage = body.detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
          } else {
            errorMessage = String(body.detail);
          }
        } else if (body.message) {
          errorMessage = String(body.message);
        }
      }
      const error = new Error(errorMessage);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    // Extract pagination headers
    const totalCount = response.headers.get("X-Total-Count");
    const pagination = totalCount !== null ? {
      totalCount: parseInt(totalCount, 10) || 0,
      currentPage: parseInt(response.headers.get("X-Page") || "1", 10) || 1,
      limit: parseInt(response.headers.get("X-Limit") || "20", 10) || 20,
      totalPages: parseInt(response.headers.get("X-Total-Pages") || "1", 10) || 1,
    } : null;

    return { data: body, pagination, headers: response.headers };
  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      const connErr = new Error("Cannot connect to backend API server. Please ensure the server is running on " + API_BASE_URL);
      connErr.isNetworkError = true;
      throw connErr;
    }
    throw err;
  }
}

/**
 * Health Check API
 */
export async function getBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_ROOT_URL}/health`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { healthy: false, status: res.status };
    const data = await res.json();
    return { healthy: data.status === "healthy", data };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

/**
 * Dashboard Summary API
 */
export async function getDashboardSummary(companyId = null) {
  const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const res = await apiRequest(`/dashboard/summary${query}`);
  return res.data;
}

/**
 * Companies APIs
 */
export async function getCompanies() {
  const res = await apiRequest("/companies");
  return res.data || [];
}

export async function createCompany(companyData) {
  const payload = {
    name: companyData.name?.trim(),
    domain: companyData.domain?.trim() || undefined,
    industry: companyData.industry?.trim() || undefined,
    description: companyData.description?.trim() || undefined,
  };
  const res = await apiRequest("/companies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteCompany(companyId) {
  const res = await apiRequest(`/companies/${companyId}`, {
    method: "DELETE",
  });
  return res.data;
}

/**
 * Protected Assets APIs
 */
export async function getProtectedAssets(companyId = null) {
  const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const res = await apiRequest(`/assets${query}`);
  return res.data || [];
}

export async function createProtectedAsset(assetData) {
  const payload = {
    company_id: Number(assetData.company_id),
    asset_type: assetData.asset_type, // "domain", "brand_name", "social_profile", "mobile_app"
    value: assetData.value?.trim(),
    name: assetData.name?.trim() || undefined,
    criticality: assetData.criticality || "HIGH",
    platform: assetData.platform || "Web",
  };
  const res = await apiRequest("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteProtectedAsset(assetId) {
  const res = await apiRequest(`/assets/${assetId}`, {
    method: "DELETE",
  });
  return res.data;
}

/**
 * Threat Candidates APIs
 */
export async function getCandidates(companyId = null) {
  const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  const res = await apiRequest(`/candidates${query}`);
  return res.data || [];
}

export async function createCandidate(candidateData) {
  const payload = {
    company_id: Number(candidateData.company_id),
    asset_type: candidateData.asset_type || "domain",
    value: candidateData.value?.trim(),
    source: candidateData.source || "MONITORING_CRAWLER",
    candidate_type: candidateData.candidate_type || "phishing_domain",
    confidence_score: candidateData.confidence_score !== undefined ? Number(candidateData.confidence_score) : 0.85,
    status: candidateData.status || "pending",
  };
  const res = await apiRequest("/candidates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

/**
 * Risk Findings APIs (with pagination & rich filters)
 */
export async function getFindings({
  page = 1,
  pageSize = 10,
  companyId = null,
  severity = null,
  status = null,
  search = null,
  minRiskScore = null,
  maxRiskScore = null,
} = {}) {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (pageSize) params.set("page_size", String(pageSize));
  if (companyId) params.set("company_id", String(companyId));
  if (severity && severity !== "all") params.set("severity", severity.toLowerCase());
  if (status && status !== "all") params.set("status", status.toLowerCase());
  if (search && search.trim()) params.set("search", search.trim());
  if (minRiskScore !== null && minRiskScore !== undefined && minRiskScore !== "") {
    params.set("min_risk_score", String(minRiskScore));
  }
  if (maxRiskScore !== null && maxRiskScore !== undefined && maxRiskScore !== "") {
    params.set("max_risk_score", String(maxRiskScore));
  }

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const res = await apiRequest(`/findings${queryString}`);
  return {
    items: res.data || [],
    pagination: res.pagination || {
      totalCount: (res.data || []).length,
      currentPage: page,
      limit: pageSize,
      totalPages: 1,
    },
  };
}

export async function updateFinding(findingId, updateData) {
  const res = await apiRequest(`/findings/${findingId}`, {
    method: "PATCH",
    body: JSON.stringify(updateData),
  });
  return res.data;
}

export async function deleteFinding(findingId) {
  const res = await apiRequest(`/findings/${findingId}`, {
    method: "DELETE",
  });
  return res.data;
}

/**
 * Automated Threat Analysis API
 * Ingests threat signals, computes explainable risk score, and generates finding
 */
export async function analyzeThreat({
  companyId,
  candidateName,
  domain,
  nameSimilarity = 0.92,
  logoSimilarity = 0.88,
}) {
  const payload = {
    company_id: Number(companyId),
    candidate_name: candidateName?.trim() || "Threat Candidate",
    domain: domain?.trim(),
    source: "AI_VISION_MODULE",
    ai_evidence: {
      name_similarity: Number(nameSimilarity),
      logo_similarity: Number(logoSimilarity),
      model_name: "drp-brand-vision-v2",
      model_confidence: 0.95,
    },
    monitoring_evidence: {
      candidate_url: domain?.trim(),
      asset_type: "domain",
      platform: "Web",
      source_identifier: "CERTSTREAM_MONITOR",
    },
    deduplicate: true,
  };

  const res = await apiRequest("/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}
