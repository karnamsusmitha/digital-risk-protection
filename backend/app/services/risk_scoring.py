"""
Digital Risk Protection - Explainable, Modular Risk-Scoring Engine

This module implements an explainable, testable, and modular risk evaluation service.
It assesses organizational threat posture, evaluates candidate attack signals,
and scores potential risks against registered official assets.

Guiding Principles:
1. Explainability: Every score contribution provides an itemized, human-readable rationale.
2. Official Asset Exclusion: Exact matches against official assets are excluded from suspicious findings.
3. Brand Resemblance: Name similarity alone is capped at LOW severity (< 35 pts) and not classified as fraud.
4. Robustness: Missing signals/evidence do not crash and are NOT treated as evidence of malicious activity.
5. Extensibility: New AI and monitoring signal evaluators can be plugged in without modifying core logic.
6. Transparency: Results are explicitly labeled as preliminary risk assessments without fabricated external scans.
"""

from typing import Optional, List, Dict, Any, Tuple, Callable
from dataclasses import dataclass, field
import math
from sqlalchemy.orm import Session
from app.models import Company, Asset, Finding, Candidate, RiskFinding
from app.schemas import CandidateEvaluationResponse, AnalyzeRequest, AnalyzeResponse


# ============================================================================
# Explicit Configurable Thresholds & Weights
# ============================================================================

DEFAULT_SEVERITY_THRESHOLDS: Dict[str, float] = {
    "CRITICAL": 80.0,
    "HIGH": 60.0,
    "MEDIUM": 35.0,
    "LOW": 0.0,
}

# Signal Weights (Maximum point contributions)
WEIGHT_NAME_SIMILARITY_MAX = 20.0       # Resembling a brand alone never exceeds LOW (< 35)
WEIGHT_LOGO_SIMILARITY_MAX = 30.0       # High visual asset imitation
WEIGHT_EXPOSED_CREDENTIAL_MAX = 35.0   # Secrets / keys in code or dark web
WEIGHT_ACTIVE_INFRASTRUCTURE = 20.0     # Active MX / live DNS resolving traffic
WEIGHT_SUSPICIOUS_KEYWORDS = 15.0      # Targets like 'login', 'auth', 'verify', 'update'
WEIGHT_RECENT_INFRASTRUCTURE = 10.0     # Newly registered / staging domain
WEIGHT_DATA_EXPOSURE = 25.0            # Exposed customer records / PII
WEIGHT_IMPERSONATION_PROFILE = 15.0    # Social profile executive impersonation

SEVERITY_WEIGHTS: Dict[str, float] = {
    "CRITICAL": 40.0,
    "HIGH": 25.0,
    "MEDIUM": 10.0,
    "LOW": 3.0,
}

ASSET_CRITICALITY_MULTIPLIERS: Dict[str, float] = {
    "CRITICAL": 1.5,
    "HIGH": 1.25,
    "MEDIUM": 1.0,
    "LOW": 0.8,
}


def map_score_to_severity(score: float, thresholds: Optional[Dict[str, float]] = None) -> str:
    """
    Explicitly maps a numerical score (0-100) to a severity category.
    Configurable via thresholds dictionary.
    """
    t = thresholds or DEFAULT_SEVERITY_THRESHOLDS
    critical_threshold = t.get("CRITICAL", 80.0)
    high_threshold = t.get("HIGH", 60.0)
    medium_threshold = t.get("MEDIUM", 35.0)

    if score >= critical_threshold:
        return "CRITICAL"
    if score >= high_threshold:
        return "HIGH"
    if score >= medium_threshold:
        return "MEDIUM"
    return "LOW"


def get_risk_level_label(score: float) -> str:
    """Classifies numerical score (0-100) into risk tier (compatibility alias)."""
    if score >= 75.0:
        return "CRITICAL"
    if score >= 50.0:
        return "HIGH"
    if score >= 25.0:
        return "MODERATE"
    return "LOW"


