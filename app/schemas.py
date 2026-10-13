from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator


class CandidateType(str, Enum):
    DOMAIN = "domain"
    URL = "url"
    SOCIAL_MEDIA_PROFILE = "social_media_profile"
    MOBILE_APP = "mobile_app"


class RiskCategory(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ScanStatus(str, Enum):
    COMPLETED = "completed"
    REVIEW_NEEDED = "review_needed"
    FALSE_POSITIVE = "false_positive"
    CONFIRMED_THREAT = "confirmed_threat"


class IndicatorSeverity(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RiskIndicator(BaseModel):
    code: str = Field(..., description="Machine-readable indicator code")
    name: str = Field(..., description="Human-readable title")
    severity: IndicatorSeverity = Field(..., description="Severity level")
    score_impact: int = Field(..., description="Contribution to the composite risk score")
    explanation: str = Field(..., description="Transparent rationale for the finding")


# --- Brand Schemas ---

class BrandBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Registered brand/company name")
    description: Optional[str] = Field(None, description="Optional brand context or description")
    official_domains: List[str] = Field(default_factory=list, description="Official domain names (e.g. example.com)")
    official_urls: List[str] = Field(default_factory=list, description="Official full URLs")
    official_social_handles: List[str] = Field(default_factory=list, description="Official social media handles")

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Brand name cannot be blank")
        return s

    @field_validator("official_domains", "official_urls", "official_social_handles", mode="before")
    @classmethod
    def coerce_none_lists(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item).strip() for item in v if item is not None and str(item).strip()]
        return v


class BrandCreate(BrandBase):
    pass


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    official_domains: Optional[List[str]] = None
    official_urls: Optional[List[str]] = None
    official_social_handles: Optional[List[str]] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            s = v.strip()
            if not s:
                raise ValueError("Brand name cannot be blank")
            return s
        return v

    @field_validator("official_domains", "official_urls", "official_social_handles", mode="before")
    @classmethod
    def coerce_update_lists(cls, v: Any) -> Optional[List[str]]:
        if v is None:
            return None
        if isinstance(v, list):
            return [str(item).strip() for item in v if item is not None and str(item).strip()]
        return v


class BrandResponse(BrandBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Scan Schemas ---

class CandidateEvidenceInput(BaseModel):
    redirect_url: Optional[str] = Field(None, description="Supplied redirect target URL")
    final_destination_url: Optional[str] = Field(None, description="Supplied final HTTP destination")
    displayed_url: Optional[str] = Field(None, description="Supplied visible anchor text URL")
    threat_intel_reports: Optional[List[Dict[str, Any]]] = Field(None, description="Verified external threat intel reports")
    external_source_name: Optional[str] = Field(None, description="Configured source label")


class ScanRequest(BaseModel):
    candidate_type: CandidateType = Field(..., description="Type of asset being evaluated")
    candidate_value: str = Field(..., min_length=1, max_length=1000, description="The domain, URL, handle, or app name to inspect")
    brand_id: Optional[int] = Field(None, description="Optional registered brand ID to compare against")
    evidence: Optional[CandidateEvidenceInput] = Field(None, description="Optional supplied situational/threat evidence")

    @field_validator("candidate_type", mode="before")
    @classmethod
    def normalize_candidate_type(cls, v: Any) -> Any:
        if isinstance(v, str):
            cleaned = v.strip().lower().replace("-", "_")
            if cleaned in ("domain",):
                return CandidateType.DOMAIN
            if cleaned in ("url",):
                return CandidateType.URL
            if cleaned in ("social_profile", "social profile", "social_media_profile", "social"):
                return CandidateType.SOCIAL_MEDIA_PROFILE
            if cleaned in ("app_listing", "app listing", "mobile_app", "mobile app", "app"):
                return CandidateType.MOBILE_APP
        return v

    @field_validator("candidate_value")
    @classmethod
    def validate_candidate_value(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Candidate value cannot be empty")
        return s


class ScanResponse(BaseModel):
    id: int
    brand_id: Optional[int] = None
    brand_name: Optional[str] = None
    candidate_type: str
    candidate_value: str
    normalized_value: str
    risk_score: int
    risk_category: str
    status: str
    indicators: List[RiskIndicator] = Field(default_factory=list)
    engine_used: str
    disclaimer: str
    created_at: datetime
    recommended_action: Optional[str] = None
    evidence_source: Optional[Dict[str, Any]] = None
    explanations: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)


class ScanStatusUpdate(BaseModel):
    status: ScanStatus = Field(..., description="Updated triage status for the scan record")


# --- Dashboard & Health Schemas ---

class DashboardSummary(BaseModel):
    total_brands: int
    total_scans: int
    risk_distribution: Dict[str, int]
    status_distribution: Dict[str, int]
    type_distribution: Dict[str, int]
    recent_scans: List[ScanResponse]
    findings_needing_review: List[ScanResponse]


class HealthResponse(BaseModel):
    status: str
    app_name: str
    environment: str
    database_connected: bool
    detection_engine: str
