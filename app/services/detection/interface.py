from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DetectionContext(BaseModel):
    brand_id: Optional[int] = None
    brand_name: Optional[str] = None
    official_domains: List[str] = Field(default_factory=list)
    official_urls: List[str] = Field(default_factory=list)
    official_social_handles: List[str] = Field(default_factory=list)


class DetectionOutput(BaseModel):
    normalized_value: str
    risk_score: int = Field(..., ge=0, le=100)
    risk_category: str  # Low, Medium, High, Critical
    indicators: List[Dict[str, Any]] = Field(default_factory=list)
    engine_used: str = "rule_based"
    disclaimer: str = (
        "Scores are preliminary risk indicators, not proof of fraud. "
        "Further human verification and technical review are required before enforcement actions."
    )
    recommended_action: Optional[str] = None
    evidence_source: Optional[Dict[str, Any]] = None
    explanations: Optional[List[str]] = None


class BaseDetectionEngine(ABC):
    """
    Abstract Base Class for detection engines.
    Both the rule-based baseline and any future teammate AI/similarity module
    must implement this interface for seamless integration.
    """

    @abstractmethod
    def detect(
        self,
        candidate_type: str,
        candidate_value: str,
        context: Optional[DetectionContext] = None
    ) -> DetectionOutput:
        """
        Analyze a candidate domain, URL, social profile, or mobile app listing
        and produce a standardized DetectionOutput.
        """
        pass