def calculate_finding_score(severity: str, asset_criticality: Optional[str] = None) -> float:
    """Calculates weighted risk score for an individual finding."""
    base_weight = SEVERITY_WEIGHTS.get(severity.upper(), 10.0)
    multiplier = ASSET_CRITICALITY_MULTIPLIERS.get((asset_criticality or "MEDIUM").upper(), 1.0)
    return min(100.0, base_weight * multiplier)


def recalculate_company_risk(company_id: int, db: Session) -> float:
    """
    Recalculates the cumulative risk score for a company based on all
    active (OPEN or IN_REVIEW) findings and their associated asset criticality.
    Updates company.overall_risk_score in the database.
    """
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return 0.0

    active_findings = (
        db.query(Finding)
        .filter(
            Finding.company_id == company_id,
            Finding.status.in_(["OPEN", "IN_REVIEW", "open", "in_review", "pending", "PENDING"])
        )
        .all()
    )

    if not active_findings:
        setattr(company, "overall_risk_score", 0.0)
        db.commit()
        db.refresh(company)
        return 0.0

    raw_score = 0.0
    for finding in active_findings:
        asset_crit = "MEDIUM"
        if getattr(finding, "protected_asset", None) and getattr(finding.protected_asset, "criticality", None):
            asset_crit = str(finding.protected_asset.criticality)
        elif getattr(finding, "asset", None) and getattr(finding.asset, "criticality", None):
            asset_crit = str(finding.asset.criticality)
        raw_score += calculate_finding_score(finding.severity, asset_crit)

    # Use logarithmic/saturating curve so score gracefully approaches 100
    # Score formula: 100 * (1 - e^(-raw / 80))
    normalized_score = round(100.0 * (1.0 - math.exp(-raw_score / 80.0)), 1)
    normalized_score = min(100.0, max(0.0, normalized_score))

    setattr(company, "overall_risk_score", normalized_score)
    db.commit()
    db.refresh(company)
    return normalized_score


# ============================================================================
# Modular Scoring Context & Data Structures
# ============================================================================

@dataclass
class ScoringContext:
    company: Optional[Company]
    candidate_name: Optional[str]
    candidate_type: str
    target_value: Optional[str]
    domain: Optional[str]
    profile_url: Optional[str]
    app_listing: Optional[str]
    source: str
    raw_data: Optional[str]
    threat_indicators: List[str]
    name_similarity: Optional[float]
    logo_similarity: Optional[float]
    monitoring_metadata: Dict[str, Any]
    additional_evidence: Dict[str, Any]
    thresholds: Dict[str, float]


@dataclass
class SignalContribution:
    signal_name: str
    score: float
    reason: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.8


@dataclass
class ModularAssessmentResult:
    overall_risk_score: float
    severity: str
    confidence_score: float
    should_convert_to_finding: bool
    reasons: List[str]
    evidence: Dict[str, Any]
    rationale: str
    remediation: str
    is_official_match: bool
    official_exclusion_reason: Optional[str]
    assessment_label: str = "Preliminary Risk Assessment"


# ============================================================================
# Official Asset Matching Utilities
# ============================================================================

def normalize_target_string(target: Optional[str]) -> str:
    """Normalizes URL, domain, or identifier for exact matching."""
    if not target or not isinstance(target, str):
        return ""
    val = target.strip().lower()
    if "://" in val:
        val = val.split("://", 1)[1]
    val = val.split("/", 1)[0].split("?", 1)[0].split("#", 1)[0]
    if val.startswith("www."):
        val = val[4:]
    if val.startswith("@"):
        val = val[1:]
    return val.strip()


