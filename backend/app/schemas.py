import json
import re
from datetime import datetime, timezone
from enum import Enum
from typing import Optional, List, Dict, Any, Union
from urllib.parse import urlparse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ============================================================================
# URL Validation Utilities
# ============================================================================

URL_PATTERN = re.compile(
    r"^https?://"
    r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\.?|"  # Domain names
    r"localhost|"                                                      # Localhost
    r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"                              # IPv4
    r"(?::\d+)?"                                                        # Optional port
    r"(?:/?|[/?]\S*)$",
    re.IGNORECASE,
)

# Common sensitive personal data patterns to detect and avoid
SENSITIVE_PII_PATTERNS = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),         # US SSN
    re.compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b"),    # Credit Card numbers
]


def validate_url_string(url: str) -> str:
    """
    Validates that a URL string has a valid http/https scheme, non-empty host,
    and valid format. Raises ValueError if invalid.
    """
    if not url or not isinstance(url, str):
        raise ValueError("URL must be a non-empty string.")
    cleaned = url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme.lower() not in ("http", "https"):
        raise ValueError(f"URL scheme must be http or https, got '{parsed.scheme}'.")
    if not parsed.netloc:
        raise ValueError("URL must include a valid host / network location.")
    if not URL_PATTERN.match(cleaned):
        raise ValueError(f"Invalid URL structure: '{cleaned}'.")
    return cleaned


def check_for_unnecessary_pii(data_text: str) -> None:
    """
    Ensures that plain sensitive personal data (e.g., SSNs, credit cards)
    is not inadvertently submitted or stored.
    """
    if not data_text or not isinstance(data_text, str):
        return
    for pattern in SENSITIVE_PII_PATTERNS:
        if pattern.search(data_text):
            raise ValueError(
                "Data minimization violation: Potential sensitive personal data (PII) detected. "
                "Do not submit direct financial or government identification numbers."
            )


# ============================================================================
# Enums
# ============================================================================

class AssetTypeEnum(str, Enum):
    BRAND_NAME = "brand_name"
    DOMAIN = "domain"
    SOCIAL_PROFILE = "social_profile"
    MOBILE_APP = "mobile_app"


class RiskSeverityEnum(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FindingStatusEnum(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================================
# Health Schema
# ============================================================================

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "digital-risk-protection-backend"
    version: str = "1.0.0"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "service": "digital-risk-protection-backend",
                "version": "1.0.0",
                "timestamp": "2026-10-12T12:00:00Z",
            }
        }
    )


# ============================================================================
# 1. Company Schemas
# ============================================================================

class CompanyBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Monitored company or brand name")
    description: Optional[str] = Field(None, max_length=2000, description="Optional description of the company")
    domain: Optional[str] = Field(None, max_length=255, description="Primary domain of the company")
    industry: Optional[str] = Field(None, max_length=100, description="Industry sector")

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_name(cls, v: Any) -> str:
        if not v or not str(v).strip():
            raise ValueError("Company name cannot be empty.")
        clean = str(v).strip()
        check_for_unnecessary_pii(clean)
        return clean

    @field_validator("domain", mode="before")
    @classmethod
    def sanitize_domain(cls, v: Any) -> Optional[str]:
        if not v:
            return None
        val = str(v).strip().lower()
        if val.startswith("http://") or val.startswith("https://"):
            validate_url_string(val)
        return val


class CompanyCreate(CompanyBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Acme Cyber Corp",
                "domain": "https://acme-corp.com",
                "industry": "Financial Services",
                "description": "Leading global financial fintech and banking platform.",
            }
        }
    )


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    domain: Optional[str] = Field(None, max_length=255)
    industry: Optional[str] = None
    overall_risk_score: Optional[float] = Field(None, ge=0.0, le=100.0)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Acme Cyber Corp",
                "domain": "https://acme-corp.com",
                "industry": "Financial Services",
                "description": "Updated global financial fintech profile.",
            }
        }
    )


class CompanyResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    industry: Optional[str] = None
    overall_risk_score: float = 0.0
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "name": "Acme Cyber Corp",
                "domain": "https://acme-corp.com",
                "industry": "Financial Services",
                "description": "Leading global financial fintech and banking platform.",
                "overall_risk_score": 42.5,
                "created_at": "2026-10-12T10:00:00Z",
                "updated_at": "2026-10-12T10:00:00Z",
            }
        },
    )


# ============================================================================
# 2. ProtectedAsset Schemas
# ============================================================================

class ProtectedAssetBase(BaseModel):
    company_id: int = Field(..., gt=0, description="Associated company ID")
    asset_type: str = Field(..., description="brand_name, domain, social_profile or mobile_app")
    value: str = Field(..., min_length=1, max_length=500, description="Asset identifier, brand string, handle, or URL")
    platform: Optional[str] = Field(None, max_length=100, description="Optional platform (e.g. twitter, github, ios)")
    name: Optional[str] = Field(None, max_length=255)
    criticality: Optional[str] = Field("MEDIUM", max_length=50)
    tags: Optional[str] = None

    @field_validator("asset_type", mode="before")
    @classmethod
    def validate_asset_type(cls, v: Any) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("asset_type is required.")
        val = v.strip().lower()
        allowed = {t.value for t in AssetTypeEnum}
        if val not in allowed:
            raise ValueError(f"Invalid asset_type '{v}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> str:
        if not v or not str(v).strip():
            raise ValueError("value cannot be empty.")
        val = str(v).strip()
        check_for_unnecessary_pii(val)
        if val.startswith("http://") or val.startswith("https://"):
            validate_url_string(val)
        return val

    @model_validator(mode="after")
    def populate_defaults(self):
        if not self.name:
            self.name = self.value
        return self


class ProtectedAssetCreate(ProtectedAssetBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "company_id": 1,
                "asset_type": "domain",
                "value": "https://acme-corp.com",
                "name": "Primary Corporate Portal",
                "platform": "Web",
                "criticality": "HIGH",
            }
        }
    )


class ProtectedAssetUpdate(BaseModel):
    asset_type: Optional[str] = None
    value: Optional[str] = None
    platform: Optional[str] = None
    name: Optional[str] = None
    criticality: Optional[str] = None
    tags: Optional[str] = None

    @field_validator("asset_type", mode="before")
    @classmethod
    def validate_asset_type_opt(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        val = str(v).strip().lower()
        allowed = {t.value for t in AssetTypeEnum}
        if val not in allowed:
            raise ValueError(f"Invalid asset_type '{v}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("value", mode="before")
    @classmethod
    def validate_value_opt(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        val = str(v).strip()
        if val.startswith("http://") or val.startswith("https://"):
            validate_url_string(val)
        return val


class ProtectedAssetResponse(BaseModel):
    id: int
    company_id: int
    asset_type: str
    value: str
    platform: Optional[str] = None
    name: Optional[str] = None
    criticality: Optional[str] = "MEDIUM"
    tags: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "company_id": 1,
                "asset_type": "domain",
                "value": "https://acme-corp.com",
                "name": "Primary Corporate Portal",
                "platform": "Web",
                "criticality": "HIGH",
                "tags": "core-infrastructure",
                "created_at": "2026-10-12T10:00:00Z",
                "updated_at": "2026-10-12T10:00:00Z",
            }
        },
    )


# Backwards compatibility aliases
AssetBase = ProtectedAssetBase
AssetCreate = ProtectedAssetCreate
AssetUpdate = ProtectedAssetUpdate
AssetResponse = ProtectedAssetResponse


# ============================================================================
# 3. Candidate Schemas
# ============================================================================

