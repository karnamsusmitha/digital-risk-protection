# Digital Risk Protection (DRP) Platform - Backend API

The Digital Risk Protection (DRP) backend is a production-grade FastAPI service designed to monitor organizational attack surfaces, ingest candidate threat signals from external crawlers and threat intelligence feeds, evaluate explainable risk scores, and persist security findings with automated severity classification.

---

## 1. Core Architecture & Highlights

- **FastAPI Core**: Async RESTful API with automated OpenAPI / Swagger documentation at `/docs` and `/redoc`.
- **Relational Persistence**: SQLite database (`drp.db`) with SQLAlchemy 2.0 ORM, strict constraints, and data persistence across application restarts.
- **Explainable Risk Scoring**: Modular formula computing normalized scores ($0.0 \le \text{score} \le 100.0$) mapped deterministically to `LOW`, `MEDIUM`, `HIGH`, and `CRITICAL` severity tiers with itemized reasons.
- **Official Asset Match Exclusion**: Whitelists legitimate corporate assets and domains to eliminate false positives.
- **Teammate Module Decoupling**: Accepts optional AI Vision/NLP evidence (`AIEvidence`) and telemetry scanner evidence (`MonitoringEvidence`) with safe deterministic fallback if external microservices are offline.
- **Zero Live Credential Requirement**: Runs locally out of the box with zero required third-party API keys or external dependencies.
- **React Frontend Ready**: Configured with CORS for local React/Vite development, pagination headers (`X-Total-Count`, `X-Page`, `X-Limit`, `X-Total-Pages`), and rich dashboard summary metrics.
- **Automated QA Coverage**: **110 pytest test cases** passing with 0 failures and 0 Pyright type errors.

---

## 2. Quickstart & Installation

### Prerequisites
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (recommended) or standard Python virtual environment

### Step 1: Clone and Setup Virtual Environment

```bash
# Clone repository and enter project root
cd digital-risk-protection

# Option A: Using uv (fastest)
uv sync

# Option B: Standard python venv & pip
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### Step 2: Environment Configuration (Optional)
The backend runs with sensible defaults out of the box. To customize settings:

```bash
cp .env.example .env
```

Configuration variables in `.env`:
- `DATABASE_URL`: Defaults to `sqlite:///./drp.db`
- `CORS_ORIGINS`: Allowed frontend origins (e.g. `http://localhost:3000,http://localhost:5173`)
- `AI_MODULE_URL`: (Optional) External AI inference endpoint
- `MONITORING_MODULE_URL`: (Optional) External monitoring endpoint

---

## 3. Starting the Backend Server

Start the FastAPI application using either `uv` or `python`:

```bash
# Using uv:
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Using activated virtual environment:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Once running, access:
- **Base URL**: `http://127.0.0.1:8000`
- **Interactive Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 3.1. Starting the Frontend Dashboard (Task 1)

The Aegis DRP dashboard is built with React 19 and Vite, featuring dark-mode cybersecurity aesthetics, real-time metrics, brand registration, findings triage, and threat simulation.

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies (if not already installed)
npm install

# Start the Vite development server
npm run dev
```

Once running, access the dashboard in your browser at:
- **Web Dashboard**: [http://127.0.0.1:5173/](http://127.0.0.1:5173/) or [http://localhost:5173/](http://localhost:5173/)

**Available Frontend Scripts:**
- `npm run dev`: Starts local Vite dev server on port 5173.
- `npm run build`: Generates production bundle in `dist/`.
- `npm run lint`: Runs code quality and linting checks via `oxlint`.
- `npm run preview`: Previews production build on port 4173.

---

## 4. Running the Test Suite

Execute the complete test suite with `uv` or `pytest`:

```bash
# Run all tests
uv run pytest backend -v

