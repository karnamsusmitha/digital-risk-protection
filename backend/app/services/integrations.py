"""
Digital Risk Protection - Teammate Module Integration Service

Provides HTTP client adapters, safe error handling, timeout management,
and deterministic fallback mechanisms for integrating with external
AI detection and monitoring scanner modules.

Security & Safety:
- Never exposes API keys in exceptions, responses, or log messages.
- Always provides a deterministic fallback assessment if external calls fail or time out.
- Clearly flags fallback or simulated results with `is_fallback=True` and `fallback_reason`.
"""

import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timezone
import httpx

from app.config import settings
from app.schemas import AIEvidence, MonitoringEvidence

logger = logging.getLogger("drp.integrations")


def mask_sensitive_headers(headers: Optional[Dict[str, str]]) -> Dict[str, str]:
    """Masks secret tokens and keys in HTTP headers to prevent leakage in logs/traces."""
    if not headers:
        return {}
    safe = {}
    sensitive_keys = {"authorization", "x-api-key", "api-key", "token", "secret"}
    for k, v in headers.items():
        if any(s in k.lower() for s in sensitive_keys):
            safe[k] = "***MASKED***"
        else:
            safe[k] = v
    return safe


def call_external_ai_service(
    target_url: Optional[str] = None,
    candidate_name: Optional[str] = None,
    company_name: Optional[str] = None,
    service_url: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout: Optional[float] = None,
) -> Tuple[Optional[AIEvidence], bool, Optional[str]]:
    """
    Invokes external teammate AI module over HTTP with safe timeouts.
    Returns (ai_evidence, is_fallback, fallback_reason).
    If service is unavailable, unreachable, or times out, safely falls back
    without crashing or exposing credentials.
    """
    url = service_url or settings.AI_MODULE_URL
    if not url:
        # Service is not configured -> return None, not an error
        return None, False, None

    key = api_key or settings.AI_MODULE_API_KEY
    req_timeout = timeout or settings.MODULE_REQUEST_TIMEOUT

    headers = {"Content-Type": "application/json"}
    if key:
        headers["X-API-Key"] = key

    payload = {
        "target_url": target_url,
        "candidate_name": candidate_name,
        "company_name": company_name,
    }

    try:
        with httpx.Client(timeout=req_timeout) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            ai_ev = AIEvidence(
                name_similarity=data.get("name_similarity"),
                logo_similarity=data.get("logo_similarity"),
                model_name=data.get("model_name", "teammate-ai-detector"),
                model_confidence=data.get("model_confidence", 0.85),
                analysis_timestamp=data.get("analysis_timestamp", datetime.now(timezone.utc).isoformat()),
                details=data.get("details"),
            )
            return ai_ev, False, None

    except httpx.TimeoutException:
        reason = f"AI detection service timed out after {req_timeout}s. Deterministic rule-based fallback applied."
        logger.warning(reason)
        fallback = AIEvidence(
            name_similarity=None,
            logo_similarity=None,
            model_name="deterministic_fallback_engine",
            model_confidence=0.5,
            analysis_timestamp=datetime.now(timezone.utc).isoformat(),
            details={"fallback": True, "error": "timeout"},
        )
        return fallback, True, reason

    except Exception as exc:
        reason = f"AI detection service unavailable ({type(exc).__name__}). Deterministic rule-based fallback applied."
        logger.warning(reason)
        fallback = AIEvidence(
            name_similarity=None,
            logo_similarity=None,
            model_name="deterministic_fallback_engine",
            model_confidence=0.5,
            analysis_timestamp=datetime.now(timezone.utc).isoformat(),
            details={"fallback": True, "error": type(exc).__name__},
        )
        return fallback, True, reason


def call_external_monitoring_service(
    candidate_url: Optional[str] = None,
    service_url: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout: Optional[float] = None,
) -> Tuple[Optional[MonitoringEvidence], bool, Optional[str]]:
    """
    Invokes external teammate monitoring/scanning module over HTTP with safe timeouts.
    Returns (monitoring_evidence, is_fallback, fallback_reason).
    """
    url = service_url or settings.MONITORING_MODULE_URL
    if not url:
        return None, False, None

    key = api_key or settings.MONITORING_MODULE_API_KEY
    req_timeout = timeout or settings.MODULE_REQUEST_TIMEOUT

    headers = {"Content-Type": "application/json"}
    if key:
        headers["X-API-Key"] = key

    payload = {"candidate_url": candidate_url}

    try:
        with httpx.Client(timeout=req_timeout) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            mon_ev = MonitoringEvidence(
                candidate_url=data.get("candidate_url", candidate_url),
                asset_type=data.get("asset_type", "domain"),
                platform=data.get("platform", "web"),
                observed_metadata=data.get("observed_metadata", {}),
                source_identifier=data.get("source_identifier", "teammate-scanner"),
                observation_timestamp=data.get("observation_timestamp", datetime.now(timezone.utc).isoformat()),
            )
            return mon_ev, False, None

    except httpx.TimeoutException:
        reason = f"Monitoring service timed out after {req_timeout}s. Deterministic passive fallback applied."
        logger.warning(reason)
        fallback = MonitoringEvidence(
            candidate_url=candidate_url,
            asset_type="domain",
            platform="web",
            observed_metadata={"fallback": True, "error": "timeout"},
            source_identifier="deterministic_fallback_engine",
            observation_timestamp=datetime.now(timezone.utc).isoformat(),
        )
        return fallback, True, reason

    except Exception as exc:
        reason = f"Monitoring service unavailable ({type(exc).__name__}). Deterministic passive fallback applied."
        logger.warning(reason)
        fallback = MonitoringEvidence(
            candidate_url=candidate_url,
            asset_type="domain",
            platform="web",
            observed_metadata={"fallback": True, "error": type(exc).__name__},
            source_identifier="deterministic_fallback_engine",
            observation_timestamp=datetime.now(timezone.utc).isoformat(),
        )
        return fallback, True, reason
