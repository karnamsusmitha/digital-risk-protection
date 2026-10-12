# Frontend Integration Guide for React

This guide documents how to integrate our React frontend application with the Digital Risk Protection (DRP) FastAPI backend.

---

## 1. Backend Service Details

| Property | Value |
| :--- | :--- |
| **Default Base URL** | `http://127.0.0.1:8000` or `http://localhost:8000` |
| **API Version Prefix** | `/api/v1` |
| **Interactive Docs (Swagger)** | `http://127.0.0.1:8000/docs` |
| **Alternative Docs (ReDoc)** | `http://127.0.0.1:8000/redoc` |
| **Health Check** | `GET http://127.0.0.1:8000/health` |

---

## 2. CORS Configuration & Headers

The backend is configured with FastAPI's `CORSMiddleware` supporting standard local frontend origins:
- `http://localhost:3000` & `http://127.0.0.1:3000` (Create React App / Next.js)
- `http://localhost:3001` & `http://127.0.0.1:3001` (Alternative CRA port)
- `http://localhost:5173` & `http://127.0.0.1:5173` (Vite dev server)
- `http://localhost:5174` & `http://127.0.0.1:5174` (Alternative Vite port)
- `http://localhost:4173` & `http://127.0.0.1:4173` (Vite preview server)
- `http://localhost:8080` & `http://127.0.0.1:8080` (Webpack dev server)

Additional origins can be configured in the `.env` file:
```env
CORS_ORIGINS="http://localhost:3000,http://localhost:5173,http://localhost:4173"
```

### Exposed Headers for Pagination
The following response headers are explicitly exposed by the backend so browser `fetch` and `axios` clients can access them:
- `X-Total-Count`: Total number of matching items in the database.
- `X-Page`: Current page number (1-based index).
- `X-Limit`: Items per page.
- `X-Total-Pages`: Total number of available pages.
- `Content-Range`: Pagination range metadata.

---

## 3. Recommended Frontend Fetch Helper

A lightweight fetch wrapper that handles JSON encoding, error parsing, and pagination header extraction:

```typescript
// src/api/client.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

export interface ApiResponse<T> {
  data: T;
  pagination?: {
    totalCount: number;
    currentPage: number;
    limit: number;
    totalPages: number;
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      errorBody.detail ||
      errorBody.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { data: null as unknown as T };
  }

  const data = await response.json();

  // Extract pagination headers if available
  const totalCount = response.headers.get("X-Total-Count");
  const pagination = totalCount
    ? {
        totalCount: parseInt(totalCount, 10),
        currentPage: parseInt(response.headers.get("X-Page") || "1", 10),
        limit: parseInt(response.headers.get("X-Limit") || "100", 10),
        totalPages: parseInt(response.headers.get("X-Total-Pages") || "1", 10),
      }
    : undefined;

  return { data, pagination };
}
```

---

## 4. Core Integration Workflows & Fetch Examples

### 1. Registering a Company (`POST /api/v1/companies`)

Creates a new monitored brand or corporate entity.

#### Request Example:
```javascript
async function registerCompany({ name, domain, industry, description }) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      domain: domain || undefined,
      industry: industry || undefined,
      description: description || undefined,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to register company");
  }

  return await response.json();
}

// Usage:
registerCompany({
  name: "Acme Cyber Corp",
  domain: "https://acme-corp.com",
  industry: "Financial Services",
  description: "Global fintech and digital banking platform.",
}).then((company) => console.log("Registered Company:", company));
```

#### Response Format (HTTP 201 Created):
```json
{
  "id": 1,
  "name": "Acme Cyber Corp",
  "domain": "https://acme-corp.com",
  "industry": "Financial Services",
  "description": "Global fintech and digital banking platform.",
  "overall_risk_score": 0.0,
  "created_at": "2026-10-12T10:00:00Z",
  "updated_at": "2026-10-12T10:00:00Z"
}
```

---

### 2. Registering a Protected Asset (`POST /api/v1/assets`)

Adds an official digital asset belonging to a registered company.

- **Allowed `asset_type` values:** `"brand_name"`, `"domain"`, `"social_profile"`, `"mobile_app"`
- **Allowed `criticality` values:** `"LOW"`, `"MEDIUM"`, `"HIGH"`, `"CRITICAL"`

