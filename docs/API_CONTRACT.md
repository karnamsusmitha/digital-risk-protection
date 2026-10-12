# Digital Risk Protection (DRP) - Teammate Integration API Contract

This document defines the stable integration contract between the core FastAPI backend, the **AI Detection Module**, and the **Monitoring / Scanner Module** developed by teammates.

---

## 1. Architecture & Integration Overview

The DRP backend acts as the central risk correlation, triage, and persistence engine. Teammates can connect their modules via multiple decoupled methods **without altering the backend database structure**:

```
+-----------------------------------+     +----------------------------------------+
|       AI Detection Module         |     |       Monitoring / Scanner Module      |
|  - Logo brand similarity          |     |  - Infrastructure discovery (DNS, MX)  |
|  - Name / text typo similarity    |     |  - Crawled URL / asset metadata        |
|  - Vision / NLP model inference   |     |  - Platform & telemetry feed ID        |
+-----------------+-----------------+     +-------------------+--------------------+
                  |                                           |
                  +--------------------+  +-------------------+
                                       |  |
                                       v  v
+----------------------------------------------------------------------------------+
|                     FastAPI DRP Backend (`POST /api/v1/analyze`)                  |
|                                                                                  |
|  1. Pydantic Request Validation (`AIEvidence`, `MonitoringEvidence`)             |
|  2. Secret Scrubbing & Masking (API keys never logged or echoed)                 |
|  3. Safe Service Client with Timeouts (3.0s timeout with deterministic fallback) |
|  4. Official-Asset Match Exclusion (Whitelists legitimate company domains)       |
|  5. Modular Signal Scoring (Combines only supported signals)                     |
|  6. Target Deduplication (Updates active findings instead of creating duplicates)|
|  7. SQLite Relational Persistence (`RiskFinding` with JSON evidence & reasons)   |
|  8. Company Risk Posture Recalculation                                           |
+----------------------------------------------------------------------------------+
```