class CandidateBase(BaseModel):
    asset_type: str = Field(..., description="brand_name, domain, social_profile or mobile_app")
    value: str = Field(..., min_length=1, max_length=1000, description="Observed threat value or URL")
    platform: Optional[str] = Field(None, max_length=100, description="Optional platform")
    observed_metadata: Optional[Dict[str, Any]] = Field(None, description="Structured JSON metadata")
    company_id: Optional[int] = Field(None, gt=0, description="Associated company ID")
    asset_id: Optional[int] = Field(None, gt=0, description="Associated asset ID")
    url: Optional[str] = Field(None, description="Explicit target URL")
    source: Optional[str] = Field("SCANNER", max_length=100)
    candidate_type: Optional[str] = Field(None, max_length=100)
    raw_data: Optional[str] = None
    confidence_score: float = Field(0.5, ge=0.0, le=1.0)
    status: str = Field("pending", max_length=50)

    @field_validator("asset_type", mode="before")
    @classmethod
    def validate_asset_type(cls, v: Any) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("asset_type is required.")
        val = v.strip().lower()
        allowed = {t.value for t in AssetTypeEnum}
        if val not in allowed:
            raise ValueError(f"Invalid asset_type '{v}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("url", mode="before")
    @classmethod
    def validate_url_field(cls, v: Any) -> Optional[str]:
        if not v:
            return None
        return validate_url_string(str(v))

    @field_validator("value", mode="before")
    @classmethod
    def validate_value(cls, v: Any) -> str:
        if not v or not str(v).strip():
            raise ValueError("value cannot be empty.")
        val = str(v).strip()
        check_for_unnecessary_pii(val)
        if val.startswith("http://") or val.startswith("https://"):
            validate_url_string(val)
        return val

    @field_validator("observed_metadata", mode="before")
    @classmethod
    def validate_metadata(cls, v: Any) -> Optional[Dict[str, Any]]:
        if v is None:
            return None
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except Exception as exc:
                raise ValueError("observed_metadata must be valid JSON.") from exc
        if not isinstance(v, dict):
            raise ValueError("observed_metadata must be a JSON object (dictionary).")
        # Ensure it is JSON-serializable
        try:
            json.dumps(v)
        except (TypeError, ValueError) as exc:
            raise ValueError("observed_metadata must be JSON-serializable.") from exc
        return v

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # If candidate_type provided without asset_type, infer asset_type
            if "candidate_type" in values and "asset_type" not in values:
                ct = str(values.get("candidate_type", "")).lower()
                if "domain" in ct or "typosquat" in ct or "phish" in ct:
                    values["asset_type"] = "domain"
                elif "social" in ct or "impersonat" in ct:
                    values["asset_type"] = "social_profile"
                elif "app" in ct:
                    values["asset_type"] = "mobile_app"
                else:
                    values["asset_type"] = "brand_name"
            # If value not provided, infer from raw_data or source
            if "value" not in values or not values.get("value"):
                values["value"] = values.get("raw_data") or values.get("source") or "unspecified_signal"
        return values


class CandidateCreate(CandidateBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "company_id": 1,
                "asset_type": "domain",
                "value": "https://acme-corp-login.phishing-hub.com",
                "source": "MONITORING_CRAWLER",
                "candidate_type": "phishing_domain",
                "platform": "Web",
                "status": "pending",
                "confidence_score": 0.85,
            }
        }
    )


class CandidateUpdate(BaseModel):
    status: Optional[str] = None
    confidence_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    raw_data: Optional[str] = None
    observed_metadata: Optional[Dict[str, Any]] = None


