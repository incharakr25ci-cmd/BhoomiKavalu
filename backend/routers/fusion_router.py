"""
Bhoomi Kavalu - Sensor Fusion Router
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import FusedDetection, Land, SensorNode, User
from backend.schemas import FusedDetectionResponse, FusionRequest
from backend.services.sensor_fusion import run_node_fusion

router = APIRouter(prefix="/api/fusion", tags=["Sensor Fusion"])


def _accessible_node_ids(db: Session, user: User) -> List[int]:
    q = db.query(SensorNode).join(Land, SensorNode.land_id == Land.id)
    if user.role == "landowner":
        q = q.filter(Land.owner_id == user.id)
    elif user.role == "forest_officer" and user.region_id:
        q = q.filter(Land.region_id == user.region_id)
    return [n.id for n in q.all()]


@router.post("/analyze", response_model=FusedDetectionResponse)
def analyze_fusion(
    payload: FusionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = _accessible_node_ids(db, current_user)
    if payload.node_id not in allowed:
        raise HTTPException(status_code=403, detail="Access denied to this sensor node")
    return run_node_fusion(db, payload.node_id, payload.time_window_seconds)


@router.get("/latest", response_model=FusedDetectionResponse)
def get_latest_fusion(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = _accessible_node_ids(db, current_user)
    if not allowed:
        raise HTTPException(status_code=404, detail="No accessible sensor nodes")
    latest = (
        db.query(FusedDetection)
        .filter(FusedDetection.node_id.in_(allowed))
        .order_by(FusedDetection.detected_at.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No fused detections yet")
    return latest


@router.get("/history", response_model=List[FusedDetectionResponse])
def get_fusion_history(
    limit: int = 25,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed = _accessible_node_ids(db, current_user)
    if not allowed:
        return []
    return (
        db.query(FusedDetection)
        .filter(FusedDetection.node_id.in_(allowed))
        .order_by(FusedDetection.detected_at.desc())
        .limit(limit)
        .all()
    )