### Why Backend Database Changes Are Not Required
The backend uses SQLAlchemy models where `RiskFinding` includes:
- `evidence`: SQLite `JSON` column storing arbitrary structured payloads (`ai_evidence`, `monitoring_evidence`, `input_signals`, and raw metadata).
- `reasons`: SQLite `JSON` column storing itemized textual rationale for the security assessment.
- `risk_score`: Float between `0.0` and `100.0`.
- `severity`: Standardized classification (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
- `status`: Lifecycle tracking (`pending`, `completed`, `failed`, `open`, `in_review`, `resolved`, `false_positive`).

Because all teammate outputs map directly into the `evidence` and `reasons` structures and standard finding fields, teammates can enrich detection parameters without modifying database tables or schemas.

---

## 2. Evidence Contract Schemas

### 2.1 AI Detection Evidence (`AIEvidence`)
Supplied by the AI detection teammate module:

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `name_similarity` | `float` | No | `0.0` to `1.0` | Phonetic or string similarity score between candidate and brand. |
| `logo_similarity` | `float` | No | `0.0` to `1.0` | Visual brand emblem / logo similarity score from vision models. |
| `model_name` | `string` | No | Max 100 chars | Identifier or version of the AI model (e.g. `vit-brand-v2`). |
| `model_confidence`| `float` | No | `0.0` to `1.0` | Internal model classification confidence score. |
| `analysis_timestamp`| `string`| No | ISO-8601 | UTC timestamp when the AI inference completed. |
| `details` | `object`| No | JSON dict | Optional arbitrary model attributes, embeddings, or bounding boxes. |

### 2.2 Monitoring Evidence (`MonitoringEvidence`)
Supplied by the monitoring / crawler teammate module:

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `candidate_url` | `string` | No | Valid `http://` or `https://` URL | Observed target URL. Validated by Pydantic. |
| `asset_type` | `string` | No | `domain`, `brand_name`, `social_profile`, `mobile_app` | Category of target asset. |
| `platform` | `string` | No | Max 100 chars | Discovery platform (e.g. `web`, `twitter`, `telegram`, `app_store`). |
| `observed_metadata`| `object`| No | JSON dict | Technical telemetry (DNS records, MX records, WHOIS, IP, SSL). |
| `source_identifier`| `string`| No | Max 100 chars | Scanner worker ID or feed name (e.g. `crawler-worker-04`). |
| `observation_timestamp`| `string`| No | ISO-8601 | UTC timestamp when target was discovered or scanned. |

---

## 3. Endpoints

### Primary Analysis Endpoint: `POST /api/v1/analyze`

Calculates risk score, evaluates threat signals, checks official asset match, saves or updates the finding in SQLite, and returns explainable rationale.

#### Request Headers
```http
Content-Type: application/json
```

---

### Request Payload Examples

#### Example 1: Full Request with Both AI and Monitoring Evidence
```json
{
  "company_id": 1,
  "candidate_type": "PHISHING",
  "source": "TEAMS_SCANNER_V2",
  "raw_data": "https://secure-login.acmecorp-verify.com/auth",
  "threat_indicators": [
    "active_dns",
    "active_mx",
    "login_form_detected"
  ],
  "ai_evidence": {
    "name_similarity": 0.88,
    "logo_similarity": 0.94,
    "model_name": "vit-logo-classifier-v3",
    "model_confidence": 0.96,
    "analysis_timestamp": "2026-10-12T14:30:00Z",
    "details": {
      "detected_logo": "Acme Corp",
      "visual_embedding_distance": 0.06
    }
  },
  "monitoring_evidence": {
    "candidate_url": "https://secure-login.acmecorp-verify.com/auth",
    "asset_type": "domain",
    "platform": "web",
    "observed_metadata": {
      "active_dns": true,
      "active_mx": true,
      "domain_age_days": 2,
      "ip_address": "198.51.100.42",
      "ssl_issuer": "Let's Encrypt"
    },
    "source_identifier": "crawler-worker-08",
    "observation_timestamp": "2026-10-12T14:28:15Z"
  },
  "deduplicate": true
}
```

#### Example 2: AI Module Unavailable (Null AI Evidence)
When AI detection is unavailable or pending, pass `ai_evidence: null` (or omit it). Missing signals will **never** inflate risk scores or crash the system:
```json
{
  "company_id": 1,
  "candidate_type": "TYPOSQUAT",
  "source": "MONITORING_CRAWLER",
  "raw_data": "https://acmec0rp.com",
  "ai_evidence": null,
  "monitoring_evidence": {
    "candidate_url": "https://acmec0rp.com",
    "asset_type": "domain",
    "platform": "web",
    "observed_metadata": {
      "active_dns": true,
      "active_mx": false,
      "domain_age_days": 12
    },
    "source_identifier": "domain-watcher-01",
    "observation_timestamp": "2026-10-12T14:20:00Z"
  },
  "threat_indicators": ["active_dns"]
}
```

#### Example 3: Monitoring Module Unavailable (Null Monitoring Evidence)
```json
{
  "company_id": 1,
  "candidate_type": "IMPERSONATION",
  "source": "COMMUNITY_REPORT",
  "raw_data": "Acme Official Support Bot",
  "ai_evidence": {
    "name_similarity": 0.91,
    "logo_similarity": null,
    "model_name": "text-similarity-nlp",
    "model_confidence": 0.82,
    "analysis_timestamp": "2026-10-12T14:15:00Z"
  },
  "monitoring_evidence": null,
  "threat_indicators": ["unverified_account"]
}
```

#### Example 4: Flat Shorthand Compatibility
For convenience, teammates can also submit parameters at top-level:
```json
{
  "company_id": 1,
  "candidate_name": "acme-support-portal",
  "candidate_url": "https://acme-support-portal.net",
  "name_similarity": 0.85,
  "logo_similarity": 0.75,
  "monitoring_metadata": {
    "active_dns": true,
    "domain_age_days": 4
  },
  "threat_indicators": ["active_dns", "typosquat"]
}
```

---

### Response Payload Examples

#### Response 1: Successful Live Assessment (200 OK)
```json
{
  "company_id": 1,
  "company_name": "Acme Corporation",
  "recommended_severity": "CRITICAL",
  "estimated_risk_score": 86.8,
  "confidence_score": 0.88,
  "should_convert_to_finding": true,
  "rationale": "Evaluated PHISHING threat signal from TEAMS_SCANNER_V2. Score: 86.8/100 (CRITICAL). Baseline category weight for 'PHISHING': +25.0 pts. AI Logo similarity score: 0.94 (+23.5 pts). Indicates intentional visual asset imitation.",
  "recommended_remediation": "Immediately revoke compromised credentials or submit expedited emergency takedown request.",
  "overall_company_risk_score": 74.2,
  "company_risk_level": "CRITICAL",
  "ai_evidence": {
    "name_similarity": 0.88,
    "logo_similarity": 0.94,
    "model_name": "vit-logo-classifier-v3",
    "model_confidence": 0.96,
    "analysis_timestamp": "2026-10-12T14:30:00Z",
    "details": {
      "detected_logo": "Acme Corp",
      "visual_embedding_distance": 0.06
    }
  },
  "monitoring_evidence": {
    "candidate_url": "https://secure-login.acmecorp-verify.com/auth",
    "asset_type": "domain",
    "platform": "web",
    "observed_metadata": {
      "active_dns": true,
      "active_mx": true,
      "domain_age_days": 2,
      "ip_address": "198.51.100.42",
      "ssl_issuer": "Let's Encrypt"
    },
    "source_identifier": "crawler-worker-08",
    "observation_timestamp": "2026-10-12T14:28:15Z"
  },
  "reasons": [
    "Baseline category weight for 'PHISHING': +25.0 pts.",
    "AI Name similarity score: 0.88 (+13.2 pts). Notice: Name resemblance alone is not classified as fraudulent without corroborated threat indicators.",
    "AI Logo similarity score: 0.94 (+23.5 pts). Indicates intentional visual asset imitation.",
    "Active infrastructure verified: Resolving DNS (+10.0 pts), Active MX mail server (+10.0 pts). Indicates weaponized phishing staging.",
    "Threat keyword correlation detected in target 'https://secure-login.acmecorp-verify.com/auth' (+6.0 pts)."
  ],
  "evidence": {
    "input_signals": {
      "name_similarity": {
        "score": 13.2,
        "confidence": 0.93,
        "evidence": {
          "name_similarity": 0.88,
          "max_weight": 15.0
        }
      },
      "logo_similarity": {
        "score": 23.5,
        "confidence": 0.85,
        "evidence": {
          "logo_similarity": 0.94,
          "max_weight": 25.0
        }
      },
      "infrastructure": {
        "score": 20.0,
        "confidence": 0.85,
        "evidence": {
          "active_dns": true,
          "active_mx": true
        }
      }
    },
    "overall_score": 86.8,
    "severity": "CRITICAL",
    "confidence": 0.88,
    "ai_evidence": {
      "name_similarity": 0.88,
      "logo_similarity": 0.94,
      "model_name": "vit-logo-classifier-v3",
      "model_confidence": 0.96
    },
    "monitoring_evidence": {
      "candidate_url": "https://secure-login.acmecorp-verify.com/auth",
      "source_identifier": "crawler-worker-08"
    }
  },
  "finding_id": 42,
  "status": "pending",
  "assessment_type": "preliminary_risk_assessment",
  "is_official_asset_match": false,
  "official_exclusion_reason": null,
  "is_fallback": false,
  "fallback_reason": null,
  "execution_mode": "live_integrated",
  "is_duplicate_updated": false,
  "disclaimer": "Preliminary algorithmic risk assessment based strictly on provided input signals. No external scan was conducted."
}
```

#### Response 2: Deterministic Fallback Response (External Service Unreachable)
When an external teammate service configured in the backend environment is offline or times out (3.0s limit):
```json
{
  "company_id": 1,
  "company_name": "Acme Corporation",
  "recommended_severity": "LOW",
  "estimated_risk_score": 15.0,
  "confidence_score": 0.60,
  "should_convert_to_finding": false,
  "rationale": "Evaluated DOMAIN threat signal from SCANNER. Score: 15.0/100 (LOW). Baseline category weight for 'DOMAIN': +15.0 pts.",
  "recommended_remediation": "Continue passive monitoring; low immediate threat correlation detected.",
  "overall_company_risk_score": 25.0,
  "company_risk_level": "LOW",
  "ai_evidence": {
    "name_similarity": null,
    "logo_similarity": null,
    "model_name": "deterministic_fallback_engine",
    "model_confidence": 0.5,
    "analysis_timestamp": "2026-10-12T14:35:00.123456",
    "details": {
      "fallback": true,
      "error": "timeout"
    }
  },
  "monitoring_evidence": null,
  "reasons": [
    "Baseline category weight for 'DOMAIN': +15.0 pts.",
    "Missing signal: AI name similarity score not supplied. Missing signals do not increase risk score.",
    "Missing signal: AI logo similarity score not supplied. Missing signals do not increase risk score."
  ],
  "evidence": {
    "overall_score": 15.0,
    "severity": "LOW",
    "confidence": 0.6
  },
  "finding_id": 43,
  "status": "pending",
  "assessment_type": "preliminary_risk_assessment",
  "is_official_asset_match": false,
  "official_exclusion_reason": null,
  "is_fallback": true,
  "fallback_reason": "AI detection service timed out after 3.0s. Deterministic rule-based fallback applied.",
  "execution_mode": "deterministic_fallback",
  "is_duplicate_updated": false,
  "disclaimer": "Preliminary algorithmic risk assessment based strictly on provided input signals. No external scan was conducted."
}
```

#### Response 3: Repeated Analysis (Deduplication)
When analyzing the same threat target again with new or updated signals, the backend updates the existing finding record rather than creating a duplicate finding:
```json
{
  "company_id": 1,
  "finding_id": 42,
  "is_duplicate_updated": true,
  "estimated_risk_score": 92.0,
  "recommended_severity": "CRITICAL",
  "execution_mode": "live_integrated",
  "status": "pending"
}
```

#### Response 4: Legitimate Official Asset Match Exclusion
If a scanned target matches an official registered domain or asset for the company, it is safely excluded:
```json
{
  "company_id": 1,
  "company_name": "Acme Corporation",
  "recommended_severity": "LOW",
  "estimated_risk_score": 0.0,
  "confidence_score": 1.0,
  "should_convert_to_finding": false,
  "rationale": "Target matches registered official company asset or domain 'acme.com'. Excluded from risk findings.",
  "recommended_remediation": "No remediation required. Entity is a confirmed official organizational asset.",
  "is_official_asset_match": true,
  "official_exclusion_reason": "Official Asset Exclusion: Target matches registered primary domain 'acme.com' for company 'Acme Corporation'. Excluded from suspicious findings.",
  "is_fallback": false,
  "execution_mode": "live_integrated",
  "is_duplicate_updated": false
}
```

---

## 4. Operational Requirements & Guarantees

### 4.1 Missing Evidence Handling
- **Non-Fatal**: Missing fields (`null` or omitted) will **never** cause 500 exceptions.
- **Fairness Principle**: Missing evidence is **not** treated as evidence of malicious activity. An entity lacking AI similarity scores receives `0.0` points for that signal rather than an arbitrary penalty.

### 4.2 Signal Weighting & Scoring Formula
The modular scoring engine combines supported signals additively, capped at `100.0`:

$$\text{Final Score} = \min\left(100.0, \, \text{Baseline} + S_{\text{name}} + S_{\text{logo}} + S_{\text{infra}} + S_{\text{credential}} + S_{\text{keywords}} + S_{\text{typo}}\right)$$

- **Baseline weight**: `15.0` to `30.0` pts based on category (Phishing: `25.0`, Credential: `30.0`).
- **Name similarity ($S_{\text{name}}$)**: up to `15.0` pts. Resembling a brand name alone never triggers `HIGH` or `CRITICAL` severity ($< 35.0$).
- **Logo similarity ($S_{\text{logo}}$)**: up to `25.0` pts. High visual resemblance indicates intentional brand imitation.
- **Infrastructure metadata ($S_{\text{infra}}$)**:
  - Active DNS: `+10.0` pts
  - Active MX mail record: `+10.0` pts
  - New domain age ($< 7$ days): `+5.0` pts
- **Exposed credentials ($S_{\text{credential}}$)**: up to `35.0` pts.

#### Severity Tiers
- **CRITICAL**: Score $\ge 80.0$
- **HIGH**: Score $\ge 60.0$
- **MEDIUM**: Score $\ge 35.0$
- **LOW**: Score $< 35.0$

### 4.3 Deduplication Policy
- If `deduplicate: true` (default), the backend checks whether an active finding already exists for the same `company_id` and normalized target identifier.
- If found:
  - Existing `RiskFinding` record is updated with new `risk_score`, `severity`, `reasons`, and updated `evidence`.
  - Response flags `is_duplicate_updated = true` with the original `finding_id`.
  - No redundant database rows are created.

### 4.4 External Service Resilience & Timeouts
- If the backend is configured to query teammate HTTP services directly via environment settings (`AI_MODULE_URL`, `MONITORING_MODULE_URL`):
  - Request timeout is strictly bounded (`3.0s` by default).
  - Network timeouts and connection drops are caught gracefully without failing the user request.
  - Returns `is_fallback: true` with a descriptive `fallback_reason`.
  - Falls back to deterministic rule-based evaluation.

### 4.5 Secret Protection & PII
- External service calls use `mask_sensitive_headers()` so that API keys, bearer tokens, and secrets are **never** logged, traced, or included in API responses.
- Payload input is scanned for sensitive PII (e.g. raw SSNs, unmasked credit cards). Violations return `422 Unprocessable Content`.

---

## 5. How Teammates Can Connect

### Integration Option A: Direct Ingestion via REST API (Recommended)
The teammate module sends HTTP POST requests directly to the backend endpoint:

```python
import requests

payload = {
    "company_id": 1,
    "candidate_type": "PHISHING",
    "source": "AI_DETECTION_TEAM",
    "ai_evidence": {
        "name_similarity": 0.89,
        "logo_similarity": 0.95,
        "model_name": "vit-logo-classifier-v2",
        "model_confidence": 0.92,
        "analysis_timestamp": "2026-10-12T15:00:00Z"
    },
    "monitoring_evidence": {
        "candidate_url": "https://malicious-login.com",
        "asset_type": "domain",
        "platform": "web",
        "observed_metadata": {"active_dns": True, "active_mx": True}
    }
}

response = requests.post("http://127.0.0.1:8000/api/v1/analyze", json=payload)
data = response.json()
print("Persisted Finding ID:", data["finding_id"])
print("Severity:", data["recommended_severity"])
```

### Integration Option B: Backend Outbound Polling
If the teammate module runs as an independent HTTP microservice, configure backend environment variables in `backend/.env`:

```env
AI_MODULE_URL=http://localhost:9000/api/detect
AI_MODULE_API_KEY=optional_teammate_secret_key
MONITORING_MODULE_URL=http://localhost:9001/api/scan
MONITORING_MODULE_API_KEY=optional_scanner_key
MODULE_REQUEST_TIMEOUT=3.0
```

When `POST /api/v1/analyze` is called without pre-computed evidence, the backend automatically calls the teammate microservices, collects results with safe timeouts, and transparently applies deterministic fallbacks if they are unreachable.

### Integration Option C: In-Process Python Function Call
Teammates working directly within the Python application can import and invoke the service functions directly:

```python
from app.schemas import AnalyzeRequest, AIEvidence, MonitoringEvidence
from app.services.risk_scoring import score_and_persist_threat

request = AnalyzeRequest(
    company_id=1,
    ai_evidence=AIEvidence(name_similarity=0.91, logo_similarity=0.88),
    monitoring_evidence=MonitoringEvidence(
        candidate_url="https://phishing.example.com",
        asset_type="domain",
        platform="web"
    ),
    candidate_type="PHISHING",
)

result = score_and_persist_threat(company=company_instance, request=request, db=db_session)
```

---

## 6. Summary of HTTP Status Codes

| Code | Meaning | When Returned |
|---|---|---|
| `200 OK` | Assessment Successful | Request analyzed, persisted/updated, and returned with explainability rationale. |
| `201 Created` | Entity Created | Company, asset, candidate, or finding successfully created in database. |
| `204 No Content` | Entity Deleted | Resource successfully deleted. |
| `400 Bad Request` | Constraint Violation | Duplicate company name or invalid entity state. |
| `404 Not Found` | Entity Missing | Specified resource ID does not exist in SQLite database. |
| `422 Unprocessable Content` | Schema / Format Error | Float out of `[0.0, 1.0]` bounds, missing required field, invalid URL, or PII policy violation. |
| `500 Internal Server Error` | Unexpected Server Error | Safe sanitized error response without leaking stack traces or credentials. |

---

## 7. Core REST API Endpoints & Operations

### 7.1 Health & Root
- `GET /health` — Application health check (`{"status": "healthy", ...}`).
- `GET /` — API root information and OpenAPI link.

### 7.2 Monitored Companies (`/api/v1/companies`)
- `POST /api/v1/companies` — Register new monitored company (HTTP 201).
- `GET /api/v1/companies` — List all monitored companies (with optional `name`, `industry` filters).
- `GET /api/v1/companies/{id}` — Retrieve company details by ID.
- `PUT /api/v1/companies/{id}` — Update company metadata.
- `DELETE /api/v1/companies/{id}` — Remove company and cascade delete related assets/findings.

### 7.3 Protected Assets (`/api/v1/assets`)
- `POST /api/v1/assets` — Register new protected asset (HTTP 201). Types: `brand_name`, `domain`, `social_profile`, `mobile_app`.
- `GET /api/v1/assets` — List assets (supports `company_id`, `asset_type`, `criticality` filters).
- `GET /api/v1/assets/{id}` — Retrieve asset details.
- `PUT /api/v1/assets/{id}` — Update asset criticality or metadata.
- `DELETE /api/v1/assets/{id}` — Delete asset.

### 7.4 Threat Candidates (`/api/v1/candidates`)
- `POST /api/v1/candidates` — Ingest unverified candidate threat signal (HTTP 201).
- `GET /api/v1/candidates` — List candidates (supports `company_id`, `status`, `source`, `candidate_type` filters).
- `GET /api/v1/candidates/{id}` — Retrieve candidate details.
- `PUT /api/v1/candidates/{id}` — Update candidate triage status or confidence.
- `POST /api/v1/candidates/{id}/convert-to-finding` — Promote candidate to verified Finding and update company posture (HTTP 201).
- `DELETE /api/v1/candidates/{id}` — Delete candidate.

### 7.5 Security Findings (`/api/v1/findings`)
- `POST /api/v1/findings` — Manually record finding (HTTP 201).
- `GET /api/v1/findings` — List findings with pagination (`page`, `page_size`) and filters (`company_id`, `severity`, `status`, `asset_id`, `candidate_id`, `search`, `min_risk_score`, `max_risk_score`).
  - Response headers include: `X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`.
- `GET /api/v1/findings/{id}` — Retrieve finding details.
- `PUT /api/v1/findings/{id}` — Update finding status or remediation.
- `DELETE /api/v1/findings/{id}` — Delete finding and recalculate company risk score.

### 7.6 Risk Analysis & Posture (`/api/v1/analysis` & `/api/v1/analyze`)
- `POST /api/v1/analyze` — Primary explainable risk assessment and finding persistence endpoint.
- `POST /api/v1/analysis/evaluate-candidate` — Stateless signal scoring for external scanners.
- `GET /api/v1/analysis/company/{id}/summary` — Comprehensive company posture metrics.
- `POST /api/v1/analysis/company/{id}/recalculate` — Force risk recalculation.

### 7.7 Brand Impersonation Detection (Task 2: `POST /api/v1/analysis/detect-brand-impersonation`)
- `POST /api/v1/analysis/detect-brand-impersonation` — Dedicated AI-based & deterministic brand impersonation engine:
  - Compares candidate brand names against registered official brands.
  - Detects look-alike names using text normalization, edit distance, and Cyrillic/Greek/Leetspeak homoglyphs.
  - Identifies suspicious domain variations: typosquatting, combosquatting with credential harvesting, deceptive subdomains, and risky TLD swaps.
  - Returns explainable risk score (0 to 100), severity, and itemized reasons.
  - Guaranteed: Name resemblance alone is capped at LOW severity (< 35 pts) and never classified as malicious without corroborated threat signals.

### 7.8 Executive Dashboard Summary (`GET /api/v1/dashboard/summary`)
- `GET /api/v1/dashboard/summary` — Returns executive overview:
  - `total_protected_assets`: Total registered protected assets.
  - `total_candidates_analyzed`: Total candidate signals analyzed.
  - `findings_by_severity`: Findings categorized by severity rating (`critical`, `high`, `medium`, `low`).
  - `recent_findings`: List of latest findings.
  - `total_findings`, `open_findings`, `total_companies`, `severity_breakdown`.
  - Supports optional `?company_id={id}` query parameter.
  - Guaranteed safe 200 OK with `0` counts on empty databases.

### 7.9 Monitoring & Candidate Asset Collection (Task 4: `/api/v1/monitoring`)
- `POST /api/v1/monitoring/validate-url` — Validates, normalizes, and classifies a candidate URL:
  - Strips marketing/tracking query parameters (`utm_*`, `ref`, `fbclid`).
  - Classifies asset type (`domain`, `social_profile`, `mobile_app`).
  - Identifies platform (`Web`, `Twitter / X`, `LinkedIn`, `Telegram`, `Google Play`, `Apple App Store`).
  - Compares candidate domain against registered official organization domains.
- `POST /api/v1/monitoring/collect` — Runs monitoring and candidate asset collection:
  - Normalizes and checks any submitted URLs.
  - Uses live external provider APIs when configured with timeout and rate-limit safeguards.
  - Generates realistic, diverse sample data when external integrations are unset.
  - **Truth-in-Labeling Guarantee**: `is_live_monitoring` is strictly `false` and labeled `simulated_sample` when using sample data.
  - Optionally persists collected assets into the `candidates` database table (`persist_to_database=true`).
- `GET /api/v1/monitoring/sample-candidates` — Fast retrieval of clearly labeled sample candidate signals for testing and demonstrations.
- `GET /api/v1/monitoring/status` — Operational status reporting for monitoring adapters and provider configuration.


