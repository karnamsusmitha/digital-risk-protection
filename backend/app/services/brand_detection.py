"""
Digital Risk Protection - AI-Based Brand Impersonation Detection Engine
Task 2 Implementation

Provides modular, explainable, and testable functions for:
1. Brand text normalization and canonicalization.
2. Homoglyph, leetspeak, and visual look-alike character substitution detection.
3. Deterministic string similarity computation (Levenshtein, SequenceMatcher, token Jaccard).
4. Suspicious domain variation detection (typosquatting, combosquatting, deceptive subdomains, TLD swaps).
5. Explainable risk scoring (0 to 100) ensuring brand resemblance alone never classifies an asset as malicious.
"""

from dataclasses import dataclass, field
import difflib
import re
import unicodedata
from typing import Optional, List, Dict, Any, Tuple
from urllib.parse import urlparse


# ============================================================================
# High-Risk Impersonation Constants
# ============================================================================

# Security and credential-harvesting keywords commonly combined with brand names
HIGH_RISK_COMBOSQUAT_KEYWORDS = [
    "login",
    "signin",
    "sign-in",
    "auth",
    "authenticate",
    "verify",
    "verification",
    "secure",
    "security",
    "portal",
    "account",
    "support",
    "billing",
    "invoice",
    "update",
    "banking",
    "helpdesk",
    "payment",
    "pay",
    "webmail",
    "mail",
    "service",
    "client",
    "member",
    "app",
    "online",
    "connect",
    "recover",
    "wallet",
]

# High-abuse or risky TLDs commonly used in brand impersonation campaigns
RISKY_TLDS = {
    "xyz", "top", "work", "click", "cc", "ru", "cn", "gq", "cf", "tk", "ml", "ga",
    "buzz", "rest", "fit", "surf", "casa", "bar", "icu", "club", "vip", "link",
}

# Unicode / Cyrillic / Greek to ASCII Homoglyph mapping
HOMOGLYPH_MAP: Dict[str, str] = {
    # Cyrillic lookalikes
    "а": "a",  # U+0430
    "с": "c",  # U+0441
    "е": "e",  # U+0435
    "і": "i",  # U+0456
    "ј": "j",  # U+0458
    "о": "o",  # U+043E
    "р": "p",  # U+0440
    "ѕ": "s",  # U+0455
    "у": "y",  # U+0443
    "х": "x",  # U+0445
    "ԁ": "d",  # U+0501
    "ԛ": "q",  # U+051B
    "ԝ": "w",  # U+051D
    # Greek lookalikes
    "α": "a",
    "β": "b",
    "ε": "e",
    "ι": "i",
    "κ": "k",
    "ν": "v",
    "ο": "o",
    "ρ": "p",
    "τ": "t",
    "υ": "u",
    "χ": "x",
}

# Common Leetspeak character substitutions
LEETSPEAK_MAP: Dict[str, str] = {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "8": "b",
    "@": "a",
    "$": "s",
    "!": "i",
}

# Corporate legal designators stripped during brand normalization
CORPORATE_SUFFIXES = [
    "inc", "incorporated", "corp", "corporation", "llc", "ltd", "limited",
    "gmbh", "co", "company", "group", "holdings", "solutions", "services",
    "global", "payments",
]


# ============================================================================
# Dataclasses & Result Models
# ============================================================================

@dataclass
class BrandImpersonationResult:
    candidate_name: Optional[str]
    candidate_domain: Optional[str]
    matched_brand: Optional[str]
    matched_official_domain: Optional[str]
    name_similarity: float
    is_name_lookalike: bool
    is_domain_variation: bool
    variation_types: List[str] = field(default_factory=list)
    homoglyphs_detected: List[str] = field(default_factory=list)
    is_official_match: bool = False
    risk_score: float = 0.0
    severity: str = "LOW"
    reasons: List[str] = field(default_factory=list)
    evidence: Dict[str, Any] = field(default_factory=dict)
    remediation_guidance: str = "Continue passive monitoring."