def check_official_asset_match(
    candidate_targets: List[str],
    company: Optional[Company],
) -> Tuple[bool, Optional[str], Optional[Any]]:
    """
    Checks if any candidate identifier matches registered company official assets or domains.
    Returns (is_match, exclusion_reason, matched_asset).
    """
    if not company:
        return False, None, None

    normalized_candidates = {
        normalize_target_string(t) for t in candidate_targets if t and normalize_target_string(t)
    }
    if not normalized_candidates:
        return False, None, None

    # 1. Check primary company domain
    if company.domain:
        norm_company_domain = normalize_target_string(company.domain)
        if norm_company_domain in normalized_candidates:
            reason = (
                f"Official Asset Exclusion: Target matches registered primary domain '{company.domain}' "
                f"for company '{company.name}'. Excluded from suspicious findings."
            )
            return True, reason, None

    # 2. Check protected assets
    official_assets = getattr(company, "protected_assets", []) or getattr(company, "assets", []) or []
    for asset in official_assets:
        norm_asset_value = normalize_target_string(asset.value)
        if norm_asset_value and norm_asset_value in normalized_candidates:
            reason = (
                f"Official Asset Exclusion: Target matches registered official asset '{asset.value}' "
                f"(Asset ID: {asset.id}, Type: {asset.asset_type}). Excluded from suspicious findings."
            )
            return True, reason, asset

    return False, None, None


# ============================================================================
# Pluggable Signal Evaluators
# ============================================================================

def eval_name_similarity(ctx: ScoringContext) -> Optional[SignalContribution]:
    """
    Evaluates AI name similarity.
    Rule: Resembling a brand name alone never exceeds LOW severity (< 35.0).
    """
    if ctx.name_similarity is None:
        return SignalContribution(
            signal_name="name_similarity",
            score=0.0,
            reason="Missing signal: AI name similarity score not supplied. Missing signals do not increase risk score.",
            evidence={"name_similarity": None},
            confidence=0.5,
        )

    sim = max(0.0, min(1.0, float(ctx.name_similarity)))
    score = round(sim * WEIGHT_NAME_SIMILARITY_MAX, 1)
    reason = (
        f"AI Name similarity score: {sim:.2f} (+{score:.1f} pts). "
        "Notice: Name resemblance alone is not classified as fraudulent without corroborated threat indicators."
    )
    return SignalContribution(
        signal_name="name_similarity",
        score=score,
        reason=reason,
        evidence={"name_similarity": sim, "max_weight": WEIGHT_NAME_SIMILARITY_MAX},
        confidence=0.75 + (0.2 * sim),
    )


def eval_logo_similarity(ctx: ScoringContext) -> Optional[SignalContribution]:
    """
    Evaluates AI visual logo similarity.
    High visual similarity indicates intentional brand imitation.
    """
    if ctx.logo_similarity is None:
        return SignalContribution(
            signal_name="logo_similarity",
            score=0.0,
            reason="Missing signal: AI logo similarity score not supplied. Missing signals do not increase risk score.",
            evidence={"logo_similarity": None},
            confidence=0.5,
        )

    sim = max(0.0, min(1.0, float(ctx.logo_similarity)))
    score = round(sim * WEIGHT_LOGO_SIMILARITY_MAX, 1)
    reason = (
        f"AI Logo similarity score: {sim:.2f} (+{score:.1f} pts). "
        "Indicates intentional visual asset imitation." if sim >= 0.7 else
        f"AI Logo similarity score: {sim:.2f} (+{score:.1f} pts). Low visual correlation."
    )
    return SignalContribution(
        signal_name="logo_similarity",
        score=score,
        reason=reason,
        evidence={"logo_similarity": sim, "max_weight": WEIGHT_LOGO_SIMILARITY_MAX},
        confidence=0.85,
    )


