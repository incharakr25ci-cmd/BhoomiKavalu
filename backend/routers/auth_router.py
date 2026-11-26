"""
Bhoomi Kavalu - Authentication Router
Handles login, landowner registration (including initial land), and profile endpoints.
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_role,
)
from backend.database import get_db
from backend.models import User, Land, Region, SensorNode
from backend.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    Token,
    RegionResponse,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LandownerRegisterRequest(BaseModel):
    full_name: str
    email: str
    phone: str
    password: str
    land_name: str
    land_location: str
    land_area: float = 5.0
    latitude: float = 12.0124
    longitude: float = 76.2712
    region: str = "Nagarhole-Bandipur Corridor"


@router.get("/regions", response_model=List[RegionResponse])
def list_regions(db: Session = Depends(get_db)):
    return db.query(Region).all()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_landowner(payload: LandownerRegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    region = db.query(Region).filter(Region.name.ilike(f"%{payload.region}%")).first()
    if not region:
        region = db.query(Region).first()
    if not region:
        region = Region(name=payload.region, description="Auto-created region")
        db.add(region)
        db.flush()

    user = User(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role="landowner",
        region_id=region.id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    land = Land(
        name=payload.land_name,
        location=payload.land_location,
        latitude=payload.latitude,
        longitude=payload.longitude,
        area_acres=payload.land_area,
        owner_id=user.id,
        region_id=region.id,
    )
    db.add(land)
    db.flush()

    node_count = db.query(SensorNode).count() + 1
    default_node = SensorNode(
        node_id=f"NODE_{node_count:03d}",
        land_id=land.id,
        node_type="multi",
        status="active",
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(default_node)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/register-officer", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_officer(
    payload: UserCreate,
    current_user: User = Depends(require_role("forest_officer")),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        phone=payload.phone,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role="forest_officer",
        region_id=payload.region_id or current_user.region_id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