class CandidateResponse(BaseModel):
    id: int
    asset_type: str
    value: str
    platform: Optional[str] = None
    observed_metadata: Optional[Dict[str, Any]] = None
    company_id: Optional[int] = None
    asset_id: Optional[int] = None
    source: Optional[str] = "SCANNER"
    candidate_type: Optional[str] = None
    raw_data: Optional[str] = None
    confidence_score: float = 0.5
    status: str = "pending"
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "company_id": 1,
                "asset_type": "domain",
                "value": "https://acme-corp-login.phishing-hub.com",
                "source": "MONITORING_CRAWLER",
                "candidate_type": "phishing_domain",
                "platform": "Web",
                "status": "pending",
                "confidence_score": 0.85,
                "created_at": "2026-10-12T10:00:00Z",
                "updated_at": "2026-10-12T10:00:00Z",
            }
        },
    )


# ============================================================================
# 4. RiskFinding Schemas
# ============================================================================

class RiskFindingBase(BaseModel):
    company_id: int = Field(..., gt=0, description="Associated company ID")
    candidate_id: Optional[int] = Field(None, gt=0, description="Associated candidate signal ID")
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk score from 0 to 100")
    severity: str = Field(..., description="low, medium, high, or critical")
    status: str = Field(default="pending", description="pending, completed, or failed")
    reasons: Optional[Union[List[str], str]] = Field(None, description="Risk finding reasons or summary")
    evidence: Optional[Union[Dict[str, Any], List[Any], str]] = Field(None, description="Structured JSON evidence")

    # Compatibility fields
    asset_id: Optional[int] = Field(None, gt=0)
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    remediation_guidance: Optional[str] = None

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: Any) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("severity is required.")
        val = v.strip().lower()
        allowed = {s.value for s in RiskSeverityEnum}
        if val not in allowed:
            raise ValueError(f"Invalid severity '{v}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("status is required.")
        val = v.strip().lower()
        allowed = {"pending", "completed", "failed", "open", "in_review", "resolved", "false_positive"}
        if val not in allowed:
            raise ValueError(f"Invalid status '{v}'. Must be one of: pending, completed, failed")
        return val

    @field_validator("evidence", mode="before")
    @classmethod
    def validate_evidence(cls, v: Any) -> Any:
        if v is None:
            return None
        # If evidence contains structured dictionary with URLs, validate them
        if isinstance(v, dict):
            for k in ("url", "target_url", "source_url", "phishing_url"):
                if k in v and v[k]:
                    validate_url_string(str(v[k]))
        # Ensure it is JSON-serializable
        try:
            json.dumps(v)
        except (TypeError, ValueError) as exc:
            raise ValueError("evidence must be JSON-compatible structured data.") from exc
        return v

    @model_validator(mode="before")
    @classmethod
    def handle_legacy_finding_fields(cls, values: Any) -> Any:
        if isinstance(values, dict):
            # If description provided without reasons, use description
            if "reasons" not in values and "description" in values:
                values["reasons"] = values.get("description")
            # If title is missing, infer a clean default
            if "title" not in values or not values.get("title"):
                sev = values.get("severity", "Risk")
                values["title"] = f"{str(sev).capitalize()} Finding"
            # If description is missing, infer a clean default
            if "description" not in values or not values.get("description"):
                reasons = values.get("reasons")
                values["description"] = str(reasons) if reasons else "Identified digital risk finding."
        return values


class RiskFindingCreate(RiskFindingBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "company_id": 1,
                "asset_id": 1,
                "candidate_id": 1,
                "title": "Typosquat Phishing Landing Page",
                "description": "Deceptive clone targeting Acme Cyber Corp customer authentication.",
                "severity": "critical",
                "status": "open",
                "risk_score": 88.5,
                "reasons": [
                    "Brand name impersonation detected in subdomain",
                    "Unregistered TLS certificate issuer mismatch",
                ],
                "evidence": {
                    "source": "AI_VISION_MODULE",
                    "logo_similarity": 0.94,
                    "name_similarity": 0.91,
                },
                "remediation_guidance": "Initiate immediate domain takedown via registrar and report to abuse desk.",
            }
        }
    )


