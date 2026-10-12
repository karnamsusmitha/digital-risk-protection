import enum
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint,
    JSON,
    func,
)
from sqlalchemy.orm import relationship, validates, Mapped, mapped_column
from app.database import Base


def get_utc_now() -> datetime:
    """Returns current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class AssetType(str, enum.Enum):
    """Allowed asset types for protected assets and candidates."""
    BRAND_NAME = "brand_name"
    DOMAIN = "domain"
    SOCIAL_PROFILE = "social_profile"
    MOBILE_APP = "mobile_app"


class RiskSeverity(str, enum.Enum):
    """Allowed risk severities."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FindingStatus(str, enum.Enum):
    """Allowed finding statuses."""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================================
# 1. Company Model
# ============================================================================

class Company(Base):
    """
    Represents an organization or brand monitored by the Digital Risk Protection platform.
    """
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Operational & backwards-compatibility fields
    domain: Mapped[Optional[str]] = mapped_column(String(255), index=True, nullable=True)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    overall_risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        onupdate=get_utc_now,
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    protected_assets = relationship(
        "ProtectedAsset",
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    candidates = relationship(
        "Candidate",
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    risk_findings = relationship(
        "RiskFinding",
        back_populates="company",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Compatibility properties for existing code expecting `company.assets` / `company.findings`
    @property
    def assets(self):
        return self.protected_assets

    @property
    def findings(self):
        return self.risk_findings


# ============================================================================
# 2. ProtectedAsset Model
# ============================================================================

class ProtectedAsset(Base):
    """
    Represents a digital asset owned and defended by a monitored company
    (brand_name, domain, social_profile or mobile_app).
    """
    __tablename__ = "protected_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    platform: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Operational & backwards-compatibility fields
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    criticality: Mapped[Optional[str]] = mapped_column(String(50), default="MEDIUM")
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        onupdate=get_utc_now,
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "lower(asset_type) IN ('brand_name', 'domain', 'social_profile', 'mobile_app')",
            name="check_protected_asset_type",
        ),
    )

    # Relationships
    company = relationship("Company", back_populates="protected_assets")
    candidates = relationship(
        "Candidate",
        back_populates="protected_asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    risk_findings = relationship(
        "RiskFinding",
        back_populates="protected_asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @validates("asset_type")
    def validate_asset_type(self, key, value):
        if not value:
            raise ValueError("asset_type is required")
        val = value.strip().lower()
        allowed = {t.value for t in AssetType}
        if val not in allowed:
            raise ValueError(f"Invalid asset_type '{value}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @validates("value")
    def validate_value(self, key, value):
        if not value or not str(value).strip():
            raise ValueError("value cannot be empty")
        return str(value).strip()


# Backward-compatible model alias
Asset = ProtectedAsset


# ============================================================================
# 3. Candidate Model
# ============================================================================

class Candidate(Base):
    """
    Represents an unverified threat detection signal, typosquat lookalike,
    or candidate discovery gathered by monitoring agents.
    """
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    value: Mapped[str] = mapped_column(String(1000), nullable=False, index=True)  # value or URL
    platform: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    observed_metadata: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Foreign Keys
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    asset_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("protected_assets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Operational & backwards-compatibility fields
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="SCANNER")
    candidate_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    raw_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.5)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        onupdate=get_utc_now,
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "lower(asset_type) IN ('brand_name', 'domain', 'social_profile', 'mobile_app')",
            name="check_candidate_asset_type",
        ),
    )

    # Relationships
    company = relationship("Company", back_populates="candidates")
    protected_asset = relationship("ProtectedAsset", back_populates="candidates")
    risk_findings = relationship(
        "RiskFinding",
        back_populates="candidate",
        passive_deletes=True,
    )

    @property
    def asset(self):
        return self.protected_asset

    @property
    def findings(self):
        return self.risk_findings

    @validates("asset_type")
    def validate_asset_type(self, key, value):
        if not value:
            raise ValueError("asset_type is required")
        val = value.strip().lower()
        allowed = {t.value for t in AssetType}
        if val not in allowed:
            raise ValueError(f"Invalid asset_type '{value}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @validates("value")
    def validate_value(self, key, value):
        if not value or not str(value).strip():
            raise ValueError("value cannot be empty")
        return str(value).strip()


# ============================================================================
# 4. RiskFinding Model
# ============================================================================

class RiskFinding(Base):
    """
    Represents an evaluated digital risk finding with confirmed severity,
    structured evidence, and remediation tracking.
    """
    __tablename__ = "risk_findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    candidate_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("candidates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    asset_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("protected_assets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=50.0, index=True)
    severity: Mapped[str] = mapped_column(String(50), nullable=False, default="medium", index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", index=True)
    reasons: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    evidence: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Operational & backwards-compatibility fields
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    remediation_guidance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_utc_now,
        onupdate=get_utc_now,
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "risk_score >= 0.0 AND risk_score <= 100.0",
            name="check_risk_score_range",
        ),
        CheckConstraint(
            "lower(severity) IN ('low', 'medium', 'high', 'critical')",
            name="check_risk_severity",
        ),
        CheckConstraint(
            "lower(status) IN ('pending', 'completed', 'failed', 'open', 'in_review', 'resolved', 'false_positive')",
            name="check_risk_status",
        ),
    )

    # Relationships
    company = relationship("Company", back_populates="risk_findings")
    candidate = relationship("Candidate", back_populates="risk_findings")
    protected_asset = relationship("ProtectedAsset", back_populates="risk_findings")

    @property
    def asset(self):
        return self.protected_asset

    @validates("risk_score")
    def validate_risk_score(self, key, value):
        if value is None:
            raise ValueError("risk_score cannot be None")
        val = float(value)
        if val < 0.0 or val > 100.0:
            raise ValueError(f"risk_score must be between 0 and 100, got {val}")
        return val

    @validates("severity")
    def validate_severity(self, key, value):
        if not value:
            raise ValueError("severity is required")
        val = value.strip().lower()
        allowed = {s.value for s in RiskSeverity}
        if val not in allowed:
            raise ValueError(f"Invalid severity '{value}'. Must be one of: {', '.join(sorted(allowed))}")
        return val

    @validates("status")
    def validate_status(self, key, value):
        if not value:
            raise ValueError("status is required")
        val = value.strip().lower()
        allowed = {"pending", "completed", "failed", "open", "in_review", "resolved", "false_positive"}
        if val not in allowed:
            raise ValueError(f"Invalid status '{value}'. Must be one of: pending, completed, failed")
        return val


# Backward-compatible model alias
Finding = RiskFinding