def eval_credential_exposure(ctx: ScoringContext) -> Optional[SignalContribution]:
    """Evaluates credential / secret leak signals."""
    type_upper = ctx.candidate_type.upper()
    raw_lower = (ctx.raw_data or "").lower()
    indicators = [i.lower() for i in ctx.threat_indicators]

    is_credential_type = "CREDENTIAL" in type_upper or "SECRET" in type_upper or "KEY" in type_upper
    has_secret_kw = any(kw in raw_lower for kw in ["password", "private_key", "aws_secret", "bearer", "token", "secret_key"])
    is_active = "active" in indicators or "exposed_secret" in indicators

    if is_credential_type or has_secret_kw:
        if has_secret_kw or is_active:
            score = WEIGHT_EXPOSED_CREDENTIAL_MAX
            reason = "High-confidence exposed secret or credential token detected in source (+35.0 pts)."
            confidence = 0.95
        else:
            score = 25.0
            reason = "Potential leaked credentials or token references identified requiring validation (+25.0 pts)."
            confidence = 0.85
        return SignalContribution(
            signal_name="credential_exposure",
            score=score,
            reason=reason,
            evidence={"has_secret_token": has_secret_kw, "active_indicator": is_active},
            confidence=confidence,
        )
    return None


def eval_infrastructure_metadata(ctx: ScoringContext) -> Optional[SignalContribution]:
    """Evaluates monitoring module metadata: active DNS, MX records, suspicious keywords."""
    meta = ctx.monitoring_metadata or {}
    raw_lower = (ctx.raw_data or "").lower()
    indicators = [i.lower() for i in ctx.threat_indicators]
    target_str = (ctx.domain or ctx.target_value or ctx.profile_url or "").lower()

    score = 0.0
    reasons = []

    # 1. Live infrastructure / resolving traffic
    has_active_dns = (
        meta.get("active_dns") is True or
        meta.get("active_mx") is True or
        "active_mx" in indicators or
        "resolving_ip" in indicators or
        "active" in indicators or
        "dns_active" in meta or
        meta.get("ip") is not None
    )
    if has_active_dns:
        score += WEIGHT_ACTIVE_INFRASTRUCTURE
        reasons.append("Active DNS/MX resolving infrastructure detected (+20.0 pts).")

    # 2. Suspicious keywords in domain or path
    phish_keywords = ["login", "verify", "auth", "secure", "update", "banking", "portal", "account", "signin"]
    matched_kws = [kw for kw in phish_keywords if kw in target_str or kw in raw_lower]
    if matched_kws:
        score += WEIGHT_SUSPICIOUS_KEYWORDS
        reasons.append(f"Target contains credential-harvesting keywords ({', '.join(matched_kws[:3])}) (+15.0 pts).")

    # 3. Newly registered domain or staging
    age_days = meta.get("domain_age_days")
    is_staging = "staging" in raw_lower or "dormant" in indicators
    if age_days is not None and age_days < 14:
        score += WEIGHT_RECENT_INFRASTRUCTURE
        reasons.append(f"Newly registered domain ({age_days} days old) (+10.0 pts).")
    elif is_staging:
        score += 5.0
        reasons.append("Dormant or staging lookalike infrastructure detected (+5.0 pts).")

    if score > 0.0:
        return SignalContribution(
            signal_name="infrastructure_metadata",
            score=score,
            reason=" ".join(reasons),
            evidence={"active_dns": has_active_dns, "keywords": matched_kws, "metadata": meta},
            confidence=0.88,
        )
    return None


def eval_data_exposure(ctx: ScoringContext) -> Optional[SignalContribution]:
    """Evaluates public data / PII exposure."""
    type_upper = ctx.candidate_type.upper()
    indicators = [i.lower() for i in ctx.threat_indicators]

    if "DATA_EXPOSURE" in type_upper or "PII" in indicators or "database_leak" in indicators:
        return SignalContribution(
            signal_name="data_exposure",
            score=WEIGHT_DATA_EXPOSURE,
            reason="Sensitive organizational data or PII potentially accessible publicly (+25.0 pts).",
            evidence={"candidate_type": ctx.candidate_type},
            confidence=0.85,
        )
    return None