class RiskFindingUpdate(BaseModel):
    risk_score: Optional[float] = Field(None, ge=0.0, le=100.0)
    severity: Optional[str] = None
    status: Optional[str] = None
    reasons: Optional[Union[List[str], str]] = None
    evidence: Optional[Union[Dict[str, Any], List[Any], str]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    remediation_guidance: Optional[str] = None

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity_opt(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        val = str(v).strip().lower()
        allowed = {s.value for s in RiskSeverityEnum}
        if val not in allowed:
            raise ValueError(f"Invalid severity '{v}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("status", mode="before")
    @classmethod
    def validate_status_opt(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        val = str(v).strip().lower()
        allowed = {"pending", "completed", "failed", "open", "in_review", "resolved", "false_positive"}
        if val not in allowed:
            raise ValueError(f"Invalid status '{v}'. Must be one of: pending, completed, failed")
        return val


class RiskFindingResponse(BaseModel):
    id: int
    company_id: int
    candidate_id: Optional[int] = None
    asset_id: Optional[int] = None
    risk_score: float
    severity: str
    status: str
    reasons: Optional[Union[List[str], str, Dict[str, Any]]] = None
    evidence: Optional[Union[Dict[str, Any], List[Any], str]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    remediation_guidance: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "company_id": 1,
                "asset_id": 1,
                "candidate_id": 1,
                "title": "Typosquat Phishing Landing Page",
                "description": "Deceptive clone targeting Acme Cyber Corp customer authentication.",
                "severity": "critical",
                "status": "open",
                "risk_score": 88.5,
                "reasons": [
                    "Brand name impersonation detected in subdomain",
                    "Unregistered TLS certificate issuer mismatch",
                ],
                "evidence": {
                    "source": "AI_VISION_MODULE",
                    "logo_similarity": 0.94,
                    "name_similarity": 0.91,
                },
                "remediation_guidance": "Initiate immediate domain takedown via registrar and report to abuse desk.",
                "created_at": "2026-10-12T10:00:00Z",
                "updated_at": "2026-10-12T10:00:00Z",
            }
        },
    )


# Backwards compatibility aliases
FindingBase = RiskFindingBase
FindingCreate = RiskFindingCreate
FindingUpdate = RiskFindingUpdate
FindingResponse = RiskFindingResponse


# ============================================================================
# 5. Analysis & Posture Schemas
# ============================================================================

class SeverityBreakdown(BaseModel):
    CRITICAL: int = 0
    HIGH: int = 0
    MEDIUM: int = 0
    LOW: int = 0


class CompanyRiskPosture(BaseModel):
    company_id: int
    company_name: str
    overall_risk_score: float
    risk_level: str  # LOW, MODERATE, HIGH, CRITICAL
    total_assets: int
    total_candidates: int
    pending_candidates: int
    total_findings: int
    open_findings: int
    severity_breakdown: SeverityBreakdown
    recent_findings: List[RiskFindingResponse] = []


class CandidateEvaluationRequest(BaseModel):
    company_id: int
    asset_id: Optional[int] = None
    source: str
    candidate_type: str
    raw_data: Optional[str] = None
    threat_indicators: Optional[List[str]] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "company_id": 1,
                "asset_id": 1,
                "source": "MONITORING_CRAWLER",
                "candidate_type": "domain",
                "raw_data": "https://acme-phish.net",
                "threat_indicators": ["typosquat", "credential_harvesting"],
            }
        }
    )


class CandidateEvaluationResponse(BaseModel):
    recommended_severity: str
    estimated_risk_score: float
    confidence_score: float
    should_convert_to_finding: bool
    rationale: str
    recommended_remediation: str

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "recommended_severity": "high",
                "estimated_risk_score": 75.0,
                "confidence_score": 0.88,
                "should_convert_to_finding": True,
                "rationale": "High typosquat match with known credential harvesting patterns.",
                "recommended_remediation": "Block domain at perimeter and request abuse takedown.",
            }
        }
    )


# ============================================================================
# 6. Teammate Integration Schemas (AI & Monitoring Contracts)
# ============================================================================