#### Request Example:
```javascript
async function registerProtectedAsset({ companyId, assetType, value, name, criticality, platform }) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: companyId,
      asset_type: assetType, // "domain", "brand_name", "social_profile", "mobile_app"
      value: value,          // e.g. "https://acme-corp.com" or "@acme_official"
      name: name || undefined,
      criticality: criticality || "HIGH",
      platform: platform || "Web",
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to register asset");
  }

  return await response.json();
}

// Usage:
registerProtectedAsset({
  companyId: 1,
  assetType: "domain",
  value: "https://acme-corp.com",
  name: "Official Corporate Portal",
  criticality: "HIGH",
  platform: "Web",
}).then((asset) => console.log("Registered Asset:", asset));
```

#### Response Format (HTTP 201 Created):
```json
{
  "id": 1,
  "company_id": 1,
  "asset_type": "domain",
  "value": "https://acme-corp.com",
  "platform": "Web",
  "name": "Official Corporate Portal",
  "criticality": "HIGH",
  "tags": null,
  "created_at": "2026-10-12T10:00:00Z",
  "updated_at": "2026-10-12T10:00:00Z"
}
```

---

### 3. Creating a Threat Candidate Signal (`POST /api/v1/candidates`)

Ingests an unverified candidate threat discovered by external crawlers, certificate logs, or threat feeds.

#### Request Example:
```javascript
async function createCandidate({ companyId, assetId, assetType, value, source, candidateType, confidenceScore }) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/candidates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: companyId,
      asset_id: assetId || undefined,
      asset_type: assetType, // "domain", "social_profile", "mobile_app", "brand_name"
      value: value,          // e.g. "https://acme-corp-login.phishing-hub.com"
      source: source || "MONITORING_CRAWLER",
      candidate_type: candidateType || "phishing_domain",
      confidence_score: confidenceScore || 0.85,
      status: "pending",
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to create candidate");
  }

  return await response.json();
}

// Usage:
createCandidate({
  companyId: 1,
  assetType: "domain",
  value: "https://acme-corp-login.phishing-hub.com",
  source: "CERTSTREAM_MONITOR",
  candidate_type: "phishing_domain",
  confidenceScore: 0.88,
}).then((cand) => console.log("Candidate Created:", cand));
```

#### Response Format (HTTP 201 Created):
```json
{
  "id": 1,
  "company_id": 1,
  "asset_id": null,
  "asset_type": "domain",
  "value": "https://acme-corp-login.phishing-hub.com",
  "platform": null,
  "observed_metadata": null,
  "source": "CERTSTREAM_MONITOR",
  "candidate_type": "phishing_domain",
  "raw_data": null,
  "confidence_score": 0.88,
  "status": "pending",
  "created_at": "2026-10-12T10:00:00Z",
  "updated_at": "2026-10-12T10:00:00Z"
}
```

---

### 4. Requesting Threat Risk Analysis (`POST /api/v1/analyze`)

Executes automated risk assessment, computing an explainable risk score (0-100), assigning a severity tier (`critical`, `high`, `medium`, `low`), generating remediation guidance, and persisting the finding in the database.

#### Request Example:
```javascript
async function requestThreatAnalysis({
  companyId,
  assetId,
  domain,
  candidateName,
  aiEvidence,
  monitoringEvidence,
}) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: companyId,
      asset_id: assetId || undefined,
      candidate_name: candidateName,
      domain: domain,
      source: "AI_VISION_MODULE",
      ai_evidence: aiEvidence || {
        name_similarity: 0.92,
        logo_similarity: 0.88,
        model_name: "drp-brand-vision-v2",
        model_confidence: 0.95,
      },
      monitoring_evidence: monitoringEvidence || {
        candidate_url: domain,
        asset_type: "domain",
        platform: "Web",
        source_identifier: "CERTSTREAM_MONITOR",
      },
      deduplicate: true,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Analysis request failed");
  }

  return await response.json();
}

// Usage:
requestThreatAnalysis({
  companyId: 1,
  candidateName: "acme-corp-secure-login",
  domain: "https://acme-corp-secure-login.com",
}).then((result) => {
  console.log("Analysis Result:", result);
  console.log("Recommended Severity:", result.recommended_severity);
  console.log("Risk Score:", result.estimated_risk_score);
  console.log("Remediation Guidance:", result.recommended_remediation);
});
```