# Run with static type checking
npx pyright --pythonpath .venv/Scripts/python.exe backend
```

**Test Suite Coverage (138 Tests Total):**
- `backend/tests/test_monitoring.py`: 16 unit & integration tests for Task 4 monitoring (URL normalization, tracking param stripping, domain/social/app classification, official domain comparison, timeout/rate-limit fallbacks, sample truth-in-labeling, DB persistence).
- `backend/tests/test_brand_detection.py`: 12 unit tests for Task 2 AI brand detection (homoglyphs, lookalikes, typosquatting, combosquatting, TLD swaps, whitelisting, name resemblance cap).
- `backend/tests/test_audit.py`: 15 comprehensive audit tests covering the full DRP lifecycle.
- `backend/tests/test_health.py`: Health check and root endpoints.
- `backend/tests/test_companies.py`: Company CRUD operations and name uniqueness.
- `backend/tests/test_api_endpoints.py`: CRUD lifecycles for assets, candidates, findings, and analysis.
- `backend/tests/test_frontend_integration.py`: Dashboard summary, CORS preflight, pagination headers, and 422 messages.
- `backend/tests/test_risk_scoring.py`: Modular scoring formulas, severity bounds, and official asset matching.
- `backend/tests/test_teammate_integrations.py`: AI and monitoring evidence bundles, deduplication, and fallback.
- `backend/tests/test_validation.py`: Pydantic input schemas, URL validation, and PII protection.
- `backend/tests/test_persistence.py`: SQLite entity persistence, index queries, and cascading deletes.
- `backend/tests/test_relationships.py`: Foreign key associations and orphaned record cleanup.

---

## 5. API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health check and uptime diagnostics |
| `POST` | `/api/v1/companies` | Register a new monitored company (HTTP 201) |
| `GET` | `/api/v1/companies` | List all monitored companies (supports `name`, `industry` filters) |
| `GET` | `/api/v1/companies/{id}` | Retrieve company details |
| `PUT` | `/api/v1/companies/{id}` | Update company details |
| `DELETE`| `/api/v1/companies/{id}` | Delete company and cascade delete related records |
| `POST` | `/api/v1/assets` | Register a protected asset (`domain`, `brand_name`, `social_profile`, `mobile_app`) |
| `GET` | `/api/v1/assets` | List assets (supports `company_id`, `asset_type`, `criticality` filters) |
| `GET` | `/api/v1/assets/{id}` | Retrieve asset details |
| `PUT` | `/api/v1/assets/{id}` | Update asset details |
| `DELETE`| `/api/v1/assets/{id}` | Delete asset |
| `POST` | `/api/v1/candidates` | Ingest unverified threat candidate signal |
| `GET` | `/api/v1/candidates` | List candidate signals (supports `company_id`, `status`, `source`) |
| `GET` | `/api/v1/candidates/{id}` | Retrieve candidate signal details |
| `PUT` | `/api/v1/candidates/{id}` | Update candidate signal status or confidence |
| `POST` | `/api/v1/candidates/{id}/convert-to-finding` | Promote candidate to verified finding and update risk score |
| `DELETE`| `/api/v1/candidates/{id}` | Delete candidate signal |
| `POST` | `/api/v1/findings` | Manually record a security finding |
| `GET` | `/api/v1/findings` | Paginated findings list (`page`, `page_size`, `severity`, `status`, `search`) |
| `GET` | `/api/v1/findings/{id}` | Retrieve finding details |
| `PUT` | `/api/v1/findings/{id}` | Update finding status or remediation guidance |
| `DELETE`| `/api/v1/findings/{id}` | Delete finding and recalculate company posture |
| `POST` | `/api/v1/analyze` | Automated threat evaluation, explainable scoring, and persistence |
| `POST` | `/api/v1/analysis/evaluate-candidate` | Stateless signal evaluation for teammate scanners |
| `POST` | `/api/v1/analysis/detect-brand-impersonation` | **Task 2**: Dedicated AI brand impersonation & domain variation detection engine |
| `POST` | `/api/v1/monitoring/validate-url` | **Task 4**: URL syntax validation, tracking param stripping, and classification |
| `POST` | `/api/v1/monitoring/collect` | **Task 4**: Candidate asset collection across domains, social, and mobile apps |
| `GET` | `/api/v1/monitoring/sample-candidates` | **Task 4**: Retrieve labeled sample candidates with truth-in-labeling guarantee |
| `GET` | `/api/v1/monitoring/status` | **Task 4**: Monitoring diagnostics and provider configuration check |
| `GET` | `/api/v1/analysis/company/{id}/summary` | Comprehensive company posture metrics |
| `POST` | `/api/v1/analysis/company/{id}/recalculate` | Force recalculation of company risk posture |
| `GET` | `/api/v1/dashboard/summary` | Executive dashboard summary (assets, candidates, severity counts, recent findings) |


Detailed request/response schemas and fetch code examples:
- 📖 **[docs/FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md)** — Frontend guide with React fetch snippets.
- 📖 **[docs/API_CONTRACT.md](docs/API_CONTRACT.md)** — Teammate module integration contracts and payloads.

---

## 6. Shortest End-to-End Hackathon Demo Procedure

To demonstrate the full working Digital Risk Protection system in under 2 minutes:

### Step 1: Health Check
```bash
curl -s http://127.0.0.1:8000/health
# Expected: {"status":"healthy","service":"digital-risk-protection-backend","version":"1.0.0",...}
```

### Step 2: Register Monitored Company
```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/companies \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Cyber Corp", "domain": "https://acme-corp.com", "industry": "FinTech"}'
# Note the returned "id" (e.g. 1)
```

### Step 3: Register Official Protected Asset
```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/assets \
  -H "Content-Type: application/json" \
  -d '{"company_id": 1, "asset_type": "domain", "value": "https://acme-corp.com", "criticality": "HIGH"}'