class AIEvidence(BaseModel):
    name_similarity: Optional[float] = Field(None, ge=0.0, le=1.0, description="String or phonetic similarity score (0.0 to 1.0)")
    logo_similarity: Optional[float] = Field(None, ge=0.0, le=1.0, description="Visual logo brand similarity score (0.0 to 1.0)")
    model_name: Optional[str] = Field(None, max_length=100, description="Name or identifier of the AI detection model")
    model_confidence: Optional[float] = Field(None, ge=0.0, le=1.0, description="Internal model classification confidence")
    analysis_timestamp: Optional[str] = Field(None, description="ISO-8601 timestamp when AI analysis occurred")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional model output attributes or embeddings")

    @field_validator("name_similarity", "logo_similarity", "model_confidence", mode="before")
    @classmethod
    def sanitize_float(cls, v: Any) -> Optional[float]:
        if v is None or v == "":
            return None
        val = float(v)
        if val < 0.0 or val > 1.0:
            raise ValueError("Similarity and confidence scores must be between 0.0 and 1.0.")
        return val


class MonitoringEvidence(BaseModel):
    candidate_url: Optional[str] = Field(None, description="Target URL detected by the monitoring module")
    asset_type: Optional[str] = Field(None, description="Target asset category: brand_name, domain, social_profile, mobile_app")
    platform: Optional[str] = Field(None, max_length=100, description="Platform identifier (web, twitter, telegram, app_store, etc.)")
    observed_metadata: Optional[Dict[str, Any]] = Field(None, description="Structured technical observation metadata (DNS, MX, IP, WHOIS, SSL)")
    source_identifier: Optional[str] = Field(None, max_length=100, description="Scanner agent or telemetry feed ID")
    observation_timestamp: Optional[str] = Field(None, description="ISO-8601 observation timestamp")

    @field_validator("candidate_url", mode="before")
    @classmethod
    def validate_candidate_url_opt(cls, v: Any) -> Optional[str]:
        if v is None or str(v).strip() == "":
            return None
        val = str(v).strip()
        return validate_url_string(val)