def eval_impersonation(ctx: ScoringContext) -> Optional[SignalContribution]:
    """Evaluates social profile executive or brand impersonation."""
    type_upper = ctx.candidate_type.upper()
    if "IMPERSONATION" in type_upper or ctx.profile_url is not None:
        return SignalContribution(
            signal_name="impersonation",
            score=WEIGHT_IMPERSONATION_PROFILE,
            reason="Executive or brand profile impersonation identified on external social/web platforms (+15.0 pts).",
            evidence={"profile_url": ctx.profile_url},
            confidence=0.78,
        )
    return None


# ============================================================================
# Pluggable Evaluator Registry
# ============================================================================

SIGNAL_EVALUATORS: List[Callable[[ScoringContext], Optional[SignalContribution]]] = [
    eval_name_similarity,
    eval_logo_similarity,
    eval_credential_exposure,
    eval_infrastructure_metadata,
    eval_data_exposure,
    eval_impersonation,
]


def register_signal_evaluator(evaluator: Callable[[ScoringContext], Optional[SignalContribution]]) -> None:
    """Enables runtime addition of new AI or monitoring signal evaluators."""
    if evaluator not in SIGNAL_EVALUATORS:
        SIGNAL_EVALUATORS.append(evaluator)


# ============================================================================
# Core Explainable Risk Evaluation
# ============================================================================