# ============================================================================
# 1. Text Normalization & Canonicalization
# ============================================================================

def normalize_brand_text(text: Optional[str], strip_suffixes: bool = True) -> str:
    """
    Normalizes a brand or entity name into a clean canonical string:
    - Normalizes unicode NFKD form and strips non-spacing marks.
    - Converts to lowercase.
    - Replaces hyphens, underscores, and punctuation with spaces.
    - Strips corporate legal suffixes (e.g. 'Inc', 'LLC', 'Corp').
    - Collapses consecutive whitespace.
    """
    if not text or not isinstance(text, str):
        return ""

    # Normalize unicode diacritics
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in normalized if not unicodedata.combining(c))

    # Lowercase and clean characters
    cleaned = ascii_text.lower().strip()
    cleaned = re.sub(r"[^\w\s]", " ", cleaned)
    tokens = cleaned.split()

    if strip_suffixes and len(tokens) > 1:
        # Strip trailing corporate designators if preceded by brand name
        while tokens and tokens[-1] in CORPORATE_SUFFIXES:
            tokens.pop()

    return " ".join(tokens)


def canonicalize_for_similarity(text: Optional[str]) -> str:
    """
    Produces a condensed alphanumeric string with leetspeak and homoglyphs mapped,
    useful for catching 'acm3', 'a-c-m-e', or 'pаypal'.
    """
    if not text:
        return ""
    val = text.lower().strip()

    # Map homoglyphs
    chars = []
    for char in val:
        if char in HOMOGLYPH_MAP:
            chars.append(HOMOGLYPH_MAP[char])
        elif char in LEETSPEAK_MAP:
            chars.append(LEETSPEAK_MAP[char])
        elif char.isalnum():
            chars.append(char)
    return "".join(chars)


# ============================================================================
# 2. String Similarity Computation
# ============================================================================

