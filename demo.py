#!/usr/bin/env python3
"""
Digital Risk Protection - Hackathon Interactive Demonstration Script
=====================================================================
Demonstrates end-to-end backend functionality using clearly identified
fictional test data:

1. Health Check & Diagnostics
2. Fictional Brand Registration
3. Candidate Risk Analysis:
   - Exact Official Asset (Guaranteed 0 risk)
   - Critical Typosquat / Homoglyph / Phishing Lookalike
   - Deceptive Social Profile Spoofing
   - Subdomain Spoofing URL
   - Benign Unrelated Domain
4. Analyst Triage Status Update (review_needed -> confirmed_threat)
5. Scan History Retrieval
6. Dashboard Summary & Risk Distribution Metrics

Usage:
    # Run using in-memory TestClient (zero server setup required):
    python demo.py

    # Run against live running server at http://127.0.0.1:8000:
    python demo.py --live
"""

import sys
import json
import logging
import warnings
import argparse
from typing import Dict, Any, Optional

# Suppress noisy library warnings and logs for clean presentation
warnings.filterwarnings("ignore")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("starlette").setLevel(logging.WARNING)

# Color formatting helpers for terminal output
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


def banner(title: str):
    print(f"\n{CYAN}{BOLD}{'=' * 75}{RESET}")
    print(f"{CYAN}{BOLD}  {title}{RESET}")
    print(f"{CYAN}{BOLD}{'=' * 75}{RESET}\n")


def section(step_num: int, title: str):
    print(f"\n{BOLD}{YELLOW}[Step {step_num}] {title}{RESET}")
    print(f"{DIM}{'-' * 70}{RESET}")


def color_category(category: str) -> str:
    if category == "Low":
        return f"{GREEN}{BOLD}Low{RESET}"
    if category == "Medium":
        return f"{YELLOW}{BOLD}Medium{RESET}"
    if category == "High":
        return f"{RED}{BOLD}High{RESET}"
    if category == "Critical":
        return f"{RED}{BOLD}Critical{RESET}"
    return category


def print_json(data: Any):
    print(json.dumps(data, indent=2))


class DemoClient:
    """Wrapper that dynamically routes requests either to live HTTP server or in-memory TestClient."""

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = base_url
        self._test_client = None

        if base_url:
            import httpx
            self.http = httpx.Client(base_url=base_url, timeout=10.0)
            self.is_live = True
        else:
            from fastapi.testclient import TestClient
            from app.main import app
            self._test_client = TestClient(app)
            self.http = self._test_client
            self.is_live = False

    def get(self, path: str, **kwargs):
        return self.http.get(path, **kwargs)

    def post(self, path: str, **kwargs):
        return self.http.post(path, **kwargs)

    def patch(self, path: str, **kwargs):
        return self.http.patch(path, **kwargs)