```

### Step 4: Run Automated Threat Analysis on Phishing Lookalike
```bash
curl -s -X POST http://127.0.0.1:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": 1,
    "candidate_name": "acme-corp-login-verify",
    "domain": "https://acme-corp-login-verify.com",
    "source": "AI_VISION_MODULE",
    "ai_evidence": {
      "name_similarity": 0.94,
      "logo_similarity": 0.92,
      "model_name": "vit-brand-v2",
      "model_confidence": 0.95
    },
    "monitoring_evidence": {
      "candidate_url": "https://acme-corp-login-verify.com/login",
      "asset_type": "domain",
      "platform": "Web",
      "source_identifier": "CERTSTREAM"
    },
    "deduplicate": true
  }'
# Expected: Returns recommended_severity: "CRITICAL", estimated_risk_score >= 80, finding_id persisted
```

### Step 5: View Real-Time Executive Dashboard Summary
```bash
curl -s http://127.0.0.1:8000/api/v1/dashboard/summary
# Expected:
# {
#   "total_protected_assets": 1,
#   "total_candidates_analyzed": 1,
#   "findings_by_severity": {"critical": 1, "high": 0, "medium": 0, "low": 0, ...},
#   "recent_findings": [...],
#   "total_findings": 1
# }
```

---

## 7. Risk Scoring Formula & Severity Tiers

The modular risk scoring engine evaluates risk according to explicit weighted signal contributions:

$$\text{Risk Score} = \min\left(100.0, \sum \text{Signal Contributions}\right)$$

### Signal Weights:
- **Logo Similarity**: Up to $+30.0\text{ pts}$ based on visual similarity.
- **Name Similarity**: Up to $+20.0\text{ pts}$ (similarity alone never exceeds LOW severity).
- **Active Infrastructure**: $+20.0\text{ pts}$ for live resolving DNS and mail MX records.
- **Target Keywords**: $+15.0\text{ pts}$ for credential harvesting targets (`login`, `auth`, `verify`).
- **Exposed Credentials / Data**: $+35.0\text{ pts}$ for active secret leaks (`aws_secret`, `private_key`).
- **Fresh Deployment**: $+10.0\text{ pts}$ for newly registered domains (< 14 days).

### Severity Mapping:
- **`CRITICAL`**: Score $\ge 80.0$
- **`HIGH`**: $60.0 \le \text{Score} < 80.0$
- **`MEDIUM`**: $35.0 \le \text{Score} < 60.0$
- **`LOW`**: $\text{Score} < 35.0$

### Safe Handling Guarantees:
1. **Official Asset Protection**: Exact matches to registered company assets receive score $0.0$, severity `LOW`, and are resolved automatically.
2. **Missing Evidence Safety**: Unsupplied signals contribute $0.0\text{ pts}$; absence of evidence is never treated as proof of malice.
3. **Deterministic Fallbacks**: If external AI or monitoring modules are unreachable, the system executes deterministic scoring and flags `is_fallback: true`.
4. **Deduplication**: Repeated requests for the same target update existing active findings without polluting the database with duplicate records.
