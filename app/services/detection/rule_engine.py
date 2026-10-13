"""
Transparent, explainable rule-based baseline detection engine.
Delegates core heuristic and deterministic risk analysis to the reusable RiskScoringService.
"""

from typing import List, Optional, Dict, Any, Tuple, Union
from app.services.detection.interface import (
    BaseDetectionEngine,
    DetectionContext,
    DetectionOutput
)
from app.services.risk_scoring import (
    RiskScoringService,
    BrandAssetContext,
    CandidateEvidence,
    CandidateAssetType,
    normalize_asset_type,
    compute_levenshtein_distance,
    normalize_homoglyphs,
    HOMOGLYPH_MAP,
    DECEPTIVE_KEYWORDS,
    SUSPICIOUS_TLDS,
    risk_scoring_service
)


class RuleBasedDetectionEngine(BaseDetectionEngine):
    """
    Rule-based detection engine implementing BaseDetectionEngine interface.
    Leverages the decoupled, reusable RiskScoringService for all score and indicator calculations.
    """

    def __init__(self, scoring_service: Optional[RiskScoringService] = None):
        self._scoring_service = scoring_service or risk_scoring_service

    def normalize_candidate(self, candidate_type: str, value: str) -> Tuple[str, Dict[str, Any]]:
        """
        Normalize input and extract parsed structural components safely.
        """
        typed_asset = normalize_asset_type(candidate_type)
        return self._scoring_service.normalize_candidate(typed_asset, value)

    def detect(
        self,
        candidate_type: str,
        candidate_value: str,
        context: Optional[DetectionContext] = None,
        evidence: Optional[Union[Dict[str, Any], CandidateEvidence]] = None
    ) -> DetectionOutput:
        """
        Analyze candidate asset using the reusable RiskScoringService.
        """
        brand_ctx: Optional[BrandAssetContext] = None
        if context:
            brand_ctx = BrandAssetContext(
                brand_id=context.brand_id,
                name=context.brand_name or "",
                official_domains=context.official_domains or [],
                official_urls=context.official_urls or [],
                official_social_handles=context.official_social_handles or []
            )

        result = self._scoring_service.analyze(
            candidate_type=candidate_type,
            candidate_value=candidate_value,
            brand=brand_ctx,
            evidence=evidence
        )

        return DetectionOutput(
            normalized_value=result.normalized_value,
            risk_score=result.score,
            risk_category=result.category,
            indicators=result.indicators,
            engine_used="rule_based",
            disclaimer=result.disclaimer,
            recommended_action=result.recommended_action,
            evidence_source=result.evidence_source,
            explanations=result.explanations
        )
