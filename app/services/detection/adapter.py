import logging
from typing import Optional, Any
from app.services.detection.interface import (
    BaseDetectionEngine,
    DetectionContext,
    DetectionOutput
)
from app.services.detection.rule_engine import RuleBasedDetectionEngine

logger = logging.getLogger(__name__)


class DetectionService:
    """
    Modular Detection Service Adapter.
    Integrates the baseline rule engine and allows plugging in a teammate's
    AI/ML similarity engine seamlessly without modifying API endpoints or database logic.
    """

    def __init__(self, initial_engine: Optional[BaseDetectionEngine] = None):
        self._engine: BaseDetectionEngine = initial_engine or RuleBasedDetectionEngine()
        self._ai_module_registered: bool = False
        self._engine_name: str = "rule_based"

    @property
    def engine_name(self) -> str:
        return self._engine_name

    @property
    def is_ai_enabled(self) -> bool:
        return self._ai_module_registered

    def register_ai_module(self, ai_engine: BaseDetectionEngine, engine_name: str = "ai_similarity"):
        """
        Hook for integrating teammate's AI/similarity module.
        """
        if not isinstance(ai_engine, BaseDetectionEngine):
            raise TypeError("AI module must implement BaseDetectionEngine interface")
        self._engine = ai_engine
        self._ai_module_registered = True
        self._engine_name = engine_name
        logger.info(f"Successfully plugged in AI detection module: {engine_name}")

    def reset_to_rule_based(self):
        """Revert back to standard rule-based baseline."""
        self._engine = RuleBasedDetectionEngine()
        self._ai_module_registered = False
        self._engine_name = "rule_based"
        logger.info("Reset detection engine to baseline rule-based engine.")

    def analyze(
        self,
        candidate_type: str,
        candidate_value: str,
        context: Optional[DetectionContext] = None,
        evidence: Optional[Any] = None
    ) -> DetectionOutput:
        """
        Execute detection analysis through the currently active engine.
        """
        try:
            output = self._engine.detect(
                candidate_type=candidate_type,
                candidate_value=candidate_value,
                context=context,
                evidence=evidence
            )
        except TypeError:
            output = self._engine.detect(
                candidate_type=candidate_type,
                candidate_value=candidate_value,
                context=context
            )
        output.engine_used = self._engine_name
        return output


# Global detection service instance for dependency injection
detection_service = DetectionService()
