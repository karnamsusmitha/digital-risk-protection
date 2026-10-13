# Digital Risk Protection Backend

Modular, high-performance backend for the **Digital Risk Protection System** built with **FastAPI**, **SQLAlchemy**, and **SQLite**. 

The system helps organizations detect impersonation, lookalike domains, spoofed social media accounts, and fraudulent mobile applications using transparent, explainable risk indicators, with a plug-and-play adapter for teammate AI/similarity models.

---

## Architecture & Project Structure

```
digital-risk-protection/
├── .env.example                       # Environment configuration template
├── .gitignore                         # Git exclusion rules (venv, db, node, cache)
├── requirements.txt                   # Production & test dependencies
├── README.md                          # Documentation and integration guide
├── docs/
│   └── risk_scoring_formula.md        # Mathematical scoring formula & limitations
├── app/
│   ├── __init__.py
│   ├── config.py                      # Pydantic Settings & environment loader
│   ├── database.py                    # SQLAlchemy SQLite engine & session factory
│   ├── models.py                      # SQLAlchemy ORM models (Brand, Scan)
│   ├── schemas.py                     # Pydantic validation & response schemas
│   ├── main.py                        # FastAPI entry point, CORS, health & error handlers
│   ├── api/
│   │   ├── __init__.py
│   │   ├── brands.py                  # CRUD endpoints for registered brands
│   │   ├── scans.py                   # Risk analysis submission, history & triage
│   │   └── dashboard.py               # Aggregated metrics & review queues
│   └── services/
│       ├── __init__.py
│       ├── risk_scoring.py            # Decoupled, reusable Risk-Scoring Engine
│       └── detection/
│           ├── __init__.py
│           ├── interface.py           # BaseDetectionEngine & DetectionContext contracts
│           ├── rule_engine.py         # Transparent baseline rule engine adapter
│           └── adapter.py             # DetectionService adapter with AI plug-in slot
└── tests/
    ├── __init__.py
    ├── conftest.py                    # TestClient & in-memory SQLite fixtures
    ├── test_health.py                 # Health and root endpoint verification
    ├── test_brands.py                 # Brand CRUD and validation tests
    ├── test_scans.py                  # API risk scoring, history & triage tests
    ├── test_dashboard.py              # Metrics and summary aggregation tests
    ├── test_detection_adapter.py      # AI module pluggability tests
    ├── test_risk_scoring.py           # Unit tests for scoring service, boundaries & evidence
    ├── test_frontend_integration.py   # Frontend contract, CORS, and tolerance tests
    └── test_backend_qa_audit.py       # Comprehensive QA audit (lifecycle, persistence, security)
```

---

## Quickstart & Setup Commands

### 1. Prerequisites
- **Python 3.11+** (Tested on Python 3.12.10)
- Git

### 2. Create and Activate Virtual Environment

**Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
*(If script execution is disabled in PowerShell, activate via Command Prompt or use `.\.venv\Scripts\python.exe` directly)*

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment
```bash
cp .env.example .env
```
*(Or on Windows PowerShell: `Copy-Item .env.example .env`)*

### 5. Run the Server
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Interactive ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- Health check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 6. Run Automated QA Tests
```bash
pytest -v
```

### 7. Run Hackathon Interactive Demo Script
```bash
# Standalone in-memory execution (no background server required):
python demo.py

# Live HTTP execution against running backend (http://127.0.0.1:8000):
python demo.py --live
```

---

## API Endpoints & Sample Requests

### 1. System Health
- **`GET /health`**
  ```json
  {
    "status": "healthy",
    "app_name": "Digital Risk Protection API",
    "environment": "development",
    "database_connected": true,
    "detection_engine": "rule_based"
  }
  ```

---

### 2. Brand Management (`/api/brands`)
- **`POST /api/brands`** — Register a company or brand
  ```json
  // Request
  {
    "name": "Acme Global",
    "description": "Enterprise cloud security",
    "official_domains": ["acmeglobal.com"],
    "official_urls": ["https://acmeglobal.com/login"],
    "official_social_handles": ["@acmeglobal"]
  }
  ```