def evaluate_modular_risk(ctx: ScoringContext) -> ModularAssessmentResult:
    """
    Executes the modular risk scoring pipeline:
    1. Checks for official asset matching and exclusion.
    2. Gathers contributions from all registered signal evaluators.
    3. Handles missing evidence cleanly without malicious inference.
    4. Clips overall score strictly between 0 and 100.
    5. Maps to configurable severity thresholds.
    6. Produces explainable reasons, structured evidence, and preliminary labeling.
    """
    thresholds = ctx.thresholds or DEFAULT_SEVERITY_THRESHOLDS

    # Candidate targets for official matching
    targets_to_check = [
        t for t in [ctx.target_value, ctx.domain, ctx.profile_url, ctx.app_listing, ctx.candidate_name] if t
    ]

    # 1. Official Asset Matching Check
    is_official, exclusion_reason, matched_asset = check_official_asset_match(targets_to_check, ctx.company)
    if is_official:
        return ModularAssessmentResult(
            overall_risk_score=0.0,
            severity="LOW",
            confidence_score=1.0,
            should_convert_to_finding=False,
            reasons=[
                "Preliminary Assessment: Entity matches registered official inventory.",
                exclusion_reason or "Exact match to registered official asset.",
            ],
            evidence={
                "is_official_match": True,
                "exclusion_reason": exclusion_reason,
                "matched_asset_id": matched_asset.id if matched_asset else None,
            },
            rationale=exclusion_reason or "Target matches official asset; excluded from suspicious findings.",
            remediation="No remediation required. Entity is verified as an official organization asset.",
            is_official_match=True,
            official_exclusion_reason=exclusion_reason,
        )

    # 2. Evaluate all modular signals
    contributions: List[SignalContribution] = []
    reasons: List[str] = [
        "Preliminary Assessment: Algorithmic risk evaluation based strictly on submitted indicators."
    ]
    evidence_bundle: Dict[str, Any] = {
        "assessment_type": "preliminary_risk_assessment",
        "source": ctx.source,
        "candidate_type": ctx.candidate_type,
        "input_signals": {},
    }

    # Baseline adjustment for signal type
    base_score = 0.0
    type_upper = ctx.candidate_type.upper()
    if "CREDENTIAL" in type_upper or "SECRET" in type_upper:
        base_score = 30.0
    elif "PHISHING" in type_upper or "TYPOSQUAT" in type_upper:
        base_score = 25.0
    elif "DATA_EXPOSURE" in type_upper:
        base_score = 25.0
    elif "IMPERSONATION" in type_upper:
        base_score = 20.0
    else:
        base_score = 15.0

    raw_score = base_score
    reasons.append(f"Baseline category weight for '{ctx.candidate_type}': +{base_score:.1f} pts.")

    confidence_weights: List[float] = [0.70]

    for evaluator in SIGNAL_EVALUATORS:
        try:
            contrib = evaluator(ctx)
            if contrib:
                contributions.append(contrib)
                raw_score += contrib.score
                reasons.append(contrib.reason)
                evidence_bundle["input_signals"][contrib.signal_name] = {
                    "score": contrib.score,
                    "confidence": contrib.confidence,
                    "evidence": contrib.evidence,
                }
                confidence_weights.append(contrib.confidence)
        except Exception as exc:
            # Resilient: evaluator failure never crashes scoring pipeline
            reasons.append(f"Notice: Signal evaluator {getattr(evaluator, '__name__', 'unknown')} encountered non-fatal error: {exc}")

    # Clip final score strictly to [0.0, 100.0]
    final_score = min(100.0, max(0.0, round(raw_score, 1)))

    # Map to severity using configurable thresholds
    severity = map_score_to_severity(final_score, thresholds)

    # Calculate confidence based on active positive detections
    active_confidences = [c.confidence for c in contributions if c.score > 0.0]
    if active_confidences:
        avg_confidence = round(sum(active_confidences) / len(active_confidences), 2)
    else:
        avg_confidence = 0.60
    avg_confidence = min(1.0, max(0.1, avg_confidence))

    # Triage decision
    medium_thresh = thresholds.get("MEDIUM", 35.0)
    should_convert = final_score >= medium_thresh

    # Rationale summary
    primary_reasons = [r for r in reasons if "(+" in r]
    rationale = f"Evaluated {ctx.candidate_type} threat signal from {ctx.source}. Score: {final_score}/100 ({severity}). " + " ".join(primary_reasons[:2])

    # Recommended Remediation
    if severity == "CRITICAL":
        remediation = "Immediately revoke compromised credentials or submit expedited emergency takedown request."
    elif severity == "HIGH":
        remediation = "File registrar takedown notice, block domain at secure email gateway, and audit access logs."
    elif severity == "MEDIUM":
        remediation = "Monitor infrastructure for active hosting deployment and review brand similarity."
    else:
        remediation = "Continue passive monitoring; low immediate threat correlation detected."

    evidence_bundle["overall_score"] = final_score
    evidence_bundle["severity"] = severity
    evidence_bundle["confidence"] = avg_confidence
    if ctx.monitoring_metadata:
        evidence_bundle["monitoring_metadata"] = ctx.monitoring_metadata
    if ctx.additional_evidence:
        evidence_bundle["submitted_evidence"] = ctx.additional_evidence

    return ModularAssessmentResult(
        overall_risk_score=final_score,
        severity=severity,
        confidence_score=avg_confidence,
        should_convert_to_finding=should_convert,
        reasons=reasons,
        evidence=evidence_bundle,
        rationale=rationale,
        remediation=remediation,
        is_official_match=False,
        official_exclusion_reason=None,
    )


# ============================================================================
# Database Persistence Integration
# ============================================================================

