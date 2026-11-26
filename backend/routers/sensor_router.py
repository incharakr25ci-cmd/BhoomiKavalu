"""
Bhoomi Kavalu - Sensor Node Router
Manages IoT sensor nodes with role-based access enforcement.
"""

from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import User, Land, SensorNode, CameraDetection, AudioDetection, VibrationReading
from backend.schemas import SensorNodeCreate, SensorNodeUpdate, SensorNodeResponse

router = APIRouter(prefix="/api/nodes", tags=["Sensor Nodes"])


def _get_accessible_node(db: Session, node_id: int, user: User) -> SensorNode:
    node = db.query(SensorNode).filter(SensorNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Sensor node not found")
    land = db.query(Land).filter(Land.id == node.land_id).first()
    if not land:
        raise HTTPException(status_code=404, detail="Associated land not found")
    if user.role == "landowner" and land.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this node")
    if user.role == "forest_officer" and user.region_id and land.region_id != user.region_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Node outside your region")
    return node


@router.post("", response_model=SensorNodeResponse, status_code=status.HTTP_201_CREATED)
def create_node(
    payload: SensorNodeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    land = db.query(Land).filter(Land.id == payload.land_id).first()
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    if current_user.role == "landowner" and land.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot add node to another owner's land")
    if db.query(SensorNode).filter(SensorNode.node_id == payload.node_id).first():
        raise HTTPException(status_code=400, detail="Node ID already exists")

    node = SensorNode(
        node_id=payload.node_id,
        land_id=payload.land_id,
        node_type=payload.node_type,
        status="active",
        latitude=payload.latitude,
        longitude=payload.longitude,
        last_heartbeat=datetime.utcnow(),
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


@router.get("", response_model=List[SensorNodeResponse])
def list_nodes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(SensorNode).join(Land, SensorNode.land_id == Land.id)
    if current_user.role == "landowner":
        query = query.filter(Land.owner_id == current_user.id)
    elif current_user.role == "forest_officer" and current_user.region_id:
        query = query.filter(Land.region_id == current_user.region_id)
    return query.all()


@router.get("/{node_id}", response_model=SensorNodeResponse)
def get_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_accessible_node(db, node_id, current_user)


@router.put("/{node_id}/status", response_model=SensorNodeResponse)
def update_node_status(
    node_id: int,
    payload: SensorNodeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    node = _get_accessible_node(db, node_id, current_user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    node.last_heartbeat = datetime.utcnow()
    db.commit()
    db.refresh(node)
    return node


@router.get("/{node_id}/readings")
def get_node_readings(
    node_id: int,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    node = _get_accessible_node(db, node_id, current_user)
    cameras = (
        db.query(CameraDetection)
        .filter(CameraDetection.node_id == node.id)
        .order_by(CameraDetection.detected_at.desc())
        .limit(limit)
        .all()
    )
    audios = (
        db.query(AudioDetection)
        .filter(AudioDetection.node_id == node.id)
        .order_by(AudioDetection.detected_at.desc())
        .limit(limit)
        .all()
    )
    vibrations = (
        db.query(VibrationReading)
        .filter(VibrationReading.node_id == node.id)
        .order_by(VibrationReading.detected_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "node_id": node.node_id,
        "camera_detections": cameras,
        "audio_detections": audios,
        "vibration_readings": vibrations,
    }
