from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    func
)
from sqlalchemy.orm import relationship
from app.database import Base


class Brand(Base):
    __tablename__ = "brands"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # JSON lists of official assets
    official_domains = Column(JSON, nullable=False, default=list)
    official_urls = Column(JSON, nullable=False, default=list)
    official_social_handles = Column(JSON, nullable=False, default=list)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    scans = relationship("Scan", back_populates="brand", cascade="all, delete")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True)

    # domain, url, social_media_profile, mobile_app
    candidate_type = Column(String(50), nullable=False, index=True)
    candidate_value = Column(String(1000), nullable=False)
    normalized_value = Column(String(1000), nullable=False)

    # Risk metrics
    risk_score = Column(Integer, nullable=False, default=0)
    risk_category = Column(String(20), nullable=False, index=True)  # Low, Medium, High, Critical
    status = Column(String(50), nullable=False, default="completed", index=True)  # completed, review_needed, false_positive, confirmed_threat

    # Evidence details
    indicators = Column(JSON, nullable=False, default=list)
    engine_used = Column(String(50), nullable=False, default="rule_based")
    disclaimer = Column(
        Text,
        nullable=False,
        default="Scores are preliminary risk indicators, not proof of fraud."
    )
    recommended_action = Column(String(500), nullable=True)
    evidence_source = Column(JSON, nullable=True)
    explanations = Column(JSON, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    brand = relationship("Brand", back_populates="scans")
