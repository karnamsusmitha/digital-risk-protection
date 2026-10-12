import pytest
from app.models import Company, ProtectedAsset, Candidate, RiskFinding


def test_company_asset_candidate_finding_relationships(db_session):
    # 1. Create Company
    company = Company(
        name="Nexus Technologies",
        description="Global cloud infrastructure provider",
    )
    db_session.add(company)
    db_session.commit()
    db_session.refresh(company)

    # 2. Add ProtectedAsset
    asset = ProtectedAsset(
        company_id=company.id,
        asset_type="domain",
        value="nexustech.io",
        platform="web",
    )
    db_session.add(asset)
    db_session.commit()
    db_session.refresh(asset)

    # 3. Add Candidate linked to company and asset
    candidate = Candidate(
        company_id=company.id,
        asset_id=asset.id,
        asset_type="domain",
        value="https://nexustech-auth-portal.com/login",
        platform="web",
        observed_metadata={"dns": "active", "mx": "mail.nexustech-auth-portal.com"},
    )
    db_session.add(candidate)
    db_session.commit()
    db_session.refresh(candidate)

    # 4. Add RiskFinding linked to company, asset, and candidate
    finding = RiskFinding(
        company_id=company.id,
        candidate_id=candidate.id,
        asset_id=asset.id,
        risk_score=90.0,
        severity="critical",
        status="pending",
        reasons=["Lookalike domain harvesting credentials"],
        evidence={"target_url": "https://nexustech-auth-portal.com/login", "registrar": "BadRegistrar"},
    )
    db_session.add(finding)
    db_session.commit()
    db_session.refresh(finding)

    # Verify relationships from Company perspective
    db_session.refresh(company)
    assert len(company.protected_assets) == 1
    assert company.protected_assets[0].id == asset.id
    assert len(company.assets) == 1  # Alias property
    assert len(company.candidates) == 1
    assert company.candidates[0].id == candidate.id
    assert len(company.risk_findings) == 1
    assert company.risk_findings[0].id == finding.id
    assert len(company.findings) == 1  # Alias property

    # Verify relationships from ProtectedAsset perspective
    assert asset.company.id == company.id
    assert len(asset.candidates) == 1
    assert asset.candidates[0].id == candidate.id
    assert len(asset.risk_findings) == 1
    assert asset.risk_findings[0].id == finding.id

    # Verify relationships from Candidate perspective
    assert candidate.company.id == company.id
    assert candidate.protected_asset.id == asset.id
    assert candidate.asset.id == asset.id  # Alias property
    assert len(candidate.risk_findings) == 1
    assert candidate.risk_findings[0].id == finding.id

    # Verify relationships from RiskFinding perspective
    assert finding.company.id == company.id
    assert finding.candidate.id == candidate.id
    assert finding.protected_asset.id == asset.id
    assert finding.asset.id == asset.id  # Alias property


def test_cascade_delete_company_deletes_all_related(db_session):
    # Setup company with child assets, candidates, and findings
    company = Company(name="Cascade Target Corp")
    db_session.add(company)
    db_session.commit()

    asset = ProtectedAsset(company_id=company.id, asset_type="brand_name", value="CascadeTarget")
    db_session.add(asset)
    db_session.commit()

    candidate = Candidate(company_id=company.id, asset_type="brand_name", value="CascadeTarget-fake")
    db_session.add(candidate)
    db_session.commit()

    finding = RiskFinding(
        company_id=company.id,
        candidate_id=candidate.id,
        risk_score=70.0,
        severity="high",
        status="pending",
    )
    db_session.add(finding)
    db_session.commit()

    asset_id = asset.id
    candidate_id = candidate.id
    finding_id = finding.id

    # Delete company
    db_session.delete(company)
    db_session.commit()

    # Verify children are deleted via cascade
    assert db_session.query(ProtectedAsset).filter(ProtectedAsset.id == asset_id).first() is None
    assert db_session.query(Candidate).filter(Candidate.id == candidate_id).first() is None
    assert db_session.query(RiskFinding).filter(RiskFinding.id == finding_id).first() is None


def test_delete_candidate_sets_candidate_id_to_null_on_finding(db_session):
    company = Company(name="Nullify Target Corp")
    db_session.add(company)
    db_session.commit()

    candidate = Candidate(company_id=company.id, asset_type="domain", value="phishing.com")
    db_session.add(candidate)
    db_session.commit()

    finding = RiskFinding(
        company_id=company.id,
        candidate_id=candidate.id,
        risk_score=60.0,
        severity="medium",
        status="pending",
    )
    db_session.add(finding)
    db_session.commit()

    finding_id = finding.id
    candidate_id = candidate.id

    # Delete candidate
    db_session.delete(candidate)
    db_session.commit()

    # Candidate should be deleted
    assert db_session.query(Candidate).filter(Candidate.id == candidate_id).first() is None

    # Finding should still exist, with candidate_id set to None
    refreshed_finding = db_session.query(RiskFinding).filter(RiskFinding.id == finding_id).first()
    assert refreshed_finding is not None
    assert refreshed_finding.candidate_id is None