#### Response Format (HTTP 200 OK):
```json
{
  "company_id": 1,
  "company_name": "Acme Cyber Corp",
  "recommended_severity": "critical",
  "estimated_risk_score": 88.5,
  "confidence_score": 0.92,
  "should_convert_to_finding": true,
  "rationale": "High brand and logo similarity detected on unregistered external infrastructure.",
  "recommended_remediation": "Request domain registrar suspension and issue threat advisory.",
  "overall_company_risk_score": 45.0,
  "company_risk_level": "MODERATE",
  "finding_id": 1,
  "status": "pending",
  "reasons": [
    "High brand similarity score: 0.92",
    "High logo similarity score: 0.88"
  ],
  "evidence": {
    "source": "AI_VISION_MODULE",
    "target_value": "https://acme-corp-secure-login.com"
  },
  "is_official_asset_match": false,
  "is_fallback": false,
  "execution_mode": "live_integrated",
  "is_duplicate_updated": false,
  "disclaimer": "Preliminary algorithmic risk assessment based strictly on provided input signals."
}
```

---

### 4b. AI-Based Brand Impersonation Detection (`POST /api/v1/analysis/detect-brand-impersonation`)

Runs deterministic & AI brand similarity evaluation comparing candidates against official registered brands and domains:
- Detects look-alike names using text normalization, edit distance, and homoglyphs.
- Identifies typosquatting, combosquatting, deceptive subdomains, and risky TLD swaps.
- Returns explainable risk score (0 to 100), severity, itemized reasons, and remediation guidance.

#### Request Example:
```javascript
async function detectBrandImpersonation({ companyId, candidateName, candidateDomain, contextIndicators }) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/analysis/detect-brand-impersonation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: companyId,
      candidate_name: candidateName,
      candidate_domain: candidateDomain,
      context_indicators: contextIndicators || ["active_dns"],
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Brand impersonation detection failed");
  }

  return await response.json();
}

// Usage:
detectBrandImpersonation({
  companyId: 1,
  candidateName: "Acme Secure Login",
  candidateDomain: "https://acmecorp-login.xyz",
  contextIndicators: ["active_dns"],
}).then((result) => {
  console.log("Brand Impersonation Result:", result);
  console.log("Risk Score:", result.risk_score);
  console.log("Severity:", result.severity);
  console.log("Reasons:", result.reasons);
  console.log("Remediation:", result.remediation_guidance);
});
```

#### Response Format (HTTP 200 OK):
```json
{
  "candidate_name": "Acme Secure Login",
  "candidate_domain": "https://acmecorp-login.xyz",
  "matched_brand": "Acme Corp",
  "matched_official_domain": "acmecorp.com",
  "name_similarity": 0.85,
  "is_name_lookalike": true,
  "is_domain_variation": true,
  "variation_types": ["combosquatting_credential_harvesting", "risky_tld_swap"],
  "homoglyphs_detected": [],
  "is_official_match": false,
  "risk_score": 72.0,
  "severity": "HIGH",
  "reasons": [
    "Brand name similarity: 0.85 (+17.0 pts). Resembles monitored brand.",
    "High-Risk Combosquatting: Domain embeds brand with credential-harvesting keywords (+35.0 pts).",
    "Brand domain registered on high-abuse top-level domain (TLD) (+20.0 pts)."
  ],
  "evidence": {
    "candidate_name": "Acme Secure Login",
    "candidate_domain": "https://acmecorp-login.xyz",
    "name_similarity": 0.85,
    "variation_types": ["combosquatting_credential_harvesting", "risky_tld_swap"],
    "final_score": 72.0,
    "severity": "HIGH"
  },
  "remediation_guidance": "Issue trademark infringement notice to hosting provider and monitor threat telemetry."
}
```

---

### 4c. Monitoring & Candidate Asset Collection (`POST /api/v1/monitoring/collect`)