class AnalyzeRequest(BaseModel):
    company_id: int = Field(..., gt=0, description="Associated company ID")
    candidate_type: Optional[str] = Field("DOMAIN", description="Candidate or threat signal type")
    source: Optional[str] = Field("SCANNER", description="Analysis source")
    asset_id: Optional[int] = Field(None, gt=0, description="Optional associated protected asset ID")
    candidate_id: Optional[int] = Field(None, gt=0, description="Optional associated candidate ID")
    raw_data: Optional[str] = Field(None, description="Observed threat data or URL")
    threat_indicators: Optional[List[str]] = Field(None, description="Threat indicator keywords or tags")

    # Teammate Evidence Bundles
    ai_evidence: Optional[AIEvidence] = Field(None, description="Evidence generated by AI detection module")
    monitoring_evidence: Optional[MonitoringEvidence] = Field(None, description="Evidence generated by monitoring / scanning module")

    # Modular Signal Inputs (top-level compatibility)
    candidate_name: Optional[str] = Field(None, description="Candidate entity or brand name")
    domain: Optional[str] = Field(None, description="Candidate domain under inspection")
    profile_url: Optional[str] = Field(None, description="Candidate social profile or web URL")
    app_listing: Optional[str] = Field(None, description="Mobile app package name or store listing")
    value: Optional[str] = Field(None, description="Observed threat value or identifier")

    # Direct Similarity Inputs
    name_similarity: Optional[float] = Field(None, ge=0.0, le=1.0, description="AI name similarity score (0.0 to 1.0)")
    logo_similarity: Optional[float] = Field(None, ge=0.0, le=1.0, description="AI visual logo similarity score (0.0 to 1.0)")
    monitoring_metadata: Optional[Dict[str, Any]] = Field(None, description="Metadata from monitoring scanner (e.g. DNS, MX, SSL, age)")

    # Deduplication and execution flags
    deduplicate: bool = Field(True, description="Whether to update existing active finding for repeated analyses")
    timestamp: Optional[str] = Field(None, description="Observation timestamp")
    evidence: Optional[Dict[str, Any]] = Field(None, description="Additional structured evidence")
    thresholds: Optional[Dict[str, float]] = Field(None, description="Custom severity thresholds (CRITICAL, HIGH, MEDIUM, LOW)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "company_id": 1,
                "asset_id": 1,
                "candidate_name": "acme-corp-secure-login",
                "domain": "https://acme-corp-secure-login.com",
                "source": "AI_VISION_MODULE",
                "ai_evidence": {
                    "name_similarity": 0.92,
                    "logo_similarity": 0.88,
                    "model_name": "drp-brand-vision-v2",
                    "model_confidence": 0.95,
                },
                "monitoring_evidence": {
                    "candidate_url": "https://acme-corp-secure-login.com/login",
                    "asset_type": "domain",
                    "platform": "Web",
                    "source_identifier": "CERTSTREAM_MONITOR",
                },
                "deduplicate": True,
            }
        }
    )

    @model_validator(mode="before")
    @classmethod
    def synthesize_evidence_bundles(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # If top-level AI similarity passed without ai_evidence explicitly provided, construct ai_evidence
            if "ai_evidence" not in data:
                ai_dict = {}
                if data.get("name_similarity") is not None:
                    ai_dict["name_similarity"] = data["name_similarity"]
                if data.get("logo_similarity") is not None:
                    ai_dict["logo_similarity"] = data["logo_similarity"]
                if data.get("model_name") is not None:
                    ai_dict["model_name"] = data["model_name"]
                if data.get("model_confidence") is not None:
                    ai_dict["model_confidence"] = data["model_confidence"]
                if data.get("analysis_timestamp") is not None:
                    ai_dict["analysis_timestamp"] = data["analysis_timestamp"]
                if ai_dict:
                    data["ai_evidence"] = ai_dict

            # If top-level monitoring attributes passed without monitoring_evidence explicitly provided, construct monitoring_evidence
            if "monitoring_evidence" not in data:
                mon_dict = {}
                cand_url = data.get("candidate_url") or data.get("profile_url") or (data.get("value") if str(data.get("value", "")).startswith("http") else None)
                if cand_url:
                    mon_dict["candidate_url"] = cand_url
                if data.get("asset_type") is not None:
                    mon_dict["asset_type"] = data["asset_type"]
                if data.get("platform") is not None:
                    mon_dict["platform"] = data["platform"]
                if data.get("monitoring_metadata") is not None:
                    mon_dict["observed_metadata"] = data["monitoring_metadata"]
                elif data.get("observed_metadata") is not None:
                    mon_dict["observed_metadata"] = data["observed_metadata"]
                if data.get("source_identifier") is not None:
                    mon_dict["source_identifier"] = data["source_identifier"]
                if mon_dict:
                    if data.get("timestamp") is not None:
                        mon_dict["observation_timestamp"] = data["timestamp"]
                    data["monitoring_evidence"] = mon_dict
        return data


class AnalyzeResponse(BaseModel):
    company_id: int
    company_name: Optional[str] = None
    recommended_severity: str
    estimated_risk_score: float
    confidence_score: float
    should_convert_to_finding: bool
    rationale: str
    recommended_remediation: str
    overall_company_risk_score: Optional[float] = None
    company_risk_level: Optional[str] = None

    # Teammate Evidence Bundles
    ai_evidence: Optional[AIEvidence] = Field(None, description="Validated AI evidence or null if unavailable")
    monitoring_evidence: Optional[MonitoringEvidence] = Field(None, description="Validated monitoring evidence or null if unavailable")

    # Explainability & Database Tracking
    reasons: List[str] = Field(default_factory=list, description="Itemized explainable assessment reasons")
    evidence: Dict[str, Any] = Field(default_factory=dict, description="Structured evidence dictionary")
    finding_id: Optional[int] = Field(None, description="ID of persisted RiskFinding in database")
    status: str = Field("pending", description="Finding status in database")
    assessment_type: str = Field("preliminary_risk_assessment", description="Explicit labeling as preliminary assessment")
    is_official_asset_match: bool = Field(False, description="Whether entity matched registered official asset")
    official_exclusion_reason: Optional[str] = Field(None, description="Reason entity was excluded from suspicious findings")

    # Fallback and Deduplication Metadata
    is_fallback: bool = Field(False, description="True if assessment relied on deterministic fallback due to service unavailability")
    fallback_reason: Optional[str] = Field(None, description="Explanation when deterministic fallback occurred")
    execution_mode: str = Field("live_integrated", description="'live_integrated' or 'deterministic_fallback'")
    is_duplicate_updated: bool = Field(False, description="True if an existing active finding was updated instead of duplicated")
    disclaimer: str = Field(
        "Preliminary algorithmic risk assessment based strictly on provided input signals. No external scan was conducted.",
        description="Preliminary assessment notice",
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "company_id": 1,
                "company_name": "Acme Cyber Corp",
                "recommended_severity": "critical",
                "estimated_risk_score": 88.5,
                "confidence_score": 0.92,
                "should_convert_to_finding": True,
                "rationale": "High brand and logo similarity detected on unregistered external infrastructure.",
                "recommended_remediation": "Request domain registrar suspension and issue threat advisory.",
                "overall_company_risk_score": 45.0,
                "company_risk_level": "MODERATE",
                "finding_id": 1,
                "status": "pending",
                "reasons": ["High brand similarity score: 0.92", "High logo similarity score: 0.88"],
                "evidence": {"source": "AI_VISION_MODULE"},
                "is_official_asset_match": False,
                "is_fallback": False,
                "execution_mode": "live_integrated",
                "is_duplicate_updated": False,
            }
        },
    )