- **`GET /api/brands`** — List registered brands (supports `?limit=50&offset=0&search=acme`)
- **`GET /api/brands/{brand_id}`** — Retrieve a single brand
- **`PUT /api/brands/{brand_id}`** — Update brand details
- **`DELETE /api/brands/{brand_id}`** — Delete a brand

---

### 3. Risk Analysis & Scans (`/api/scans`)
- **`POST /api/scans`** — Submit an asset for risk analysis
  ```json
  // Request
  {
    "candidate_type": "domain",
    "candidate_value": "acm3globa1-login.xyz",
    "brand_id": 1
  }
  ```
  ```json
  // Response (201 Created)
  {
    "id": 1,
    "brand_id": 1,
    "brand_name": "Acme Global",
    "candidate_type": "domain",
    "candidate_value": "acm3globa1-login.xyz",
    "normalized_value": "acm3globa1-login.xyz",
    "risk_score": 90,
    "risk_category": "Critical",
    "status": "review_needed",
    "indicators": [
      {
        "code": "HOMOGLYPH_SUBSTITUTION",
        "name": "Homoglyph Character Substitution",
        "severity": "high",
        "score_impact": 35,
        "explanation": "Substituted visual lookalikes detected (e.g. '0' for 'o', '1' for 'l') mimicking 'acmeglobal'."
      },
      {
        "code": "DECEPTIVE_SECURITY_KEYWORD",
        "name": "Deceptive Phishing / Security Keywords",
        "severity": "medium",
        "score_impact": 15,
        "explanation": "Candidate contains sensitive credential/auth keywords: login."
      },
      {
        "code": "SUSPICIOUS_TLD",
        "name": "Abuse-Prone Top-Level Domain",
        "severity": "medium",
        "score_impact": 20,
        "explanation": "Domain utilizes TLD '.xyz', statistically associated with high phishing abuse rates."
      }
    ],
    "engine_used": "rule_based",
    "recommended_action": "Immediate triage and mitigation: active high-confidence impersonation/phishing indicators; initiate takedown or security blocking.",
    "evidence_source": {
      "engine": "risk_scoring_service_v1",
      "static_analysis": true,
      "redirect_evidence": "not_provided",
      "external_threat_intel": {
        "configured": false,
        "source": "none",
        "status": "not_configured",
        "detail": "No external threat intelligence source configured; missing evidence is not treated as proof of malicious activity."
      },
      "ai_models": {
        "configured": false,
        "status": "not_configured",
        "detail": "No AI prediction model configured. Static heuristic risk scoring utilized."
      }
    },
    "explanations": [
      "Substituted visual lookalikes detected (e.g. '0' for 'o', '1' for 'l') mimicking 'acmeglobal'.",
      "Candidate contains sensitive credential/auth keywords: login.",
      "Domain utilizes TLD '.xyz', statistically associated with high phishing abuse rates."
    ],
    "disclaimer": "Scores are preliminary risk indicators, not proof of fraud. Further human verification and technical review are required before enforcement actions.",
    "created_at": "2026-10-12T14:40:00Z"
  }
  ```
- **`GET /api/scans`** — Filter scan history (supports `?brand_id=1&category=Critical&status=review_needed&limit=50`)
- **`GET /api/scans/{scan_id}`** — Retrieve a specific scan
- **`PATCH /api/scans/{scan_id}/status`** — Update triage status (`completed`, `review_needed`, `false_positive`, `confirmed_threat`)

---

### 4. Dashboard Summary (`/api/dashboard/summary`)
- **`GET /api/dashboard/summary`**
  ```json
  {
    "total_brands": 12,
    "total_scans": 148,
    "risk_distribution": {
      "Low": 80,
      "Medium": 35,
      "High": 21,
      "Critical": 12
    },
    "status_distribution": {
      "completed": 115,
      "review_needed": 25,
      "false_positive": 5,
      "confirmed_threat": 3
    },
    "type_distribution": {
      "domain": 80,
      "url": 40,
      "social_media_profile": 18,
      "mobile_app": 10
    },
    "recent_scans": [...],
    "findings_needing_review": [...]
  }
  ```

