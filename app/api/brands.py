from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import Brand
from app.schemas import BrandCreate, BrandUpdate, BrandResponse

router = APIRouter(prefix="/api/brands", tags=["Brands"])


@router.post("", response_model=BrandResponse, status_code=status.HTTP_201_CREATED)
def create_brand(brand_in: BrandCreate, db: Session = Depends(get_db)):
    """
    Register a new company or brand with official domains, URLs, and handles.
    """
    existing = db.query(Brand).filter(Brand.name.ilike(brand_in.name.strip())).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Brand with name '{brand_in.name}' is already registered."
        )

    brand = Brand(
        name=brand_in.name.strip(),
        description=brand_in.description,
        official_domains=[d.strip() for d in brand_in.official_domains if d.strip()],
        official_urls=[u.strip() for u in brand_in.official_urls if u.strip()],
        official_social_handles=[h.strip() for h in brand_in.official_social_handles if h.strip()]
    )
    db.add(brand)
    try:
        db.commit()
        db.refresh(brand)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Brand '{brand_in.name}' already exists."
        )

    return brand


@router.get("", response_model=List[BrandResponse])
def list_brands(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    List all registered brands with optional name filtering and pagination.
    """
    query = db.query(Brand)
    if search:
        query = query.filter(Brand.name.ilike(f"%{search.strip()}%"))
    return query.order_by(Brand.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/{brand_id}", response_model=BrandResponse)
def get_brand(brand_id: int, db: Session = Depends(get_db)):
    """
    Retrieve a registered brand by ID.
    """
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brand with ID {brand_id} not found."
        )
    return brand


@router.put("/{brand_id}", response_model=BrandResponse)
def update_brand(brand_id: int, brand_in: BrandUpdate, db: Session = Depends(get_db)):
    """
    Update an existing brand's metadata or official assets.
    """
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brand with ID {brand_id} not found."
        )

    if brand_in.name is not None:
        new_name = brand_in.name.strip()
        # Ensure new name doesn't collide with another brand
        duplicate = db.query(Brand).filter(Brand.name.ilike(new_name), Brand.id != brand_id).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Another brand with name '{new_name}' already exists."
            )
        brand.name = new_name

    if brand_in.description is not None:
        brand.description = brand_in.description

    if brand_in.official_domains is not None:
        brand.official_domains = [d.strip() for d in brand_in.official_domains if d.strip()]

    if brand_in.official_urls is not None:
        brand.official_urls = [u.strip() for u in brand_in.official_urls if u.strip()]

    if brand_in.official_social_handles is not None:
        brand.official_social_handles = [h.strip() for h in brand_in.official_social_handles if h.strip()]

    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand(brand_id: int, db: Session = Depends(get_db)):
    """
    Delete a registered brand.
    """
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Brand with ID {brand_id} not found."
        )

    db.delete(brand)
    db.commit()
    return None
