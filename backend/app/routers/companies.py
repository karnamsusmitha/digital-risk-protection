from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company
from app.schemas import CompanyCreate, CompanyUpdate, CompanyResponse

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("", response_model=List[CompanyResponse], include_in_schema=False)
@router.get("/", response_model=List[CompanyResponse])
def list_companies(
    name: Optional[str] = Query(None, description="Filter by company name"),
    industry: Optional[str] = Query(None, description="Filter by industry sector"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """List all monitored companies with optional filtering."""
    query = db.query(Company)
    if name:
        query = query.filter(Company.name.ilike(f"%{name}%"))
    if industry:
        query = query.filter(func.lower(Company.industry) == industry.lower())
    return query.offset(skip).limit(limit).all()


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_in: CompanyCreate,
    db: Session = Depends(get_db),
):
    """Register a new company for digital risk monitoring."""
    existing = db.query(Company).filter(Company.name == company_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Company with name '{company_in.name}' already exists.",
        )
    company = Company(**company_in.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found.",
        )
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    company_in: CompanyUpdate,
    db: Session = Depends(get_db),
):
    """Update details for an existing company."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found.",
        )
    update_data = company_in.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != company.name:
        conflict = db.query(Company).filter(Company.name == update_data["name"]).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Another company with name '{update_data['name']}' already exists.",
            )
    for field, value in update_data.items():
        setattr(company, field, value)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
):
    """Delete a company and all related assets, candidates, and findings."""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {company_id} not found.",
        )
    db.delete(company)
    db.commit()
    return None
