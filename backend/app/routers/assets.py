from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Company, ProtectedAsset, Asset
from app.schemas import (
    AssetCreate,
    AssetUpdate,
    AssetResponse,
    ProtectedAssetCreate,
    ProtectedAssetUpdate,
    ProtectedAssetResponse,
)

router = APIRouter(prefix="/assets", tags=["Assets"])


@router.get("", response_model=List[ProtectedAssetResponse], include_in_schema=False)
@router.get("/", response_model=List[ProtectedAssetResponse])
def list_assets(
    company_id: Optional[int] = Query(None, description="Filter assets by company ID"),
    asset_type: Optional[str] = Query(None, description="Filter by asset type"),
    criticality: Optional[str] = Query(None, description="Filter by criticality"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """List monitored assets with optional filters."""
    query = db.query(ProtectedAsset)
    if company_id is not None:
        query = query.filter(ProtectedAsset.company_id == company_id)
    if asset_type:
        query = query.filter(func.lower(ProtectedAsset.asset_type) == asset_type.lower())
    if criticality:
        query = query.filter(func.upper(ProtectedAsset.criticality) == criticality.upper())
    return query.offset(skip).limit(limit).all()


@router.post("", response_model=ProtectedAssetResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=ProtectedAssetResponse, status_code=status.HTTP_201_CREATED)
def create_asset(
    asset_in: ProtectedAssetCreate,
    db: Session = Depends(get_db),
):
    """Add a new digital asset to monitor for a company."""
    company = db.query(Company).filter(Company.id == asset_in.company_id).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Company with ID {asset_in.company_id} does not exist.",
        )
    asset_data = asset_in.model_dump()
    asset_data["asset_type"] = asset_data["asset_type"].lower()
    if "criticality" in asset_data and asset_data["criticality"]:
        asset_data["criticality"] = asset_data["criticality"].upper()
    asset = ProtectedAsset(**asset_data)
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=ProtectedAssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific asset."""
    asset = db.query(ProtectedAsset).filter(ProtectedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {asset_id} not found.",
        )
    return asset


@router.put("/{asset_id}", response_model=ProtectedAssetResponse)
def update_asset(
    asset_id: int,
    asset_in: ProtectedAssetUpdate,
    db: Session = Depends(get_db),
):
    """Update details of an asset."""
    asset = db.query(ProtectedAsset).filter(ProtectedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {asset_id} not found.",
        )
    update_data = asset_in.model_dump(exclude_unset=True)
    if "asset_type" in update_data and update_data["asset_type"]:
        update_data["asset_type"] = update_data["asset_type"].lower()
    if "criticality" in update_data and update_data["criticality"]:
        update_data["criticality"] = update_data["criticality"].upper()
    for field, value in update_data.items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Delete an asset."""
    asset = db.query(ProtectedAsset).filter(ProtectedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Asset with ID {asset_id} not found.",
        )
    db.delete(asset)
    db.commit()
    return None
