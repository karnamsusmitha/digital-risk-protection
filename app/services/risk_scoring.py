"""
Modular, explainable risk-scoring service for Digital Risk Protection backend.

Features:
- Decoupled from API routes for independent testing and reusability.
- Evaluates domains, URLs, social media profiles, and app listings against registered brand assets.
- Generates transparent, explainable risk indicators with documented weights.
- Handles configurable score bands (Low: 0-24, Medium: 25-49, High: 50-74, Critical: 75-100).
- Distinguishes exact verified official assets (score 0, never flagged as impersonators).
- Evaluates supplied redirect/URL mismatch evidence and external threat intelligence only when provided.
- Missing evidence is never treated as proof of malicious activity.
- Reports unconfigured external threat intelligence and AI models clearly.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Tuple, Union
from sqlalchemy.orm import Session

from app.models import Brand

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums and Value Objects
# ---------------------------------------------------------------------------

class CandidateAssetType(str, Enum):
    DOMAIN = "domain"
    URL = "url"
    SOCIAL_PROFILE = "social_profile"
    APP_LISTING = "app_listing"


def normalize_asset_type(raw_type: Union[str, CandidateAssetType]) -> CandidateAssetType:
    """
    Safely normalize candidate asset type strings and aliases.
    Accepts:
      - 'domain'
      - 'url'
      - 'social profile', 'social_profile', 'social_media_profile', 'social'
      - 'app listing', 'app_listing', 'mobile_app', 'mobile app', 'app'
    """
    if isinstance(raw_type, CandidateAssetType):
        return raw_type

    if not isinstance(raw_type, str):
        raise ValueError(f"Asset type must be a string, got {type(raw_type).__name__}")

    cleaned = raw_type.strip().lower().replace("-", "_")

    if cleaned == "domain":
        return CandidateAssetType.DOMAIN
    elif cleaned == "url":
        return CandidateAssetType.URL
    elif cleaned in ("social_profile", "social profile", "social_media_profile", "social"):
        return CandidateAssetType.SOCIAL_PROFILE
    elif cleaned in ("app_listing", "app listing", "mobile_app", "mobile app", "app"):
        return CandidateAssetType.APP_LISTING
    else:
        raise ValueError(
            f"Unsupported candidate asset type: '{raw_type}'. "
            f"Supported types are: domain, url, social profile, app listing."
        )


@dataclass
class BrandAssetContext:
    """Structured brand registration data for risk analysis comparison."""
    brand_id: Optional[int] = None
    name: str = ""
    description: Optional[str] = None
    official_domains: List[str] = field(default_factory=list)
    official_urls: List[str] = field(default_factory=list)
    official_social_handles: List[str] = field(default_factory=list)
    official_app_names: List[str] = field(default_factory=list)

    @classmethod
    def from_orm(cls, brand: Brand) -> BrandAssetContext:
        """Create BrandAssetContext from an SQLAlchemy Brand model."""
        return cls(
            brand_id=brand.id,
            name=brand.name,
            description=brand.description,
            official_domains=list(brand.official_domains or []),
            official_urls=list(brand.official_urls or []),
            official_social_handles=list(brand.official_social_handles or []),
            official_app_names=[]
        )


@dataclass
class CandidateEvidence:
    """Optional evidence supplied by caller or external pipelines."""
    redirect_url: Optional[str] = None
    final_destination_url: Optional[str] = None
    displayed_url: Optional[str] = None
    threat_intel_reports: Optional[List[Dict[str, Any]]] = None
    external_source_name: Optional[str] = None


class ThreatIntelProvider(Protocol):
    """Protocol for verified external threat intelligence integrations."""
    def check_threat(
        self,
        candidate_type: str,
        candidate_value: str
    ) -> Optional[Dict[str, Any]]:
        """Return threat finding dict if verified malicious, else None."""
        ...


@dataclass
class ScoreBands:
    """Configurable risk category score bands."""
    bands: Dict[str, Tuple[int, int]] = field(
        default_factory=lambda: {
            "Low": (0, 24),
            "Medium": (25, 49),
            "High": (50, 74),
            "Critical": (75, 100),
        }
    )

    def get_category(self, score: int) -> str:
        """Map an integer score (0-100) to its category band."""
        clamped = max(0, min(100, score))
        for category, (low, high) in self.bands.items():
            if low <= clamped <= high:
                return category
        # Fallback if custom bands had gaps
        if clamped >= 75:
            return "Critical"
        elif clamped >= 50:
            return "High"
        elif clamped >= 25:
            return "Medium"
        return "Low"


@dataclass
class RiskScoringWeights:
    """Configurable weights for each explainable indicator."""
    typosquat_dist_1: int = 35
    typosquat_dist_2: int = 20
    homoglyph_substitution: int = 35
    deceptive_keyword_single: int = 15
    deceptive_keyword_multi_max: int = 30
    subdomain_spoofing: int = 40
    suspicious_tld: int = 20
    excessive_hyphens: int = 15
    suspicious_app_modifier: int = 35
    suspicious_social_modifier: int = 25
    benign_brand_mention: int = 15
    redirect_mismatch: int = 35
    displayed_url_mismatch: int = 35
    verified_threat_intel: int = 40
    tld_swap_suspicious: int = 25
    tld_swap_standard: int = 20


@dataclass
class RiskAnalysisResult:
    """Comprehensive, explainable output from the risk-scoring engine."""
    score: int
    category: str
    candidate_type: str
    candidate_value: str
    normalized_value: str
    is_official_asset: bool
    indicators: List[Dict[str, Any]]
    explanations: List[str]
    evidence_source: Dict[str, Any]
    recommended_action: str
    disclaimer: str
    brand_id: Optional[int] = None
    brand_name: Optional[str] = None

    @property
    def recommended_next_action(self) -> str:
        """Alias for recommended_action for API ergonomics."""
        return self.recommended_action


# ---------------------------------------------------------------------------
# Constants & Heuristic Lookup Sets
# ---------------------------------------------------------------------------

HOMOGLYPH_MAP: Dict[str, str] = {
    '0': 'o',
    '1': 'l',
    'l': 'i',
    'i': '1',
    'vv': 'w',
    'rn': 'm',
    '5': 's',
    '@': 'a',
    '3': 'e',
    '4': 'a',
    '8': 'b',
    '6': 'g',
}

DECEPTIVE_KEYWORDS: set[str] = {
    "login", "signin", "verify", "secure", "security", "update",
    "auth", "authentication", "support", "billing", "wallet",
    "portal", "password", "account", "recover", "helpdesk",
    "banking", "confirm", "claim", "reward", "validation", "customer"
}

SUSPICIOUS_TLDS: set[str] = {
    "xyz", "top", "click", "live", "loan", "work", "rest",
    "gq", "tk", "ml", "cf", "zip", "mov", "cam", "fit", "buzz"
}

SUSPICIOUS_APP_MODIFIERS: list[str] = [
    "crack", "mod", "hack", "bonus", "free cash", "unlimited", "generator", "cheat", "pro free"
]

SUSPICIOUS_SOCIAL_KEYWORDS: list[str] = [
    "support", "help", "helpdesk", "service", "official", "claim",
    "bonus", "giveaway", "login", "verify", "recovery", "desk"
]


# ---------------------------------------------------------------------------
# Helper String Functions
# ---------------------------------------------------------------------------

def compute_levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate the Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return compute_levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def normalize_homoglyphs(text: str) -> str:
    """Normalize common visual lookalike characters to Latin equivalents."""
    normalized = text.lower()
    for glyph, replacement in HOMOGLYPH_MAP.items():
        normalized = normalized.replace(glyph, replacement)
    return normalized


def clean_alphanumeric(text: str) -> str:
    """Strip all non-alphanumeric characters and lowercase."""
    return re.sub(r"[^\w]", "", text.lower())


def extract_sld_and_tld(hostname: str) -> Tuple[str, str, str]:
    """
    Split hostname into (subdomain, sld, tld).
    Example: 'login.google.com' -> ('login', 'google', 'com')
    Example: 'paypa1.xyz' -> ('', 'paypa1', 'xyz')
    """
    cleaned = hostname.lower().strip(".")
    parts = cleaned.split(".")
    if len(parts) == 1:
        return "", parts[0], ""
    elif len(parts) == 2:
        return "", parts[0], parts[1]
    else:
        subdomain = ".".join(parts[:-2])
        sld = parts[-2]
        tld = parts[-1]
        return subdomain, sld, tld


# ---------------------------------------------------------------------------
# Main Reusable Risk Scoring Service
# ---------------------------------------------------------------------------

class RiskScoringService:
    """
    Reusable, modular Risk-Scoring Engine for Digital Risk Protection.
    Fully decoupled from API routes to facilitate independent unit testing,
    batch scanning, and background pipeline execution.
    """

    def __init__(
        self,
        weights: Optional[RiskScoringWeights] = None,
        score_bands: Optional[ScoreBands] = None,
        threat_intel_provider: Optional[ThreatIntelProvider] = None,
    ):
        self.weights = weights or RiskScoringWeights()
        self.score_bands = score_bands or ScoreBands()
        self.threat_intel_provider = threat_intel_provider

    # -----------------------------------------------------------------------
    # Input Normalization & Structural Parsing
    # -----------------------------------------------------------------------

    def normalize_candidate(
        self,
        asset_type: CandidateAssetType,
        raw_value: str
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Validate and normalize input candidate string according to asset type.
        Returns:
            (normalized_string, metadata_dict)
        Raises:
            ValueError on invalid or unsafe input.
        """
        if raw_value is None:
            raise ValueError("Candidate value cannot be empty")

        raw = raw_value.strip()
        if not raw:
            raise ValueError("Candidate value cannot be empty")

        meta: Dict[str, Any] = {}

        if asset_type == CandidateAssetType.DOMAIN:
            cleaned = raw.lower()
            if "://" in cleaned:
                parsed = urllib.parse.urlparse(cleaned)
                cleaned = parsed.netloc or cleaned
            cleaned = cleaned.split("/")[0].split(":")[0].strip(".")
            # Strip invalid characters safely
            cleaned = re.sub(r"[^\w\.-]", "", cleaned)
            if not cleaned or "." not in cleaned:
                raise ValueError(f"Domain value is invalid: '{raw_value}'")

            subdomain, sld, tld = extract_sld_and_tld(cleaned)
            meta["domain"] = cleaned
            meta["subdomain"] = subdomain
            meta["sld"] = sld
            meta["tld"] = tld
            return cleaned, meta

        elif asset_type == CandidateAssetType.URL:
            parsed_raw = urllib.parse.urlparse(raw)
            if parsed_raw.scheme:
                scheme = parsed_raw.scheme.lower()
                if scheme not in ("http", "https"):
                    raise ValueError(
                        f"Unsupported or unsafe URL scheme: '{parsed_raw.scheme}'. "
                        f"Only http and https are allowed."
                    )
                url_to_parse = raw
            else:
                url_to_parse = f"http://{raw}"

            parsed = urllib.parse.urlparse(url_to_parse)
            host = parsed.netloc.lower()
            if not host:
                raise ValueError("URL must include a valid host/domain name.")

            if ":" in host:
                host = host.split(":")[0]

            subdomain, sld, tld = extract_sld_and_tld(host)
            path = parsed.path or "/"
            normalized = f"{parsed.scheme.lower()}://{host}{path}"
            meta["host"] = host
            meta["path"] = path
            meta["query"] = parsed.query
            meta["subdomain"] = subdomain
            meta["sld"] = sld
            meta["tld"] = tld
            return normalized, meta

        elif asset_type == CandidateAssetType.SOCIAL_PROFILE:
            cleaned = raw
            if "://" in cleaned or "/" in cleaned:
                parts = cleaned.rstrip("/").split("/")
                cleaned = parts[-1]
            cleaned = cleaned.lstrip("@").strip().lower()
            if not cleaned:
                raise ValueError("Social profile handle cannot be empty.")
            meta["handle"] = cleaned
            return f"@{cleaned}", meta

        elif asset_type == CandidateAssetType.APP_LISTING:
            cleaned = " ".join(raw.split())
            if not cleaned:
                raise ValueError("App listing title cannot be empty.")
            meta["app_name"] = cleaned
            return cleaned, meta

        else:
            raise ValueError(f"Unsupported candidate asset type: {asset_type}")

    # -----------------------------------------------------------------------
    # Official Asset Recognition (Requirement 8)
    # -----------------------------------------------------------------------

    def is_official_asset(
        self,
        asset_type: CandidateAssetType,
        normalized_value: str,
        meta: Dict[str, Any],
        brand: BrandAssetContext
    ) -> bool:
        """
        Check if the normalized candidate matches registered official brand assets.
        Must return True only for genuine official assets, preventing false flags.
        """
        if asset_type == CandidateAssetType.DOMAIN:
            target_domain = meta.get("domain", "").lower().strip(".")
            for official_d in brand.official_domains:
                clean_official = official_d.lower().strip().split("/")[0].split(":")[0].strip(".")
                if target_domain == clean_official:
                    return True
                # Match if candidate has 'www.' prefix of official or vice versa
                if target_domain.startswith("www.") and target_domain[4:] == clean_official:
                    return True
                if clean_official.startswith("www.") and clean_official[4:] == target_domain:
                    return True

        elif asset_type == CandidateAssetType.URL:
            target_url = normalized_value.lower()
            for official_u in brand.official_urls:
                clean_u = official_u.lower().rstrip("/")
                if target_url.startswith(clean_u):
                    return True
            # Also check if the URL host matches an official domain
            host = meta.get("host", "").lower().strip(".")
            for official_d in brand.official_domains:
                clean_official = official_d.lower().strip().split("/")[0].split(":")[0].strip(".")
                if host == clean_official or (host.startswith("www.") and host[4:] == clean_official):
                    return True

        elif asset_type == CandidateAssetType.SOCIAL_PROFILE:
            handle = meta.get("handle", "").lower()
            for official_h in brand.official_social_handles:
                clean_h = official_h.lower().lstrip("@").strip()
                if "/" in clean_h:
                    clean_h = clean_h.rstrip("/").split("/")[-1]
                if handle == clean_h:
                    return True

        elif asset_type == CandidateAssetType.APP_LISTING:
            app_name = meta.get("app_name", "").strip().lower()
            for official_app in brand.official_app_names:
                if app_name == official_app.strip().lower():
                    return True
            # If official brand name exactly matches app name
            if brand.name and app_name == brand.name.strip().lower():
                return True

        return False

    # -----------------------------------------------------------------------
    # Core Analysis & Scoring
    # -----------------------------------------------------------------------

    def analyze(
        self,
        candidate_type: Union[str, CandidateAssetType],
        candidate_value: str,
        brand_id: Optional[int] = None,
        brand: Optional[Union[Brand, BrandAssetContext]] = None,
        evidence: Optional[Union[Dict[str, Any], CandidateEvidence]] = None,
        db: Optional[Session] = None
    ) -> RiskAnalysisResult:
        """
        Analyze a candidate domain, URL, social profile, or app listing against
        the target brand and return explainable indicators, composite score,
        score band category, and actionable recommendations.
        """
        typed_asset = normalize_asset_type(candidate_type)
        normalized_value, meta = self.normalize_candidate(typed_asset, candidate_value)

        # 1. Resolve brand context
        brand_context: Optional[BrandAssetContext] = None
        if isinstance(brand, BrandAssetContext):
            brand_context = brand
        elif isinstance(brand, Brand):
            brand_context = BrandAssetContext.from_orm(brand)
        elif brand_id is not None:
            if db is not None:
                db_brand = db.query(Brand).filter(Brand.id == brand_id).first()
                if not db_brand:
                    raise ValueError(f"Associated Brand ID {brand_id} not found.")
                brand_context = BrandAssetContext.from_orm(db_brand)
            else:
                brand_context = BrandAssetContext(brand_id=brand_id, name="")

        # 2. Normalize evidence
        evidence_obj: CandidateEvidence
        if isinstance(evidence, CandidateEvidence):
            evidence_obj = evidence
        elif isinstance(evidence, dict):
            evidence_obj = CandidateEvidence(
                redirect_url=evidence.get("redirect_url"),
                final_destination_url=evidence.get("final_destination_url"),
                displayed_url=evidence.get("displayed_url"),
                threat_intel_reports=evidence.get("threat_intel_reports"),
                external_source_name=evidence.get("external_source_name"),
            )
        else:
            evidence_obj = CandidateEvidence()

        evidence_sources_evaluated: Dict[str, Any] = {
            "engine": "risk_scoring_service_v1",
            "static_analysis": True,
            "redirect_evidence": "supplied" if (evidence_obj.redirect_url or evidence_obj.final_destination_url) else "not_provided",
            "external_threat_intel": {
                "configured": self.threat_intel_provider is not None or bool(evidence_obj.threat_intel_reports),
                "source": (
                    evidence_obj.external_source_name or
                    (type(self.threat_intel_provider).__name__ if self.threat_intel_provider else "none")
                ),
                "status": "evaluated" if (self.threat_intel_provider or evidence_obj.threat_intel_reports) else "not_configured",
                "detail": (
                    "Verified external threat intelligence source active."
                    if (self.threat_intel_provider or evidence_obj.threat_intel_reports)
                    else "No external threat intelligence source configured; missing evidence is not treated as proof of malicious activity."
                )
            },
            "ai_models": {
                "configured": False,
                "status": "not_configured",
                "detail": "No AI prediction model configured. Static heuristic risk scoring utilized."
            }
        }

        # 3. Check if candidate is an official registered asset (Requirement 8)
        if brand_context and self.is_official_asset(typed_asset, normalized_value, meta, brand_context):
            official_indicator = {
                "code": "OFFICIAL_ASSET_VERIFIED",
                "name": "Official Registered Asset",
                "severity": "info",
                "score_impact": 0,
                "explanation": (
                    f"Candidate matches officially verified registered asset for '{brand_context.name}'. "
                    f"Verified assets are never flagged as impersonators."
                )
            }
            return RiskAnalysisResult(
                score=0,
                category="Low",
                candidate_type=typed_asset.value,
                candidate_value=candidate_value.strip(),
                normalized_value=normalized_value,
                is_official_asset=True,
                indicators=[official_indicator],
                explanations=[official_indicator["explanation"]],
                evidence_source=evidence_sources_evaluated,
                recommended_action="No action required: verified official brand asset.",
                disclaimer=(
                    "Scores are preliminary risk indicators, not proof of fraud. "
                    "Further human verification and technical review are required before enforcement actions."
                ),
                brand_id=brand_context.brand_id,
                brand_name=brand_context.name
            )

        # 4. Generate Explainable Indicators
        indicators: List[Dict[str, Any]] = []

        # Target token for brand comparison
        target_token = ""
        target_stem = ""
        if typed_asset == CandidateAssetType.DOMAIN:
            target_token = meta.get("domain", normalized_value)
            target_stem = meta.get("sld", target_token.split(".")[0])
        elif typed_asset == CandidateAssetType.URL:
            target_token = meta.get("host", "")
            target_stem = meta.get("sld", target_token.split(".")[0])
        elif typed_asset == CandidateAssetType.SOCIAL_PROFILE:
            target_token = meta.get("handle", normalized_value.lstrip("@"))
            target_stem = target_token
        elif typed_asset == CandidateAssetType.APP_LISTING:
            target_token = meta.get("app_name", normalized_value)
            target_stem = target_token

        brand_name_str = brand_context.name.strip() if brand_context else ""
        clean_brand_name = clean_alphanumeric(brand_name_str) if brand_name_str else ""
        clean_target_stem = clean_alphanumeric(target_stem)

        # Build comparison targets from brand name and registered official domain stems
        comparison_targets: set[str] = set()
        if clean_brand_name:
            comparison_targets.add(clean_brand_name)
            for word in brand_name_str.split():
                clean_w = clean_alphanumeric(word)
                if len(clean_w) >= 4:
                    comparison_targets.add(clean_w)

        if brand_context and brand_context.official_domains:
            for off_d in brand_context.official_domains:
                _, off_sld, _ = extract_sld_and_tld(off_d)
                clean_off_sld = clean_alphanumeric(off_sld)
                if clean_off_sld and len(clean_off_sld) >= 3:
                    comparison_targets.add(clean_off_sld)

        # Build candidate tokens to inspect (including sub-tokens from hyphenated hostnames)
        candidate_tokens: set[str] = set()
        if clean_target_stem:
            candidate_tokens.add(clean_target_stem)
        for part in re.split(r"[-_\.]", target_stem):
            clean_p = clean_alphanumeric(part)
            if len(clean_p) >= 3:
                candidate_tokens.add(clean_p)

        # --- A. Brand Name Similarity: Edit Distance & Homoglyphs ---
        homoglyph_detected = False
        typosquat_1_detected = False
        typosquat_2_detected = False

        for cand_tok in candidate_tokens:
            for target_ref in comparison_targets:
                # Check Homoglyphs
                norm_cand = normalize_homoglyphs(cand_tok)
                norm_target = normalize_homoglyphs(target_ref)
                is_homoglyph = (norm_cand == norm_target and cand_tok != target_ref)
                if not homoglyph_detected and is_homoglyph:
                    homoglyph_detected = True
                    indicators.append({
                        "code": "HOMOGLYPH_SUBSTITUTION",
                        "name": "Homoglyph Character Substitution",
                        "severity": "high",
                        "score_impact": self.weights.homoglyph_substitution,
                        "explanation": (
                            f"Substituted visual lookalikes detected (e.g. '0' for 'o', '1' for 'l') mimicking '{target_ref}'."
                        )
                    })

                # Check Edit Distance only if this token is not already a homoglyph match
                if not is_homoglyph:
                    dist = compute_levenshtein_distance(cand_tok, target_ref)
                    if not typosquat_1_detected and dist == 1 and len(target_ref) > 3 and cand_tok != target_ref:
                        typosquat_1_detected = True
                        indicators.append({
                            "code": "TYPOSQUAT_DISTANCE_1",
                            "name": "High-Confidence Typosquatting",
                            "severity": "high",
                            "score_impact": self.weights.typosquat_dist_1,
                            "explanation": (
                                f"Candidate token '{cand_tok}' is a single character edit from official brand target '{target_ref}'."
                            )
                        })
                    elif not typosquat_1_detected and not typosquat_2_detected and dist == 2 and len(target_ref) > 5 and cand_tok != target_ref:
                        typosquat_2_detected = True
                        indicators.append({
                            "code": "TYPOSQUAT_DISTANCE_2",
                            "name": "Potential Lookalike Typosquatting",
                            "severity": "medium",
                            "score_impact": self.weights.typosquat_dist_2,
                            "explanation": (
                                f"Candidate token '{cand_tok}' has an edit distance of 2 from official brand target '{target_ref}'."
                            )
                        })

        # --- B. Candidate Domain vs Official Domains Similarity ---
        if brand_context and brand_context.official_domains and typed_asset in (CandidateAssetType.DOMAIN, CandidateAssetType.URL):
            candidate_sld = meta.get("sld", "").lower()
            candidate_tld = meta.get("tld", "").lower()

            for official_d in brand_context.official_domains:
                _, off_sld, off_tld = extract_sld_and_tld(official_d)
                off_sld = off_sld.lower()
                off_tld = off_tld.lower()

                # TLD Swap Squatting: exact SLD matches official domain SLD, but TLD is different
                if candidate_sld and off_sld and candidate_sld == off_sld and candidate_tld and off_tld and candidate_tld != off_tld:
                    if candidate_tld in SUSPICIOUS_TLDS:
                        indicators.append({
                            "code": "TLD_SWAP_SQUATTING",
                            "name": "Abuse-Prone TLD Swap Squatting",
                            "severity": "high",
                            "score_impact": self.weights.tld_swap_suspicious,
                            "explanation": (
                                f"Candidate domain uses identical stem '{candidate_sld}' to official domain '{official_d}' "
                                f"under abuse-prone TLD '.{candidate_tld}'."
                            )
                        })
                    else:
                        indicators.append({
                            "code": "TLD_SWAP_SQUATTING",
                            "name": "Alternative TLD Swap Squatting",
                            "severity": "medium",
                            "score_impact": self.weights.tld_swap_standard,
                            "explanation": (
                                f"Candidate domain uses identical stem '{candidate_sld}' to official domain '{official_d}' "
                                f"under alternative TLD '.{candidate_tld}'."
                            )
                        })
                    break

        # --- C. Deceptive Keywords ---
        search_kw_text = target_token.lower()
        if typed_asset == CandidateAssetType.URL:
            search_kw_text = f"{search_kw_text} {meta.get('path', '').lower()} {meta.get('query', '').lower()}"

        found_keywords = [kw for kw in DECEPTIVE_KEYWORDS if kw in search_kw_text]
        if found_keywords:
            if len(found_keywords) > 1:
                kw_impact = self.weights.deceptive_keyword_multi_max
                kw_severity = "high"
            else:
                kw_impact = self.weights.deceptive_keyword_single
                kw_severity = "medium"

            indicators.append({
                "code": "DECEPTIVE_SECURITY_KEYWORD",
                "name": "Deceptive Phishing / Security Keywords",
                "severity": kw_severity,
                "score_impact": kw_impact,
                "explanation": (
                    f"Candidate contains sensitive credential/auth keywords: {', '.join(sorted(found_keywords))}."
                )
            })

        # --- D. Subdomain Spoofing, Abuse-Prone TLDs, and Hyphens ---
        if typed_asset in (CandidateAssetType.DOMAIN, CandidateAssetType.URL):
            subdomain = meta.get("subdomain", "").lower()
            sld = meta.get("sld", "").lower()
            tld = meta.get("tld", "").lower()
            full_host = meta.get("host") or meta.get("domain", "")

            # Subdomain Brand Spoofing
            if brand_name_str and clean_brand_name:
                clean_subdomain = clean_alphanumeric(subdomain)
                clean_sld = clean_alphanumeric(sld)
                if clean_brand_name in clean_subdomain and clean_brand_name not in clean_sld:
                    indicators.append({
                        "code": "SUBDOMAIN_SPOOFING",
                        "name": "Subdomain Brand Spoofing",
                        "severity": "critical",
                        "score_impact": self.weights.subdomain_spoofing,
                        "explanation": (
                            f"Brand name '{brand_name_str}' appears in subdomain prefix while host root is '{sld}.{tld}'."
                        )
                    })

            # Suspicious TLD check
            if tld in SUSPICIOUS_TLDS:
                # Avoid duplicate TLD flags if TLD swap already recorded it
                if not any(i["code"] == "TLD_SWAP_SQUATTING" and "Abuse-Prone" in i["name"] for i in indicators):
                    indicators.append({
                        "code": "SUSPICIOUS_TLD",
                        "name": "Abuse-Prone Top-Level Domain",
                        "severity": "medium",
                        "score_impact": self.weights.suspicious_tld,
                        "explanation": (
                            f"Domain utilizes TLD '.{tld}', statistically associated with high phishing abuse rates."
                        )
                    })

            # Excessive hyphens
            hyphen_count = full_host.count("-")
            has_suspicious_context = (
                bool(clean_brand_name and clean_brand_name in clean_alphanumeric(full_host)) or
                bool(found_keywords) or
                bool(indicators)
            )
            if hyphen_count >= 2 and has_suspicious_context:
                indicators.append({
                    "code": "EXCESSIVE_HYPHENS",
                    "name": "Deceptive Hyphenation Pattern",
                    "severity": "low",
                    "score_impact": self.weights.excessive_hyphens,
                    "explanation": (
                        f"Hostname contains {hyphen_count} hyphens commonly used to bypass domain brand filters."
                    )
                })

        # --- E. Suspicious Social Media Profile Heuristics ---
        if typed_asset == CandidateAssetType.SOCIAL_PROFILE:
            handle_lower = meta.get("handle", "").lower()
            matched_social_terms = [t for t in SUSPICIOUS_SOCIAL_KEYWORDS if t in handle_lower]
            if brand_name_str and clean_brand_name in clean_alphanumeric(handle_lower) and matched_social_terms:
                indicators.append({
                    "code": "SUSPICIOUS_SOCIAL_PROFILE",
                    "name": "Suspicious Brand Profile Modifier",
                    "severity": "high",
                    "score_impact": self.weights.suspicious_social_modifier,
                    "explanation": (
                        f"Social media profile handle '@{handle_lower}' incorporates brand name with high-risk keyword(s): "
                        f"{', '.join(matched_social_terms)}."
                    )
                })

        # --- F. Suspicious App Listing Heuristics ---
        if typed_asset == CandidateAssetType.APP_LISTING:
            app_lower = meta.get("app_name", "").lower()
            found_app_terms = [t for t in SUSPICIOUS_APP_MODIFIERS if t in app_lower]
            if found_app_terms:
                indicators.append({
                    "code": "SUSPICIOUS_APP_TITLE_MODIFIER",
                    "name": "Suspicious Mobile App Modifier",
                    "severity": "high",
                    "score_impact": self.weights.suspicious_app_modifier,
                    "explanation": (
                        f"App title contains unauthorized modifiers: {', '.join(found_app_terms)}."
                    )
                })

        # --- G. Supplied Redirect or URL Mismatch (Only when evidence is available) ---
        redirect_dest = evidence_obj.redirect_url or evidence_obj.final_destination_url
        if redirect_dest:
            try:
                parsed_redirect = urllib.parse.urlparse(redirect_dest if "://" in redirect_dest else f"http://{redirect_dest}")
                redirect_host = (parsed_redirect.netloc or redirect_dest).lower().split(":")[0].strip(".")
                candidate_host = (meta.get("host") or meta.get("domain", "")).lower().split(":")[0].strip(".")

                # Check if redirect destination matches official domains
                is_redirect_official = False
                if brand_context:
                    for official_d in brand_context.official_domains:
                        clean_off = official_d.lower().strip().split("/")[0].split(":")[0].strip(".")
                        if redirect_host == clean_off or (redirect_host.startswith("www.") and redirect_host[4:] == clean_off):
                            is_redirect_official = True
                            break

                if redirect_host and redirect_host != candidate_host and not is_redirect_official:
                    indicators.append({
                        "code": "REDIRECT_URL_MISMATCH",
                        "name": "Suspicious Destination URL Redirect",
                        "severity": "high",
                        "score_impact": self.weights.redirect_mismatch,
                        "explanation": (
                            f"Candidate redirects to unverified destination '{redirect_host}', "
                            f"which differs from initial host '{candidate_host}' and is not a registered official domain."
                        )
                    })
                elif is_redirect_official:
                    indicators.append({
                        "code": "REDIRECT_TO_OFFICIAL_ASSET",
                        "name": "Redirects to Verified Brand Domain",
                        "severity": "info",
                        "score_impact": 0,
                        "explanation": f"Supplied redirect successfully terminates at official brand domain '{redirect_host}'."
                    })
            except Exception as e:
                logger.warning(f"Failed to parse supplied redirect URL: {e}")

        # Displayed vs Destination URL Mismatch (Phishing link masquerading)
        if evidence_obj.displayed_url:
            try:
                parsed_disp = urllib.parse.urlparse(
                    evidence_obj.displayed_url if "://" in evidence_obj.displayed_url else f"http://{evidence_obj.displayed_url}"
                )
                disp_host = (parsed_disp.netloc or evidence_obj.displayed_url).lower().split(":")[0].strip(".")
                dest_host = (meta.get("host") or meta.get("domain", "")).lower().split(":")[0].strip(".")

                if disp_host and dest_host and disp_host != dest_host:
                    indicators.append({
                        "code": "DISPLAYED_URL_MISMATCH",
                        "name": "Displayed vs Destination URL Mismatch",
                        "severity": "high",
                        "score_impact": self.weights.displayed_url_mismatch,
                        "explanation": (
                            f"Displayed link text '{disp_host}' does not match actual destination host '{dest_host}'."
                        )
                    })
            except Exception as e:
                logger.warning(f"Failed to evaluate displayed URL mismatch: {e}")

        # --- H. Verified External Threat Intelligence (Only when configured source supplies it) ---
        threat_intel_finding: Optional[Dict[str, Any]] = None
        if self.threat_intel_provider:
            try:
                threat_intel_finding = self.threat_intel_provider.check_threat(
                    candidate_type=typed_asset.value,
                    candidate_value=normalized_value
                )
            except Exception as e:
                logger.warning(f"External threat intelligence provider failed: {e}")

        if not threat_intel_finding and evidence_obj.threat_intel_reports:
            for rep in evidence_obj.threat_intel_reports:
                if rep.get("verified_threat") or rep.get("is_malicious"):
                    threat_intel_finding = rep
                    break

        if threat_intel_finding:
            source_label = threat_intel_finding.get("source", evidence_obj.external_source_name or "Verified Threat Intel")
            threat_type = threat_intel_finding.get("threat_type", "malicious domain")
            indicators.append({
                "code": "EXTERNAL_THREAT_INTEL_MATCH",
                "name": "Verified External Threat Intelligence Match",
                "severity": "critical",
                "score_impact": self.weights.verified_threat_intel,
                "explanation": (
                    f"Verified external intelligence from '{source_label}' confirms active threat: {threat_type}."
                )
            })

        has_name_mention = bool(
            brand_name_str and (
                (clean_brand_name and clean_brand_name in clean_alphanumeric(target_token)) or
                any(t in clean_alphanumeric(target_token) for t in comparison_targets if len(t) >= 4)
            )
        )
        if has_name_mention:
            if not indicators:
                indicators.append({
                    "code": "NAME_MENTION_UNVERIFIED",
                    "name": "Brand Name Mentioned",
                    "severity": "low",
                    "score_impact": self.weights.benign_brand_mention,
                    "explanation": (
                        "Target references brand name but exhibits no deceptive keywords, typosquatting, "
                        "or homoglyphs. Preliminary low-risk mention only."
                    )
                })
        elif not indicators:
            indicators.append({
                "code": "NO_ANOMALOUS_INDICATORS",
                "name": "Standard Inspection Passed",
                "severity": "info",
                "score_impact": 0,
                "explanation": "No suspicious typosquatting, homoglyphs, or spoofing patterns observed in rule evaluation."
            })

        # 5. Composite Score Calculation (Requirement 5)
        raw_score = sum(ind["score_impact"] for ind in indicators)
        final_score = max(0, min(100, raw_score))

        # 6. Score Band Category (Requirement 6)
        risk_category = self.score_bands.get_category(final_score)

        # 7. Recommended Next Action (Requirement 7)
        recommended_action: str
        if risk_category == "Critical":
            recommended_action = (
                "Immediate triage and mitigation: active high-confidence impersonation/phishing indicators; "
                "initiate takedown or security blocking."
            )
        elif risk_category == "High":
            recommended_action = (
                "Urgent analyst investigation: high likelihood of deceptive intent; "
                "verify asset ownership and gather technical WHOIS/DNS evidence."
            )
        elif risk_category == "Medium":
            recommended_action = (
                "Queue for scheduled review: moderate similarity or isolated indicator detected; "
                "monitor for infrastructure changes."
            )
        else:
            recommended_action = (
                "Monitor asset: low preliminary risk; maintain routine observation."
            )

        explanations = [ind["explanation"] for ind in indicators]

        return RiskAnalysisResult(
            score=final_score,
            category=risk_category,
            candidate_type=typed_asset.value,
            candidate_value=candidate_value.strip(),
            normalized_value=normalized_value,
            is_official_asset=False,
            indicators=indicators,
            explanations=explanations,
            evidence_source=evidence_sources_evaluated,
            recommended_action=recommended_action,
            disclaimer=(
                "Scores are preliminary risk indicators, not proof of fraud. "
                "Further human verification and technical review are required before enforcement actions."
            ),
            brand_id=brand_context.brand_id if brand_context else None,
            brand_name=brand_context.name if brand_context else None
        )


# Global reusable instance
risk_scoring_service = RiskScoringService()