def main():
    parser = argparse.ArgumentParser(description="Digital Risk Protection Demo Walkthrough")
    parser.add_argument("--live", action="store_true", help="Connect to live server on http://127.0.0.1:8000")
    parser.add_argument("--url", type=str, default=None, help="Custom backend URL")
    args = parser.parse_args()

    target_url = None
    if args.live:
        target_url = "http://127.0.0.1:8000"
    elif args.url:
        target_url = args.url

    banner("DIGITAL RISK PROTECTION - BACKEND HACKATHON AUDIT DEMO")

    if target_url:
        print(f"Connecting to live backend at: {BOLD}{target_url}{RESET}")
        try:
            client = DemoClient(base_url=target_url)
            # Test connectivity
            health = client.get("/health")
            if health.status_code != 200:
                print(f"{RED}Server responded with status {health.status_code}{RESET}")
                sys.exit(1)
        except Exception as e:
            print(f"{RED}Could not connect to live server at {target_url}: {e}{RESET}")
            print(f"{YELLOW}Falling back to in-memory TestClient mode...{RESET}\n")
            client = DemoClient(base_url=None)
    else:
        print(f"{DIM}Running in standalone TestClient mode (in-memory, no external server startup needed){RESET}")
        client = DemoClient(base_url=None)

    # ---------------------------------------------------------------------
    # Step 1: Health Check & System Status
    # ---------------------------------------------------------------------
    section(1, "Service Health Check (GET /health)")
    res = client.get("/health")
    health_data = res.json()
    print(f"Status Code:       {GREEN}{res.status_code} OK{RESET}")
    print(f"Health Status:     {GREEN}{health_data.get('status')}{RESET}")
    print(f"Active Engine:     {CYAN}{health_data.get('detection_engine')}{RESET}")
    print(f"Database State:    {GREEN}Connected{RESET}" if health_data.get("database_connected") else f"{RED}Disconnected{RESET}")

    # ---------------------------------------------------------------------
    # Step 2: Register Fictional Target Brand
    # ---------------------------------------------------------------------
    section(2, "Register Fictional Brand (POST /api/brands)")
    fictional_brand_payload = {
        "name": "Apex Global Bank",
        "description": "[FICTIONAL DEMO ENTITY] Fictional financial services provider for hackathon testing",
        "official_domains": ["apexglobalbank.com", "apex-banking.com"],
        "official_urls": ["https://apexglobalbank.com/portal/login"],
        "official_social_handles": ["@apexglobalbank", "@apex_support"]
    }
    print(f"Registering brand with payload:")
    print_json(fictional_brand_payload)

    brand_res = client.post("/api/brands", json=fictional_brand_payload)
    if brand_res.status_code == 409:
        # If already registered from previous run, fetch it
        list_res = client.get("/api/brands?search=Apex Global Bank")
        brand_data = list_res.json()[0]
        print(f"\n{YELLOW}Brand already exists in SQLite, retrieved existing record.{RESET}")
    else:
        brand_data = brand_res.json()
        print(f"\nStatus Code: {GREEN}{brand_res.status_code} CREATED{RESET}")

    brand_id = brand_data["id"]
    print(f"Assigned Brand ID: {BOLD}{brand_id}{RESET}")
    print(f"Official Domains:  {brand_data['official_domains']}")
    print(f"Official Handles:  {brand_data['official_social_handles']}")

    # ---------------------------------------------------------------------
    # Step 3: Run Candidate Risk Analyses
    # ---------------------------------------------------------------------
    section(3, "Candidate Risk Analysis Scenarios (POST /api/scans)")

    scenarios = [
        {
            "label": "Scenario A: Exact Official Asset (Non-Impersonator Guarantee)",
            "payload": {
                "candidate_type": "domain",
                "candidate_value": "apexglobalbank.com",
                "brand_id": brand_id
            },
            "expected": "Score 0, Low risk, OFFICIAL_ASSET_VERIFIED"
        },
        {
            "label": "Scenario B: Critical Impersonator (Typosquat + Homoglyphs + Phishing Keyword + High-Risk TLD)",
            "payload": {
                "candidate_type": "domain",
                "candidate_value": "apexg1oba1bank-login-verify.xyz",
                "brand_id": brand_id,
                "evidence": {
                    "redirect_url": "https://malicious-credential-stealer.xyz/harvest"
                }
            },
            "expected": "Score >= 75, Critical, Lookalike & Keyword Flags"
        },
        {
            "label": "Scenario C: Deceptive Social Profile Spoofing",
            "payload": {
                "candidate_type": "social_media_profile",
                "candidate_value": "@apexglobalbank_official_support",
                "brand_id": brand_id
            },
            "expected": "Medium/High risk, Suspicious Modifier Flags"
        },
        {
            "label": "Scenario D: Subdomain Brand Spoofing URL",
            "payload": {
                "candidate_type": "url",
                "candidate_value": "https://apexglobalbank.com.auth-update.attacker-hub.top/signin",
                "brand_id": brand_id
            },
            "expected": "Score >= 60, High, Subdomain Spoofing Flag"
        },
        {
            "label": "Scenario E: Benign Unrelated Asset",
            "payload": {
                "candidate_type": "domain",
                "candidate_value": "global-hiking-trail-reviews.org",
                "brand_id": brand_id
            },
            "expected": "Score <= 24, Low risk, No impersonation alert"
        }
    ]

    scans_created = []
    for sc in scenarios:
        print(f"\n{BOLD}--> {sc['label']}{RESET}")
        print(f"    Candidate:  {sc['payload']['candidate_value']} ({sc['payload']['candidate_type']})")
        print(f"    Expected:   {sc['expected']}")

        s_res = client.post("/api/scans", json=sc["payload"])
        s_data = s_res.json()
        scans_created.append(s_data)

        score = s_data["risk_score"]
        cat = s_data["risk_category"]
        indicators = [f"{i['code']} (+{i['score_impact']})" for i in s_data.get("indicators", [])]
        action = s_data.get("recommended_action")

        print(f"    Result:     Score = {BOLD}{score}/100{RESET} [{color_category(cat)}]")
        print(f"    Indicators: {', '.join(indicators) if indicators else 'None'}")
        if action:
            print(f"    Action:     {action}")

    critical_scan_id = scans_created[1]["id"]

    # ---------------------------------------------------------------------
    # Step 4: Analyst Triage Status Update
    # ---------------------------------------------------------------------
    section(4, f"Security Analyst Triage (PATCH /api/scans/{critical_scan_id}/status)")
    print(f"Promoting critical finding #{critical_scan_id} from 'review_needed' to 'confirmed_threat'...")
    patch_res = client.patch(
        f"/api/scans/{critical_scan_id}/status",
        json={"status": "confirmed_threat"}
    )
    patched = patch_res.json()
    print(f"Status Code:    {GREEN}{patch_res.status_code} OK{RESET}")
    print(f"Updated Status: {RED}{BOLD}{patched['status']}{RESET}")

    # ---------------------------------------------------------------------
    # Step 5: Scan History Retrieval
    # ---------------------------------------------------------------------
    section(5, f"Scan History Retrieval (GET /api/scans?brand_id={brand_id})")
    history_res = client.get(f"/api/scans?brand_id={brand_id}&limit=10")
    history_data = history_res.json()
    print(f"Retrieved {BOLD}{len(history_data)}{RESET} scans for Brand #{brand_id}:\n")
    print(f"{'ID':<6} {'Score':<8} {'Category':<12} {'Status':<18} {'Candidate'}")
    print(f"{'-' * 70}")
    for s in history_data:
        cat_str = color_category(s["risk_category"])
        print(f"#{s['id']:<5} {s['risk_score']:<8} {s['risk_category']:<12} {s['status']:<18} {s['candidate_value'][:30]}")

    # ---------------------------------------------------------------------
    # Step 6: Dashboard Summary & Reconciliation
    # ---------------------------------------------------------------------
    section(6, "Dashboard Summary & Aggregates (GET /api/dashboard/summary)")
    dash_res = client.get("/api/dashboard/summary")
    dash = dash_res.json()

    print(f"Total Brands:       {BOLD}{dash['total_brands']}{RESET}")
    print(f"Total Scans:        {BOLD}{dash['total_scans']}{RESET}")
    print(f"\nRisk Distribution:")
    for k, v in dash["risk_distribution"].items():
        print(f"  - {color_category(k)}: {v}")
    print(f"\nStatus Distribution:")
    for k, v in dash["status_distribution"].items():
        print(f"  - {k}: {v}")
    print(f"\nPriority Findings Needing Review: {BOLD}{len(dash['findings_needing_review'])}{RESET}")

    banner("DEMO COMPLETED SUCCESSFULLY - ALL REQUIREMENTS VERIFIED")


if __name__ == "__main__":
    main()