# ============================================================================
# 7. Dashboard Schemas
# ============================================================================

class DashboardSummaryResponse(BaseModel):
    """Executive dashboard summary metrics for Digital Risk Protection."""
    total_protected_assets: int = Field(0, description="Total count of protected assets registered")
    total_candidates_analyzed: int = Field(0, description="Total count of threat candidates analyzed")
    findings_by_severity: Dict[str, int] = Field(
        default_factory=lambda: {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
        },
        description="Findings grouped by severity rating (supports lowercase and uppercase keys)",
    )
    recent_findings: List[RiskFindingResponse] = Field(
        default_factory=list,
        description="Recent security findings",
    )
    total_findings: int = Field(0, description="Total findings count")
    open_findings: int = Field(0, description="Open or unresolved findings count")
    total_companies: int = Field(0, description="Total monitored companies count")
    total_assets: int = Field(0, description="Alias for total_protected_assets")
    total_candidates: int = Field(0, description="Alias for total_candidates_analyzed")
    severity_breakdown: Optional[SeverityBreakdown] = Field(
        None,
        description="Structured severity breakdown object",
    )

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
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
                    "LOW": 5,
                },
                "recent_findings": [
                    {
                        "id": 1,
                        "company_id": 1,
                        "title": "Suspected Phishing Domain",
                        "description": "Domain mimics official corporate login portal.",
                        "severity": "critical",
                        "status": "pending",
                        "risk_score": 92.0,
                        "reasons": ["High brand similarity score: 0.94", "Typosquat permutation"],
                        "evidence": {"source": "AI_VISION_MODULE"},
                        "remediation_guidance": "Initiate registrar abuse takedown.",
                        "created_at": "2026-10-12T12:00:00Z",
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
                    "LOW": 5,
                },
            }
        },
    )