def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes exact Levenshtein edit distance between two strings."""
    if s1 == s2:
        return 0
    if not s1:
        return len(s2)
    if not s2:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (0 if c1 == c2 else 1)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def compute_string_similarity(s1: str, s2: str) -> float:
    """
    Computes deterministic string similarity ratio in [0.0, 1.0].
    Combines Levenshtein ratio, Python SequenceMatcher, sorted token matching,
    token Dice, token Jaccard, and canonical leetspeak distance.
    """
    if not s1 or not s2:
        return 0.0

    s1_clean = normalize_brand_text(s1)
    s2_clean = normalize_brand_text(s2)

    if s1_clean == s2_clean:
        return 1.0

    # 1. Levenshtein ratio
    max_len = max(len(s1_clean), len(s2_clean))
    lev_ratio = 1.0 - (levenshtein_distance(s1_clean, s2_clean) / max_len) if max_len > 0 else 0.0

    # 2. SequenceMatcher ratio (handles common blocks and substring alignment)
    seq_ratio = difflib.SequenceMatcher(None, s1_clean, s2_clean).ratio()

    # 3. Sorted token match (handles token reordering e.g. 'Acme Cyber Security' vs 'Security Acme Cyber')
    tokens1 = s1_clean.split()
    tokens2 = s2_clean.split()
    sorted1 = " ".join(sorted(tokens1))
    sorted2 = " ".join(sorted(tokens2))
    if sorted1 == sorted2 and sorted1:
        sorted_ratio = 1.0
    else:
        sorted_ratio = difflib.SequenceMatcher(None, sorted1, sorted2).ratio()

    # 4. Token Jaccard and Dice coefficients
    set1 = set(tokens1)
    set2 = set(tokens2)
    common_tokens = len(set1 & set2)
    total_unique = len(set1 | set2)
    total_tokens = len(tokens1) + len(tokens2)

    jaccard = (common_tokens / total_unique) if total_unique > 0 else 0.0
    dice = (2.0 * common_tokens / total_tokens) if total_tokens > 0 else 0.0

    # 5. Canonical / leetspeak ratio
    c1 = canonicalize_for_similarity(s1)
    c2 = canonicalize_for_similarity(s2)
    c_max = max(len(c1), len(c2))
    canon_ratio = 1.0 - (levenshtein_distance(c1, c2) / c_max) if c_max > 0 else 0.0

    best_score = max(lev_ratio, seq_ratio, sorted_ratio, jaccard, dice, canon_ratio)
    return round(max(0.0, min(1.0, best_score)), 3)


def detect_homoglyphs(text: str) -> Tuple[bool, str, List[str]]:
    """
    Inspects string for foreign homoglyphs and leetspeak numbers in brand context.
    Returns (has_homoglyphs, decoded_text, detected_characters).
    """
    if not text:
        return False, "", []

    detected = []
    decoded_chars = []
    for c in text:
        if c in HOMOGLYPH_MAP:
            detected.append(f"Unicode homoglyph '{c}' (U+{ord(c):04X}) -> '{HOMOGLYPH_MAP[c]}'")
            decoded_chars.append(HOMOGLYPH_MAP[c])
        elif c in LEETSPEAK_MAP and c.isdigit():
            detected.append(f"Leetspeak number '{c}' -> '{LEETSPEAK_MAP[c]}'")
            decoded_chars.append(LEETSPEAK_MAP[c])
        else:
            decoded_chars.append(c)

    has_homoglyphs = len(detected) > 0
    return has_homoglyphs, "".join(decoded_chars), detected


# ============================================================================
# 3. Look-Alike Brand Name Detection
# ============================================================================

def detect_lookalike_brand_name(
    candidate_name: Optional[str],
    official_brand_names: List[str],
    similarity_threshold: float = 0.70,
) -> Dict[str, Any]:
    """
    Compares a candidate brand name against a list of official brand names.
    Returns structured analysis with highest match, similarity score,
    homoglyphs, and variation classification.
    """
    if not candidate_name or not official_brand_names:
        return {
            "is_lookalike": False,
            "is_exact_match": False,
            "matched_brand": None,
            "similarity": 0.0,
            "homoglyphs": [],
            "reasons": [],
        }

    cand_norm = normalize_brand_text(candidate_name)
    has_homoglyphs, decoded_name, homoglyph_details = detect_homoglyphs(candidate_name)

    best_match = None
    best_sim = 0.0
    is_exact = False
    reasons = []

    for brand in official_brand_names:
        if not brand:
            continue
        brand_norm = normalize_brand_text(brand)
        if not brand_norm:
            continue

        # Exact match check
        if cand_norm == brand_norm:
            return {
                "is_lookalike": False,
                "is_exact_match": True,
                "matched_brand": brand,
                "similarity": 1.0,
                "homoglyphs": homoglyph_details,
                "reasons": [f"Exact match to official brand name '{brand}'."],
            }

        # Calculate similarity against raw and decoded variant
        sim_raw = compute_string_similarity(candidate_name, brand)
        sim_decoded = compute_string_similarity(decoded_name, brand)
        sim = max(sim_raw, sim_decoded)

        if sim > best_sim:
            best_sim = sim
            best_match = brand

    is_lookalike = (best_sim >= similarity_threshold and not is_exact) or has_homoglyphs

    if has_homoglyphs and best_match:
        reasons.append(
            f"Detected homoglyph/leetspeak character substitution imitating '{best_match}': "
            f"{', '.join(homoglyph_details[:2])}."
        )

    if is_lookalike and best_match:
        reasons.append(
            f"High brand name similarity: {best_sim:.2f} resembling official brand '{best_match}'."
        )

    return {
        "is_lookalike": is_lookalike,
        "is_exact_match": is_exact,
        "matched_brand": best_match,
        "similarity": best_sim,
        "homoglyphs": homoglyph_details,
        "reasons": reasons,
    }


# ============================================================================
# 4. Domain Normalization & Component Extraction
# ============================================================================

def normalize_domain_for_comparison(domain_or_url: Optional[str]) -> str:
    """Normalizes URL, host, or domain string to a clean lower-case hostname."""
    if not domain_or_url or not isinstance(domain_or_url, str):
        return ""

    val = domain_or_url.strip().lower()
    if "://" not in val:
        val = f"http://{val}"

    try:
        parsed = urlparse(val)
        host = parsed.netloc or parsed.path
    except Exception:
        host = val

    # Strip port, path, query
    host = host.split(":", 1)[0].split("/", 1)[0].split("?", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    return host.strip(".")


def extract_domain_components(domain_or_url: Optional[str]) -> Dict[str, str]:
    """
    Extracts subdomain, SLD (second-level domain), and TLD from domain or URL.
    Example: 'login.acme-corp.com' -> {'subdomain': 'login', 'sld': 'acme-corp', 'tld': 'com'}
    """
    host = normalize_domain_for_comparison(domain_or_url)
    if not host or "." not in host:
        return {"host": host, "subdomain": "", "sld": host, "tld": ""}

    parts = host.split(".")
    # Basic multi-part TLD handling (e.g. .co.uk, .com.au)
    if len(parts) >= 3 and parts[-2] in ("co", "com", "org", "net", "gov", "edu") and len(parts[-1]) == 2:
        tld = f"{parts[-2]}.{parts[-1]}"
        sld = parts[-3]
        subdomain = ".".join(parts[:-3])
    else:
        tld = parts[-1]
        sld = parts[-2]
        subdomain = ".".join(parts[:-2])

    return {
        "host": host,
        "subdomain": subdomain,
        "sld": sld,
        "tld": tld,
        "registered_domain": f"{sld}.{tld}" if sld and tld else host,
    }


# ============================================================================
# 5. Suspicious Domain Variation Detection
# ============================================================================

def detect_suspicious_domain_variation(
    candidate_domain: Optional[str],
    official_domains: List[str],
    brand_names: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Analyzes candidate domain against official domains and brand names for:
    1. Exact Match -> Legitimate official domain.
    2. Typosquatting -> 1-2 edit distance from official SLD.
    3. Combosquatting -> Official brand combined with security/phishing keywords.
    4. Deceptive Subdomain -> Brand appears as a subdomain on an external apex host.
    5. TLD Swap -> Exact brand SLD registered on an alternative or risky TLD.
    6. Homoglyphs / IDN Punycode spoofing in domain.
    """
    if not candidate_domain:
        return {
            "is_suspicious_variation": False,
            "is_official_match": False,
            "variation_types": [],
            "matched_official_domain": None,
            "similarity": 0.0,
            "reasons": [],
        }

    cand_components = extract_domain_components(candidate_domain)
    cand_host = cand_components["host"]
    cand_sld = cand_components["sld"]
    cand_sub = cand_components["subdomain"]
    cand_tld = cand_components["tld"]

    if not cand_host:
        return {
            "is_suspicious_variation": False,
            "is_official_match": False,
            "variation_types": [],
            "matched_official_domain": None,
            "similarity": 0.0,
            "reasons": [],
        }

    # Normalize official domains
    norm_official = [
        (orig, extract_domain_components(orig))
        for orig in official_domains
        if orig and normalize_domain_for_comparison(orig)
    ]

    # Clean brand tokens for combo-squatting detection
    brand_tokens = set()
    for b in (brand_names or []):
        cleaned = re.sub(r"[^\w]", "", normalize_brand_text(b))
        if len(cleaned) >= 3:
            brand_tokens.add(cleaned)

    # 1. Exact Match Check
    for orig, comps in norm_official:
        if cand_host == comps["host"]:
            return {
                "is_suspicious_variation": False,
                "is_official_match": True,
                "variation_types": ["official_asset_exact_match"],
                "matched_official_domain": orig,
                "similarity": 1.0,
                "reasons": [f"Exact match to official registered domain '{orig}'."],
            }

    # Also include official SLDs in brand tokens
    for _, comps in norm_official:
        if comps["sld"] and len(comps["sld"]) >= 3:
            brand_tokens.add(comps["sld"].replace("-", ""))

    variation_types: List[str] = []
    reasons: List[str] = []
    matched_domain: Optional[str] = None
    highest_sim = 0.0

    # 2. Check Deceptive Subdomain Spoofing
    # e.g., 'acme-corp.com.malicious-site.net' or 'acme.phishing-hub.org'
    if cand_sub:
        cand_sub_clean = cand_sub.replace("-", "").replace(".", "")
        for brand_token in brand_tokens:
            if brand_token in cand_sub_clean:
                variation_types.append("deceptive_subdomain_spoofing")
                reasons.append(
                    f"Deceptive Subdomain Spoofing: Brand identifier '{brand_token}' placed in subdomain "
                    f"'{cand_sub}' under external apex domain '{cand_components['registered_domain']}'."
                )
                break

    # 3. Check Homoglyphs / Punycode in Candidate Domain
    has_homoglyphs, _, homoglyph_details = detect_homoglyphs(cand_host)
    if has_homoglyphs or cand_host.startswith("xn--"):
        variation_types.append("homoglyph_domain_spoofing")
        reasons.append(
            f"Homoglyph/IDN spoofing in domain: {', '.join(homoglyph_details[:2]) if homoglyph_details else 'Punycode encoded domain'}."
        )

    # 4. Compare candidate SLD against each official domain SLD
    cand_sld_compact = cand_sld.replace("-", "")

    for orig, comps in norm_official:
        off_sld = comps["sld"]
        off_sld_compact = off_sld.replace("-", "")
        if not off_sld:
            continue

        sim = compute_string_similarity(cand_sld, off_sld)
        if sim > highest_sim:
            highest_sim = sim
            matched_domain = orig

        # A. TLD Swap (Exact SLD match on different TLD)
        if cand_sld_compact == off_sld_compact and cand_tld != comps["tld"]:
            if cand_tld in RISKY_TLDS:
                variation_types.append("risky_tld_swap")
                reasons.append(
                    f"High-Risk TLD Swap: Brand domain '{off_sld}' registered on high-abuse TLD '.{cand_tld}' "
                    f"(official TLD is '.{comps['tld']}')."
                )
            else:
                variation_types.append("tld_swap")
                reasons.append(
                    f"TLD Swap: Brand domain '{off_sld}' registered on alternative TLD '.{cand_tld}' "
                    f"(official TLD is '.{comps['tld']}')."
                )

        # B. Typosquatting (Edit distance 1 or 2 from official SLD)
        dist = levenshtein_distance(cand_sld_compact, off_sld_compact)
        if 1 <= dist <= 2 and abs(len(cand_sld_compact) - len(off_sld_compact)) <= 2:
            variation_types.append("typosquatting")
            reasons.append(
                f"Typosquatting: Candidate domain SLD '{cand_sld}' is {dist} character edit(s) "
                f"from official domain '{off_sld}'."
            )

        # C. Combosquatting (Official SLD or Brand combined with security/login keywords)
        has_brand_in_sld = (off_sld_compact in cand_sld_compact) or any(bt in cand_sld_compact for bt in brand_tokens)
        if has_brand_in_sld and cand_sld_compact != off_sld_compact:
            matched_keywords = [
                kw for kw in HIGH_RISK_COMBOSQUAT_KEYWORDS
                if kw in cand_sld.replace("_", "-").split("-") or kw in cand_sld
            ]
            if matched_keywords:
                variation_types.append("combosquatting_credential_harvesting")
                reasons.append(
                    f"Combosquatting: Official brand concatenated with credential-harvesting keyword(s) "
                    f"'{', '.join(matched_keywords[:3])}' in domain '{cand_host}'."
                )
            else:
                variation_types.append("combosquatting_brand_variation")
                reasons.append(
                    f"Combosquatting: Candidate domain '{cand_sld}' embeds brand name '{off_sld}' with additional words."
                )

    is_suspicious = len(variation_types) > 0

    return {
        "is_suspicious_variation": is_suspicious,
        "is_official_match": False,
        "variation_types": list(set(variation_types)),
        "matched_official_domain": matched_domain,
        "similarity": highest_sim,
        "reasons": reasons,
    }


