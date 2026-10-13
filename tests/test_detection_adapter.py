from app.services.detection.interface import (
    BaseDetectionEngine,
    DetectionContext,
    DetectionOutput
)
from app.services.detection.adapter import detection_service


class MockTeammateAIEngine(BaseDetectionEngine):
    """Simulated teammate AI model for testing pluggability."""

    def detect(self, candidate_type: str, candidate_value: str, context=None) -> DetectionOutput:
        return DetectionOutput(
            normalized_value=candidate_value.strip().lower(),
            risk_score=92,
            risk_category="Critical",
            indicators=[{
                "code": "AI_SIMILARITY_MATCH",
                "name": "Neural Embedding Similarity Alert",
                "severity": "critical",
                "score_impact": 92,
                "explanation": "High cosine similarity detected against visual/text embedding cluster."
            }],
            engine_used="ai_transformer_v1"
        )


def test_pluggable_ai_module_integration(client):
    # Verify baseline before plugging in
    assert detection_service.engine_name == "rule_based"

    # Register teammate's AI module
    detection_service.register_ai_module(MockTeammateAIEngine(), engine_name="ai_transformer_v1")
    assert detection_service.engine_name == "ai_transformer_v1"
    assert detection_service.is_ai_enabled is True

    # Scan should now route through the AI engine
    scan_res = client.post("/api/scans", json={
        "candidate_type": "domain",
        "candidate_value": "test-ai-domain.com"
    })
    assert scan_res.status_code == 201
    data = scan_res.json()
    assert data["risk_score"] == 92
    assert data["risk_category"] == "Critical"
    assert data["engine_used"] == "ai_transformer_v1"
    assert data["indicators"][0]["code"] == "AI_SIMILARITY_MATCH"

    # Reset back to rule-based engine
    detection_service.reset_to_rule_based()
    assert detection_service.engine_name == "rule_based"
    assert detection_service.is_ai_enabled is False