Triggers candidate asset collection across domains, social profiles, and mobile app stores:
- Normalizes and validates submitted or discovered URLs.
- Compares candidates against official registered company domains.
- Uses configured live external providers or provides clearly labeled sample data.
- **Truth-in-Labeling Guarantee**: `is_live_monitoring` is strictly `false` when using sample data.
- Optionally persists assets into the database as pending candidates (`persist_to_database: true`).

#### Request Example (Collect & Persist):
```javascript
async function collectMonitoringCandidates({ companyId, assetTypes, persistToDatabase = true, limit = 10 }) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/monitoring/collect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: companyId,
      asset_types: assetTypes || ["domain", "social_profile", "mobile_app"],
      persist_to_database: persistToDatabase,
      limit: limit,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Monitoring collection failed");
  }

  return await response.json();
}

// Usage:
collectMonitoringCandidates({ companyId: 1, persistToDatabase: true }).then((data) => {
  console.log("Total Collected:", data.total_collected);
  console.log("Persisted to DB:", data.persisted_count);
  console.log("Live Monitoring Active:", data.is_live_monitoring);
  console.log("Monitoring Mode:", data.monitoring_mode);
  console.log("Disclaimer:", data.disclaimer);
});
```

#### Request Example (URL Normalization & Validation):
```javascript
async function validateCandidateUrl({ url, companyId }) {
  const response = await fetch("http://127.0.0.1:8000/api/v1/monitoring/validate-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url,
      company_id: companyId,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "URL validation failed");
  }

  return await response.json();
}

// Usage:
validateCandidateUrl({
  url: "https://twitter.com/acme_support_help?utm_source=twitter&ref=feed",
  companyId: 1,
}).then((result) => {
  console.log("Clean URL:", result.url_info.normalized_url);
  console.log("Asset Type:", result.asset_type);     // "social_profile"
  console.log("Platform:", result.platform);         // "Twitter / X"
  console.log("Official Match:", result.is_official_match); // false
});
```

---

### 5. Fetching Dashboard Summary Metrics (`GET /api/v1/dashboard/summary`)

Returns aggregated key performance indicators for executive and operational dashboards. Supports optional filtering by `company_id`.

#### Request Example:
```javascript
async function getDashboardSummary(companyId = null) {
  const url = new URL("http://127.0.0.1:8000/api/v1/dashboard/summary");
  if (companyId) {
    url.searchParams.append("company_id", companyId);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to load dashboard summary");
  }

  return await response.json();
}

// Usage:
getDashboardSummary().then((summary) => {
  console.log("Total Protected Assets:", summary.total_protected_assets);
  console.log("Total Candidates Analyzed:", summary.total_candidates_analyzed);
  console.log("Critical Findings:", summary.findings_by_severity.critical);
  console.log("Recent Findings:", summary.recent_findings);
});
```

#### Response Format (HTTP 200 OK):
```json
{
  "total_protected_assets": 12,
  "total_candidates_analyzed": 45,
  "findings_by_severity": {
    "critical": 3,
    "high": 7,
    "medium": 12,
    "low": 5,
    "CRITICAL": 3,
    "HIGH": 7,
    "MEDIUM": 12,
    "LOW": 5
  },
  "recent_findings": [
    {
      "id": 1,
      "company_id": 1,
      "title": "Typosquat Phishing Landing Page",
      "severity": "critical",
      "status": "pending",
      "risk_score": 88.5,
      "created_at": "2026-10-12T10:00:00Z"
    }
  ],
  "total_findings": 27,
  "open_findings": 18,
  "total_companies": 2,
  "total_assets": 12,
  "total_candidates": 45,
  "severity_breakdown": {
    "CRITICAL": 3,
    "HIGH": 7,
    "MEDIUM": 12,
    "LOW": 5
  }
}
```

> **Safe Empty Database Guarantee:** When the database is completely empty (or a requested company has zero assets/findings), the endpoint always returns HTTP 200 with `0` counts and an empty array `[]` for `recent_findings`, never an error.

---

### 6. Listing Findings with Filtering & Pagination (`GET /api/v1/findings`)

Retrieves paginated findings with multiple filter criteria.