def score_and_persist_threat(
    company: Company,
    request: AnalyzeRequest,
    db: Session,
) -> AnalyzeResponse:
    """
    Main API integration service for POST /api/v1/analyze:
    1. Extracts and validates incoming AI and monitoring evidence bundles.
    2. Combines only supported evidence into the modular scoring service.
    3. Implements safe external calling with deterministic fallback if configured.
    4. Deduplicates repeated analyses for the same target by updating active findings.
    5. Persists score, severity, reasons, evidence, and status in SQLite.
    6. Recalculates company risk score.
    7. Returns stable AnalyzeResponse with complete explainability metadata.
    """
    from app.services.integrations import call_external_ai_service, call_external_monitoring_service

    is_fallback = False
    fallback_reasons = []

    # 1. AI Evidence Resolution (Direct, or external call if configured and missing)
    ai_ev = request.ai_evidence
    if ai_ev is None:
        fetched_ai, ai_fallback, ai_fb_reason = call_external_ai_service(
            target_url=request.domain or request.profile_url or request.value,
            candidate_name=request.candidate_name,
            company_name=company.name,
        )
        if fetched_ai:
            ai_ev = fetched_ai
            if ai_fallback:
                is_fallback = True
                if ai_fb_reason:
                    fallback_reasons.append(ai_fb_reason)

    # 2. Monitoring Evidence Resolution
    mon_ev = request.monitoring_evidence
    if mon_ev is None:
        fetched_mon, mon_fallback, mon_fb_reason = call_external_monitoring_service(
            candidate_url=request.domain or request.profile_url or request.value,
        )
        if fetched_mon:
            mon_ev = fetched_mon
            if mon_fallback:
                is_fallback = True
                if mon_fb_reason:
                    fallback_reasons.append(mon_fb_reason)

    # 3. Extract Supported Signals Only
    name_sim = ai_ev.name_similarity if ai_ev else request.name_similarity
    logo_sim = ai_ev.logo_similarity if ai_ev else request.logo_similarity

    mon_metadata = {}
    if mon_ev and mon_ev.observed_metadata:
        mon_metadata.update(mon_ev.observed_metadata)
    if request.monitoring_metadata:
        mon_metadata.update(request.monitoring_metadata)

    target_value = (
        (mon_ev.candidate_url if mon_ev and mon_ev.candidate_url else None)
        or request.value
        or request.domain
        or request.profile_url
        or request.app_listing
        or request.raw_data
    )

    cand_type = (
        (mon_ev.asset_type if mon_ev and mon_ev.asset_type else None)
        or request.candidate_type
        or "DOMAIN"
    )

    src = (
        (mon_ev.source_identifier if mon_ev and mon_ev.source_identifier else None)
        or request.source
        or "SCANNER"
    )

    # Build ScoringContext
    ctx = ScoringContext(
        company=company,
        candidate_name=request.candidate_name,
        candidate_type=cand_type,
        target_value=target_value,
        domain=request.domain,
        profile_url=request.profile_url,
        app_listing=request.app_listing,
        source=src,
        raw_data=request.raw_data,
        threat_indicators=request.threat_indicators or [],
        name_similarity=name_sim,
        logo_similarity=logo_sim,
        monitoring_metadata=mon_metadata,
        additional_evidence=request.evidence or {},
        thresholds=request.thresholds or DEFAULT_SEVERITY_THRESHOLDS,
    )

    assessment = evaluate_modular_risk(ctx)

    # Attach validated evidence bundles to evidence payload
    norm_target = normalize_target_string(target_value)
    assessment.evidence["normalized_target"] = norm_target
    assessment.evidence["target_value"] = target_value
    assessment.evidence["ai_evidence"] = ai_ev.model_dump() if ai_ev else None
    assessment.evidence["monitoring_evidence"] = mon_ev.model_dump() if mon_ev else None
    assessment.evidence["is_fallback"] = is_fallback
    fallback_reason_str = "; ".join(fallback_reasons) if fallback_reasons else None
    assessment.evidence["fallback_reason"] = fallback_reason_str
    execution_mode = "deterministic_fallback" if is_fallback else "live_integrated"

    if is_fallback and fallback_reason_str:
        assessment.reasons.append(f"Fallback Notice: {fallback_reason_str}")

    # Determine status for persistence
    finding_status = "resolved" if assessment.is_official_match else "pending"

    # 4. Deduplication Logic for Repeated Analyses
    is_duplicate_updated = False
    finding: Optional[RiskFinding] = None

    if request.deduplicate and norm_target:
        active_findings = (
            db.query(RiskFinding)
            .filter(
                RiskFinding.company_id == company.id,
                RiskFinding.status.in_(["pending", "open", "in_review", "PENDING", "OPEN", "IN_REVIEW"])
            )
            .all()
        )
        for af in active_findings:
            af_ev = af.evidence if isinstance(af.evidence, dict) else {}
            af_norm = af_ev.get("normalized_target") or normalize_target_string(af_ev.get("target_value") or af_ev.get("url"))
            if af_norm == norm_target or (request.candidate_id and af.candidate_id == request.candidate_id):
                finding = af
                is_duplicate_updated = True
                break

    if finding:
        # Update existing active finding with latest evidence and score
        finding.risk_score = assessment.overall_risk_score
        finding.severity = assessment.severity.lower()
        finding.status = finding_status
        finding.reasons = assessment.reasons
        finding.evidence = assessment.evidence
        finding.description = assessment.rationale
        finding.remediation_guidance = assessment.remediation
    else:
        # Persist as new RiskFinding in SQLite
        finding = RiskFinding(
            company_id=company.id,
            asset_id=request.asset_id,
            candidate_id=request.candidate_id,
            risk_score=assessment.overall_risk_score,
            severity=assessment.severity.lower(),
            status=finding_status,
            reasons=assessment.reasons,
            evidence=assessment.evidence,
            title=f"Preliminary Assessment: {cand_type or 'Threat Signal'}",
            description=assessment.rationale,
            remediation_guidance=assessment.remediation,
        )
        db.add(finding)

    db.commit()
    db.refresh(finding)

    # Recalculate company risk posture
    new_company_risk = recalculate_company_risk(company.id, db)

    return AnalyzeResponse(
        company_id=company.id,
        company_name=company.name,
        recommended_severity=assessment.severity,
        estimated_risk_score=assessment.overall_risk_score,
        confidence_score=assessment.confidence_score,
        should_convert_to_finding=assessment.should_convert_to_finding,
        rationale=assessment.rationale,
        recommended_remediation=assessment.remediation,
        overall_company_risk_score=new_company_risk,
        company_risk_level=get_risk_level_label(new_company_risk),
        ai_evidence=ai_ev,
        monitoring_evidence=mon_ev,
        reasons=assessment.reasons,
        evidence=assessment.evidence,
        finding_id=finding.id,
        status=finding_status,
        assessment_type="preliminary_risk_assessment",
        is_official_asset_match=assessment.is_official_match,
        official_exclusion_reason=assessment.official_exclusion_reason,
        is_fallback=is_fallback,
        fallback_reason=fallback_reason_str,
        execution_mode=execution_mode,
        is_duplicate_updated=is_duplicate_updated,
        disclaimer=(
            "Preliminary algorithmic risk assessment based strictly on provided input signals. "
            "No external network scans, probing, or unauthorized testing were conducted."
        ),
    )


# ============================================================================
# Backwards-Compatible Signal Evaluation
# ============================================================================

def evaluate_candidate_signal(
    candidate_type: str,
    source: str,
    raw_data: Optional[str] = None,
    threat_indicators: Optional[List[str]] = None,
) -> CandidateEvaluationResponse:
    """
    Evaluates raw candidate signals using the modular engine.
    Preserves exact backwards compatibility for existing routers and tests.
    """
    ctx = ScoringContext(
        company=None,
        candidate_name=None,
        candidate_type=candidate_type,
        target_value=raw_data,
        domain=None,
        profile_url=None,
        app_listing=None,
        source=source,
        raw_data=raw_data,
        threat_indicators=threat_indicators or [],
        name_similarity=None,
        logo_similarity=None,
        monitoring_metadata={},
        additional_evidence={},
        thresholds=DEFAULT_SEVERITY_THRESHOLDS,
    )
    res = evaluate_modular_risk(ctx)
    return CandidateEvaluationResponse(
        recommended_severity=res.severity,
        estimated_risk_score=res.overall_risk_score,
        confidence_score=res.confidence_score,
        should_convert_to_finding=res.should_convert_to_finding,
        rationale=res.rationale,
        recommended_remediation=res.remediation,
    )
