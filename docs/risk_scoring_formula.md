# Risk Analysis Engine: Scoring Formula, Weights & Limitations

This document describes the design, mathematical scoring formula, indicator catalog, evidence handling, configurable score bands, and operational limitations of the **Digital Risk Protection Risk-Analysis Engine**.

---

## 1. System Architecture & Design Philosophy

The Risk Analysis Engine is encapsulated in a dedicated, decoupled service: [`RiskScoringService`](file:///c:/Users/user/digital-risk-protection/digital-risk-protection/app/services/risk_scoring.py).

### Core Guarantees:
1. **Decoupled & Reusable**: Completely decoupled from FastAPI HTTP route handlers and database models. The engine can execute in-memory, in batch processing pipelines, background jobs, or through HTTP endpoints.
2. **Deterministic & Explainable**: Every point added to the risk score is tied to an explicit, human-readable indicator with a transparent rationale.
3. **No Phantom Penalties (Missing Evidence Guarantee)**: Missing evidence is **never** treated as proof of malicious activity. If redirect data or external threat intelligence is unconfigured or not provided, zero penalty is applied and the unconfigured state is explicitly reported.
4. **No False Positives on Registered Official Assets**: Registered official domains, URLs, social handles, and app listings are recognized and assigned a score of `0` ("Official Registered Asset Verified"), bypassing all lookalike heuristics.
5. **Name Mention Rule**: A brand name mention alone never results in a fraudulent label or high-risk score without compound anomalous indicators (e.g. deceptive keywords, homoglyphs, or spoofed subdomains).

---

## 2. Mathematical Scoring Formula

The composite risk score $S$ is calculated by summing the weights of all triggered indicators $I$ and clamping the result between $0$ and $100$:

$$S = \min\left(100, \max\left(0, \sum_{i \in I} w_i\right)\right)$$

Where:
- $I$ is the set of active indicators identified for the candidate asset.
- $w_i \in \mathbb{Z}^+$ is the calibrated score contribution of indicator $i$.
- If candidate is an exact verified official asset: $S = 0$, bypassing all indicator evaluation.

---

## 3. Indicator Catalog & Configurable Weights

| Indicator Code | Name | Default Weight ($w_i$) | Default Severity | Description & Trigger Criteria |
| :--- | :--- | :---: | :---: | :--- |
| `OFFICIAL_ASSET_VERIFIED` | Official Registered Asset | `0` | `info` | Candidate matches an officially registered brand domain, URL, social handle, or app listing. |
| `NO_ANOMALOUS_INDICATORS` | Standard Inspection Passed | `0` | `info` | No suspicious typosquatting, homoglyphs, or deceptive indicators detected. |
| `HOMOGLYPH_SUBSTITUTION` | Homoglyph Character Substitution | `35` | `high` | Visual lookalike substitution (e.g. `0` for `o`, `1` for `l`, `vv` for `w`) mimicking brand or official domain stem. |
| `TYPOSQUAT_DISTANCE_1` | High-Confidence Typosquatting | `35` | `high` | Single-character Levenshtein edit distance ($d=1$) from brand name or official domain stem. |
| `TYPOSQUAT_DISTANCE_2` | Potential Lookalike Typosquatting | `20` | `medium` | Two-character Levenshtein edit distance ($d=2$) from brand name or official domain stem. |
| `SUBDOMAIN_SPOOFING` | Subdomain Brand Spoofing | `40` | `critical` | Brand name appears in subdomain prefix while host root is an unrelated third-party domain. |
| `TLD_SWAP_SQUATTING` | TLD Swap Squatting | `20`–`25` | `medium`–`high` | Domain utilizes exact second-level domain (SLD) of official brand domain under an alternative TLD (`25` if abuse-prone TLD, `20` if standard). |
| `DECEPTIVE_SECURITY_KEYWORD` | Deceptive Phishing / Auth Keywords | `15`–`30` | `medium`–`high` | Candidate contains sensitive authentication/credential keywords (`login`, `verify`, `secure`, `banking`, etc.). `15` for 1 keyword, `30` for $\ge 2$ keywords. |
| `SUSPICIOUS_TLD` | Abuse-Prone Top-Level Domain | `20` | `medium` | Domain utilizes a TLD statistically linked with high phishing registration abuse (`.xyz`, `.top`, `.click`, `.live`, etc.). |
| `EXCESSIVE_HYPHENS` | Deceptive Hyphenation Pattern | `15` | `low` | Hostname contains $\ge 2$ hyphens in context with brand or phishing keywords. |
| `SUSPICIOUS_SOCIAL_PROFILE` | Suspicious Brand Profile Modifier | `25` | `high` | Social media profile handle incorporates brand name with high-risk keyword (`support`, `helpdesk`, `giveaway`, `claim`). |
| `SUSPICIOUS_APP_TITLE_MODIFIER` | Suspicious Mobile App Modifier | `35` | `high` | App listing title contains unauthorized third-party modifiers (`crack`, `mod`, `hack`, `generator`, `bonus`). |
| `NAME_MENTION_UNVERIFIED` | Benign Brand Name Mention | `15` | `low` | Candidate contains brand name but exhibits zero deceptive keywords, typosquatting, or homoglyphs. Preliminary observation only. |
| `REDIRECT_URL_MISMATCH` | Suspicious Destination URL Redirect | `35` | `high` | **Supplied Evidence Only**: Candidate redirects to an unverified third-party destination differing from initial host and official domains. |
| `DISPLAYED_URL_MISMATCH` | Displayed vs Destination URL Mismatch | `35` | `high` | **Supplied Evidence Only**: Displayed anchor link text masquerades as official brand while destination points to third party. |
| `EXTERNAL_THREAT_INTEL_MATCH` | Verified Threat Intelligence Match | `40` | `critical` | **Configured Source Only**: Verified external threat intelligence confirms active malicious/phishing listing. |

---

## 4. Configurable Score Bands

The engine maps the composite score $S \in [0, 100]$ to risk categories and standardized analyst actions using configurable bands:

| Score Range | Category | Recommended Next Action | Triage Status |
| :---: | :---: | :--- | :---: |
| **0 – 24** | **Low** | *Monitor asset: low preliminary risk; maintain routine observation.* | `completed` |
| **25 – 49** | **Medium** | *Queue for scheduled review: moderate similarity or isolated indicator detected; monitor for infrastructure changes.* | `completed` |
| **50 – 74** | **High** | *Urgent analyst investigation: high likelihood of deceptive intent; verify asset ownership and gather technical WHOIS/DNS evidence.* | `review_needed` |
| **75 – 100** | **Critical** | *Immediate triage and mitigation: active high-confidence impersonation/phishing indicators; initiate takedown or security blocking.* | `review_needed` |

### Custom Band Configuration Example:
```python
from app.services.risk_scoring import RiskScoringService, ScoreBands

custom_bands = ScoreBands(bands={
    "Low": (0, 19),
    "Medium": (20, 59),
    "High": (60, 79),
    "Critical": (80, 100),
})
service = RiskScoringService(score_bands=custom_bands)
```

---

## 5. Evidence Handling & Strict Non-Invention Policy

In accordance with system requirements:
- **No Inventions**: Reputation scores, threat intelligence hits, and AI predictions are **never** simulated or invented.
- **Evidence Source Reporting**: Every evaluation returns structured metadata detailing:
  - `static_analysis`: `true`
  - `redirect_evidence`: `"supplied"` or `"not_provided"`
  - `external_threat_intel`: Reports whether a provider was configured, source label, status (`"evaluated"` or `"not_configured"`), and notice: *"No external threat intelligence source configured; missing evidence is not treated as proof of malicious activity."*
  - `ai_models`: Reports `"not_configured"` unless teammate AI module is explicitly registered.

---

## 6. Limitations of the Engine

While the rule-based risk scoring engine provides transparent, deterministic, and rapid static evaluation, organizations should be aware of the following technical limitations:

1. **Static Analysis vs. Dynamic Payload Delivery**:
   - The engine parses URLs and domains statically without executing untrusted JavaScript or downloading external binaries.
   - Attackers using dynamic cloaking (e.g. serving benign pages to scanners and phishing payloads to targeted browser User-Agents or geo-locations) cannot be detected without dynamic sandbox rendering.
2. **Homoglyph & Unicode Coverage**:
   - The homoglyph map covers the most common Latin-lookalike visual substitutions (`0/o`, `1/l`, `vv/w`, `rn/m`, `5/s`, `@/a`, `3/e`, `4/a`, `8/b`, `6/g`).
   - Exotic multi-script Internationalized Domain Names (IDN punycode attacks across Cyrillic, Greek, or Cherokee scripts) require extended punycode normalization tables.
3. **Dictionary Word Collisions**:
   - Short brand names (e.g. `Target`, `Apex`, `Apple`, `Box`) naturally appear in common English words and unrelated domain registrations (`boxoffice.com`, `applecider.org`).
   - The engine mitigates this via the **Name Mention Rule** (capping score at `15`, strictly in the Low band), but human analyst review remains essential for short common-word brands.
4. **External Threat Intelligence Latency**:
   - Real-world threat feeds (blocklists, DNSBL, URLScan, VirusTotal) have ingestion latency between 15 minutes and 24 hours. A zero-hour domain registration may not appear in any external threat feed at the moment of scanning.
5. **No Network-Level DNS Resolution**:
   - Safe static parsing deliberately does not issue live DNS lookups or HTTP requests during evaluation to prevent alerting malicious actors through DNS telemetry. Live nameserver and MX record changes should be tracked in scheduled enrichment pipelines.