---

## Frontend Integration Guide

This backend is designed for turnkey integration with frontend web frameworks (Angular, React, Vue, Next.js, Vite).

### 1. Connection Details
- **Backend Base URL**: `http://localhost:8000` (or `http://127.0.0.1:8000`)
- **Interactive Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Interactive ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: `GET http://localhost:8000/health`

### 2. CORS Configuration
CORS is configured via the `CORS_ORIGINS` environment variable in `.env`.
- **Development**: Defaults allow `http://localhost:4200` (Angular), `http://localhost:3000` (React/Next), and `http://localhost:5173` (Vite) with credentials enabled (`Access-Control-Allow-Credentials: true`).
- **Production**: Wildcard `*` is strictly disallowed and filtered out. You must supply your exact frontend domain:
  ```env
  APP_ENV="production"
  CORS_ORIGINS=["https://app.digitalriskprotection.com"]
  ```

### 3. TypeScript Interfaces for Frontend Models

```typescript
export type CandidateType = 'domain' | 'url' | 'social_media_profile' | 'mobile_app';
export type RiskCategory = 'Low' | 'Medium' | 'High' | 'Critical';
export type ScanStatus = 'completed' | 'review_needed' | 'false_positive' | 'confirmed_threat';
export type IndicatorSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface RiskIndicator {
  code: string;
  name: string;
  severity: IndicatorSeverity;
  score_impact: number;
  explanation: string;
}

export interface Brand {
  id: number;
  name: string;
  description?: string | null;
  official_domains: string[];
  official_urls: string[];
  official_social_handles: string[];
  created_at: string;
  updated_at: string;
}

export interface BrandCreateRequest {
  name: string;
  description?: string;
  official_domains?: string[];
  official_urls?: string[];
  official_social_handles?: string[];
}

export interface ScanRequest {
  candidate_type: CandidateType | string;
  candidate_value: string;
  brand_id?: number | null;
  evidence?: {
    redirect_url?: string;
    final_destination_url?: string;
    displayed_url?: string;
    threat_intel_reports?: any[];
  };
}

export interface ScanResponse {
  id: number;
  brand_id: number | null;
  brand_name: string | null;
  candidate_type: string;
  candidate_value: string;
  normalized_value: string;
  risk_score: number;
  risk_category: RiskCategory;
  status: ScanStatus;
  indicators: RiskIndicator[];
  recommended_action: string;
  evidence_source: Record<string, any>;
  explanations: string[];
  engine_used: string;
  disclaimer: string;
  created_at: string;
}

export interface DashboardSummary {
  total_brands: number;
  total_scans: number;
  risk_distribution: Record<RiskCategory, number>;
  status_distribution: Record<ScanStatus, number>;
  type_distribution: Record<CandidateType, number>;
  recent_scans: ScanResponse[];
  findings_needing_review: ScanResponse[];
}
```

### 4. HTTP Status Codes & Error Responses

All backend errors return standard, friendly JSON responses:

| HTTP Status | Reason | Response Format |
| :--- | :--- | :--- |
| **`200 OK`** | Successful retrieval / update | Data object or list |
| **`201 Created`** | Successful creation | Created record |
| **`204 No Content`** | Successful deletion | Empty body |
| **`400 Bad Request`** | Invalid input format (e.g. unsafe URL scheme) | `{"detail": "Input validation error: ..."}` |
| **`404 Not Found`** | Resource ID does not exist | `{"detail": "Associated Brand ID 99 not found."}` |
| **`409 Conflict`** | Duplicate resource (e.g. brand name already exists) | `{"detail": "Brand with name '...' is already registered."}` |
| **`422 Unprocessable Content`** | Missing or invalid schema fields | `{"detail": "name: Field required", "errors": [...]}` |
| **`500 Internal Error`** | Unhandled internal exception | `{"detail": "An internal server error occurred..."}` |

