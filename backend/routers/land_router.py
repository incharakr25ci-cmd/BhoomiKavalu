"""
Bhoomi Kavalu - Land Management Router
Strict role-based filtering: landowners see only their lands; officers see only their region's lands.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import User, Land, SensorNode, Region
from backend.schemas import (
    LandCreate,
    LandUpdate,
    LandResponse,
    LandDetailResponse,
    SensorNodeResponse,
)

router = APIRouter(prefix="/api/lands", tags=["Lands"])


def _check_land_access(user: User, land: Land) -> None:
    if user.role == "landowner" and land.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this land")
    if user.role == "forest_officer" and user.region_id and land.region_id != user.region_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Land is outside your assigned region")


@router.post("", response_model=LandResponse, status_code=status.HTTP_201_CREATED)
def create_land(
    payload: LandCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    region = db.query(Region).filter(Region.id == payload.region_id).first()
    if not region:
        region = db.query(Region).first()
    land = Land(
        name=payload.name,
        location=payload.location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        area_acres=payload.area_acres,
        owner_id=current_user.id,
        region_id=region.id if region else payload.region_id,
    )
    db.add(land)
    db.commit()
    db.refresh(land)
    return land


@router.get("", response_model=List[LandDetailResponse])
def list_lands(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Land)
    if current_user.role == "landowner":
        query = query.filter(Land.owner_id == current_user.id)
    elif current_user.role == "forest_officer" and current_user.region_id:
        query = query.filter(Land.region_id == current_user.region_id)
    return query.order_by(Land.created_at.desc()).all()


@router.get("/{land_id}", response_model=LandDetailResponse)
def get_land(
    land_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    land = db.query(Land).filter(Land.id == land_id).first()
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    _check_land_access(current_user, land)
    return land


@router.put("/{land_id}", response_model=LandResponse)
def update_land(
    land_id: int,
    payload: LandUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    land = db.query(Land).filter(Land.id == land_id).first()
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    _check_land_access(current_user, land)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(land, field, value)
    db.commit()
    db.refresh(land)
    return land


@router.get("/{land_id}/nodes", response_model=List[SensorNodeResponse])
def get_land_nodes(
    land_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    land = db.query(Land).filter(Land.id == land_id).first()
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    _check_land_access(current_user, land)
    return db.query(SensorNode).filter(SensorNode.land_id == land_id).all()