#### Supported Query Parameters:
- `page`: Page number (1-based index, default: 1).
- `page_size`: Number of items per page (default: 100, max: 1000).
- `company_id`: Filter by company ID.
- `severity`: Filter by severity (`critical`, `high`, `medium`, `low`).
- `status`: Filter by status (`pending`, `open`, `completed`, `failed`, `in_review`).
- `asset_id`: Filter by associated asset ID.
- `candidate_id`: Filter by associated candidate signal ID.
- `search`: Filter matching keywords in finding title or description.
- `min_risk_score`: Filter findings with risk score >= value.
- `max_risk_score`: Filter findings with risk score <= value.

#### Request Example:
```javascript
async function getFindings({
  page = 1,
  pageSize = 20,
  companyId = null,
  severity = null,
  status = null,
  search = null,
} = {}) {
  const url = new URL("http://127.0.0.1:8000/api/v1/findings");
  url.searchParams.append("page", page.toString());
  url.searchParams.append("page_size", pageSize.toString());

  if (companyId) url.searchParams.append("company_id", companyId);
  if (severity) url.searchParams.append("severity", severity);
  if (status) url.searchParams.append("status", status);
  if (search) url.searchParams.append("search", search);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.detail || "Failed to fetch findings");
  }

  const findings = await response.json();
  const totalCount = parseInt(response.headers.get("X-Total-Count") || "0", 10);
  const totalPages = parseInt(response.headers.get("X-Total-Pages") || "1", 10);

  return {
    items: findings,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
    },
  };
}

// Usage:
getFindings({ severity: "critical", page: 1, pageSize: 10 }).then(
  ({ items, pagination }) => {
    console.log(`Showing ${items.length} of ${pagination.totalCount} critical findings:`);
    console.log(items);
  }
);
```

---

## 5. Standard Error Handling & Formats

The backend provides consistent, structured error responses across all endpoints:

### 1. HTTP 422 Unprocessable Content (Validation Errors)
Occurs when required fields are missing or data types are invalid.

```json
{
  "detail": "Missing required field(s): name",
  "message": "Missing required field(s): name",
  "errors": [
    {
      "type": "missing",
      "loc": ["body", "name"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

### 2. HTTP 404 Not Found
Occurs when a requested resource ID does not exist.

```json
{
  "detail": "Company with ID 999 not found."
}
```

### 3. HTTP 400 Bad Request
Occurs when business constraints are violated (e.g. duplicate company name).

```json
{
  "detail": "Company with name 'Acme Corp' already exists."
}
```

### 4. HTTP 500 Internal Server Error
Safe server error fallback preventing sensitive stack trace disclosure.

```json
{
  "detail": "An internal server error occurred. Please contact the administrator."
}
```

---

## 6. TypeScript Interface Declarations

For React TypeScript projects, copy these types into `src/types/drp.ts`:

```typescript
export interface Company {
  id: number;
  name: string;
  domain?: string | null;
  industry?: string | null;
  description?: string | null;
  overall_risk_score: number;
  created_at: string;
  updated_at?: string | null;
}

export type AssetType = "brand_name" | "domain" | "social_profile" | "mobile_app";
export type AssetCriticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ProtectedAsset {
  id: number;
  company_id: number;
  asset_type: AssetType;
  value: string;
  platform?: string | null;
  name?: string | null;
  criticality: AssetCriticality;
  tags?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Candidate {
  id: number;
  company_id?: number | null;
  asset_id?: number | null;
  asset_type: AssetType;
  value: string;
  platform?: string | null;
  source?: string | null;
  candidate_type?: string | null;
  confidence_score: number;
  status: string;
  created_at: string;
  updated_at?: string | null;
}

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskFinding {
  id: number;
  company_id: number;
  candidate_id?: number | null;
  asset_id?: number | null;
  title?: string | null;
  description?: string | null;
  risk_score: number;
  severity: RiskSeverity;
  status: string;
  reasons?: string[] | string | null;
  evidence?: Record<string, any> | null;
  remediation_guidance?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DashboardSummary {
  total_protected_assets: number;
  total_candidates_analyzed: number;
  findings_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  recent_findings: RiskFinding[];
  total_findings: number;
  open_findings: number;
  total_companies: number;
  total_assets: number;
  total_candidates: number;
}
```