```python
from app.services.detection.interface import BaseDetectionEngine, DetectionOutput, DetectionContext
from app.services.detection.adapter import detection_service

class MyAIDetectionEngine(BaseDetectionEngine):
    def detect(self, candidate_type: str, candidate_value: str, context: DetectionContext = None) -> DetectionOutput:
        # 1. Run your ML / similarity embedding logic here
        # 2. Return standardized DetectionOutput
        return DetectionOutput(
            normalized_value=candidate_value.strip().lower(),
            risk_score=85,
            risk_category="Critical",
            indicators=[{
                "code": "AI_SIMILARITY_MATCH",
                "name": "Neural Embedding Similarity Match",
                "severity": "critical",
                "score_impact": 85,
                "explanation": "High embedding cosine similarity (>0.92) with target brand asset."
            }],
            engine_used="my_ai_model_v1"
        )

# Register into the live service:
detection_service.register_ai_module(MyAIDetectionEngine(), engine_name="my_ai_model_v1")
```

---

---

## Risk-Analysis Engine & Scoring Formula

The risk-analysis engine is decoupled from API routes in [`app/services/risk_scoring.py`](file:///c:/Users/user/digital-risk-protection/digital-risk-protection/app/services/risk_scoring.py) and can be executed independently across backend routes, batch scanners, or unit tests.

### 1. Scoring Formula
The composite risk score $S$ is calculated by summing the calibrated weights of all triggered indicators $I$ and clamping the result between $0$ and $100$:

$$S = \min\left(100, \max\left(0, \sum_{i \in I} w_i\right)\right)$$

*If the candidate matches a registered official asset: $S = 0$, bypassing all threat heuristics.*

### 2. Configurable Score Bands
- **0 – 24 (Low)**: Routine monitoring, low preliminary risk.
- **25 – 49 (Medium)**: Queue for scheduled analyst review; monitor for DNS/infrastructure changes.
- **50 – 74 (High)**: Urgent analyst investigation; high likelihood of deceptive intent.
- **75 – 100 (Critical)**: Immediate triage and mitigation; active high-confidence impersonation/phishing; initiate takedown or blocking.

### 3. Documented Weights & Indicators Catalog

| Indicator Code | Name | Weight ($w_i$) | Severity | Description |
| :--- | :--- | :---: | :---: | :--- |
| `OFFICIAL_ASSET_VERIFIED` | Official Registered Asset | `0` | `info` | Candidate matches registered official brand domain, URL, social handle, or app. |
| `NO_ANOMALOUS_INDICATORS` | Standard Inspection Passed | `0` | `info` | No suspicious typosquatting, homoglyphs, or spoofing patterns detected. |
| `HOMOGLYPH_SUBSTITUTION` | Homoglyph Character Substitution | `35` | `high` | Substituted visual lookalikes (`0` for `o`, `1` for `l`, `vv` for `w`) mimicking brand or official domain. |
| `TYPOSQUAT_DISTANCE_1` | High-Confidence Typosquatting | `35` | `high` | Single edit distance ($d=1$) from registered brand name or official domain stem. |
| `TYPOSQUAT_DISTANCE_2` | Potential Lookalike Typosquatting | `20` | `medium` | Two edit distance ($d=2$) from registered brand name or official domain stem. |
| `SUBDOMAIN_SPOOFING` | Subdomain Brand Spoofing | `40` | `critical` | Brand name appears in subdomain prefix of an unrelated third-party root domain. |
| `TLD_SWAP_SQUATTING` | TLD Swap Squatting | `20`–`25` | `medium`–`high` | Same stem as official domain under alternative or abuse-prone TLD. |
| `DECEPTIVE_SECURITY_KEYWORD` | Deceptive Phishing / Auth Keywords | `15`–`30` | `medium`–`high` | Candidate contains sensitive credential/auth keywords (`login`, `verify`, `auth`, `secure`, `billing`, etc.). |
| `SUSPICIOUS_TLD` | Abuse-Prone Top-Level Domain | `20` | `medium` | TLD statistically linked with high phishing abuse rates (`.xyz`, `.top`, `.click`, `.live`, etc.). |
| `EXCESSIVE_HYPHENS` | Deceptive Hyphenation Pattern | `15` | `low` | Hostname contains $\ge 2$ hyphens in context with brand or phishing keywords. |
| `SUSPICIOUS_SOCIAL_PROFILE` | Suspicious Brand Profile Modifier | `25` | `high` | Social handle pairs brand name with high-risk words (`support`, `giveaway`, `helpdesk`, `claim`). |
| `SUSPICIOUS_APP_TITLE_MODIFIER` | Suspicious Mobile App Modifier | `35` | `high` | App title contains unauthorized modifiers (`crack`, `mod`, `hack`, `bonus`, `generator`). |
| `NAME_MENTION_UNVERIFIED` | Benign Brand Name Mention | `15` | `low` | Target references brand name but exhibits zero deceptive keywords or homoglyphs. Preliminary observation only. |
| `REDIRECT_URL_MISMATCH` | Suspicious Destination URL Redirect | `35` | `high` | **Supplied Evidence Only**: Candidate redirects to unverified destination differing from initial host. |
| `DISPLAYED_URL_MISMATCH` | Displayed vs Destination URL Mismatch | `35` | `high` | **Supplied Evidence Only**: Displayed link anchor text masquerades as brand while destination points elsewhere. |
| `EXTERNAL_THREAT_INTEL_MATCH` | Verified Threat Intelligence Match | `40` | `critical` | **Configured Source Only**: Verified external threat intelligence confirms active threat. |

### 4. Non-Invention Policy & Missing Evidence Guarantee
- **No Inventions**: Reputation checks, external intelligence, and AI predictions are **never** simulated or invented.
- If no external threat intelligence source or AI model is configured, the engine reports this transparently in `evidence_source`:
  `{"external_threat_intel": {"configured": false, "status": "not_configured", "detail": "No external threat intelligence source configured; missing evidence is not treated as proof of malicious activity."}}`
- Missing evidence (e.g. absent redirect data or absent external threat intelligence) is **never** treated as proof of malicious activity.

### 5. Independent Programmatic Usage
```python
from app.services.risk_scoring import RiskScoringService, BrandAssetContext

service = RiskScoringService()
brand = BrandAssetContext(
    name="Acme Global",
    official_domains=["acmeglobal.com"]
)

# Score candidate asset independently of API routes:
result = service.analyze(
    candidate_type="domain",
    candidate_value="acm3globa1-login.xyz",
    brand=brand
)
print(result.score)                 # 90
print(result.category)              # "Critical"
print(result.recommended_action)    # "Immediate triage and mitigation..."
```

### 6. Limitations of the Engine
1. **Static Analysis vs. Dynamic Cloaking**: The engine performs safe static parsing without executing untrusted remote code or JavaScript. Dynamic cloaking (serving benign pages to bots and phishing to real victims) requires dynamic sandboxing.
2. **Homoglyph Scope**: Focuses on common Latin-lookalike visual substitutions (`0/o`, `1/l`, `vv/w`, `rn/m`, `5/s`, `@/a`, `3/e`, `4/a`, `8/b`, `6/g`). Internationalized punycode lookalikes across non-Latin scripts (Cyrillic, Greek) require expanded IDN mapping.
3. **Common Dictionary Word Brands**: Short brand names (e.g. "Box", "Target", "Apex") naturally appear in innocent registrations. Mitigated via the **Name Mention Rule** (capping score at `15`, strictly in Low band), but analyst review remains necessary.
4. **Feed Latency**: External threat intelligence relies on configured external sources, which have ingestion latencies (15m–24h) for newly registered domains.

---

## Reliability, Security & Explainability Guarantees

1. **Safe Static Parsing**: Input URLs and domains are normalized using standard library parsing. The backend **never** executes untrusted URLs, downloads remote payloads, or runs JavaScript.
2. **No False Positives on Official Assets**: Any candidate matching a registered brand's official domain, URL, or handle is automatically classified with a risk score of `0` ("Official Asset Verified").
3. **Proportional Scoring**: In accordance with project requirements, brand name matching alone **never** triggers a fraudulent or high risk label without compound anomalies (such as lookalikes, homoglyphs, or deceptive authentication keywords).
4. **Secret Protection**: Error handlers capture uncaught exceptions and return sanitized messages, preventing stack trace or internal configuration leakage.