# ============================================================================
# 6. Combined Explainable Impersonation Assessment
# ============================================================================

def evaluate_brand_impersonation(
    candidate_name: Optional[str] = None,
    candidate_domain: Optional[str] = None,
    official_brand_names: Optional[List[str]] = None,
    official_domains: Optional[List[str]] = None,
    context_indicators: Optional[List[str]] = None,
) -> BrandImpersonationResult:
    """
    Main detection pipeline evaluating brand lookalikes and domain variations:
    1. Checks for exact matches to official inventory (Score = 0.0, excluded).
    2. Evaluates brand name similarity using deterministic normalization.
    3. Evaluates domain typosquatting, combosquatting, and deceptive subdomains.
    4. Applies Explainability Rule: Name similarity alone is capped at LOW severity (< 35 pts)
       and never classified as malicious without corroborated threat signals.
    5. Returns explainable score (0 to 100), severity, itemized reasons, and remediation guidance.
    """
    brand_names = [b.strip() for b in (official_brand_names or []) if b and b.strip()]
    domains = [d.strip() for d in (official_domains or []) if d and d.strip()]
    indicators = [i.lower() for i in (context_indicators or [])]

    # 1. Check Domain Variations & Official Matches
    domain_analysis = detect_suspicious_domain_variation(
        candidate_domain=candidate_domain,
        official_domains=domains,
        brand_names=brand_names,
    )

    # 2. Check Name Lookalikes
    name_analysis = detect_lookalike_brand_name(
        candidate_name=candidate_name,
        official_brand_names=brand_names,
    )

    # A. Exact Official Match Handling
    if domain_analysis["is_official_match"] or (name_analysis["is_exact_match"] and not domain_analysis["is_suspicious_variation"]):
        matched_item = domain_analysis["matched_official_domain"] or name_analysis["matched_brand"]
        return BrandImpersonationResult(
            candidate_name=candidate_name,
            candidate_domain=candidate_domain,
            matched_brand=name_analysis["matched_brand"],
            matched_official_domain=domain_analysis["matched_official_domain"],
            name_similarity=name_analysis["similarity"],
            is_name_lookalike=False,
            is_domain_variation=False,
            variation_types=["official_asset_exact_match"],
            is_official_match=True,
            risk_score=0.0,
            severity="LOW",
            reasons=[
                "Official Asset Match: Target matches registered organization inventory.",
                f"Exact match to verified official entity '{matched_item}'. Excluded from suspicious findings.",
            ],
            evidence={
                "is_official_match": True,
                "matched_item": matched_item,
            },
            remediation_guidance="No remediation required. Entity is verified as an official organization asset.",
        )

    # B. Score Calculation with Explainability Guarantees
    score = 0.0
    reasons: List[str] = []
    evidence: Dict[str, Any] = {
        "candidate_name": candidate_name,
        "candidate_domain": candidate_domain,
        "name_similarity": name_analysis["similarity"],
        "domain_similarity": domain_analysis["similarity"],
        "variation_types": domain_analysis["variation_types"],
        "homoglyphs": name_analysis["homoglyphs"],
    }

    sim = name_analysis["similarity"]
    is_domain_suspicious = domain_analysis["is_suspicious_variation"]

    # 1. Base Name Similarity Contribution (Max 20.0 pts)
    if sim >= 0.50:
        name_contrib = round(sim * 20.0, 1)
        score += name_contrib
        reasons.append(
            f"Brand name similarity: {sim:.2f} (+{name_contrib:.1f} pts). "
            "Resembles monitored brand."
        )

    # 2. Domain Variation Contributions
    for v_type in domain_analysis["variation_types"]:
        if v_type == "combosquatting_credential_harvesting":
            score += 35.0
            reasons.append("High-Risk Combosquatting: Domain embeds brand with credential-harvesting keywords (+35.0 pts).")
        elif v_type == "deceptive_subdomain_spoofing":
            score += 35.0
            reasons.append("Deceptive Subdomain Spoofing: Brand name spoofed in subdomain on external hosting (+35.0 pts).")
        elif v_type == "homoglyph_domain_spoofing":
            score += 25.0
            reasons.append("Homoglyph / Punycode visual deception detected in domain (+25.0 pts).")
        elif v_type == "typosquatting":
            score += 25.0
            reasons.append("Domain Typosquatting: Close edit-distance lookalike of official domain (+25.0 pts).")
        elif v_type == "risky_tld_swap":
            score += 20.0
            reasons.append("Brand domain registered on high-abuse top-level domain (TLD) (+20.0 pts).")
        elif v_type == "tld_swap":
            score += 15.0
            reasons.append("Brand domain registered on alternative top-level domain (TLD) (+15.0 pts).")
        elif v_type == "combosquatting_brand_variation":
            score += 15.0
            reasons.append("Brand name combined with additional terms in domain (+15.0 pts).")

    # 3. Contextual Threat Indicators
    if any(ind in indicators for ind in ["active", "active_mx", "active_dns"]):
        score += 15.0
        reasons.append("Active resolving mail/DNS infrastructure detected (+15.0 pts).")
    if "phishing" in indicators:
        score += 15.0
        reasons.append("Corroborated phishing telemetry signal (+15.0 pts).")

    # Critical Guardrail (Requirement 8):
    # Do not classify an asset as malicious based only on name similarity!
    # If NO domain variation and NO external threat indicators exist, cap score strictly at 25.0 (LOW severity).
    if not is_domain_suspicious and not any(ind in indicators for ind in ["active", "active_mx", "active_dns", "phishing", "exposed_secret"]):
        if score > 25.0:
            score = 25.0
        if score > 0.0:
            reasons.append(
                "Notice: Name resemblance alone is not classified as fraudulent without corroborated threat indicators."
            )

    final_score = min(100.0, max(0.0, round(score, 1)))

    # Map to Severity
    if final_score >= 80.0:
        severity = "CRITICAL"
        remediation = "File emergency domain registrar takedown notice and block domain at secure email gateway."
    elif final_score >= 60.0:
        severity = "HIGH"
        remediation = "Issue trademark infringement notice to hosting provider and monitor threat telemetry."
    elif final_score >= 35.0:
        severity = "MEDIUM"
        remediation = "Monitor domain infrastructure for live hosting deployment and credential login clones."
    else:
        severity = "LOW"
        remediation = "Continue passive monitoring; low immediate correlation with fraudulent activity."

    evidence["final_score"] = final_score
    evidence["severity"] = severity

    # If completely unrelated
    if not reasons:
        reasons.append("No suspicious brand resemblance or domain variations detected.")

    return BrandImpersonationResult(
        candidate_name=candidate_name,
        candidate_domain=candidate_domain,
        matched_brand=name_analysis["matched_brand"],
        matched_official_domain=domain_analysis["matched_official_domain"],
        name_similarity=name_analysis["similarity"],
        is_name_lookalike=name_analysis["is_lookalike"],
        is_domain_variation=is_domain_suspicious,
        variation_types=domain_analysis["variation_types"],
        homoglyphs_detected=name_analysis["homoglyphs"],
        is_official_match=False,
        risk_score=final_score,
        severity=severity,
        reasons=reasons,
        evidence=evidence,
        remediation_guidance=remediation,
    )
